import { useState, useEffect } from "react";
import type { MapRoom, Player } from "../../../shared/types/game";

type CurrentRoomViewProps = {
  room: MapRoom;
  players: Player[];
  selfPlayerId?: string;
  talkingIds: Set<string>;
  inspectingPlayers: Record<string, string>;
  isMoving: boolean;
  canExplore?: boolean;
  onInteractObject?: (objectId: string) => void;
  onStartInspection?: (objectId: string) => void;
  onCancelInspection?: (objectId: string) => void;
  onCompleteInspection?: (objectId: string) => void;
};

/**
 * Component hiển thị bản đồ trực quan của căn phòng hiện tại.
 * Render theo mô hình Layer: Layer 1 (Background), Layer 2 (Object PNGs), Layer 3 (Players).
 */
const CANVAS_W = 1280;
const CANVAS_H = 720;

export function CurrentRoomView({ room, players, selfPlayerId, talkingIds, inspectingPlayers, isMoving, canExplore, onInteractObject, onStartInspection, onCancelInspection, onCompleteInspection }: CurrentRoomViewProps) {
  const [inspectingObjectId, setInspectingObjectId] = useState<string | null>(null);
  const [inspectProgress, setInspectProgress] = useState(0);

  // Auto-cancel inspection if the player moves away from the object
  useEffect(() => {
    const selfPlayer = players.find(p => p.id === selfPlayerId);
    if (inspectingObjectId && selfPlayer?.currentObjectId !== inspectingObjectId) {
      setInspectingObjectId(null);
      setInspectProgress(0);
      onCancelInspection?.(inspectingObjectId);
    }
  }, [players, selfPlayerId, inspectingObjectId, onCancelInspection]);

  // Handle the inspection progress bar
  useEffect(() => {
    if (!inspectingObjectId) return;

    let frame: number;
    let start = performance.now();
    const duration = 3000; // 3 seconds to inspect

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setInspectProgress(progress);

      if (progress < 100) {
        frame = requestAnimationFrame(tick);
      } else {
        onCompleteInspection?.(inspectingObjectId);
        setInspectingObjectId(null);
        setInspectProgress(0);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inspectingObjectId, onCompleteInspection]);

  const startInspection = (e: React.MouseEvent, objectId: string) => {
    e.stopPropagation(); // Ngăn không cho click xuyên xuống object (gây di chuyển lại)
    setInspectingObjectId(objectId);
    setInspectProgress(0);
    onStartInspection?.(objectId);
  };

  return (
    <section className={isMoving ? "room-stage muted" : "room-stage"}>
      <div className="room-stage-header">
        <p className="eyebrow">Current visible room</p>
        <h1>{room.name}</h1>
        <p className="hint">You only see players who are currently in this room.</p>
      </div>

      <div className="layered-room">
        {/* Layer 1: Background */}
        <img
          key={`bg-${room.id}`}
          className="room-bg"
          src={`/assets/rooms/${room.id}.png`}
          alt={room.name}
          onError={(e) => {
            // Fallback if image is missing
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Layer 2: Objects */}
        {room.objects.map(obj => {
          const selfPlayer = players.find(p => p.id === selfPlayerId);
          const isSelfAtObject = selfPlayer?.currentObjectId === obj.id;
          const isInspectingThis = inspectingObjectId === obj.id;
          const anyPlayerInspectingThis = players.some(p => p.currentObjectId === obj.id);

          return (
            <div 
              key={obj.id}
              style={{
                position: 'absolute',
                left: `${(obj.x / CANVAS_W) * 100}%`, 
                top: `${(obj.y / CANVAS_H) * 100}%`,
                width: obj.width ? `${(obj.width / CANVAS_W) * 100}%` : 'auto',
                height: obj.height ? `${(obj.height / CANVAS_H) * 100}%` : 'auto'
              }}
            >
              <button
                className="room-object-btn"
                style={{ width: '100%', height: '100%' }}
                disabled={!canExplore || isMoving}
                onClick={() => onInteractObject?.(obj.id)}
              >
                <img
                  className="room-object-img"
                  src={`/assets/objects/${obj.id}.png`}
                  alt={obj.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement?.classList.add('missing-img');
                  }}
                />
                <span className="room-object-tooltip">{obj.name}</span>
              </button>

              {/* Popup Inspect khi người chơi đã ở tại object */}
              {isSelfAtObject && canExplore && !isMoving && !isInspectingThis && (
                <div className="inspect-popup">
                  <button onClick={(e) => startInspection(e, obj.id)} className="btn-inspect">
                    🔍 Khám xét
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Layer 3: Players */}
        {players.map((player, index) => {
          const object = room.objects.find(o => o.id === player.currentObjectId);
          // Avatars are offset relative to the canvas scale
          const leftPx = object ? object.x + 45 + index * 25 : 120 + index * 42;
          const topPx = object ? object.y + 30 : CANVAS_H - 100;

          const style = {
            left: `${(leftPx / CANVAS_W) * 100}%`,
            top: `${(topPx / CANVAS_H) * 100}%`,
            background: player.appearance?.avatarColor || "#38bdf8"
          };

          const isInspectingThisLocal = player.id === selfPlayerId && player.currentObjectId && inspectingObjectId === player.currentObjectId;
          const isInspectingGlobal = inspectingPlayers[player.id];

          return (
            <div
              key={player.id}
              className={`room-avatar ${talkingIds.has(player.id) ? "speaking" : ""} ${player.id === selfPlayerId ? "self-avatar" : ""}`}
              title={player.name}
              style={style}
            >
              {player.name.slice(0, 1).toUpperCase()}

              {/* Progress bar khi đang khám xét hiển thị trên đầu nhân vật */}
              {isInspectingThisLocal && (
                <div className="inspect-progress-container player-top">
                  <span className="inspect-progress-text">Đang khám xét...</span>
                  <div className="inspect-progress-bg">
                    <div className="inspect-progress-fill" style={{ width: `${inspectProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Hiển thị bong bóng thoại cho người chơi khác đang khám xét */}
              {!isInspectingThisLocal && isInspectingGlobal && (
                <div className="inspect-bubble">
                  <span style={{ fontSize: '1.2rem' }}>🔍</span>
                  Đang khám xét...
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
