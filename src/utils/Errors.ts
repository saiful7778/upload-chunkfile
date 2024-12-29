export class UploadAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadAbortedError";
  }
}

export class FileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileUploadError";
  }
}
