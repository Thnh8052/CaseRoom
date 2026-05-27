import type { MapRoom, Player } from "../types";

type VisiblePlayersPanelProps = {
  currentRoom: MapRoom;
  players: Player[];
  talkingIds: Set<string>;
};

/**
 * Bảng điều khiển bên phải hiển thị danh sách những người chơi đang cùng phòng.
 * Các thẻ người chơi sẽ sáng lên khi họ đang sử dụng Push To Talk.
 */
export function VisiblePlayersPanel({ currentRoom, players, talkingIds }: VisiblePlayersPanelProps) {
  return (
    <aside className="side-panel">
      <h3>Players in this room</h3>
      <p className="hint">Locations outside this room are hidden.</p>

      {players.length === 0 && <p className="small">No visible players.</p>}

      {players.map(player => (
        <div key={player.id} className={talkingIds.has(player.id) ? "player speaking" : "player"}>
          <strong>{player.name}</strong>
          <span>{currentRoom.name}</span>
          {player.currentObjectId && <em>at {findObjectName(currentRoom, player.currentObjectId)}</em>}
        </div>
      ))}
    </aside>
  );
}

function findObjectName(room: MapRoom, objectId: string) {
  return room.objects.find(o => o.id === objectId)?.name ?? objectId;
}
