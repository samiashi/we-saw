import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ToastProvider } from "@/components/ToastProvider";
import { StoreProvider } from "@/lib/store";
import { applyTheme, getTheme } from "@/lib/theme";
import { captureInviteCode } from "@/lib/invite";
import "@/styles.css";

applyTheme(getTheme());
captureInviteCode();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <ToastProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </ToastProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
