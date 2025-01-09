# Upload Chunkfile

A robust and customizable JavaScript class for uploading large files in chunks. This library is designed for seamless integration into web applications that require efficient file uploads with progress tracking and resumable uploads.

1. [Features](#features)
2. [Benefits](#benefits)
3. [Installation](#installation)
4. [Usage](#usage)
   - [Basic Usage](#basic-usage)
   - [Abort Upload](#abort-upload)
   - [React Usage](#react-usage)
5. [Configuration Options](#configuration-options)
6. [How It Works](#how-it-works)
7. [FAQ](#faq)

---

## Features

- **Chunked Uploads:** Split large files into smaller chunks for reliable uploads.
- **Customizable Chunk Size:** Set your preferred chunk size based on network conditions.
- **Abortable Uploads:** Cancel ongoing uploads using AbortController.
- **Progress Tracking:** Real-time progress updates for a better user experience.
- **Flexible HTTP Methods:** Support for POST, PUT, or any HTTP method.
- **Multi-File and Single-File Upload Modes:** Adaptable to different use cases.

## Benefits

1. **Reliable Large File Uploads:** Handles large files without overwhelming network resources.
2. **Resumable Uploads:** Easily implement resumable uploads (with additional backend support).
3. **Progress Feedback:** Keeps users informed about upload progress.
4. **Network Efficiency:** Avoids uploading the entire file again if an error occurs mid-transfer.
5. **Customizable:** Highly adaptable to different server requirements and APIs.

## Installation

Upload-chunkfile already published on npm.

```bash
npm install upload-chunkfile
# or
yarn add upload-chunkfile
# or
pnpm add upload-chunkfile
# or
bun add upload-chunkfile
```

## Usage

### Basic Usage

You can integrate this library by importing it into your project:

```javascript
import UploadChunkFile from "upload-chunkfile";
```

Here’s a simple example of how to use UploadChunkFile to upload a file:

```javascript
const uploader = new UploadChunkFile({
  uploadType: "multiple", // Use 'single' for single-chunk uploads. DEFAULT: 'multiple'
  method: "POST", // DEFAULT: 'POST'
  chunkSize: 2 * 1024 * 1024, // 2MB chunk size. DEFAULT: 5MB
});

const file = document.querySelector("#fileInput").files[0]; // Select a file input element

uploader
  .uploadFile({
    file,
    uploadUrl: "https://your-server.com/upload",
    onProgressChange: (progress) => {
      console.log(`Upload Progress: ${progress.toFixed(2)}%`);
    },
  })
  .then((response) => {
    console.log("Upload completed successfully:", response);
  })
  .catch((error) => {
    console.error("Upload failed:", error);
  });
```

### Abort Upload

```javascript
const abortController = new AbortController();
const uploader = new UploadChunkFile(
  {
    /* Options */
  },
  abortController.signal
);

setTimeout(() => {
  abortController.abort();
  console.log("Upload aborted");
}, 5000); // Abort after 5 seconds
```

### React Usage

```javascript
const [file, setFile] = (useState < File) | (null > null);
const [progress, setProgress] = useState(0);

const handleUpload = useCallback(async () => {
  const uploadChunkFile = new UploadChunkFile({
    maxParallel: 1,
    retryDelay: 100,
    payloadOptions: {
      chunkName: "file",
    },
  });

  if (file) {
    try {
      const res = await uploadChunkFile.uploadFile({
        file,
        uploadUrl: "http://127.0.0.1:8000/api/upload",
        onProgressChange: (progress) => {
          setProgress(progress);
        },
      });
      console.log(res);
    } catch (error) {
      console.error(error);
    }
  }
}, [file]);
```

## Configuration Options

`UploadChunkFile` take two parameters, first one is `options` object and second one is `AbortSignal`

1. `options` parameter value.

| Option        | Type     | Default           | Description                                                       |
| ------------- | -------- | ----------------- | ----------------------------------------------------------------- |
| `method`      | `string` | `'POST'`          | HTTP method used for the upload. `'POST'` `'PUT'` `'PATCH'`       |
| `uploadType`  | `string` | `'multiple'`      | `'single'` for single upload or `'multiple'` for chunked uploads. |
| `chunkSize`   | `number` | `5 * 1024 * 1024` | Size of the each chunk                                            |
| `maxRetries`  | `number` | `2`               | How many time the request retry if failed                         |
| `retryDelay`  | `number` | `1000`            | Delay of each request retry                                       |
| `maxParallel` | `number` | `1`               | How many request will send as parallelly                          |

2. `options` can take `payloadOptions` value that can be used to modify the payload options.

| Option         | Type     | Default        | Description                                    |
| -------------- | -------- | -------------- | ---------------------------------------------- |
| `chunkName`    | `string` | `chunk`        | This is each chunk name in the payload         |
| `fileName`     | `string` | `fileName`     | This is each file name in the payload          |
| `currentChunk` | `string` | `currentChunk` | This is each current chunk name in the payload |
| `totalChunk`   | `string` | `totalChunk`   | This is total chunk name in the payload        |

3. `uploadChunkFile.uploadFile` parameter value.

| Option             | Type                         | Default | Description                            |
| ------------------ | ---------------------------- | ------- | -------------------------------------- |
| `file`             | `File`                       | `null`  | This is the file                       |
| `uploadUrl`        | `string`                     | `null`  | This is the upload url                 |
| `onProgressChange` | `(progress: number) => void` | `null`  | This is the progress callback function |

## How It Works

1. **File Splitting:** The file is divided into chunks based on the specified chunkSize.
2. **Sequential Uploads:** Each chunk is uploaded sequentially to the server.
3. **Error Handling:** If an error occurs during a chunk upload, the process can be retried (requires additional implementation).
4. **Progress Reporting:** The progress is calculated and reported using the onProgressChange callback.

## Faq

1. How do I handle resumable uploads?
   You can implement resumable uploads by adding metadata to each chunk (e.g., chunk index) and handling them on the server side.

2. What happens if a chunk fails to upload?
   The uploadFile method rejects the promise if a chunk fails to upload. You can implement retry logic in your application.

3. Can I use this with any backend?
   Yes! The package is backend-agnostic. As long as your backend supports receiving file chunks, it will work seamlessly.
