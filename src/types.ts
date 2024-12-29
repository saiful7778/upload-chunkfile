export type OnProgressChangeHandler = (progress: number) => void;

export type Method = "POST" | "PUT" | "PATCH";

export type Options = {
  method: Method | undefined;
  uploadType: "multipart" | "single" | undefined;
  signal: AbortSignal | undefined;
  chunkSize: number | undefined;
  maxRetries: number | undefined;
  retryDelay: number | undefined;
  maxParallel: number | undefined;
};

export type MultipartOptions = {
  chunkSize: number;
  maxRetries: number;
  retryDelay: number;
  maxParallel: number
};
