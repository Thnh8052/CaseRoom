import type { MapRoom, SessionSnapshot } from "../../../../shared/types/game";

type ControlPanelProps = {
  gameStatus: string;
  voiceStatus: string;
  currentRoom: MapRoom;
  isPushToTalkDown: boolean;
  isMoving: boolean;
  targetRoom: MapRoom | null;
  onStartPushToTalk: () => void;
  onStopPushToTalk: () => void;
  isHost: boolean;
  snapshot: SessionSnapshot;
  onStartBriefing: () => void;
  onStartExploration: () => void;
};

/**
 * Bảng điều khiển chính bên trái.
 * Hiển thị trạng thái kết nối, phase hiện tại, và nút Push To Talk.
 * Việc chuyển phòng và tương tác đồ vật giờ được thực hiện trực tiếp trên bản đồ (WASD + Exit Zone).
 */
export function ControlPanel({
  gameStatus,
  voiceStatus,
  currentRoom,
  isPushToTalkDown,
  isMoving,
  targetRoom,
  onStartPushToTalk,
  onStopPushToTalk,
  isHost,
  snapshot,
  onStartBriefing,
  onStartExploration
}: ControlPanelProps) {
  return (
    <aside className="glass-sidebar">
      <h2>CaseRoom</h2>
      <p className="small">{gameStatus}</p>
      {snapshot.selectedMode !== "SinglePlayer" && <p className="small">{voiceStatus}</p>}

      <p className="phase-indicator"><strong>Phase:</strong> {snapshot.phase}</p>

      {isHost && snapshot.phase === "Briefing" && (
        <button onClick={onStartExploration} className="primary-action">
          Start Exploration
        </button>
      )}

      {snapshot.phase === "Briefing" && (
        <div className="briefing-card">
          <h3>Briefing</h3>
          <p>{snapshot.briefingText}</p>
        </div>
      )}

      {isMoving && (
        <div className="movement-status">
          Moving{targetRoom ? ` to ${targetRoom.name}` : ""}...
        </div>
      )}

      {/* Thông tin phòng hiện tại */}
      <div style={{ marginTop: 'auto' }}>
        <h3>Current Room</h3>
        <strong style={{ color: '#38bdf8' }}>{currentRoom.name}</strong>
        <p className="hint" style={{ marginTop: 4, fontSize: '0.75rem' }}>
          Di chuyển bằng W A S D.<br />
          Đến gần cửa để chuyển phòng.
        </p>
      </div>

      {snapshot.selectedMode !== "SinglePlayer" && (
        <div className="ptt-btn-wrapper">
          <button
            className={isPushToTalkDown ? "ptt-btn active" : "ptt-btn"}
            disabled={isMoving}
            onMouseDown={onStartPushToTalk}
            onMouseUp={onStopPushToTalk}
            onMouseLeave={onStopPushToTalk}
            onTouchStart={onStartPushToTalk}
            onTouchEnd={onStopPushToTalk}
          >
            {isMoving ? "Moving..." : isPushToTalkDown ? "Talking..." : "Hold to Talk (V)"}
          </button>
          <p className="hint" style={{ margin: 0 }}>Only players here can hear you.</p>
        </div>
      )}
    </aside>
  );
}
