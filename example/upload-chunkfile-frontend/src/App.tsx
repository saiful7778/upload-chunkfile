import { Button } from "./components/shadcn/ui/button";
import FileUpload from "./components/FileUpload";
import { useCallback, useState } from "react";
import { Info, Trash } from "lucide-react";
import UploadChunkFile from "upload-chunkfile";
import FileTable from "./components/FileTable";
import formatFileSize from "./utils/formatFileSize";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const App: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [fileStatus, setFileStatus] = useState<{
    isError: boolean;
    error: string;
  }>({
    isError: false,
    error: "",
  });
  const [files, setFiles] = useState<File[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleError = (error: string) => {
    setFileStatus((prev) => ({ ...prev, isError: true, error }));
  };

  const handleRemoveFile = useCallback((fileIdx: number) => {
    setFiles((prevFiles) => prevFiles?.filter((_, idx) => idx !== fileIdx));
  }, []);

  const handleFileSelect = useCallback((file: File[]) => {
    if (file.length > 0) {
      setFiles(file);
    } else {
      handleError("No file selected");
    }
  }, []);

  const handleFileUpload = useCallback(async () => {
    const uploadChunkFile = new UploadChunkFile({
      maxParallel: 1,
      retryDelay: 100,
      // chunkSize: 2 * 1024 * 1024,
      payloadOptions: {
        chunkName: "file",
      },
    });
    if (files) {
      try {
        setIsLoading(true);
        for (const file of files) {
          await uploadChunkFile.uploadFile({
            file: file,
            uploadUrl: `${import.meta.env.VITE_BASE_URL}/api/upload`,
            onProgressChange: (progress) => {
              setProgress(progress);
            },
          });
        }
        setFiles([]);
        setProgress(0);
        await queryClient.invalidateQueries({ queryKey: ["files"] });
        toast.success("File is uploaded successfully");
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message);
        } else {
          toast.error("Failed to upload file");
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      handleError("No files selected");
    }
  }, [files, queryClient]);

  return (
    <div className="w-full min-h-screen flex-col gap-4 p-4 flex items-center justify-center overflow-x-hidden">
      <div className="flex flex-col max-w-md w-full gap-2 items-center justify-center">
        <FileUpload
          setFiles={handleFileSelect}
          setError={(error) => handleError(error)}
          options={{ disabled: isLoading }}
        />
        {fileStatus?.isError && (
          <div className="text-center my-4 text-sm text-destructive">
            {fileStatus?.error}
          </div>
        )}
        {progress > 0 && (
          <div className="flex w-full flex-col items-center text-center justify-center gap-2">
            <div className="text-xl font-semibold">{progress.toFixed(2)}%</div>
            <div className="relative h-2.5 w-full rounded-sm bg-border">
              <div
                className="absolute top-0 left-0 transition-all duration-100 h-full bg-primary rounded-sm"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
        {files && files?.length > 0 && (
          <div className="w-full">
            <p className="my-2 flex items-center gap-1 font-normal">
              <Info size={16} />
              Uploaded Files
            </p>
            <ul className="space-y-2 max-h-52 overflow-auto">
              {files?.map((file, idx) => (
                <li
                  key={file?.name}
                  className="flex gap-2 items-center justify-between border-l-4 border-l-accent px-4 py-2.5 text-left font-normal capitalize"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{file?.name}</span>
                    <span className="text-xs">
                      Size: {formatFileSize(file.size)}
                    </span>
                  </div>
                  <Button
                    className="flex-shrink-0"
                    onClick={() => handleRemoveFile(idx)}
                    variant="destructive"
                    size="icon"
                    disabled={isLoading}
                  >
                    <Trash size={16} color="red" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button
          onClick={handleFileUpload}
          className="w-full"
          type="button"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Upload"}
        </Button>
      </div>
      <FileTable />
    </div>
  );
};

export default App;
