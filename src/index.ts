import delay from "./utils/delay";
import { FileUploadError, UploadAbortedError } from "./utils/Errors";
import type {
  Method,
  MultipartOptions,
  OnProgressChangeHandler,
  Options,
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
      method: options?.method ?? "POST", // Default HTTP method is POST
      uploadType: options?.uploadType ?? "multiple", // Default upload type is multipart
    };

    // Set default values for multipart options
    this.multipartOptions = {
      chunkSize: options?.chunkSize || 5 * 1024 * 1024, // Default chunk size is 5MB
      maxRetries: options?.maxRetries || 2, // Default max retries for failed uploads
      retryDelay: options?.retryDelay || 1000, // Default retry delay in milliseconds
      maxParallel: options?.maxParallel || 1, // Default maximum parallel uploads
    };

    // Set default values for payload options
    this.payloadOptions = {
      chunkName: options?.payloadOptions?.chunkName ?? "chunk", // Default chunk name key
      fileName: options?.payloadOptions?.fileName ?? "fileName", // Default file name key
      currentChunk: options?.payloadOptions?.currentChunk ?? "currentChunk", // Default current chunk key
      totalChunk: options?.payloadOptions?.totalChunk ?? "totalChunk", // Default total chunk key
    };
  }

  // Main method to upload a file
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
      this.onProgressChange = onProgressChange; // Set the progress change handler
      this.onProgressChange?.(0); // Initialize progress to 0

      const uploadType = this.options.uploadType; // Determine upload type

      // Check the upload type and call the appropriate method
      if (uploadType === "multiple") {
        return this.multipartUpload<T>({ file, uploadUrl }); // Perform multipart upload
      } else if (uploadType === "single") {
        return this.singleFileUpload<T>({ file, uploadUrl }); // Perform single file upload
      } else {
        throw new Error(`Invalid upload type: ${uploadType}`); // Handle invalid upload type
      }
    } catch (error) {
      this.handleUploadError(error); // Handle errors centrally
    }
  }

  // Method to handle multipart uploads
  private async multipartUpload<T>({
    file,
    uploadUrl,
  }: {
    file: File;
    uploadUrl: string;
  }) {
    // Calculate the number of chunks and chunk details
    const { chunks, totalChunks } = this.calculateMultipartDetails(file);
    const uploadProgress: Map<number, number> = new Map(); // Track progress for each part

    // Function to upload a single part
    const uploadPart = async ({
      chunkIndex,
      chunk,
    }: {
      chunkIndex: number;
      chunk: Blob;
    }): Promise<UploadResponse<T>> => {
      return this.singleFileUpload<T>({
        file: chunk,
        uploadUrl,
        fileName: file.name, // Include file name in the request
        currentChunk: chunkIndex, // Current chunk index
        totalChunk: totalChunks, // Total number of chunks
        onProgressChange: (progress) => {
          uploadProgress.set(chunkIndex, progress); // Track progress for the current chunk
          const totalProgress = Array.from(uploadProgress.values()).reduce(
            (sum, value) => sum + value,
            0
          );
          this.onProgressChange?.(totalProgress / totalChunks); // Update overall progress
        },
      });
    };

    // Process chunks in batches
    return await this.processInBatches(
      chunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex, // Index of the chunk
        chunk: file.slice(
          (chunk.chunkIndex - 1) * this.multipartOptions.chunkSize!, // Start byte
          chunk.chunkIndex * this.multipartOptions.chunkSize! // End byte
        ),
      })),
      uploadPart // Function to process each chunk
    );
  }

  // Method to handle single file uploads
  private async singleFileUpload<T>({
    file,
    uploadUrl,
    fileName,
    currentChunk,
    totalChunk,
    onProgressChange,
  }: {
    file: File | Blob;
    uploadUrl: string;
    fileName?: string;
    currentChunk?: number;
    totalChunk?: number;
    onProgressChange?: OnProgressChangeHandler;
  }): Promise<UploadResponse<T>> {
    return new Promise<{ response: T }>((resolve, reject) => {
      if (this.signal?.aborted) {
        reject(new UploadAbortedError("File upload aborted")); // Handle abort signal
        return;
      }

      const request = new XMLHttpRequest();
      request.open(this.options.method, uploadUrl); // Open the request

      // Setup event handlers for the request
      this.setupRequestHandlers({
        request,
        onProgressChange,
        resolve,
        reject,
      });

      // Create FormData payload
      const formData = new FormData();
      formData.append(this.payloadOptions.chunkName!, file); // Add file chunk

      if (fileName) {
        formData.append(this.payloadOptions.fileName!, fileName); // Add file name
      }

      if (currentChunk || currentChunk === 0) {
        formData.append(
          this.payloadOptions.currentChunk!,
          currentChunk.toString()
        ); // Add current chunk index
      }

      if (totalChunk) {
        formData.append(this.payloadOptions.totalChunk!, totalChunk.toString()); // Add total chunks
      }

      request.send(formData); // Send the request
    });
  }

  // Method to process items in batches with concurrency control
  private async processInBatches<TItem, TResult>(
    items: TItem[],
    processFn: (item: TItem) => Promise<TResult>
  ): Promise<TResult> {
    let finalResult: Awaited<TResult>;

    // Semaphore to control concurrency
    const semaphore = {
      count: this.multipartOptions.maxParallel!,
      async wait() {
        while (this.count <= 0) await delay(500); // Wait if maximum concurrency is reached
        this.count--;
      },
      signal() {
        this.count++;
      },
    };

    // Function to execute with retries
    const executeWithRetry = async (
      func: () => Promise<TResult>,
      retries: number
    ): Promise<TResult> => {
      try {
        return await func();
      } catch (error) {
        if (error instanceof UploadAbortedError) {
          throw error; // Abort error should not be retried
        }
        if (retries > 0) {
          await delay(this.multipartOptions.retryDelay!); // Delay before retry
          return executeWithRetry(func, retries - 1); // Retry
        } else {
          throw error; // Throw error after max retries
        }
      }
    };

    // Map over items and process each in a batch
    const tasks: Promise<void>[] = items.map((item, i) =>
      (async () => {
        await semaphore.wait(); // Wait for concurrency slot

        try {
          const result = await executeWithRetry(
            () => processFn(item),
            this.multipartOptions.maxRetries!
          );
          if (i === items.length - 1) {
            finalResult = result; // Store the final result
          }
        } finally {
          semaphore.signal(); // Release concurrency slot
        }
      })()
    );

    await Promise.all(tasks); // Wait for all tasks to complete
    return finalResult!; // Return the final result
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
    reject: (reason?: unknown) => void;
  }) {
    // Track upload progress
    request.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100; // Calculate progress percentage
        onProgressChange?.(progress); // Update progress
      }
    });

    request.setRequestHeader("Accept", "application/json"); // Set request header

    // Handle successful response
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve({ response: JSON.parse(request.responseText) }); // Resolve with parsed response
      } else {
        reject(new FileUploadError(`HTTP ${request.status}`)); // Reject on error status
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

  // Calculate multipart upload details
  private calculateMultipartDetails(file: File) {
    const totalChunks = Math.ceil(file.size / this.multipartOptions.chunkSize!); // Calculate total chunks

    const chunks = Array.from({ length: totalChunks }, (_, index) => ({
      chunkIndex: index, // Create an object for each chunk with its index
    }));

    return { chunks, totalChunks }; // Return chunks and total chunks
  }

  // Handle errors during upload
  private handleUploadError(error: unknown): never {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UploadAbortedError("Upload aborted by user"); // Handle abort error
    }
    this.onProgressChange?.(0); // Reset progress on error
    throw error; // Re-throw the error
  }
}
