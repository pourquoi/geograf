import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import router from "./routes";
import { AppConfigProvider, FlowProvider } from "./providers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <AppConfigProvider>
          <FlowProvider>
            <RouterProvider router={router} />
          </FlowProvider>
        </AppConfigProvider>
      </QueryClientProvider>
    </ThemeProvider>
    <Toaster position="top-right" richColors={true} />
  </React.StrictMode>,
);
