import type { MapRoom, SessionSnapshot } from "../types";

type ControlPanelProps = {
  gameStatus: string;
  voiceStatus: string;
  currentRoom: MapRoom;
  rooms: MapRoom[];
  isPushToTalkDown: boolean;
  isMoving: boolean;
  targetRoom: MapRoom | null;
  onMoveToRoom: (roomId: string) => void;
  onInteractObject: (objectId: string) => void;
  onStartPushToTalk: () => void;
  onStopPushToTalk: () => void;
  isHost: boolean;
  canExplore: boolean;
  snapshot: SessionSnapshot;
  onStartBriefing: () => void;
  onStartExploration: () => void;
};

/**
 * Bảng điều khiển chính bên trái.
 * Hiển thị trạng thái kết nối, nút bấm chuyển phòng, các vật thể có thể tương tác, và nút Push To Talk.
 */
export function ControlPanel({
  gameStatus,
  voiceStatus,
  currentRoom,
  rooms,
  isPushToTalkDown,
  isMoving,
  targetRoom,
  onMoveToRoom,
  onInteractObject,
  onStartPushToTalk,
  onStopPushToTalk,
  isHost,
  canExplore,
  snapshot,
  onStartBriefing,
  onStartExploration
}: ControlPanelProps) {
  return (
    <aside className="side-panel">
      <h2>CaseRoom</h2>
      <p className="small">{gameStatus}</p>
      <p className="small">{voiceStatus}</p>

      <p className="phase-indicator"><strong>Phase:</strong> {snapshot.phase}</p>



      {isHost && snapshot.phase === "Briefing" && (
        <button onClick={onStartExploration} className="primary-action">
          Start Exploration
        </button>
      )}

      {snapshot.phase === "Briefing" && (
        <div className="briefing-panel">
          <h3>Briefing</h3>
          <p>{snapshot.briefingText}</p>
        </div>
      )}

      {isMoving && (
        <div className="movement-status">
          Moving{targetRoom ? ` to ${targetRoom.name}` : ""}...
        </div>
      )}

      <div className="ptt-panel">
        <button
          className={isPushToTalkDown ? "ptt active" : "ptt"}
          disabled={isMoving}
          onMouseDown={onStartPushToTalk}
          onMouseUp={onStopPushToTalk}
          onMouseLeave={onStopPushToTalk}
          onTouchStart={onStartPushToTalk}
          onTouchEnd={onStopPushToTalk}
        >
          {isMoving ? "Moving..." : isPushToTalkDown ? "Talking..." : "Hold to Talk (V)"}
        </button>
        <p className="hint">Only players in the same room should hear you.</p>
      </div>

      <h3>Current room</h3>
      <strong>{currentRoom.name}</strong>

      <h3>Move</h3>
      <div className="button-list">
        {currentRoom.connectedRoomIds.map(roomId => {
          const room = rooms.find(r => r.id === roomId);
          return <button key={roomId} disabled={isMoving || !canExplore} onClick={() => onMoveToRoom(roomId)}>{room?.name ?? roomId}</button>;
        })}
      </div>

      <h3>Objects here</h3>
      <div className="button-list">
        {currentRoom.objects.map(obj => (
          <button key={obj.id} disabled={isMoving || !canExplore} onClick={() => onInteractObject(obj.id)}>{obj.name}</button>
        ))}
      </div>
    </aside>
  );
}
