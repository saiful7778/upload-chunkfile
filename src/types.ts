export type OnProgressChangeHandler = (progress: number) => void;

export type Method = "POST" | "PUT" | "PATCH";

export type UploadResponse<T> = {
  eTag: string | null;
  response: T;
};

export type PayloadOptions = {
  chunkName: string;
  filename: string;
  currentChunk: string;
  totalChunk: string;
};

export type Options = {
  method: Method | undefined;
  uploadType: "multipart" | "single" | undefined;
  signal: AbortSignal | undefined;
  chunkSize: number | undefined;
  maxRetries: number | undefined;
  retryDelay: number | undefined;
  maxParallel: number | undefined;
  payloadOptions: PayloadOptions | undefined;
};

export type MultipartOptions = {
  chunkSize: number;
  maxRetries: number;
  retryDelay: number;
  maxParallel: number;
};
