import delay from "./utils/delay";
import { FileUploadError, UploadAbortedError } from "./utils/Errors";
import type {
  Options,
  OnProgressChangeHandler,
  Method,
  MultipartOptions,
  PayloadOptions,
  UploadResponse,
  UploadType,
} from "./types";

export default class UploadChunkFile {
  private options: {
    method: Method;
    uploadType: UploadType;
  };
  private signal?: AbortSignal;
  private onProgressChange?: OnProgressChangeHandler;
  private payloadOptions: PayloadOptions;
  private multipartOptions: MultipartOptions;

  // Constructor to initialize options, signal, and default settings
  constructor(options?: Options, signal?: AbortSignal) {
    this.signal = signal;

    this.options = {
      method: options?.method ?? "POST",
      uploadType: options?.uploadType ?? "multipart",
    };

    // Set default values for multipart options
    this.multipartOptions = {
      chunkSize: options?.chunkSize ?? 5 * 1024 * 1024, // Default chunk size is 5MB
      maxRetries: options?.maxRetries ?? 5, // Default max retries
      retryDelay: options?.retryDelay ?? 3000, // Default retry delay in ms
      maxParallel: options?.maxParallel ?? 5, // Default max parallel uploads
    };

    // Set default values for payload options
    this.payloadOptions = {
      chunkName: options?.payloadOptions?.chunkName ?? "chunk",
      filename: options?.payloadOptions?.filename ?? "filename",
      currentChunk: options?.payloadOptions?.currentChunk ?? "currentChunk",
      totalChunk: options?.payloadOptions?.totalChunk ?? "totalChunk",
    };
  }

  // Main function to handle file upload (single or multipart)
  public async uploadFile<T>({
    file,
    uploadUrl,
    onProgressChange,
  }: {
    file: File;
    uploadUrl: string;
    onProgressChange?: OnProgressChangeHandler;
  }): Promise<UploadResponse<T>> {
    try {
      this.onProgressChange = onProgressChange;
      this.onProgressChange?.(0); // Initialize progress to 0

      const uploadType = this.options.uploadType; // Default to multipart upload
      const method = this.options.method; // Default HTTP method

      if (uploadType === "multipart") {
        return this.multipartUpload<T>({ file, uploadUrl, method }); // Multipart upload
      } else if (uploadType === "single") {
        return this.singleFileUpload<T>({ file, uploadUrl, method }); // Single file upload
      } else {
        throw new Error(`Invalid upload type: ${uploadType}`);
      }
    } catch (error) {
      this.handleUploadError(error); // Handle errors centrally
    }
  }

  // Function to handle multipart uploads
  private async multipartUpload<T>({
    file,
    uploadUrl,
    method,
  }: {
    file: File;
    uploadUrl: string;
    method: Method;
  }): Promise<UploadResponse<T>> {
    // Calculate details like part size and total parts
    const { partSize, parts, totalParts } = this.calculateMultipartDetails(
      file,
      this.multipartOptions.chunkSize!
    );

    const uploadProgress: Map<number, number> = new Map(); // Track progress for each part

    // Function to upload a single part
    const uploadPart = async ({
      partNumber,
      chunk,
    }: {
      partNumber: number;
      chunk: Blob;
    }): Promise<void> => {
      await this.singleFileUpload({
        file: chunk,
        uploadUrl,
        method,
        filename: file.name,
        currentChunk: partNumber,
        totalChunk: totalParts,
        onProgressChange: (progress) => {
          uploadProgress.set(partNumber, progress);
          const totalProgress = Array.from(uploadProgress.values()).reduce(
            (sum, value) => sum + value,
            0
          );
          this.onProgressChange?.(totalProgress / totalParts); // Update overall progress
        },
      });
    };

    // Process all parts in parallel batches
    await this.processInBatches(
      parts.map((part) => ({
        partNumber: part.partNumber,
        chunk: file.slice(
          (part.partNumber - 1) * partSize,
          part.partNumber * partSize
        ),
      })),
      uploadPart
    );

    // Return a meaningful response after all parts are uploaded
    return {
      response: {
        message: "File uploaded successfully",
      } as T,
    };
  }

  // Calculate multipart upload details like part size and total parts
  private calculateMultipartDetails(file: File, partSize: number) {
    const totalParts = Math.ceil(file.size / partSize);
    const parts = Array.from({ length: totalParts }, (_, index) => ({
      partNumber: index + 1,
    }));
    return { partSize, parts, totalParts };
  }

  // Function to handle single file upload
  private async singleFileUpload<T>({
    file,
    uploadUrl,
    method,
    filename,
    currentChunk,
    totalChunk,
    onProgressChange,
  }: {
    file: File | Blob;
    uploadUrl: string;
    method: Method;
    filename?: string;
    currentChunk?: number;
    totalChunk?: number;
    onProgressChange?: OnProgressChangeHandler;
  }): Promise<UploadResponse<T>> {
    return new Promise<{ response: T }>((resolve, reject) => {
      if (this.signal?.aborted) {
        reject(new UploadAbortedError("File upload aborted"));
        return;
      }

      const request = new XMLHttpRequest();
      request.open(method, uploadUrl);

      // Setup event handlers for request
      this.setupRequestHandlers({
        request,
        onProgressChange,
        resolve,
        reject,
      });

      // Create FormData payload
      const formData = new FormData();
      formData.append(this.payloadOptions.chunkName!, file);
      if (filename) formData.append(this.payloadOptions.filename!, filename);
      if (currentChunk)
        formData.append(
          this.payloadOptions.currentChunk!,
          currentChunk.toString()
        );
      if (totalChunk)
        formData.append(this.payloadOptions.totalChunk!, totalChunk.toString());

      request.send(formData); // Send the request
    });
  }

  // Setup event handlers for XMLHttpRequest
  private setupRequestHandlers<T>({
    request,
    onProgressChange,
    resolve,
    reject,
  }: {
    request: XMLHttpRequest;
    onProgressChange?: OnProgressChangeHandler;
    resolve: (value: { response: T } | PromiseLike<{ response: T }>) => void;
    reject: (reason?: any) => void;
  }) {
    // Track upload progress
    request.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        onProgressChange?.(progress);
      }
    });

    // Handle successful response
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve({ response: JSON.parse(request.responseText) });
        return { response: JSON.parse(request.response) };
      } else {
        reject(new FileUploadError(`HTTP ${request.status}`));
      }
    });

    // Handle errors
    request.addEventListener("error", () =>
      reject(new FileUploadError("Upload failed"))
    );

    // Handle abort
    request.addEventListener("abort", () =>
      reject(new UploadAbortedError("Upload aborted"))
    );

    // Abort request if signal is triggered
    if (this.signal) {
      this.signal.addEventListener("abort", () => request.abort());
    }
  }

  // Process items in batches with retries
  private async processInBatches<TItem, TResult>(
    items: TItem[],
    processFn: (item: TItem) => Promise<TResult>
  ): Promise<TResult[]> {
    const results: TResult[] = Array(items.length).fill(
      undefined as unknown as TResult
    );

    const tasks = items.map(async (item, index) => {
      for (
        let attempt = 0;
        attempt <= this.multipartOptions.maxRetries!;
        attempt++
      ) {
        try {
          results[index] = await processFn(item); // Process the item
          break;
        } catch (error) {
          if (attempt === this.multipartOptions.maxRetries) {
            throw error; // Fail after max retries
          }
          await delay(this.multipartOptions.retryDelay!); // Wait before retrying
        }
      }
    });

    await Promise.all(tasks); // Wait for all tasks to complete
    return results;
  }

  // Centralized error handling
  private handleUploadError(error: unknown): never {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UploadAbortedError("Upload aborted by user");
    }
    this.onProgressChange?.(0); // Reset progress on error
    throw error; // Re-throw the error
  }
}
