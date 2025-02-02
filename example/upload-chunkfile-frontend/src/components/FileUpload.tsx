import { FolderIcon1 } from "@/assets/icons";
import { cn } from "@/lib/shadcn/utils";
import { forwardRef, useCallback } from "react";
import {
  type DropzoneOptions,
  type FileRejection,
  useDropzone,
} from "react-dropzone";
import { Button } from "./shadcn/ui/button";

interface FileUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  setFiles: (files: File[]) => void;
  setError: (errorName: string) => void;
  options?: DropzoneOptions | undefined;
}

const FileUpload = forwardRef<HTMLDivElement, FileUploadProps>(
  ({ className, setFiles, setError, options, ...props }, ref) => {
    const onDrop = useCallback(
      (acceptedFiles: File[]) => {
        setFiles(acceptedFiles);
      },
      [setFiles]
    );

    const onDropRejected = useCallback(
      (rejectedFiles: FileRejection[]) => {
        let errorName = "";
        switch (rejectedFiles[0].errors[0].code) {
          case "file-too-large":
            errorName = "Selected file is too big.";
            break;
          case "file-invalid-type":
            errorName = "Invalid file type.";
            break;

          default:
            errorName = "Something went wrong.";
            break;
        }

        setError(errorName);
      },
      [setError]
    );

    const { getRootProps, getInputProps } = useDropzone({
      onDrop,
      onDropRejected,
      maxSize: 100 * 1024 * 1024,
      accept: {
        "video/*": [".mp4", ".mov", ".avi"],
        "audio/*": [".mp3", ".wav", ".ogg"],
        "image/*": [".jpg", ".jpeg", ".png", ".gif"],
      },
      ...options,
    });

    return (
      <div
        {...props}
        ref={ref}
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer w-full flex-col items-center rounded-xl border bg-background hover:bg-secondary p-4 gap-4 text-center transition-colors duration-300",
          className
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center">
          <FolderIcon1 />
        </div>
        <div className="my-5 space-y-2">
          <p className="text-body-3 font-medium text-metal-600 dark:text-white">
            Drag & Drop or Choose File to Upload
          </p>
          <p className="text-body-4 font-normal text-metal-400 dark:text-metal-300">
            Video, Audio, Image formats, up to 100 MB.
          </p>
        </div>
        <Button size="sm">Upload File</Button>
        <input {...getInputProps()} />
      </div>
    );
  }
);

export default FileUpload;
