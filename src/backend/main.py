import asyncio
import json
import logging
import os
from typing import Any

from asyncua import Client
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("twin-backend")


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


DEFAULT_NODE_MAP: dict[str, dict[str, str]] = {
    "positioningPin": {
        "zRotationDeg": "ns=2;s=DT.PositioningPin.Right.ZRotationDeg",
        "xMove": "ns=2;s=DT.PositioningPin.Right.XMoveMm",
        "zMove": "ns=2;s=DT.PositioningPin.Right.ZMoveMm",
        "rightPinZMove": "ns=2;s=DT.PositioningPin.Right.RightPinZMoveMm",
    },
    "leftPositioningPin": {
        "zRotationDeg": "ns=2;s=DT.PositioningPin.Left.ZRotationDeg",
        "xMove": "ns=2;s=DT.PositioningPin.Left.XMoveMm",
        "zMove": "ns=2;s=DT.PositioningPin.Left.ZMoveMm",
        "leftPinZMove": "ns=2;s=DT.PositioningPin.Left.LeftPinZMoveMm",
    },
    "gripper": {
        "yMove": "ns=2;s=DT.Gripper1.YMoveMm",
        "zMove": "ns=2;s=DT.Gripper1.ZMoveMm",
        "catchRotateXDeg": "ns=2;s=DT.Gripper1.CatchRotateXDeg",
    },
    "gripper2": {
        "yMove": "ns=2;s=DT.Gripper2.YMoveMm",
        "zMove": "ns=2;s=DT.Gripper2.ZMoveMm",
        "catchRotateXDeg": "ns=2;s=DT.Gripper2.CatchRotateXDeg",
    },
    "gripper3": {
        "yMove": "ns=2;s=DT.Gripper3.YMoveMm",
        "zMove": "ns=2;s=DT.Gripper3.ZMoveMm",
        "catchRotateXDeg": "ns=2;s=DT.Gripper3.CatchRotateXDeg",
    },
    "gripper4": {
        "xMove": "ns=2;s=DT.Gripper4.XMoveMm",
        "yMove": "ns=2;s=DT.Gripper4.YMoveMm",
        "catchRotateZDeg": "ns=2;s=DT.Gripper4.CatchRotateZDeg",
    },
}


class TwinBridge:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.running = False
        self.worker_task: asyncio.Task | None = None
        self.lock = asyncio.Lock()
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
            client = Client(self.opc_endpoint)
            try:
                await client.connect()
                logger.info("Connected OPC UA: %s", self.opc_endpoint)
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
                try:
                    node = client.get_node(node_id)
                    value = await node.read_value()
                    snapshot[group_name][field_name] = float(value)
                except Exception:
                    snapshot[group_name][field_name] = 0.0

        return snapshot

    async def _mock_worker(self) -> None:
        tick = 0.0
        while self.running:
            tick += 0.1
            snapshot = {
                "positioningPin": {
                    "zRotationDeg": 10.0,
                    "xMove": 10.0 + 5.0 * tick,
                    "zMove": 30.0,
                    "rightPinZMove": 15.0,
                },
                "leftPositioningPin": {
                    "zRotationDeg": -10.0,
                    "xMove": -10.0,
                    "zMove": 30.0,
                    "leftPinZMove": 15.0,
                },
                "gripper": {
                    "yMove": 5.0,
                    "zMove": 15.0,
                    "catchRotateXDeg": 5.0,
                },
                "gripper2": {
                    "yMove": 5.0,
                    "zMove": 15.0,
                    "catchRotateXDeg": 5.0,
                },
                "gripper3": {
                    "yMove": 5.0,
                    "zMove": 15.0,
                    "catchRotateXDeg": 5.0,
                },
                "gripper4": {
                    "xMove": 5.0,
                    "yMove": 5.0,
                    "catchRotateZDeg": 3.0,
                },
            }
            await self.broadcast({"type": "snapshot", "data": snapshot})
            await asyncio.sleep(self.poll_interval)


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
