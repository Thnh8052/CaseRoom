import type { MapRoom, Player } from "../types";

type CurrentRoomViewProps = {
  room: MapRoom;
  players: Player[];
  talkingIds: Set<string>;
  isMoving: boolean;
};

/**
 * Component hiển thị bản đồ trực quan của căn phòng hiện tại.
 * Render các vật thể (objects) và người chơi (avatars) dựa trên tọa độ (x, y) của phòng.
 */
export function CurrentRoomView({ room, players, talkingIds, isMoving }: CurrentRoomViewProps) {
  return (
    <section className={isMoving ? "room-stage muted" : "room-stage"}>
      <div className="room-stage-header">
        <p className="eyebrow">Current visible room</p>
        <h1>{room.name}</h1>
        <p className="hint">You only see players who are currently in this room.</p>
      </div>

      <div className="focused-room">
        <div className="room-floor-label">{room.name}</div>
        {room.objects.map(obj => (
          <div key={obj.id} className="object" style={objectPosition(room, obj)}>
            {obj.name}
          </div>
        ))}

        {players.map((player, index) => {
          const object = room.objects.find(o => o.id === player.currentObjectId);
          const style = object
            ? avatarNearObject(room, object, index)
            : avatarIdle(index);

          return (
            <div
              key={player.id}
              className={talkingIds.has(player.id) ? "avatar talking" : "avatar"}
              title={player.name}
              style={style}
            >
              {player.name.slice(0, 1).toUpperCase()}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function objectPosition(room: MapRoom, object: { x: number; y: number }) {
  return {
    left: `${object.x - room.x + 320}px`,
    top: `${object.y - room.y + 205}px`
  };
}

function avatarNearObject(room: MapRoom, object: { x: number; y: number }, index: number) {
  return {
    left: `${object.x - room.x + 332 + index * 12}px`,
    top: `${object.y - room.y + 238}px`
  };
}

function avatarIdle(index: number) {
  return {
    left: `${120 + index * 42}px`,
    top: "335px"
  };
}
