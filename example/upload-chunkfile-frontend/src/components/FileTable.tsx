import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./shadcn/ui/table";
import { axiosPublic } from "@/lib/config/axios.config";
import formatFileSize from "@/utils/formatFileSize";
import moment from "moment";
import { Button } from "./shadcn/ui/button";
import { Trash } from "lucide-react";
import Spinner from "./Spinner";
import toast from "react-hot-toast";

interface FileDataProps {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
  updated_at: string;
}

const FileTable: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const { data } = await axiosPublic.get<{
        data: FileDataProps[];
      }>("/api/uploaded");
      return data?.data;
    },
  });

  if (isLoading) {
    return <div className="text-center my-4 text-sm">Loading...</div>;
  }

  if (isError) {
    return (
      <div className="text-center my-4 text-sm text-destructive">
        Something went wrong!
      </div>
    );
  }

  return (
    <div className="w-full md:w-[90%]">
      <Table className="text-nowrap">
        <TableCaption>A list of uploaded files</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>File Name</TableHead>
            <TableHead>File Type</TableHead>
            <TableHead>File Size</TableHead>
            <TableHead>File Path</TableHead>
            <TableHead>Uploaded at</TableHead>
            <TableHead className="text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No records found
              </TableCell>
            </TableRow>
          ) : (
            data?.map((fileData, idx) => (
              <FileTableRow fileData={fileData} key={`file-row-${idx}`} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const FileTableRow: React.FC<{ fileData: FileDataProps }> = ({ fileData }) => {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationKey: ["deleteFile"],
    mutationFn: async ({ fileId }: { fileId: number }) => {
      return axiosPublic.delete(`/api/uploaded/${fileId}`);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("File deleted successfully!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  return (
    <TableRow>
      <TableCell>{fileData.id}</TableCell>
      <TableCell>{fileData.file_name}</TableCell>
      <TableCell>{fileData.file_type}</TableCell>
      <TableCell>{formatFileSize(fileData.file_size)}</TableCell>
      <TableCell>
        <a
          className="text-blue-400 underline"
          href={`${import.meta.env.VITE_BASE_URL}/${fileData.file_path}`}
          target="_blank"
        >
          {import.meta.env.VITE_BASE_URL}/{fileData.file_path}
        </a>
      </TableCell>
      <TableCell>
        {moment(fileData.created_at).format("DD/MMM/YY - h:m a")}
      </TableCell>
      <TableCell className="text-center">
        <Button
          className="flex-shrink-0"
          onClick={() => mutate({ fileId: fileData?.id })}
          variant="destructive"
          size="icon"
          disabled={isPending}
        >
          {isPending ? <Spinner size={15} /> : <Trash size={16} color="red" />}
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default FileTable;
