import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/assets/css/style.css";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 5000,
          removeDelay: 1000,
          className: "react-hot-toast",
        }}
      />
    </QueryClientProvider>
  </StrictMode>
);
