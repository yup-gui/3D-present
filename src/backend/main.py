import asyncio
import json
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from asyncua import Client
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


BASE_DIR = Path(__file__).resolve().parent

# 读取 backend/.env
load_dotenv(BASE_DIR / ".env")

LOG_DIR = BASE_DIR / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "twin-backend.log"

LOG_LEVEL = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        RotatingFileHandler(
            LOG_FILE,
            maxBytes=5 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        ),
    ],
    force=True,
)
logger = logging.getLogger("twin-backend")
logger.info("Backend logging initialized: %s", LOG_FILE)


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_str(name: str, default: str = "") -> str:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip()


# PLC中各个变量的NodeId映射，key是前端和广播中使用的名称，value是实际OPC UA中的NodeId，需要根据实际PLC的地址进行调整
DEFAULT_NODE_MAP: dict[str, dict[str, str]] = {
    "positioningPin": {
        "zRotationDeg": "ns=4;i=441",  # 右侧定位销的Z轴旋转角度，单位度
        "xMove": "ns=4;i=440", # 右侧定位销的X轴移动距离，单位毫米
        "zMove": "ns=4;i=474", # 右侧定位销的Z轴移动距离，布尔值
        "rightPinZMove": "ns=4;i=463", # 右侧定位销的Z轴移动距离，布尔值
    },
    "leftPositioningPin": {
        "zRotationDeg": "ns=4;i=437", # 左侧定位销的Z轴旋转角度，单位度
        "xMove": "ns=4;i=436", # 左侧定位销的X轴移动距离，单位毫米
        "zMove": "ns=4;i=474", # 左侧定位销的Z轴移动距离，布尔值
        "leftPinZMove": "ns=4;i=463", # 左侧定位销的Z轴移动距离，布尔值（专门针对左侧定位销的Z轴移动）
    },
    "gripper": {
        "yMove": "ns=4;i=419",  #gripper1的纵向移动距离，单位毫米
        "zMove": "ns=4;i=418", #gripper1的横向移动距离，单位毫米
        "catchRotateXDeg": "ns=4;i=485", #gripper1的夹取旋转角度，布尔值
    },
    "gripper2": {
        "yMove": "ns=4;i=423", #gripper2的纵向移动距离，单位毫米
        "zMove": "ns=4;i=422", #gripper2的横向移动距离，单位毫米
        "catchRotateXDeg": "ns=4;i=485", #gripper2的夹取旋转角度，布尔值
    },
    "gripper3": {
        "yMove": "ns=4;i=427", #gripper3的纵向移动距离，单位毫米
        "zMove": "ns=4;i=426", #gripper3的横向移动距离，单位毫米
        "catchRotateXDeg": "ns=4;i=485", #gripper3的夹取旋转角度，布尔值
    },
    "gripper4": {
        "xMove": "ns=4;i=431", #gripper4的横向移动距离，单位毫米
        "zMove": "ns=4;i=430", #gripper4的纵向移动距离，单位毫米
        "catchRotateYDeg": "ns=4;i=485", #gripper4的夹取旋转角度，布尔值
    },
    "attachment": {
        "doorAttached": _env_str("OPCUA_NODE_DOOR_ATTACHED"),
    },
    "axis1": {
        "yRotatingDeg": _env_str("OPCUA_NODE_AXIS1_Y_ROTATING_DEG"),
    },
    "axis2": {
        "zRotatingDeg": _env_str("OPCUA_NODE_AXIS2_Z_ROTATING_DEG"),
    },
    "axis3": {
        "zRotatingDeg": _env_str("OPCUA_NODE_AXIS3_Z_ROTATING_DEG"),
    },
    "axis4": {
        "xRotatingDeg": _env_str("OPCUA_NODE_AXIS4_X_ROTATING_DEG"),
    },
    "axis5": {
        "zRotatingDeg": _env_str("OPCUA_NODE_AXIS5_Z_ROTATING_DEG"),
    },
    "axis6": {
        "xRotatingDeg": _env_str("OPCUA_NODE_AXIS6_X_ROTATING_DEG"),
    },
}


class TwinBridge:
    # 管理WebSocket客户端和OPC UA连接的桥梁
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.running = False
        self.worker_task: asyncio.Task | None = None
        self.lock = asyncio.Lock()
        # 这里需要写实际PLC的网络地址（局域网）
        self.opc_endpoint = os.getenv("OPCUA_ENDPOINT", "opc.tcp://127.0.0.1:4840")
        self.poll_interval = _env_float("OPCUA_POLL_INTERVAL", 0.1)
        self.retry_interval = _env_float("OPCUA_RETRY_INTERVAL", 1.0)
        self.mock_mode = _env_bool("OPCUA_MOCK_MODE", False)

    async def add_client(self, ws: WebSocket) -> None:
        self.clients.add(ws)
        await self._send(
            ws,
            {
                "type": "status",
                "running": self.running,
                "mockMode": self.mock_mode,
            },
        )

    async def remove_client(self, ws: WebSocket) -> None:
        self.clients.discard(ws)
        if not self.clients:
            await self.stop()

    async def start(self) -> None:
        async with self.lock:
            if self.running:
                return
            self.running = True
            self.worker_task = asyncio.create_task(self._worker())
        await self.broadcast(
            {"type": "status", "running": True, "mockMode": self.mock_mode}
        )

    async def stop(self) -> None:
        async with self.lock:
            if not self.running:
                return
            self.running = False
            task = self.worker_task
            self.worker_task = None

        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        await self.broadcast(
            {"type": "status", "running": False, "mockMode": self.mock_mode}
        )

    async def broadcast(self, payload: dict[str, Any]) -> None:
        if not self.clients:
            return

        dead_clients: list[WebSocket] = []
        raw = json.dumps(payload)
        for client in self.clients:
            try:
                await client.send_text(raw)
            except Exception:
                dead_clients.append(client)

        for dead in dead_clients:
            self.clients.discard(dead)

    async def _send(self, ws: WebSocket, payload: dict[str, Any]) -> None:
        await ws.send_text(json.dumps(payload))

    async def _worker(self) -> None:
        if self.mock_mode:
            await self._mock_worker()
            return

        while self.running:
            # 使用NONE安全连接创建OPC UA服务器，避免证书和安全策略问题
            client = Client(self.opc_endpoint)
            # 使用安全策略模式连接OPC UA服务器，适用于生产环境，但需要正确配置证书和安全策略
            # client.set_security_string("Basic256Sha256,SignAndEncrypt,certificate.der,private_key.pem")
            try:
                await client.connect()
                logger.info("连接到OPC UA服务器: %s", self.opc_endpoint)

                await self._opc_loop(client)

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception("OPC UA worker error: %s", exc)
                await self.broadcast(
                    {"type": "error", "message": f"OPC UA连接异常: {exc}"}
                )
                await asyncio.sleep(self.retry_interval)
            finally:
                try:
                    await client.disconnect()
                except Exception:
                    pass

    async def _opc_loop(self, client: Client) -> None:
        while self.running:
            snapshot = await self._read_snapshot(client)
            await self.broadcast({"type": "snapshot", "data": snapshot})
            await asyncio.sleep(self.poll_interval)

    async def _read_snapshot(self, client: Client) -> dict[str, dict[str, float]]:
        snapshot: dict[str, dict[str, float]] = {}

        for group_name, fields in DEFAULT_NODE_MAP.items():
            snapshot[group_name] = {}
            for field_name, node_id in fields.items():
                if not node_id:
                    snapshot[group_name][field_name] = (
                        False if group_name == "attachment" else 0.0
                    )
                    continue
                try:
                    node = client.get_node(node_id)
                    value = await node.read_value()
                    if group_name == "attachment":
                        snapshot[group_name][field_name] = bool(value)
                    else:
                        snapshot[group_name][field_name] = float(value)
                except Exception:
                    snapshot[group_name][field_name] = (
                        False if group_name == "attachment" else 0.0
                    )

        return snapshot
# # 模拟数据生成器，用于开发和测试阶段，当PLC不可用时提供动态变化的数据
#     async def _mock_worker(self) -> None:
#         tick = 0.0
#         while self.running:
#             tick += 0.1
#             snapshot = {
#                 "positioningPin": {
#                     "zRotationDeg": 10.0,
#                     "xMove": 10.0 + 5.0 * tick,
#                     "zMove": 30.0,
#                     "rightPinZMove": 15.0,
#                 },
#                 "leftPositioningPin": {
#                     "zRotationDeg": -10.0,
#                     "xMove": -10.0,
#                     "zMove": 30.0,
#                     "leftPinZMove": 15.0,
#                 },
#                 "gripper": {
#                     "yMove": 5.0,
#                     "zMove": 15.0,
#                     "catchRotateXDeg": 5.0,
#                 },
#                 "gripper2": {
#                     "yMove": 5.0,
#                     "zMove": 15.0,
#                     "catchRotateXDeg": 5.0,
#                 },
#                 "gripper3": {
#                     "yMove": 5.0,
#                     "zMove": 15.0,
#                     "catchRotateXDeg": 5.0,
#                 },
#                 "gripper4": {
#                     "xMove": 5.0,
#                     "zMove": 5.0,
#                     "catchRotateYDeg": 3.0,
#                 },
#             }
#             await self.broadcast({"type": "snapshot", "data": snapshot})
#             await asyncio.sleep(self.poll_interval)


twin_bridge = TwinBridge()

app = FastAPI(title="Digital Twin Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "running": twin_bridge.running,
        "mockMode": twin_bridge.mock_mode,
        "clientCount": len(twin_bridge.clients),
    }


@app.websocket("/ws/twin")
async def twin_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    await twin_bridge.add_client(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

            if msg_type == "start_twin":
                await twin_bridge.start()
            elif msg_type == "stop_twin":
                await twin_bridge.stop()
            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        await twin_bridge.remove_client(websocket)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
