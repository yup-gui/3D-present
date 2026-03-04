<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import { TresCanvas } from "@tresjs/core";
import { useGraph, useLoader } from "@tresjs/core";
import { OrbitControls } from "@tresjs/cientos";
import OutlineEffect from "./OutlineEffect.vue";
import ModelSync from "./ModelSync.vue";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useHandleStore } from "@/stores/handle";

const handleStore = useHandleStore();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
);

const { state: model } = useLoader<GLTF>(
  GLTFLoader,
  "/models/总装_第一版0304.glb",
  {
    extensions: (loader) => {
      if (loader instanceof GLTFLoader) {
        loader.setDRACOLoader(dracoLoader);
      }
    },
  },
);

const scene = computed(() => model.value?.scene);
const graph = useGraph(scene);
const nodes = computed(() => graph.value?.nodes ?? {});
const twinRunning = shallowRef(false);
const twinConnected = shallowRef(false);
const twinError = shallowRef("");
const wsClient = shallowRef<WebSocket | null>(null);

const twinWsUrl =
  import.meta.env.VITE_TWIN_WS_URL ?? "ws://127.0.0.1:8000/ws/twin";

const sendTwinCommand = (command: "start_twin" | "stop_twin") => {
  wsClient.value?.send(JSON.stringify({ type: command }));
};

const connectTwin = () => {
  if (wsClient.value) return;

  const ws = new WebSocket(twinWsUrl);
  wsClient.value = ws;

  ws.onopen = () => {
    twinConnected.value = true;
    twinError.value = "";
    sendTwinCommand("start_twin");
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "snapshot") {
        handleStore.applyTwinSnapshot(payload.data ?? {});
      }
      if (payload.type === "status") {
        twinRunning.value = Boolean(payload.running);
      }
      if (payload.type === "error") {
        twinError.value = String(payload.message ?? "孪生通道错误");
      }
    } catch {
      twinError.value = "孪生消息解析失败";
    }
  };

  ws.onerror = () => {
    twinError.value = "孪生连接失败";
  };

  ws.onclose = () => {
    twinConnected.value = false;
    twinRunning.value = false;
    wsClient.value = null;
  };
};

const disconnectTwin = () => {
  if (wsClient.value?.readyState === WebSocket.OPEN) {
    sendTwinCommand("stop_twin");
  }
  wsClient.value?.close();
};

const toggleTwin = () => {
  if (twinRunning.value || twinConnected.value) {
    disconnectTwin();
    return;
  }
  connectTwin();
};

onBeforeUnmount(() => {
  disconnectTwin();
});

watch(
  model,
  (gltf) => {
    if (gltf?.scene) {
      onModelLoad(gltf);
    }
  },
  { immediate: true },
);

// 存储被选中的对象的数组
const selectedObjects = shallowRef<THREE.Mesh[]>([]);
// 当模型被点击时触发
const onClickModel = (intersection: any) => {
  // 阻止事件穿透
  intersection.stopPropagation?.();

  const object = intersection.object;
  if (selectedObjects.value[0] === object) return;

  // 设置高亮
  selectedObjects.value = [object];
};

// 点击背景清除选中状态
const clearSelection = () => {
  selectedObjects.value = [];
};

// **新增：模型加载完成时的回调，用于打印结构**
const onModelLoad = (gltf: any) => {
  console.log("=== 模型加载完成 ===");
  // 1. 初始化 Pinia Store
  handleStore.initFromScene(gltf.scene);
  handleStore.bindControlTargets(gltf.scene);
};
</script>

<template>
  <div class="scene-body">
    <div class="scene-container">
      <!-- 背景颜色调整为类似 Blender 默认深灰色 #2b2b2b -->
      <TresCanvas
        clear-color="#2b2b2b"
        window-size
        @pointermissed="clearSelection"
      >
        <!-- 透视相机：调整至经典的斜45度等大视角位置 -->
        <TresPerspectiveCamera
          make-default
          :position="[5, 4, 6]"
          :look-at="[0, 0, 0]"
          :fov="45"
        />

        <!-- 轨道控制器：可调整阻尼，手感更像工业软件 -->
        <OrbitControls
          make-default
          :enable-damping="true"
          :damping-factor="0.05"
        />

        <!-- === 灯光组：降低强度，回归沉稳工业风 === -->
        <!-- 环境光：提供基础亮度，稍微调暗防止过曝 -->
        <TresAmbientLight :intensity="0.8" />

        <!-- 半球光：保留天光和地反光，调低亮度 -->
        <TresHemisphereLight
          sky-color="#ffffff"
          ground-color="#444444"
          :intensity="0.8"
        />

        <!-- 主平行光：打出微弱侧面光影增加立体感 -->
        <TresDirectionalLight
          :position="[10, 10, 5]"
          :intensity="0.6"
          cast-shadow
        />

        <!-- === 场景辅助器具 === -->
        <!-- 场地网格：典型的 3D 软件元素 -->
        <TresGridHelper :args="[20, 20, '#444444', '#333333']" />
        <!-- 坐标轴指示器：红绿蓝三轴 -->
        <TresAxesHelper :args="[2]" />

        <!-- 加入自行封装的 Outline 后期处理组合器 -->
        <OutlineEffect :selected-objects="selectedObjects" />

        <!-- 加入模型位置同步控制器 -->
        <ModelSync />

        <!-- Suspense 使用完整结构，可处理加载状态 -->
        <Suspense>
          <!-- 加载成功的展示区：将模型沿 X 轴旋转 90 度 (Math.PI / 2 弧度) -->
          <template #default>
            <primitive
              v-if="nodes.Scene"
              :object="nodes.Scene"
              @click="onClickModel"
            />
            <primitive
              v-else-if="scene"
              :object="scene"
              @click="onClickModel"
            />
          </template>
          <!-- 这里你可以放一个 HTML 的 Loading 动画，目前模型较小可留空 -->
          <template #fallback>
            <TresMesh>
              <!-- 占位符：加载中时在原地显示一个小方块以防画面全空 -->
              <TresBoxGeometry :args="[0.5, 0.5, 0.5]" />
              <TresMeshBasicMaterial color="#ff0000" wireframe />
            </TresMesh>
          </template>
        </Suspense>
      </TresCanvas>
    </div>
    <div class="side-bar">
      <h3 class="panel-title">控制面板</h3>

      <div class="twin-row">
        <button class="twin-button" @click="toggleTwin">
          {{ twinRunning ? "停止孪生" : "开始孪生" }}
        </button>
        <span class="twin-state" :class="{ active: twinRunning }">
          {{ twinRunning ? "同步中" : twinConnected ? "已连接" : "未连接" }}
        </span>
      </div>
      <p v-if="twinError" class="twin-error">{{ twinError }}</p>

      <div class="control-group">
        <h4 class="group-title">定位销</h4>

        <div class="input-row">
          <span>Z旋转(°)</span>
          <input
            type="number"
            step="1"
            v-model.number="
              handleStore.controlValues.positioningPin.zRotationDeg
            "
          />
        </div>

        <div class="input-row">
          <span>X位移(mm)</span>
          <input
            type="number"
            step="1"
            v-model.number="handleStore.controlValues.positioningPin.xMove"
          />
        </div>

        <div class="input-row">
          <span>Z位移(mm)</span>
          <input
            type="number"
            step="1"
            v-model.number="handleStore.controlValues.positioningPin.zMove"
          />
        </div>

        <div class="input-row">
          <span>rightPin Z(mm)</span>
          <input
            type="number"
            step="1"
            v-model.number="
              handleStore.controlValues.positioningPin.rightPinZMove
            "
          />
        </div>
      </div>

      <div class="control-group">
        <h4 class="group-title">夹爪</h4>

        <div class="input-row">
          <span>Y位移(mm)</span>
          <input
            type="number"
            step="1"
            v-model.number="handleStore.controlValues.gripper.yMove"
          />
        </div>

        <div class="input-row">
          <span>Z位移(mm)</span>
          <input
            type="number"
            step="1"
            v-model.number="handleStore.controlValues.gripper.zMove"
          />
        </div>

        <div class="input-row">
          <span>X旋转(°)</span>
          <input
            type="number"
            step="1"
            v-model.number="handleStore.controlValues.gripper.catchRotateXDeg"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-container {
  width: 80vw;
  height: 100vh;
  overflow: hidden;
  background-color: #2b2b2b; /* 与 Canvas 色调统一 */
}
.scene-body {
  display: flex;
  flex-direction: row;
}

.side-bar {
  z-index: 1;
  width: 20vw;
  height: 100vh;
  background-color: #1e1e1e; /* 深色侧边栏，突出主体 */
  color: #fff;
  padding: 10px;
  box-sizing: border-box;
}

.panel-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.2em;
  border-bottom: 2px solid #555;
  padding-bottom: 10px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 24px;
}

.group-title {
  margin: 0;
  font-size: 1em;
  color: #ddd;
}

.twin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.twin-button {
  border: 1px solid #666;
  background: #2f2f2f;
  color: #fff;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.twin-state {
  font-size: 0.85em;
  color: #999;
}

.twin-state.active {
  color: #4cd964;
}

.twin-error {
  margin: 0 0 12px;
  color: #ff7f7f;
  font-size: 0.85em;
}

.part-name {
  font-weight: bold;
  color: #ff8c00;
  margin-bottom: 5px;
}

.input-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.input-row span {
  width: 90px;
  color: #aaa;
  font-size: 0.9em;
}

.input-row input {
  width: 100px;
  background: #333;
  border: 1px solid #555;
  color: #fff;
  padding: 5px;
  border-radius: 4px;
}

.empty-tip {
  color: #666;
  text-align: center;
  margin-top: 50px;
}
</style>
