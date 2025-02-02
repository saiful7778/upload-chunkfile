import { cn } from "@/lib/shadcn/utils";
import { Loader } from "lucide-react";

const Spinner: React.FC<{ className?: string; size: number }> = ({
  className,
  size = 20,
}) => {
  return (
    <span
      className={cn("animate-spinner inline-block h-fit w-fit", className)}
      role="status"
    >
      <Loader size={size} />
    </span>
  );
};

export default Spinner;
