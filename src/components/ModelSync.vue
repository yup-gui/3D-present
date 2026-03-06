<script setup lang="ts">
import { useTresContext } from "@tresjs/core";
import { useHandleStore } from "@/stores/handle";
import { watch } from "vue";
import * as THREE from "three";

const handleStore = useHandleStore();
const { scene } = useTresContext();

// 本地缓存映射，无需响应式
const objectsMap = new Map<string, THREE.Object3D>();
let isMapReady = false;

const buildObjectsMap = (root: THREE.Object3D) => {
  objectsMap.clear();
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      objectsMap.set(child.name, child);
    }
  });
  isMapReady = objectsMap.size > 0;
};

const syncSceneFromStore = () => {
  for (const [name, targetPos] of Object.entries(handleStore.partTransforms)) {
    const object = objectsMap.get(name);
    if (object) {
      object.position.x = targetPos.position.x;
      object.position.y = targetPos.position.y;
      object.position.z = targetPos.position.z;
    }
  }
};

watch(
  scene,
  (currentScene) => {
    if (!currentScene) return;
    if (Object.keys(handleStore.partTransforms).length === 0) return;

    buildObjectsMap(currentScene);
    if (isMapReady) {
      syncSceneFromStore();
    }
  },
  { immediate: true },
);

watch(
  () => handleStore.partTransforms,
  () => {
    if (!scene.value) return;

    if (!isMapReady) {
      buildObjectsMap(scene.value);
      if (!isMapReady) return;
    }

    syncSceneFromStore();
  },
  { deep: true },
);
</script>

<template>
  <!-- 这是一个功能性组件，不渲染任何 DOM -->
</template>
