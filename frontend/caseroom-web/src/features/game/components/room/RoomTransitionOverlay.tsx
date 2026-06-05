import type { MapRoom } from "../../../../shared/types/game";

type RoomTransitionOverlayProps = {
  isMoving: boolean;
  targetRoom: MapRoom | null;
};

export function RoomTransitionOverlay({ isMoving, targetRoom }: RoomTransitionOverlayProps) {
  if (!isMoving) return null;

  return (
    <div className="room-transition" role="status" aria-live="polite">
      <div className="transition-card">
        <div className="walking-dots">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Moving</p>
        <h2>{targetRoom ? `Heading to ${targetRoom.name}` : "Changing room"}</h2>
        <p className="hint">Updating room state, nearby players, and voice channel...</p>
      </div>
    </div>
  );
}
