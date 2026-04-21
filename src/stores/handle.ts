import { defineStore } from "pinia";
import { reactive, shallowRef, watch } from "vue";
import * as THREE from "three";

type PositioningPinControls = {
  zRotationDeg: number;
  xMove: number;
  zMove: number;
  rightPinZMove: number;
};

type LeftPositioningPinControls = {
  zRotationDeg: number;
  xMove: number;
  zMove: number;
  leftPinZMove: number;
};

type GripperControls = {
  yMove: number;
  zMove: number;
  catchRotateXDeg: number;
};

type Gripper4Controls = {
  xMove: number;
  zMove: number;
  catchRotateYDeg: number;
};

type TwinControlSnapshot = {
  positioningPin: Partial<PositioningPinControls>;
  leftPositioningPin: Partial<LeftPositioningPinControls>;
  gripper: Partial<GripperControls>;
  gripper2: Partial<GripperControls>;
  gripper3: Partial<GripperControls>;
  gripper4: Partial<Gripper4Controls>;
};

type ControlValueState = {
  positioningPin: PositioningPinControls;
  leftPositioningPin: LeftPositioningPinControls;
  gripper: GripperControls;
  gripper2: GripperControls;
  gripper3: GripperControls;
  gripper4: Gripper4Controls;
};

export const useHandleStore = defineStore("Handle", () => {
  const MM_TO_M = 0.001;
  const M_TO_MM = 1000;
  const DISPLAY_PRECISION = 2;

  const mmToM = (valueMm: number) => valueMm * MM_TO_M;
  const mToMm = (valueM: number) => valueM * M_TO_MM;
  const roundToPrecision = (value: number) =>
    Number(value.toFixed(DISPLAY_PRECISION));

  // 核心数据源：存储所有零件的位置信息
  // 结构: { "零件名": { position: { x: 0, y: 0, z: 0 } } }
  const partTransforms = reactive<
    Record<string, { position: { x: number; y: number; z: number } }>
  >({});

  const controlValues = reactive<{
    positioningPin: PositioningPinControls;
    leftPositioningPin: LeftPositioningPinControls;
    gripper: GripperControls;
    gripper2: GripperControls;
    gripper3: GripperControls;
    gripper4: Gripper4Controls;
  }>({
    positioningPin: {
      zRotationDeg: 0,
      xMove: 0,
      zMove: 0,
      rightPinZMove: 0,
    },
    leftPositioningPin: {
      zRotationDeg: 0,
      xMove: 0,
      zMove: 0,
      leftPinZMove: 0,
    },
    gripper: {
      yMove: 0,
      zMove: 0,
      catchRotateXDeg: 0,
    },
    gripper2: {
      yMove: 0,
      zMove: 0,
      catchRotateXDeg: 0,
    },
    gripper3: {
      yMove: 0,
      zMove: 0,
      catchRotateXDeg: 0,
    },
    gripper4: {
      xMove: 0,
      zMove: 0,
      catchRotateYDeg: 0,
    },
  });

  let initialControlBaseline: ControlValueState | null = null;
  const REVERSED_GRIPPER_ROTATE_KEYS = new Set(["catchRotateXDeg"]);
  const REVERSED_GRIPPER4_ROTATE_KEYS = new Set(["catchRotateYDeg"]);

  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  const createControlValueSnapshot = (): ControlValueState => ({
    positioningPin: { ...controlValues.positioningPin },
    leftPositioningPin: { ...controlValues.leftPositioningPin },
    gripper: { ...controlValues.gripper },
    gripper2: { ...controlValues.gripper2 },
    gripper3: { ...controlValues.gripper3 },
    gripper4: { ...controlValues.gripper4 },
  });

  const normalizeNumericRecord = <T extends Record<string, number>>(
    record: T,
  ) => {
    const targetRecord = record as Record<string, number>;
    for (const keyName of Object.keys(targetRecord)) {
      const value = targetRecord[keyName];
      if (!isFiniteNumber(value)) {
        continue;
      }
      targetRecord[keyName] = roundToPrecision(value);
    }
  };

  const normalizeControlValuePrecision = () => {
    normalizeNumericRecord(controlValues.positioningPin);
    normalizeNumericRecord(controlValues.leftPositioningPin);
    normalizeNumericRecord(controlValues.gripper);
    normalizeNumericRecord(controlValues.gripper2);
    normalizeNumericRecord(controlValues.gripper3);
    normalizeNumericRecord(controlValues.gripper4);
  };

  const applyOffsetFromZero = <T extends Record<string, number>>(
    target: T,
    baseline: T,
    incoming?: Partial<T>,
    reversedKeys: ReadonlySet<string> = new Set(),
  ) => {
    if (!incoming) {
      return;
    }

    const targetRecord = target as Record<string, number>;
    const baselineRecord = baseline as Record<string, number>;
    const incomingRecord = incoming as Record<string, number>;

    for (const keyName of Object.keys(incomingRecord)) {
      const backendOffset = incomingRecord[keyName];
      if (!isFiniteNumber(backendOffset)) {
        continue;
      }

      const baselineValue = baselineRecord[keyName] ?? 0;
      targetRecord[keyName] = reversedKeys.has(keyName)
        ? baselineValue - backendOffset
        : baselineValue + backendOffset;
    }
  };

  const controlTargets = {
    rightPositioningPinYRotatingGroup: shallowRef<THREE.Object3D | null>(null),
    rightPositioningPinXMovingGroup: shallowRef<THREE.Object3D | null>(null),
    rightPositioningPinYMovingGroup: shallowRef<THREE.Object3D | null>(null),
    rightPin: shallowRef<THREE.Object3D | null>(null),
    leftPositioningPinYRotatingGroup: shallowRef<THREE.Object3D | null>(null),
    leftPositioningPinXMovingGroup: shallowRef<THREE.Object3D | null>(null),
    leftPositioningPinYMovingGroup: shallowRef<THREE.Object3D | null>(null),
    leftPin: shallowRef<THREE.Object3D | null>(null),
    handle1ZMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle1YMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle1CratchUpX: shallowRef<THREE.Object3D | null>(null),
    handle2ZMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle2YMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle2CratchUpX: shallowRef<THREE.Object3D | null>(null),
    handle3ZMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle3YMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle3CratchUpX: shallowRef<THREE.Object3D | null>(null),
    handle4XMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle4YMovingGroup: shallowRef<THREE.Object3D | null>(null),
    handle4CratchUpZ: shallowRef<THREE.Object3D | null>(null),
  };

  // 1. 初始化：从加载完成的模型中提取初始位置
  const initFromScene = (scene: THREE.Object3D) => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        // 如果该零件还没有记录，则记录初始值
        if (!partTransforms[child.name]) {
          partTransforms[child.name] = {
            position: {
              x: parseFloat(child.position.x.toFixed(3)),
              y: parseFloat(child.position.y.toFixed(3)),
              z: parseFloat(child.position.z.toFixed(3)),
            },
          };
        }
      }
    });
    console.log(
      "HandleStore 初始化完成，共加载零件数:",
      Object.keys(partTransforms).length,
    );
  };

  // 2. 更新逻辑：修改某个零件的某个轴坐标
  const updatePartPosition = (
    name: string,
    axis: "x" | "y" | "z",
    value: number,
  ) => {
    if (partTransforms[name]) {
      partTransforms[name].position[axis] = value;
    }
  };

  const applyControlValues = () => {
    if (controlTargets.rightPositioningPinYRotatingGroup.value) {
      controlTargets.rightPositioningPinYRotatingGroup.value.rotation.z =
        THREE.MathUtils.degToRad(controlValues.positioningPin.zRotationDeg);
    }

    if (controlTargets.rightPositioningPinXMovingGroup.value) {
      controlTargets.rightPositioningPinXMovingGroup.value.position.x = mmToM(
        controlValues.positioningPin.xMove,
      );
    }

    if (controlTargets.rightPositioningPinYMovingGroup.value) {
      controlTargets.rightPositioningPinYMovingGroup.value.position.z = mmToM(
        controlValues.positioningPin.zMove,
      );
    }

    if (controlTargets.rightPin.value) {
      controlTargets.rightPin.value.position.z = mmToM(
        controlValues.positioningPin.rightPinZMove,
      );
    }

    if (controlTargets.leftPositioningPinYRotatingGroup.value) {
      controlTargets.leftPositioningPinYRotatingGroup.value.rotation.z =
        THREE.MathUtils.degToRad(controlValues.leftPositioningPin.zRotationDeg);
    }

    if (controlTargets.leftPositioningPinXMovingGroup.value) {
      controlTargets.leftPositioningPinXMovingGroup.value.position.x = mmToM(
        controlValues.leftPositioningPin.xMove,
      );
    }

    if (controlTargets.leftPositioningPinYMovingGroup.value) {
      controlTargets.leftPositioningPinYMovingGroup.value.position.z = mmToM(
        controlValues.leftPositioningPin.zMove,
      );
    }

    if (controlTargets.leftPin.value) {
      controlTargets.leftPin.value.position.z = mmToM(
        controlValues.leftPositioningPin.leftPinZMove,
      );
    }

    if (controlTargets.handle1ZMovingGroup.value) {
      controlTargets.handle1ZMovingGroup.value.position.y = mmToM(
        controlValues.gripper.yMove,
      );
    }

    if (controlTargets.handle1YMovingGroup.value) {
      controlTargets.handle1YMovingGroup.value.position.z = mmToM(
        controlValues.gripper.zMove,
      );
    }

    if (controlTargets.handle1CratchUpX.value) {
      controlTargets.handle1CratchUpX.value.rotation.x =
        THREE.MathUtils.degToRad(controlValues.gripper.catchRotateXDeg);
    }

    if (controlTargets.handle2ZMovingGroup.value) {
      controlTargets.handle2ZMovingGroup.value.position.y = mmToM(
        controlValues.gripper2.yMove,
      );
    }

    if (controlTargets.handle2YMovingGroup.value) {
      controlTargets.handle2YMovingGroup.value.position.z = mmToM(
        controlValues.gripper2.zMove,
      );
    }

    if (controlTargets.handle2CratchUpX.value) {
      controlTargets.handle2CratchUpX.value.rotation.x =
        THREE.MathUtils.degToRad(controlValues.gripper2.catchRotateXDeg);
    }

    if (controlTargets.handle3ZMovingGroup.value) {
      controlTargets.handle3ZMovingGroup.value.position.y = mmToM(
        controlValues.gripper3.yMove,
      );
    }

    if (controlTargets.handle3YMovingGroup.value) {
      controlTargets.handle3YMovingGroup.value.position.z = mmToM(
        controlValues.gripper3.zMove,
      );
    }

    if (controlTargets.handle3CratchUpX.value) {
      controlTargets.handle3CratchUpX.value.rotation.x =
        THREE.MathUtils.degToRad(controlValues.gripper3.catchRotateXDeg);
    }

    if (controlTargets.handle4XMovingGroup.value) {
      controlTargets.handle4XMovingGroup.value.position.x = mmToM(
        controlValues.gripper4.xMove,
      );
    }

    if (controlTargets.handle4YMovingGroup.value) {
      controlTargets.handle4YMovingGroup.value.position.z = mmToM(
        controlValues.gripper4.zMove,
      );
    }

    if (controlTargets.handle4CratchUpZ.value) {
      controlTargets.handle4CratchUpZ.value.rotation.y =
        THREE.MathUtils.degToRad(controlValues.gripper4.catchRotateYDeg);
    }
  };

  const syncControlValuesFromScene = () => {
    if (controlTargets.rightPositioningPinYRotatingGroup.value) {
      controlValues.positioningPin.zRotationDeg = THREE.MathUtils.radToDeg(
        controlTargets.rightPositioningPinYRotatingGroup.value.rotation.z,
      );
    }

    if (controlTargets.rightPositioningPinXMovingGroup.value) {
      controlValues.positioningPin.xMove = mToMm(
        controlTargets.rightPositioningPinXMovingGroup.value.position.x,
      );
    }

    if (controlTargets.rightPositioningPinYMovingGroup.value) {
      controlValues.positioningPin.zMove = mToMm(
        controlTargets.rightPositioningPinYMovingGroup.value.position.z,
      );
    }

    if (controlTargets.rightPin.value) {
      controlValues.positioningPin.rightPinZMove = mToMm(
        controlTargets.rightPin.value.position.z,
      );
    }

    if (controlTargets.leftPositioningPinYRotatingGroup.value) {
      controlValues.leftPositioningPin.zRotationDeg = THREE.MathUtils.radToDeg(
        controlTargets.leftPositioningPinYRotatingGroup.value.rotation.z,
      );
    }

    if (controlTargets.leftPositioningPinXMovingGroup.value) {
      controlValues.leftPositioningPin.xMove = mToMm(
        controlTargets.leftPositioningPinXMovingGroup.value.position.x,
      );
    }

    if (controlTargets.leftPositioningPinYMovingGroup.value) {
      controlValues.leftPositioningPin.zMove = mToMm(
        controlTargets.leftPositioningPinYMovingGroup.value.position.z,
      );
    }

    if (controlTargets.leftPin.value) {
      controlValues.leftPositioningPin.leftPinZMove = mToMm(
        controlTargets.leftPin.value.position.z,
      );
    }

    if (controlTargets.handle1ZMovingGroup.value) {
      controlValues.gripper.yMove = mToMm(
        controlTargets.handle1ZMovingGroup.value.position.y,
      );
    }

    if (controlTargets.handle1YMovingGroup.value) {
      controlValues.gripper.zMove = mToMm(
        controlTargets.handle1YMovingGroup.value.position.z,
      );
    }

    if (controlTargets.handle1CratchUpX.value) {
      controlValues.gripper.catchRotateXDeg = THREE.MathUtils.radToDeg(
        controlTargets.handle1CratchUpX.value.rotation.x,
      );
    }

    if (controlTargets.handle2ZMovingGroup.value) {
      controlValues.gripper2.yMove = mToMm(
        controlTargets.handle2ZMovingGroup.value.position.y,
      );
    }

    if (controlTargets.handle2YMovingGroup.value) {
      controlValues.gripper2.zMove = mToMm(
        controlTargets.handle2YMovingGroup.value.position.z,
      );
    }

    if (controlTargets.handle2CratchUpX.value) {
      controlValues.gripper2.catchRotateXDeg = THREE.MathUtils.radToDeg(
        controlTargets.handle2CratchUpX.value.rotation.x,
      );
    }

    if (controlTargets.handle3ZMovingGroup.value) {
      controlValues.gripper3.yMove = mToMm(
        controlTargets.handle3ZMovingGroup.value.position.y,
      );
    }

    if (controlTargets.handle3YMovingGroup.value) {
      controlValues.gripper3.zMove = mToMm(
        controlTargets.handle3YMovingGroup.value.position.z,
      );
    }

    if (controlTargets.handle3CratchUpX.value) {
      controlValues.gripper3.catchRotateXDeg = THREE.MathUtils.radToDeg(
        controlTargets.handle3CratchUpX.value.rotation.x,
      );
    }

    if (controlTargets.handle4XMovingGroup.value) {
      controlValues.gripper4.xMove = mToMm(
        controlTargets.handle4XMovingGroup.value.position.x,
      );
    }

    if (controlTargets.handle4YMovingGroup.value) {
      controlValues.gripper4.zMove = mToMm(
        controlTargets.handle4YMovingGroup.value.position.z,
      );
    }

    if (controlTargets.handle4CratchUpZ.value) {
      controlValues.gripper4.catchRotateYDeg = THREE.MathUtils.radToDeg(
        controlTargets.handle4CratchUpZ.value.rotation.y,
      );
    }

    normalizeControlValuePrecision();
  };

  const bindControlTargets = (scene: THREE.Object3D) => {
    controlTargets.rightPositioningPinYRotatingGroup.value =
      scene.getObjectByName("rightPositioningPinYRotatingGroup") ?? null;
    controlTargets.rightPositioningPinXMovingGroup.value =
      scene.getObjectByName("rightPositioningPinXMovingGroup") ?? null;
    controlTargets.rightPositioningPinYMovingGroup.value =
      scene.getObjectByName("rightPositioningPinYMovingGroup") ?? null;
    controlTargets.rightPin.value = scene.getObjectByName("rightPin") ?? null;
    controlTargets.leftPositioningPinYRotatingGroup.value =
      scene.getObjectByName("leftPositioningPinYRotatingGroup") ?? null;
    controlTargets.leftPositioningPinXMovingGroup.value =
      scene.getObjectByName("leftPositioningPinXMovingGroup") ?? null;
    controlTargets.leftPositioningPinYMovingGroup.value =
      scene.getObjectByName("leftPositioningPinYMovingGroup") ?? null;
    controlTargets.leftPin.value = scene.getObjectByName("leftPin") ?? null;
    controlTargets.handle1ZMovingGroup.value =
      scene.getObjectByName("handle1ZMovingGroup") ?? null;
    controlTargets.handle1YMovingGroup.value =
      scene.getObjectByName("handle1YMovingGroup") ?? null;
    controlTargets.handle1CratchUpX.value =
      scene.getObjectByName("handle1CratchUpX") ?? null;
    controlTargets.handle2ZMovingGroup.value =
      scene.getObjectByName("handle2ZMovingGroup") ?? null;
    controlTargets.handle2YMovingGroup.value =
      scene.getObjectByName("handle2YMovingGroup") ?? null;
    controlTargets.handle2CratchUpX.value =
      scene.getObjectByName("handle2CratchUpX") ?? null;
    controlTargets.handle3ZMovingGroup.value =
      scene.getObjectByName("handle3ZMovingGroup") ?? null;
    controlTargets.handle3YMovingGroup.value =
      scene.getObjectByName("handle3YMovingGroup") ?? null;
    controlTargets.handle3CratchUpX.value =
      scene.getObjectByName("handle3CratchUpX") ?? null;
    controlTargets.handle4XMovingGroup.value =
      scene.getObjectByName("handle4XMovingGroup") ?? null;
    controlTargets.handle4YMovingGroup.value =
      scene.getObjectByName("handle4YMovingGroup") ?? null;
    controlTargets.handle4CratchUpZ.value =
      scene.getObjectByName("handle4CratchUpZ") ?? null;

    Object.entries(controlTargets).forEach(([name, refNode]) => {
      if (!refNode.value) {
        console.warn(`未找到控制对象: ${name}`);
      }
    });

    syncControlValuesFromScene();
    initialControlBaseline = createControlValueSnapshot();
    applyControlValues();
  };

  const updatePositioningPinControls = (
    payload: Partial<PositioningPinControls>,
  ) => {
    Object.assign(controlValues.positioningPin, payload);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  const updateGripperControls = (payload: Partial<GripperControls>) => {
    Object.assign(controlValues.gripper, payload);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  const updateLeftPositioningPinControls = (
    payload: Partial<LeftPositioningPinControls>,
  ) => {
    Object.assign(controlValues.leftPositioningPin, payload);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  const updateGripper2Controls = (payload: Partial<GripperControls>) => {
    Object.assign(controlValues.gripper2, payload);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  const updateGripper3Controls = (payload: Partial<GripperControls>) => {
    Object.assign(controlValues.gripper3, payload);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  const updateGripper4Controls = (payload: Partial<Gripper4Controls>) => {
    Object.assign(controlValues.gripper4, payload);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  const applyTwinSnapshot = (payload: Partial<TwinControlSnapshot>) => {
    if (!initialControlBaseline) {
      initialControlBaseline = createControlValueSnapshot();
    }

    applyOffsetFromZero(
      controlValues.positioningPin,
      initialControlBaseline.positioningPin,
      payload.positioningPin,
    );
    applyOffsetFromZero(
      controlValues.leftPositioningPin,
      initialControlBaseline.leftPositioningPin,
      payload.leftPositioningPin,
    );
    applyOffsetFromZero(
      controlValues.gripper,
      initialControlBaseline.gripper,
      payload.gripper,
      REVERSED_GRIPPER_ROTATE_KEYS,
    );
    applyOffsetFromZero(
      controlValues.gripper2,
      initialControlBaseline.gripper2,
      payload.gripper2,
      REVERSED_GRIPPER_ROTATE_KEYS,
    );
    applyOffsetFromZero(
      controlValues.gripper3,
      initialControlBaseline.gripper3,
      payload.gripper3,
    );
    applyOffsetFromZero(
      controlValues.gripper4,
      initialControlBaseline.gripper4,
      payload.gripper4,
      REVERSED_GRIPPER4_ROTATE_KEYS,
    );

    normalizeControlValuePrecision();
    applyControlValues();
  };

  const resetTwinIncrementBaseline = () => {
    if (!initialControlBaseline) {
      initialControlBaseline = createControlValueSnapshot();
    }

    Object.assign(
      controlValues.positioningPin,
      initialControlBaseline.positioningPin,
    );
    Object.assign(
      controlValues.leftPositioningPin,
      initialControlBaseline.leftPositioningPin,
    );
    Object.assign(controlValues.gripper, initialControlBaseline.gripper);
    Object.assign(controlValues.gripper2, initialControlBaseline.gripper2);
    Object.assign(controlValues.gripper3, initialControlBaseline.gripper3);
    Object.assign(controlValues.gripper4, initialControlBaseline.gripper4);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  watch(controlValues, applyControlValues, { deep: true });

  return {
    partTransforms,
    controlValues,
    initFromScene,
    updatePartPosition,
    bindControlTargets,
    updatePositioningPinControls,
    updateGripperControls,
    updateLeftPositioningPinControls,
    updateGripper2Controls,
    updateGripper3Controls,
    updateGripper4Controls,
    applyTwinSnapshot,
    resetTwinIncrementBaseline,
    applyControlValues,
  };
});
