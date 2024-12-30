export type OnProgressChangeHandler = (progress: number) => void;

export type Method = "POST" | "PUT" | "PATCH";
export type UploadType = "multipart" | "single";

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

export type MultipartOptions = {
  chunkSize: number;
  maxRetries: number;
  retryDelay: number;
  maxParallel: number;
};

export type Options = {
  method: Method;
  uploadType: UploadType;
  signal: AbortSignal | undefined;
  payloadOptions: PayloadOptions;
} & MultipartOptions;
