export type ProcessingStatusValue = 0 | 1 | 2 | 3 | 4 | 5;
export type PixelFormatValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type FrameTransformValue = 0 | 1 | 2 | 3 | 4 | 5;

export interface SdkOptions {
  apiKey: string;
  requestedMetrics: number[];
  enableAccumulatedOutput: boolean;
  logLevel: number;
  enableTelemetry: boolean;
}

export interface VideoFileOptions {
  timestampsPath?: string | null;
  interframeDelayMs?: number;
  startOffsetMs?: number;
  maxDurationMs?: number;
  frameTransform?: FrameTransformValue;
}

export interface SdkSession {
  readonly processingStatus: ProcessingStatusValue;
  useCustomInput(frameTransform?: FrameTransformValue): this;
  useFile(path: string, options?: VideoFileOptions): this;
  start(): void;
  stop(): void;
  stopAsync(): Promise<void>;
  destroy(): Promise<void>;
  requestInsight(text: string): number;
  sendFrame(buffer: Uint8Array | Buffer, width: number, height: number, stride: number, pixelFormat: PixelFormatValue, timestampUs: number): boolean;
  on(event: "processingStatus", callback: (status: ProcessingStatusValue) => void): this;
  on(event: "validationStatus", callback: (code: number, timestampUs: number, hint: string) => void): this;
  on(event: "metrics", callback: (buffer: Buffer, timestampUs: number) => void): this;
  on(event: "accumulatedMetrics", callback: (buffer: Buffer, timestampUs: number) => void): this;
  on(event: "insight", callback: (buffer: Buffer, requestId: number) => void): this;
  on(event: "error", callback: (code: number, message: string, retryable: boolean) => void): this;
  on(event: "frameSentThrough", callback: (sent: boolean, timestampUs: number) => void): this;
  on(event: "videoOutput", callback: (buffer: Buffer, width: number, height: number, stride: number, pixelFormat: PixelFormatValue, timestampUs: number) => void): this;
}

export type SdkFactory = (options: SdkOptions) => SdkSession;

export interface SdkRuntime {
  sdkVersion: string;
  create: SdkFactory;
  decodeMetrics(buffer: Buffer): unknown;
  metricBundles: {
    breathing: readonly number[];
    cardio: readonly number[];
    face: readonly number[];
    micromotion: readonly number[];
    eda: readonly number[];
  };
  metricTypes: Readonly<Record<string, number>>;
  processingStatus: Readonly<Record<string, number>>;
  validationCode: Readonly<Record<string, number>>;
  errorCode: Readonly<Record<string, number>>;
  pixelFormat: Readonly<Record<string, number>>;
  frameTransform: Readonly<Record<string, number>>;
  logLevel: Readonly<Record<string, number>>;
}
