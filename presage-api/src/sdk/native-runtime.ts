import {
  breathingMetrics,
  cardioMetrics,
  edaMetrics,
  faceMetrics,
  FrameTransform,
  micromotionMetrics,
  PixelFormat,
  ProcessingStatus,
  SmartSpectraErrorCode,
  SmartSpectraLogLevel,
  SmartSpectraSDK,
  ValidationCode,
} from "@smartspectra/node-sdk";
import { decodeMetrics } from "@smartspectra/node-sdk/messages";

import type { SdkRuntime, SdkSession } from "./contracts.js";

export const nativeRuntime: SdkRuntime = {
  sdkVersion: SmartSpectraSDK.version,
  create: (options) =>
    new SmartSpectraSDK(options as ConstructorParameters<typeof SmartSpectraSDK>[0]) as SdkSession,
  decodeMetrics,
  metricBundles: {
    breathing: breathingMetrics,
    cardio: cardioMetrics,
    face: faceMetrics,
    micromotion: micromotionMetrics,
    eda: edaMetrics,
  },
  metricTypes: {
    CHEST_BREATHING: 0,
    ABDOMEN_BREATHING: 1,
    BREATHING_RATE: 2,
    BREATHING_AMPLITUDE: 3,
    APNEA: 4,
    RESPIRATORY_LINE_LENGTH: 5,
    BASELINE: 6,
    INHALE_EXHALE_RATIO: 7,
    GLUTES_MICROMOTION: 8,
    KNEES_MICROMOTION: 9,
    EDA_TRACE: 10,
    FACE_LANDMARKS: 11,
    BLINKING: 12,
    TALKING: 13,
    EXPRESSIONS: 14,
    PULSE_RATE: 15,
    ARTERIAL_PRESSURE_TRACE: 16,
    HRV: 17,
  },
  processingStatus: ProcessingStatus,
  validationCode: ValidationCode,
  errorCode: SmartSpectraErrorCode,
  pixelFormat: PixelFormat,
  frameTransform: FrameTransform,
  logLevel: SmartSpectraLogLevel,
};
