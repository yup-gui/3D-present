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

type Axis1Controls = {
  yRotatingDeg: number;
};

type Axis2Controls = {
  zRotatingDeg: number;
};

type Axis3Controls = {
  zRotatingDeg: number;
};

type Axis4Controls = {
  xRotatingDeg: number;
};

type Axis5Controls = {
  zRotatingDeg: number;
};

type Axis6Controls = {
  xRotatingDeg: number;
};

type AttachmentControls = {
  doorAttached: boolean;
};

type TwinControlSnapshot = {
  positioningPin: Partial<PositioningPinControls>;
  leftPositioningPin: Partial<LeftPositioningPinControls>;
  gripper: Partial<GripperControls>;
  gripper2: Partial<GripperControls>;
  gripper3: Partial<GripperControls>;
  gripper4: Partial<Gripper4Controls>;
  axis1: Partial<Axis1Controls>;
  axis2: Partial<Axis2Controls>;
  axis3: Partial<Axis3Controls>;
  axis4: Partial<Axis4Controls>;
  axis5: Partial<Axis5Controls>;
  axis6: Partial<Axis6Controls>;
  attachment?: Partial<AttachmentControls>;
};

type ControlValueState = {
  positioningPin: PositioningPinControls;
  leftPositioningPin: LeftPositioningPinControls;
  gripper: GripperControls;
  gripper2: GripperControls;
  gripper3: GripperControls;
  gripper4: Gripper4Controls;
  axis1: Axis1Controls;
  axis2: Axis2Controls;
  axis3: Axis3Controls;
  axis4: Axis4Controls;
  axis5: Axis5Controls;
  axis6: Axis6Controls;
};

type ControlGroupKey = keyof ControlValueState;
type DirectionMap = Record<string, 1 | -1>;

export const useHandleStore = defineStore("Handle", () => {
  const MM_TO_M = 0.001;
  const M_TO_MM = 1000;
  const DISPLAY_PRECISION = 2;

  const mmToM = (valueMm: number) => valueMm * MM_TO_M;
  const mToMm = (valueM: number) => valueM * M_TO_MM;
  const roundToPrecision = (value: number) =>
    Number(value.toFixed(DISPLAY_PRECISION));

  const controlValues = reactive<{
    positioningPin: PositioningPinControls;
    leftPositioningPin: LeftPositioningPinControls;
    gripper: GripperControls;
    gripper2: GripperControls;
    gripper3: GripperControls;
    gripper4: Gripper4Controls;
    axis1: Axis1Controls;
    axis2: Axis2Controls;
    axis3: Axis3Controls;
    axis4: Axis4Controls;
    axis5: Axis5Controls;
    axis6: Axis6Controls;
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
    axis1: {
      yRotatingDeg: 0,
    },
    axis2: {
      zRotatingDeg: 0,
    },
    axis3: {
      zRotatingDeg: 0,
    },
    axis4: {
      xRotatingDeg: 0,
    },
    axis5: {
      zRotatingDeg: 0,
    },
    axis6: {
      xRotatingDeg: 0,
    },
  });
  const attachmentState = reactive<AttachmentControls>({
    doorAttached: false,
  });

  let initialControlBaseline: ControlValueState | null = null;
  const AXIS_CONTROL_KEYS = [
    "axis1",
    "axis2",
    "axis3",
    "axis4",
    "axis5",
    "axis6",
  ] as const;
  type AxisControlKey = (typeof AXIS_CONTROL_KEYS)[number];
  const CONTROL_DIRECTION_MAP: Record<ControlGroupKey, DirectionMap> = {
    positioningPin: {
      zRotationDeg: 1,
      xMove: 1,
      zMove: 1,
      rightPinZMove: 1,
    },
    leftPositioningPin: {
      zRotationDeg: 1,
      xMove: 1,
      zMove: 1,
      leftPinZMove: 1,
    },
    gripper: {
      yMove: 1,
      zMove: 1,
      catchRotateXDeg: -1,
    },
    gripper2: {
      yMove: 1,
      zMove: -1,
      catchRotateXDeg: -1,
    },
    gripper3: {
      yMove: 1,
      zMove: -1,
      catchRotateXDeg: 1,
    },
    gripper4: {
      xMove: 1,
      zMove: -1,
      catchRotateYDeg: -1,
    },
    axis1: {
      yRotatingDeg: 1,
    },
    axis2: {
      zRotatingDeg: 1,
    },
    axis3: {
      zRotatingDeg: 1,
    },
    axis4: {
      xRotatingDeg: 1,
    },
    axis5: {
      zRotatingDeg: 1,
    },
    axis6: {
      xRotatingDeg: 1,
    },
  };

  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  const createControlValueSnapshot = (): ControlValueState => ({
    positioningPin: { ...controlValues.positioningPin },
    leftPositioningPin: { ...controlValues.leftPositioningPin },
    gripper: { ...controlValues.gripper },
    gripper2: { ...controlValues.gripper2 },
    gripper3: { ...controlValues.gripper3 },
    gripper4: { ...controlValues.gripper4 },
    axis1: { ...controlValues.axis1 },
    axis2: { ...controlValues.axis2 },
    axis3: { ...controlValues.axis3 },
    axis4: { ...controlValues.axis4 },
    axis5: { ...controlValues.axis5 },
    axis6: { ...controlValues.axis6 },
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
    normalizeNumericRecord(controlValues.axis1);
    normalizeNumericRecord(controlValues.axis2);
    normalizeNumericRecord(controlValues.axis3);
    normalizeNumericRecord(controlValues.axis4);
    normalizeNumericRecord(controlValues.axis5);
    normalizeNumericRecord(controlValues.axis6);
  };

  const applyOffsetFromZero = <T extends Record<string, number>>(
    target: T,
    baseline: T,
    incoming?: Partial<T>,
    directionMap: DirectionMap = {},
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
      const direction = directionMap[keyName] ?? 1;
      targetRecord[keyName] = baselineValue + backendOffset * direction;
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
    axis1: shallowRef<THREE.Object3D | null>(null),
    axis2: shallowRef<THREE.Object3D | null>(null),
    axis3: shallowRef<THREE.Object3D | null>(null),
    axis4: shallowRef<THREE.Object3D | null>(null),
    axis5: shallowRef<THREE.Object3D | null>(null),
    axis6: shallowRef<THREE.Object3D | null>(null),
  };

  const positioningPinBaselines = {
    rightPositioningPinYRotatingGroup: 0,
    rightPositioningPinXMovingGroup: 0,
    rightPositioningPinYMovingGroup: 0,
    rightPin: 0,
    leftPositioningPinYRotatingGroup: 0,
    leftPositioningPinXMovingGroup: 0,
    leftPositioningPinYMovingGroup: 0,
    leftPin: 0,
  };

  const axisBaseQuaternions: Record<AxisControlKey, THREE.Quaternion | null> = {
    axis1: null,
    axis2: null,
    axis3: null,
    axis4: null,
    axis5: null,
    axis6: null,
  };

  const resetAxisControlsToZero = (axisName: AxisControlKey) => {
    switch (axisName) {
      case "axis1":
        controlValues.axis1.yRotatingDeg = 0;
        break;
      case "axis2":
        controlValues.axis2.zRotatingDeg = 0;
        break;
      case "axis3":
        controlValues.axis3.zRotatingDeg = 0;
        break;
      case "axis4":
        controlValues.axis4.xRotatingDeg = 0;
        break;
      case "axis5":
        controlValues.axis5.zRotatingDeg = 0;
        break;
      case "axis6":
        controlValues.axis6.xRotatingDeg = 0;
        break;
    }
  };

  const resetPositioningPinControlsToZero = () => {
    controlValues.positioningPin.zRotationDeg = 0;
    controlValues.positioningPin.xMove = 0;
    controlValues.positioningPin.zMove = 0;
    controlValues.positioningPin.rightPinZMove = 0;

    controlValues.leftPositioningPin.zRotationDeg = 0;
    controlValues.leftPositioningPin.xMove = 0;
    controlValues.leftPositioningPin.zMove = 0;
    controlValues.leftPositioningPin.leftPinZMove = 0;
  };

  const applySignedValue = (
    value: number,
    directionMap: DirectionMap,
    keyName: string,
  ) => value * (directionMap[keyName] ?? 1);

  const readSignedValue = (
    value: number,
    directionMap: DirectionMap,
    keyName: string,
  ) => value * (directionMap[keyName] ?? 1);

  const applyAxisRotation = (axisName: AxisControlKey) => {
    const target = controlTargets[axisName].value;
    const baseQuaternion = axisBaseQuaternions[axisName];

    if (!target || !baseQuaternion) {
      return;
    }

    const deltaEuler = new THREE.Euler(0, 0, 0, "XYZ");

    switch (axisName) {
      case "axis1":
        deltaEuler.y = THREE.MathUtils.degToRad(
          controlValues.axis1.yRotatingDeg,
        );
        break;
      case "axis2":
        deltaEuler.z = THREE.MathUtils.degToRad(
          controlValues.axis2.zRotatingDeg,
        );
        break;
      case "axis3":
        deltaEuler.z = THREE.MathUtils.degToRad(
          controlValues.axis3.zRotatingDeg,
        );
        break;
      case "axis4":
        deltaEuler.x = THREE.MathUtils.degToRad(
          controlValues.axis4.xRotatingDeg,
        );
        break;
      case "axis5":
        deltaEuler.z = THREE.MathUtils.degToRad(
          controlValues.axis5.zRotatingDeg,
        );
        break;
      case "axis6":
        deltaEuler.x = THREE.MathUtils.degToRad(
          controlValues.axis6.xRotatingDeg,
        );
        break;
    }

    const deltaQuaternion = new THREE.Quaternion().setFromEuler(deltaEuler);

    target.quaternion.copy(baseQuaternion).multiply(deltaQuaternion);
  };

  const syncAxisControlValuesFromScene = (axisName: AxisControlKey) => {
    const target = controlTargets[axisName].value;
    const baseQuaternion = axisBaseQuaternions[axisName];

    if (!target || !baseQuaternion) {
      return;
    }

    const relativeQuaternion = baseQuaternion
      .clone()
      .invert()
      .multiply(target.quaternion.clone());
    const relativeEuler = new THREE.Euler().setFromQuaternion(
      relativeQuaternion,
      "XYZ",
    );

    switch (axisName) {
      case "axis1":
        controlValues.axis1.yRotatingDeg = THREE.MathUtils.radToDeg(
          relativeEuler.y,
        );
        break;
      case "axis2":
        controlValues.axis2.zRotatingDeg = THREE.MathUtils.radToDeg(
          relativeEuler.z,
        );
        break;
      case "axis3":
        controlValues.axis3.zRotatingDeg = THREE.MathUtils.radToDeg(
          relativeEuler.z,
        );
        break;
      case "axis4":
        controlValues.axis4.xRotatingDeg = THREE.MathUtils.radToDeg(
          relativeEuler.x,
        );
        break;
      case "axis5":
        controlValues.axis5.zRotatingDeg = THREE.MathUtils.radToDeg(
          relativeEuler.z,
        );
        break;
      case "axis6":
        controlValues.axis6.xRotatingDeg = THREE.MathUtils.radToDeg(
          relativeEuler.x,
        );
        break;
    }
  };

  const applyControlValues = () => {
    if (controlTargets.rightPositioningPinYRotatingGroup.value) {
      controlTargets.rightPositioningPinYRotatingGroup.value.rotation.y =
        positioningPinBaselines.rightPositioningPinYRotatingGroup +
        THREE.MathUtils.degToRad(controlValues.positioningPin.zRotationDeg);
    }

    if (controlTargets.rightPositioningPinXMovingGroup.value) {
      controlTargets.rightPositioningPinXMovingGroup.value.position.x =
        mmToM(controlValues.positioningPin.xMove) +
        positioningPinBaselines.rightPositioningPinXMovingGroup;
    }

    if (controlTargets.rightPositioningPinYMovingGroup.value) {
      controlTargets.rightPositioningPinYMovingGroup.value.position.y =
        mmToM(controlValues.positioningPin.zMove) +
        positioningPinBaselines.rightPositioningPinYMovingGroup;
    }

    if (controlTargets.rightPin.value) {
      controlTargets.rightPin.value.position.y =
        mmToM(controlValues.positioningPin.rightPinZMove) +
        positioningPinBaselines.rightPin;
    }

    if (controlTargets.leftPositioningPinYRotatingGroup.value) {
      controlTargets.leftPositioningPinYRotatingGroup.value.rotation.y =
        positioningPinBaselines.leftPositioningPinYRotatingGroup +
        THREE.MathUtils.degToRad(controlValues.leftPositioningPin.zRotationDeg);
    }

    if (controlTargets.leftPositioningPinXMovingGroup.value) {
      controlTargets.leftPositioningPinXMovingGroup.value.position.x =
        mmToM(controlValues.leftPositioningPin.xMove) +
        positioningPinBaselines.leftPositioningPinXMovingGroup;
    }

    if (controlTargets.leftPositioningPinYMovingGroup.value) {
      controlTargets.leftPositioningPinYMovingGroup.value.position.y =
        mmToM(controlValues.leftPositioningPin.zMove) +
        positioningPinBaselines.leftPositioningPinYMovingGroup;
    }

    if (controlTargets.leftPin.value) {
      controlTargets.leftPin.value.position.y =
        mmToM(controlValues.leftPositioningPin.leftPinZMove) +
        positioningPinBaselines.leftPin;
    }

    if (controlTargets.handle1ZMovingGroup.value) {
      controlTargets.handle1ZMovingGroup.value.position.y = mmToM(
        controlValues.gripper.yMove,
      );
    }

    if (controlTargets.handle1YMovingGroup.value) {
      controlTargets.handle1YMovingGroup.value.position.y = mmToM(
        applySignedValue(
          controlValues.gripper.zMove,
          CONTROL_DIRECTION_MAP.gripper,
          "zMove",
        ),
      );
    }

    if (controlTargets.handle1CratchUpX.value) {
      controlTargets.handle1CratchUpX.value.rotation.x =
        THREE.MathUtils.degToRad(
          applySignedValue(
            controlValues.gripper.catchRotateXDeg,
            CONTROL_DIRECTION_MAP.gripper,
            "catchRotateXDeg",
          ),
        );
    }

    if (controlTargets.handle2ZMovingGroup.value) {
      controlTargets.handle2ZMovingGroup.value.position.y = mmToM(
        controlValues.gripper2.yMove,
      );
    }

    if (controlTargets.handle2YMovingGroup.value) {
      controlTargets.handle2YMovingGroup.value.position.y = mmToM(
        applySignedValue(
          controlValues.gripper2.zMove,
          CONTROL_DIRECTION_MAP.gripper2,
          "zMove",
        ),
      );
    }

    if (controlTargets.handle2CratchUpX.value) {
      controlTargets.handle2CratchUpX.value.rotation.x =
        THREE.MathUtils.degToRad(
          applySignedValue(
            controlValues.gripper2.catchRotateXDeg,
            CONTROL_DIRECTION_MAP.gripper2,
            "catchRotateXDeg",
          ),
        );
    }

    if (controlTargets.handle3ZMovingGroup.value) {
      controlTargets.handle3ZMovingGroup.value.position.y = mmToM(
        controlValues.gripper3.yMove,
      );
    }

    if (controlTargets.handle3YMovingGroup.value) {
      controlTargets.handle3YMovingGroup.value.position.y = mmToM(
        applySignedValue(
          controlValues.gripper3.zMove,
          CONTROL_DIRECTION_MAP.gripper3,
          "zMove",
        ),
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
      controlTargets.handle4YMovingGroup.value.position.y = mmToM(
        applySignedValue(
          controlValues.gripper4.zMove,
          CONTROL_DIRECTION_MAP.gripper4,
          "zMove",
        ),
      );
    }

    if (controlTargets.handle4CratchUpZ.value) {
      controlTargets.handle4CratchUpZ.value.rotation.z =
        THREE.MathUtils.degToRad(
          applySignedValue(
            controlValues.gripper4.catchRotateYDeg,
            CONTROL_DIRECTION_MAP.gripper4,
            "catchRotateYDeg",
          ),
        );
    }

    AXIS_CONTROL_KEYS.forEach(applyAxisRotation);
  };

  const syncControlValuesFromScene = () => {
    if (controlTargets.rightPositioningPinYRotatingGroup.value) {
      controlValues.positioningPin.zRotationDeg = THREE.MathUtils.radToDeg(
        controlTargets.rightPositioningPinYRotatingGroup.value.rotation.y -
          positioningPinBaselines.rightPositioningPinYRotatingGroup,
      );
    }

    if (controlTargets.rightPositioningPinXMovingGroup.value) {
      controlValues.positioningPin.xMove = mToMm(
        controlTargets.rightPositioningPinXMovingGroup.value.position.x -
          positioningPinBaselines.rightPositioningPinXMovingGroup,
      );
    }

    if (controlTargets.rightPositioningPinYMovingGroup.value) {
      controlValues.positioningPin.zMove = mToMm(
        controlTargets.rightPositioningPinYMovingGroup.value.position.y -
          positioningPinBaselines.rightPositioningPinYMovingGroup,
      );
    }

    if (controlTargets.rightPin.value) {
      controlValues.positioningPin.rightPinZMove = mToMm(
        controlTargets.rightPin.value.position.y -
          positioningPinBaselines.rightPin,
      );
    }

    if (controlTargets.leftPositioningPinYRotatingGroup.value) {
      controlValues.leftPositioningPin.zRotationDeg = THREE.MathUtils.radToDeg(
        controlTargets.leftPositioningPinYRotatingGroup.value.rotation.y -
          positioningPinBaselines.leftPositioningPinYRotatingGroup,
      );
    }

    if (controlTargets.leftPositioningPinXMovingGroup.value) {
      controlValues.leftPositioningPin.xMove = mToMm(
        controlTargets.leftPositioningPinXMovingGroup.value.position.x -
          positioningPinBaselines.leftPositioningPinXMovingGroup,
      );
    }

    if (controlTargets.leftPositioningPinYMovingGroup.value) {
      controlValues.leftPositioningPin.zMove = mToMm(
        controlTargets.leftPositioningPinYMovingGroup.value.position.y -
          positioningPinBaselines.leftPositioningPinYMovingGroup,
      );
    }

    if (controlTargets.leftPin.value) {
      controlValues.leftPositioningPin.leftPinZMove = mToMm(
        controlTargets.leftPin.value.position.y -
          positioningPinBaselines.leftPin,
      );
    }

    if (controlTargets.handle1ZMovingGroup.value) {
      controlValues.gripper.yMove = mToMm(
        controlTargets.handle1ZMovingGroup.value.position.y,
      );
    }

    if (controlTargets.handle1YMovingGroup.value) {
      controlValues.gripper.zMove = readSignedValue(
        mToMm(controlTargets.handle1YMovingGroup.value.position.y),
        CONTROL_DIRECTION_MAP.gripper,
        "zMove",
      );
    }

    if (controlTargets.handle1CratchUpX.value) {
      controlValues.gripper.catchRotateXDeg = readSignedValue(
        THREE.MathUtils.radToDeg(
          controlTargets.handle1CratchUpX.value.rotation.x,
        ),
        CONTROL_DIRECTION_MAP.gripper,
        "catchRotateXDeg",
      );
    }

    if (controlTargets.handle2ZMovingGroup.value) {
      controlValues.gripper2.yMove = mToMm(
        controlTargets.handle2ZMovingGroup.value.position.y,
      );
    }

    if (controlTargets.handle2YMovingGroup.value) {
      controlValues.gripper2.zMove = readSignedValue(
        mToMm(controlTargets.handle2YMovingGroup.value.position.y),
        CONTROL_DIRECTION_MAP.gripper2,
        "zMove",
      );
    }

    if (controlTargets.handle2CratchUpX.value) {
      controlValues.gripper2.catchRotateXDeg = readSignedValue(
        THREE.MathUtils.radToDeg(
          controlTargets.handle2CratchUpX.value.rotation.x,
        ),
        CONTROL_DIRECTION_MAP.gripper2,
        "catchRotateXDeg",
      );
    }

    if (controlTargets.handle3ZMovingGroup.value) {
      controlValues.gripper3.yMove = mToMm(
        controlTargets.handle3ZMovingGroup.value.position.y,
      );
    }

    if (controlTargets.handle3YMovingGroup.value) {
      controlValues.gripper3.zMove = readSignedValue(
        mToMm(controlTargets.handle3YMovingGroup.value.position.y),
        CONTROL_DIRECTION_MAP.gripper3,
        "zMove",
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
      controlValues.gripper4.zMove = readSignedValue(
        mToMm(controlTargets.handle4YMovingGroup.value.position.y),
        CONTROL_DIRECTION_MAP.gripper4,
        "zMove",
      );
    }

    if (controlTargets.handle4CratchUpZ.value) {
      controlValues.gripper4.catchRotateYDeg = readSignedValue(
        THREE.MathUtils.radToDeg(
          controlTargets.handle4CratchUpZ.value.rotation.z,
        ),
        CONTROL_DIRECTION_MAP.gripper4,
        "catchRotateYDeg",
      );
    }

    AXIS_CONTROL_KEYS.forEach(syncAxisControlValuesFromScene);

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
    controlTargets.axis1.value = scene.getObjectByName("axis1") ?? null;
    controlTargets.axis2.value = scene.getObjectByName("axis2") ?? null;
    controlTargets.axis3.value = scene.getObjectByName("axis3") ?? null;
    controlTargets.axis4.value = scene.getObjectByName("axis4") ?? null;
    controlTargets.axis5.value = scene.getObjectByName("axis5") ?? null;
    controlTargets.axis6.value = scene.getObjectByName("axis6") ?? null;

    positioningPinBaselines.rightPositioningPinYRotatingGroup =
      controlTargets.rightPositioningPinYRotatingGroup.value?.rotation.y ?? 0;
    positioningPinBaselines.rightPositioningPinXMovingGroup =
      controlTargets.rightPositioningPinXMovingGroup.value?.position.x ?? 0;
    positioningPinBaselines.rightPositioningPinYMovingGroup =
      controlTargets.rightPositioningPinYMovingGroup.value?.position.y ?? 0;
    positioningPinBaselines.rightPin =
      controlTargets.rightPin.value?.position.y ?? 0;
    positioningPinBaselines.leftPositioningPinYRotatingGroup =
      controlTargets.leftPositioningPinYRotatingGroup.value?.rotation.y ?? 0;
    positioningPinBaselines.leftPositioningPinXMovingGroup =
      controlTargets.leftPositioningPinXMovingGroup.value?.position.x ?? 0;
    positioningPinBaselines.leftPositioningPinYMovingGroup =
      controlTargets.leftPositioningPinYMovingGroup.value?.position.y ?? 0;
    positioningPinBaselines.leftPin =
      controlTargets.leftPin.value?.position.y ?? 0;

    AXIS_CONTROL_KEYS.forEach((axisName) => {
      const axisTarget = controlTargets[axisName].value;
      axisBaseQuaternions[axisName] = axisTarget
        ? axisTarget.quaternion.clone()
        : null;
      resetAxisControlsToZero(axisName);
    });
    resetPositioningPinControlsToZero();

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

  const updateAxisControls = (
    axisName: AxisControlKey,
    payload:
      | Partial<Axis1Controls>
      | Partial<Axis2Controls>
      | Partial<Axis3Controls>
      | Partial<Axis4Controls>
      | Partial<Axis5Controls>
      | Partial<Axis6Controls>,
  ) => {
    Object.assign(controlValues[axisName], payload);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  const applyTwinSnapshot = (payload: Partial<TwinControlSnapshot>) => {
    if (!initialControlBaseline) {
      initialControlBaseline = createControlValueSnapshot();
    }

    if (typeof payload.attachment?.doorAttached === "boolean") {
      attachmentState.doorAttached = payload.attachment.doorAttached;
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
      CONTROL_DIRECTION_MAP.gripper,
    );
    applyOffsetFromZero(
      controlValues.gripper2,
      initialControlBaseline.gripper2,
      payload.gripper2,
      CONTROL_DIRECTION_MAP.gripper2,
    );
    applyOffsetFromZero(
      controlValues.gripper3,
      initialControlBaseline.gripper3,
      payload.gripper3,
      CONTROL_DIRECTION_MAP.gripper3,
    );
    applyOffsetFromZero(
      controlValues.gripper4,
      initialControlBaseline.gripper4,
      payload.gripper4,
      CONTROL_DIRECTION_MAP.gripper4,
    );
    applyOffsetFromZero(
      controlValues.axis1,
      initialControlBaseline.axis1,
      payload.axis1,
    );
    applyOffsetFromZero(
      controlValues.axis2,
      initialControlBaseline.axis2,
      payload.axis2,
    );
    applyOffsetFromZero(
      controlValues.axis3,
      initialControlBaseline.axis3,
      payload.axis3,
    );
    applyOffsetFromZero(
      controlValues.axis4,
      initialControlBaseline.axis4,
      payload.axis4,
    );
    applyOffsetFromZero(
      controlValues.axis5,
      initialControlBaseline.axis5,
      payload.axis5,
    );
    applyOffsetFromZero(
      controlValues.axis6,
      initialControlBaseline.axis6,
      payload.axis6,
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
    Object.assign(controlValues.axis1, initialControlBaseline.axis1);
    Object.assign(controlValues.axis2, initialControlBaseline.axis2);
    Object.assign(controlValues.axis3, initialControlBaseline.axis3);
    Object.assign(controlValues.axis4, initialControlBaseline.axis4);
    Object.assign(controlValues.axis5, initialControlBaseline.axis5);
    Object.assign(controlValues.axis6, initialControlBaseline.axis6);
    normalizeControlValuePrecision();
    applyControlValues();
  };

  watch(controlValues, applyControlValues, { deep: true });

  return {
    controlValues,
    attachmentState,
    CONTROL_DIRECTION_MAP,
    bindControlTargets,
    updatePositioningPinControls,
    updateGripperControls,
    updateLeftPositioningPinControls,
    updateGripper2Controls,
    updateGripper3Controls,
    updateGripper4Controls,
    updateAxisControls,
    applyTwinSnapshot,
    resetTwinIncrementBaseline,
    applyControlValues,
  };
});
