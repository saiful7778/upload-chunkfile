import { Input } from "@/components/shadcn/ui/input";
import { Button } from "./components/shadcn/ui/button";

const App: React.FC = () => {
  return (
    <div className="w-full min-h-screen flex-col gap-2 p-4 flex items-center justify-center overflow-x-hidden">
      <form className="flex flex-col gap-2 items-center justify-center">
        <Input type="file" />
        <Button type="submit">Submit</Button>
      </form>
    </div>
  );
};

export default App;
