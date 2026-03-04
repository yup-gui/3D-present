<script setup lang="ts">
import { watch, onUnmounted } from "vue";
import { useTresContext } from "@tresjs/core";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import * as THREE from "three";

const props = defineProps<{
  selectedObjects: THREE.Object3D[];
}>();

const { renderer, scene, camera, sizes } = useTresContext();

const rawRenderer = renderer.instance;
// 1. 初始化 EffectComposer
const composer = new EffectComposer(rawRenderer as THREE.WebGLRenderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 2. 添加 RenderPass (基础场景渲染)
const renderPass = new RenderPass(scene.value, camera.activeCamera.value!);
composer.addPass(renderPass);

// 3. 添加 OutlinePass
const outlinePass = new OutlinePass(
  new THREE.Vector2(
    sizes.width.value || window.innerWidth,
    sizes.height.value || window.innerHeight,
  ),
  scene.value,
  camera.activeCamera.value,
  props.selectedObjects,
);

outlinePass.edgeStrength = 10.0;
outlinePass.edgeGlow = 0.5;
outlinePass.usePatternTexture = false;
outlinePass.edgeThickness = 1.0;
// 降低采样率以提升性能 (1 -> 2)
outlinePass.downSampleRatio = 2;
outlinePass.pulsePeriod = 2;
outlinePass.visibleEdgeColor.setHex(0xff8c00);
outlinePass.hiddenEdgeColor.setHex(0xff8c00);

composer.addPass(outlinePass);

// 4. 接管渲染循环以执行后期处理
renderer.replaceRenderFunction((notifyComplete) => {
  composer.render();
  notifyComplete();
});

// 监听外界传进来的选中对象变化，并赋值给 outlinePass
watch(
  () => props.selectedObjects,
  (newVals) => {
    if (outlinePass) {
      outlinePass.selectedObjects = newVals;
    }
  },
  { deep: true },
);

// 监听窗口大小改变调整 composer 尺寸
// watch(
//   () => sizes.width.value,
//   () => {
//     if (composer) {
//       composer.setSize(sizes.width.value, sizes.height.value);
//     }
//   },
// );

onUnmounted(() => {
  if (composer) {
    composer.dispose();
  }
});
</script>

<template>
  <!-- 此组件不需要 DOM 渲染，仅用于插入生命周期和逻辑 -->
</template>
