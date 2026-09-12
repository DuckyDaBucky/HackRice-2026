export interface ErrorBody {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId?: string;
  };
}

export function errorBody(
  code: string,
  message: string,
  retryable: boolean,
  requestId?: string,
): ErrorBody {
  return {
    error: {
      code,
      message,
      retryable,
      ...(requestId ? { requestId } : {}),
    },
  };
}

export function sdkErrorDetails(error: unknown): {
  code: number | null;
  message: string;
  retryable: boolean;
} {
  if (!(error instanceof Error)) {
    return { code: null, message: "Unknown SmartSpectra error", retryable: false };
  }

  const candidate = error as Error & { code?: unknown; retryable?: unknown };
  return {
    code: typeof candidate.code === "number" ? candidate.code : null,
    message: candidate.message,
    retryable: candidate.retryable === true,
  };
}
