<script setup lang="ts">
import { useLoop, useTresContext } from "@tresjs/core";
import { useHandleStore } from "@/stores/handle";
import * as THREE from "three";

const handleStore = useHandleStore();
const { scene } = useTresContext();
const { onBeforeRender } = useLoop();

// 本地缓存映射，无需响应式
const objectsMap = new Map<string, THREE.Object3D>();
let isMapReady = false;

onBeforeRender(() => {
  if (!scene.value) return;

  // 如果缓存还没准备好，尝试构建缓存
  // 触发条件：Store 中已经有数据了 (说明模型加载完了)，但 Map 还没填充
  if (!isMapReady) {
    const hasStoreData = Object.keys(handleStore.partTransforms).length > 0;

    if (hasStoreData) {
      scene.value.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          objectsMap.set(child.name, child);
        }
      });

      // 如果找到了物体，标记为已就绪，避免每帧 traverse
      if (objectsMap.size > 0) {
        isMapReady = true;
      }
    }
  }

  // 如果还没就绪，跳过同步
  if (!isMapReady) return;

  // 每一帧同步 Store -> Scene
  for (const [name, targetPos] of Object.entries(handleStore.partTransforms)) {
    const object = objectsMap.get(name);
    if (object) {
      object.position.x = targetPos.position.x;
      object.position.y = targetPos.position.y;
      object.position.z = targetPos.position.z;
    }
  }
});
</script>

<template>
  <!-- 这是一个功能性组件，不渲染任何 DOM -->
</template>
