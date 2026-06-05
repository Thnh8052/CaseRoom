import { WifiOff } from "lucide-react";

export function ReconnectingOverlay() {
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content glass-panel" style={{ textAlign: "center", maxWidth: 400 }}>
        <WifiOff size={64} color="#ef4444" style={{ margin: "0 auto 16px", animation: "pulseInspect 2s infinite" }} />
        <h2 style={{ color: "#f8fafc", marginBottom: 12 }}>Mất kết nối</h2>
        <p style={{ color: "#9da6bd", fontSize: "1.1rem" }}>
          Máy chủ đang không phản hồi. Đang tự động kết nối lại...
        </p>
      </div>
    </div>
  );
}
