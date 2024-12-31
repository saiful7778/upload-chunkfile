export type OnProgressChangeHandler = (progress: number) => void;

export type Method = "POST" | "PUT" | "PATCH";
export type UploadType = "multiple" | "single";

export type UploadResponse<T> = {
  response: T;
};

export type PayloadOptions = {
  chunkName?: string | undefined;
  fileName?: string | undefined;
  currentChunk?: string | undefined;
  totalChunk?: string | undefined;
};

export type MultipartOptions = {
  chunkSize?: number | undefined;
  maxRetries?: number | undefined;
  retryDelay?: number | undefined;
  maxParallel?: number | undefined;
};

export type Options = {
  method?: Method | undefined;
  uploadType?: UploadType | undefined;
  signal?: AbortSignal | undefined;
  payloadOptions?: PayloadOptions | undefined;
} & MultipartOptions;
