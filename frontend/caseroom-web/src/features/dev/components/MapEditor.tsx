import { useState, useRef, MouseEvent, ChangeEvent } from "react";
import "../styles/map-editor.css";

type Hitbox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  objectId: string;
};

export function MapEditor() {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedImageUrl(url);
      setHitboxes([]); // Reset hitboxes when new image is uploaded
    }
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const currentX = Math.round(e.clientX - rect.left);
    const currentY = Math.round(e.clientY - rect.top);

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const w = Math.abs(currentX - startPoint.x);
    const h = Math.abs(currentY - startPoint.y);

    setCurrentRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) return;
    setIsDrawing(false);

    if (currentRect.w > 10 && currentRect.h > 10) {
      const objectId = prompt("Nhập ID của Object (VD: O32 - Két sắt):");
      if (objectId) {
        setHitboxes(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          x: currentRect.x,
          y: currentRect.y,
          width: currentRect.w,
          height: currentRect.h,
          objectId
        }]);
      }
    }
    setCurrentRect(null);
  };

  const handleRemoveHitbox = (id: string) => {
    setHitboxes(prev => prev.filter(h => h.id !== id));
  };

  const exportJson = () => {
    const data = JSON.stringify(hitboxes, null, 2);
    console.log(data);
    alert("Đã xuất JSON ra Console (Nhấn F12 để xem)!");
  };

  return (
    <div className="map-editor-container">
      <div className="editor-sidebar">
        <h2>Map Editor</h2>

        <div className="form-group">
          <label>1. Tải ảnh phòng lên:</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ color: 'white' }}
          />
        </div>

        {uploadedImageUrl && (
          <div className="form-group">
            <label>2. Dùng chuột kéo thả để vẽ khung</label>
          </div>
        )}

        <div className="hitbox-list">
          <h3>Hitboxes ({hitboxes.length})</h3>
          {hitboxes.map(h => (
            <div key={h.id} className="hitbox-item">
              <span>{h.objectId}</span>
              <small>({h.x}, {h.y}) [{h.width}x{h.height}]</small>
              <button onClick={() => handleRemoveHitbox(h.id)}>X</button>
            </div>
          ))}
        </div>

        <button className="btn-export" onClick={exportJson} disabled={hitboxes.length === 0}>Xuất JSON</button>
      </div>

      <div className="editor-workspace">
        {!uploadedImageUrl ? (
          <div style={{ color: '#94a3b8', fontSize: '1.2rem', textAlign: 'center' }}>
            <p>Vui lòng chọn một file ảnh ở cột bên trái.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>(Ảnh sẽ hiển thị đúng kích thước gốc để đảm bảo tọa độ X,Y chuẩn xác)</p>
          </div>
        ) : (
          <div
            className="canvas-wrapper"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ minWidth: '300px', minHeight: '300px', background: 'rgba(255,255,255,0.05)' }}
          >
            <img
              ref={imageRef}
              src={uploadedImageUrl}
              alt="Uploaded Room Background"
              className="room-bg"
              draggable="false"
              onLoad={() => console.log("Image loaded successfully:", uploadedImageUrl)}
              onError={(e) => {
                console.error("Image failed to load:", uploadedImageUrl);
                alert("Lỗi: Không thể tải ảnh này (" + uploadedImageUrl + "). Vui lòng thử ảnh khác.");
              }}
            />

            {/* Render drawn hitboxes */}
            {hitboxes.map(h => (
              <div
                key={h.id}
                className="drawn-hitbox"
                style={{
                  left: `${h.x}px`,
                  top: `${h.y}px`,
                  width: `${h.width}px`,
                  height: `${h.height}px`
                }}
              >
                <span>{h.objectId}</span>
              </div>
            ))}

            {/* Render current drawing box */}
            {isDrawing && currentRect && (
              <div
                className="drawing-hitbox"
                style={{
                  left: `${currentRect.x}px`,
                  top: `${currentRect.y}px`,
                  width: `${currentRect.w}px`,
                  height: `${currentRect.h}px`
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
