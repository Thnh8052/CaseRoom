import { useState } from "react";
import type { Item, MapRoom, Player, SessionSnapshot } from "../../../../shared/types/game";

type GameHUDProps = {
  snapshot: SessionSnapshot;
  currentRoom: MapRoom;
  players: Player[];
  talkingIds: Set<string>;
  inspectingPlayers: Record<string, string>;
  selfPlayer?: Player;
  voiceStatus: string;
  isHost: boolean;
  isMoving: boolean;
  isPushToTalkDown: boolean;
  onStartExploration: () => void;
  onStartPushToTalk: () => void;
  onStopPushToTalk: () => void;
  onDropItem: (itemId: string) => void;
  onGiveItem: (targetPlayerId: string, itemId: string) => void;
};

const ITEM_ICONS: Record<string, string> = {
  Key: "🗝️",
  Weapon: "🔪",
  Clue: "🔍",
  Note: "📄",
  default: "📦",
};

function getItemIcon(type: string) {
  return ITEM_ICONS[type] ?? ITEM_ICONS.default;
}

/**
 * GameHUD — Toàn bộ UI game tích hợp ở dạng Floating Overlay.
 * Gồm: Info Panel góc trái, Players Panel góc phải, Inventory Hotbar đáy màn hình, PTT button.
 */
export function GameHUD({
  snapshot,
  currentRoom,
  players,
  talkingIds,
  inspectingPlayers,
  selfPlayer,
  voiceStatus,
  isHost,
  isMoving,
  isPushToTalkDown,
  onStartExploration,
  onStartPushToTalk,
  onStopPushToTalk,
  onDropItem,
  onGiveItem,
}: GameHUDProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [giveTargetId, setGiveTargetId] = useState<string | null>(null);
  const [playersOpen, setPlayersOpen] = useState(false);

  const inventory: Item[] = selfPlayer?.inventory ?? [];
  const selectedItem = inventory.find(i => i.id === selectedItemId) ?? null;

  const otherPlayers = players.filter(p => p.id !== selfPlayer?.id);

  const handleDrop = () => {
    if (!selectedItemId) return;
    onDropItem(selectedItemId);
    setSelectedItemId(null);
  };

  const handleGive = (targetId: string) => {
    if (!selectedItemId) return;
    onGiveItem(targetId, selectedItemId);
    setSelectedItemId(null);
    setGiveTargetId(null);
  };

  return (
    <>
      {/* ── TOP LEFT: Trạng thái game ── */}
      <div className="hud-panel hud-top-left">
        <div className="hud-room-info">
          <span className="hud-eyebrow">🏚 {snapshot.phase}</span>
          <h2 className="hud-room-name">{currentRoom.name}</h2>
          {isMoving && <span className="hud-moving">⟳ Đang chuyển phòng...</span>}
        </div>

        {isHost && snapshot.phase === "Briefing" && (
          <button className="hud-action-btn" onClick={onStartExploration}>
            ▶ Bắt Đầu Khám Phá
          </button>
        )}

        {snapshot.phase === "Briefing" && snapshot.briefingText && (
          <div className="hud-briefing">
            <p>{snapshot.briefingText}</p>
          </div>
        )}

        <p className="hud-hint">WASD: Di chuyển &nbsp;|&nbsp; F: Khám xét &nbsp;|&nbsp; E: Nhặt</p>
      </div>

      {/* ── TOP CENTER: Role Indicator ── */}
      {selfPlayer?.role && snapshot.selectedMode !== "SinglePlayer" && snapshot.phase === "Exploration" && (
        <div className="hud-panel hud-top-center">
          <span className="hud-role-text">
            Vai Trò: <span className={selfPlayer.role === "Murderer" ? "role-murderer" : "role-detective"}>
              {selfPlayer.role === "Murderer" ? "Hung Thủ" : "Thám Tử"}
            </span>
          </span>
        </div>
      )}

      {/* ── TOP RIGHT: Người trong phòng (Collapsible) ── */}
      <div className="hud-panel hud-top-right">
        <button
          className="hud-players-toggle"
          onClick={() => setPlayersOpen(o => !o)}
        >
          👥 {players.length} trong phòng {playersOpen ? "▲" : "▼"}
        </button>

        <div className={`hud-players-list-wrapper ${playersOpen ? "open" : ""}`}>
          <div className="hud-players-list">
            {players.length === 0 && <p className="hud-hint">Không có ai ở đây.</p>}
            {players.map(player => (
              <div
                key={player.id}
                className={`hud-player-card ${talkingIds.has(player.id) ? "speaking" : ""}`}
              >
                <div
                  className="hud-player-avatar"
                  style={{ background: player.appearance?.avatarColor ?? "#38bdf8" }}
                >
                  {player.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="hud-player-info">
                  <strong>{player.name}</strong>
                  {player.role === "Murderer" && (
                    <span style={{ color: "#ef4444", fontSize: "0.75em" }}> (Hung thủ)</span>
                  )}
                  {inspectingPlayers[player.id] && (
                    <em style={{ color: "#f59e0b", fontSize: "0.75em", display: "block" }}>
                      🔍 Đang khám xét...
                    </em>
                  )}
                  {talkingIds.has(player.id) && (
                    <em style={{ color: "#34d399", fontSize: "0.75em", display: "block" }}>
                      🎙 Đang nói...
                    </em>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CENTER: Inventory Hotbar ── */}
      <div className="hud-hotbar">
        {Array.from({ length: 6 }).map((_, i) => {
          const item = inventory[i];
          const isSelected = item && item.id === selectedItemId;
          return (
            <button
              key={i}
              className={`hud-slot ${item ? "has-item" : "empty"} ${isSelected ? "active" : ""}`}
              onClick={() => {
                if (!item) return;
                setSelectedItemId(isSelected ? null : item.id);
                setGiveTargetId(null);
              }}
              title={item?.name}
            >
              {item ? (
                <>
                  <span className="slot-icon">{getItemIcon(item.type)}</span>
                  <span className="slot-name">{item.name}</span>
                </>
              ) : (
                <span className="slot-empty">—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Popup action khi chọn item trong hotbar ── */}
      {selectedItem && (
        <div className="hud-item-popup">
          <div className="hud-item-popup-header">
            <span>{getItemIcon(selectedItem.type)} {selectedItem.name}</span>
            <button className="popup-close" onClick={() => { setSelectedItemId(null); setGiveTargetId(null); }}>✕</button>
          </div>
          <p className="hud-item-desc">{selectedItem.description}</p>

          <div className="hud-item-actions">
            <button className="popup-action-btn drop" onClick={handleDrop}>
              📤 Thả xuống
            </button>

            {otherPlayers.length > 0 && (
              <button
                className="popup-action-btn give"
                onClick={() => setGiveTargetId(giveTargetId ? null : "selecting")}
              >
                🤝 Đưa cho người khác
              </button>
            )}
          </div>

          {/* Chọn người nhận */}
          {giveTargetId === "selecting" && (
            <div className="hud-give-targets">
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: 8 }}>Chọn người nhận:</p>
              {otherPlayers.map(p => (
                <button key={p.id} className="give-target-btn" onClick={() => handleGive(p.id)}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 24, height: 24,
                      borderRadius: "50%",
                      background: p.appearance?.avatarColor ?? "#38bdf8",
                      marginRight: 8,
                      fontSize: "0.8rem",
                      lineHeight: "24px",
                      textAlign: "center"
                    }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM RIGHT: PTT Button ── */}
      {snapshot.selectedMode !== "SinglePlayer" && (
        <div className="hud-ptt">
          <button
            className={`hud-ptt-btn ${isPushToTalkDown ? "active" : ""}`}
            onMouseDown={onStartPushToTalk}
            onMouseUp={onStopPushToTalk}
            onMouseLeave={onStopPushToTalk}
            onTouchStart={onStartPushToTalk}
            onTouchEnd={onStopPushToTalk}
          >
            {isPushToTalkDown ? "🎙 Nói..." : "🎙 Giữ (V)"}
          </button>
          <p className="hud-hint" style={{ textAlign: "center", marginTop: 4 }}>{voiceStatus}</p>
        </div>
      )}
    </>
  );
}
