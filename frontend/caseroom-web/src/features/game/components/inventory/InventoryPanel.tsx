import { useState } from "react";
import type { Item, Player } from "../../../../shared/types/game";

type Props = {
  inventory: Item[];
  onDropItem: (itemId: string) => void;
  onGiveItem: (targetPlayerId: string, itemId: string) => void;
  visiblePlayers: Player[]; // to select who to give the item to
};

export function InventoryPanel({ inventory, onDropItem, onGiveItem, visiblePlayers }: Props) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  if (inventory.length === 0) {
    return (
      <aside className="glass-sidebar" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Túi Đồ</h3>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Túi đồ của bạn đang trống.</p>
      </aside>
    );
  }

  return (
    <aside className="glass-sidebar" style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Túi Đồ ({inventory.length}/5)</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {inventory.map(item => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className={`item-btn ${selectedItem?.id === item.id ? "selected" : ""}`}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              background: selectedItem?.id === item.id ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${selectedItem?.id === item.id ? "#38bdf8" : "transparent"}`,
              color: "#fff",
              cursor: "pointer"
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      {selectedItem && (
        <div style={{ marginTop: 16, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
          <p style={{ fontWeight: "bold", marginBottom: 4 }}>{selectedItem.name}</p>
          <p style={{ fontSize: "0.9rem", color: "#cbd5e1", marginBottom: 12 }}>{selectedItem.description}</p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button 
              onClick={() => {
                onDropItem(selectedItem.id);
                setSelectedItem(null);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #ef4444",
                color: "#ef4444",
                cursor: "pointer"
              }}
            >
              Vứt xuống đất
            </button>
            
            {visiblePlayers.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onGiveItem(e.target.value, selectedItem.id);
                    setSelectedItem(null);
                    e.target.value = "";
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  outline: "none",
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                <option value="" style={{ color: "#000" }}>Đưa cho...</option>
                {visiblePlayers.map(p => (
                  <option key={p.id} value={p.id} style={{ color: "#000" }}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
