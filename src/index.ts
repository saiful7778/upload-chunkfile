import {
  Options,
  OnProgressChangeHandler,
  Method,
  MultipartOptions,
} from "./types";
import delay from "./utils/delay";
import { FileUploadError, UploadAbortedError } from "./utils/Errors";

export default async function uploadFile({
  file,
  uploadUrl,
  options,
  signal,
  onProgressChange,
}: {
  file: File;
  uploadUrl: string;
  options?: Options;
  signal?: AbortSignal | undefined;
  onProgressChange?: OnProgressChangeHandler;
}) {
  try {
    onProgressChange?.(0);

    const uploadType = options?.uploadType || "multipart";
    const method = options?.method || "POST";

    const multipartOptions: MultipartOptions = {
      chunkSize: options?.chunkSize || 5 * 1024 * 1024,
      maxRetries: options?.maxRetries || 5,
      retryDelay: options?.retryDelay || 3000,
      maxParallel: options?.maxParallel || 5,
    };

    if (uploadType === "multipart") {
      return multipartUpload({
        uploadUrl,
        method,
        onProgressChange,
        signal,
        file,
        multipartOptions,
      });
    } else if (uploadType === "single") {
      return uploadFileInner({
        method,
        file,
        uploadUrl,
        onProgressChange,
        signal,
      });
    } else {
      throw new FileUploadError("An error occurred");
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new UploadAbortedError("File upload aborted");
    }
    onProgressChange?.(0);
    throw e;
  }
}

async function multipartUpload({
  method,
  uploadUrl,
  onProgressChange,
  file,
  signal,
  multipartOptions,
}: {
  file: File;
  method: Method;
  chunkSize?: number;
  signal: AbortSignal | undefined;
  onProgressChange: OnProgressChangeHandler | undefined;
  uploadUrl: string;
  multipartOptions: MultipartOptions;
}) {
  const { partSize, parts, totalParts } = generateMultipartInfo(
    file,
    multipartOptions.chunkSize
  );

  const uploadingParts: {
    partNumber: number;
    progress: number;
  }[] = [];

  const uploadPart = async ({
    part,
    chunk,
  }: {
    part: (typeof parts)[number];
    chunk: Blob;
  }) => {
    const eTag = await uploadFileInner({
      method,
      file: chunk,
      uploadUrl,
      signal,
      onProgressChange: (progress) => {
        const uploadingPart = uploadingParts.find(
          (p) => p.partNumber === part.partNumber
        );
        if (uploadingPart) {
          uploadingPart.progress = progress;
        } else {
          uploadingParts.push({
            partNumber: part.partNumber,
            progress,
          });
        }
        const totalProgress =
          Math.round(
            uploadingParts.reduce((acc, p) => acc + p.progress * 100, 0) /
              totalParts
          ) / 100;
        onProgressChange?.(totalProgress);
      },
    });
    if (!eTag) {
      throw new FileUploadError("Could not get ETag from multipart response");
    }
    return {
      partNumber: part.partNumber,
      eTag,
    };
  };

  // Upload the parts in parallel
  return queuedPromises({
    items: parts.map((part) => ({
      part,
      chunk: file.slice(
        (part.partNumber - 1) * partSize,
        part.partNumber * partSize
      ),
    })),
    fn: uploadPart,
    maxParallel: multipartOptions.maxParallel,
    retryDelay: multipartOptions.retryDelay,
    maxRetries: multipartOptions.maxRetries,
  });
}

function generateMultipartInfo(file: File, partSize: number) {
  const totalParts = Math.ceil(file.size / partSize);

  const parts = Array.from({ length: totalParts }, (_, index) => ({
    partNumber: index + 1,
  }));

  return {
    partSize, // The size of each part
    parts, // Array of part metadata
    totalParts, // Total number of parts
  };
}

async function uploadFileInner(props: {
  file: File | Blob;
  uploadUrl: string;
  method: Method;
  onProgressChange?: OnProgressChangeHandler;
  signal?: AbortSignal;
}) {
  const { file, uploadUrl, onProgressChange, method, signal } = props;

  return new Promise<{ eTag: string | null; response: unknown }>(
    (resolve, reject) => {
      if (signal?.aborted) {
        reject(new UploadAbortedError("File upload aborted"));
        return;
      }

      const request = new XMLHttpRequest();
      request.open(method, uploadUrl);

      request.addEventListener("loadstart", () => {
        onProgressChange?.(0);
      });
      request.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          // 2 decimal progress
          const progress = Math.round((e.loaded / e.total) * 10000) / 100;
          onProgressChange?.(progress);
        }
      });
      request.addEventListener("error", () => {
        reject(new Error("Error uploading file"));
      });
      request.addEventListener("abort", () => {
        reject(new UploadAbortedError("File upload aborted"));
      });
      request.addEventListener("loadend", () => {
        // Return the ETag header (needed to complete multipart upload)
        const eTag = request.getResponseHeader("ETag");
        const response = request.responseText;

        if (request.status >= 200 && request.status < 300) {
          resolve({ eTag, response: JSON.parse(response) }); // Return eTag and response
        } else {
          reject(
            new FileUploadError(`Upload failed with status: ${request.status}`)
          );
        }
      });

      if (signal) {
        signal.addEventListener("abort", () => {
          request.abort();
        });
      }

      request.send(file);
    }
  );
}

async function queuedPromises<TType, TRes>({
  items,
  fn,
  retryDelay,
  maxParallel,
  maxRetries,
}: {
  items: TType[];
  fn: (item: TType) => Promise<TRes>;
  maxParallel: number;
  retryDelay: number;
  maxRetries: number;
}): Promise<TRes[]> {
  const results: TRes[] = new Array(items.length);

  const executeWithRetry = async (
    func: () => Promise<TRes>,
    retries: number
  ): Promise<TRes> => {
    try {
      return await func();
    } catch (error) {
      if (error instanceof UploadAbortedError) {
        throw error;
      }
      if (retries > 0) {
        await delay(retryDelay);
        return executeWithRetry(func, retries - 1);
      } else {
        throw error;
      }
    }
  };

  const semaphore = {
    count: maxParallel,
    async wait() {
      // If we've reached our maximum concurrency, or it's the last item, wait
      while (this.count <= 0) {
        await delay(500);
      }
      this.count--;
    },
    signal() {
      this.count++;
    },
  };

  const tasks: Promise<void>[] = items.map((item, i) =>
    (async () => {
      await semaphore.wait();

      try {
        const result = await executeWithRetry(() => fn(item), maxRetries);
        results[i] = result;
      } finally {
        semaphore.signal();
      }
    })()
  );

  await Promise.all(tasks);
  return results;
}
