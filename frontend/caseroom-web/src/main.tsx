import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ToastProvider } from "./shared/ui/ToastProvider";
import { MapEditor } from "./features/dev/components/MapEditor";

const path = window.location.pathname;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      {path === "/dev/map-editor" ? <MapEditor /> : <App />}
    </ToastProvider>
  </React.StrictMode>
);
