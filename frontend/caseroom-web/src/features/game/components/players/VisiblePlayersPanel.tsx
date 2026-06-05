import type { MapRoom, Player } from "../../../../shared/types/game";

type VisiblePlayersPanelProps = {
  currentRoom: MapRoom;
  players: Player[];
  talkingIds: Set<string>;
  inspectingPlayers: Record<string, string>;
};

/**
 * Bảng điều khiển bên phải hiển thị danh sách những người chơi đang cùng phòng.
 * Các thẻ người chơi sẽ sáng lên khi họ đang sử dụng Push To Talk.
 */
export function VisiblePlayersPanel({ currentRoom, players, talkingIds, inspectingPlayers }: VisiblePlayersPanelProps) {
  return (
    <aside className="glass-sidebar">
      <p className="hint">Locations outside this room are hidden.</p>

      {players.length === 0 && <p className="small">No visible players.</p>}

      {players.map(player => (
        <div key={player.id} className={talkingIds.has(player.id) ? "player-card speaking" : "player-card"}>
          <strong>
            {player.name}
            {player.role === "Murderer" && <span style={{ color: '#ef4444', marginLeft: 4, fontSize: '0.8em' }}>(Hung thủ)</span>}
            {player.role === "Detective" && <span style={{ color: '#38bdf8', marginLeft: 4, fontSize: '0.8em' }}>(Thám tử)</span>}
          </strong>
          <span>{currentRoom.name}</span>
          {inspectingPlayers[player.id] && <em style={{ color: '#f59e0b' }}> Đang khám xét...</em>}
        </div>
      ))}
    </aside>
  );
}
