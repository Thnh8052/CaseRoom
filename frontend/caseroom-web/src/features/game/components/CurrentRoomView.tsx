import { useState, useEffect, useRef } from "react";
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
  onPickupFloorItem?: (itemId: string) => void;
  onUpdatePosition?: (x: number, y: number) => void;
};

const CANVAS_W = 1280;
const CANVAS_H = 720;
const PLAYER_SPEED = 300; // pixels per second
const PROXIMITY_RADIUS = 150; // pixels to interact

function getFunnyInspectionText(objId: string, objName: string): string {
  const id = objId.toLowerCase();
  const name = objName.toLowerCase();
  
  if (id.includes("trash") || name.includes("rác")) return `Đang bới ${name}...`;
  if (id.includes("toilet") || name.includes("bồn cầu")) return `Đang móc ${name}...`;
  if (id.includes("safe") || name.includes("két")) return `Đang vã mồ hôi dò mã ${name}...`;
  if (id.includes("bed") || name.includes("giường")) return `Đang lật tung ${name}...`;
  if (id.includes("desk") || name.includes("bàn") || id.includes("drawer")) return `Đang lục lọi ${name}...`;
  if (id.includes("book") || name.includes("sách")) return `Đang soi từng trang trên ${name}...`;
  if (id.includes("computer") || id.includes("laptop") || name.includes("máy")) return `Đang múa phím hack ${name}...`;
  if (id.includes("painting") || name.includes("tranh")) return `Đang dòm ngó ${name}...`;
  if (id.includes("corpse") || name.includes("xác")) return `Đang khám nghiệm ${name}...`;
  
  return `Đang săm soi ${name}...`;
}

export function CurrentRoomView({ 
  room, 
  players, 
  selfPlayerId, 
  talkingIds, 
  inspectingPlayers, 
  isMoving, 
  canExplore, 
  onInteractObject, 
  onStartInspection, 
  onCancelInspection, 
  onCompleteInspection, 
  onPickupFloorItem,
  onUpdatePosition
}: CurrentRoomViewProps) {
  
  const [inspectingObjectId, setInspectingObjectId] = useState<string | null>(null);
  const [inspectProgress, setInspectProgress] = useState(0);

  // Self position state for smooth local rendering
  const selfPlayer = players.find(p => p.id === selfPlayerId);
  const posRef = useRef({ x: selfPlayer?.x ?? CANVAS_W/2, y: selfPlayer?.y ?? CANVAS_H/2 });
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const lastSyncRef = useRef(0);
  
  // Render trigger for animation frame
  const [, setTick] = useState(0);

  // Init position when room/player changes completely
  useEffect(() => {
    if (selfPlayer) {
      // Only snap if distance is way off (prevents jitter while walking)
      const dist = Math.hypot(posRef.current.x - selfPlayer.x, posRef.current.y - selfPlayer.y);
      if (dist > 50) {
        posRef.current = { x: selfPlayer.x, y: selfPlayer.y };
      }
    }
  }, [selfPlayer?.x, selfPlayer?.y]);

  // WASD Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't move if typing in inputs or inspecting
      if (e.target instanceof HTMLInputElement || inspectingObjectId || !canExplore || isMoving) return;
      
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = true;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = true;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = true;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = false;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = false;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = false;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [inspectingObjectId, canExplore, isMoving]);

  // Game Loop
  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (!inspectingObjectId && canExplore && !isMoving) {
        const keys = keysRef.current;
        let dx = 0;
        let dy = 0;

        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        if (dx !== 0 || dy !== 0) {
          // Normalize
          const length = Math.hypot(dx, dy);
          dx /= length;
          dy /= length;

          let newX = posRef.current.x + dx * PLAYER_SPEED * dt;
          let newY = posRef.current.y + dy * PLAYER_SPEED * dt;

          // Bounds checking
          newX = Math.max(30, Math.min(CANVAS_W - 30, newX));
          newY = Math.max(30, Math.min(CANVAS_H - 30, newY));

          posRef.current = { x: newX, y: newY };
          setTick(t => t + 1); // Force re-render local player

          // Network sync throttle (10 FPS)
          if (time - lastSyncRef.current > 100) {
            onUpdatePosition?.(newX, newY);
            lastSyncRef.current = time;
          }
        }
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [inspectingObjectId, canExplore, isMoving, onUpdatePosition]);

  // Auto-cancel inspection if the player moves away from the object
  useEffect(() => {
    if (inspectingObjectId) {
      const obj = room.objects.find(o => o.id === inspectingObjectId);
      if (obj) {
        const objCX = obj.x + (obj.width || 0) / 2;
        const objCY = obj.y + (obj.height || 0) / 2;
        const dist = Math.hypot(posRef.current.x - objCX, posRef.current.y - objCY);
        if (dist > PROXIMITY_RADIUS) {
          setInspectingObjectId(null);
          setInspectProgress(0);
          onCancelInspection?.(inspectingObjectId);
        }
      }
    }
  }, [posRef.current.x, posRef.current.y, inspectingObjectId, room.objects, onCancelInspection]);

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
    e.stopPropagation();
    setInspectingObjectId(objectId);
    setInspectProgress(0);
    onStartInspection?.(objectId);
    onInteractObject?.(objectId);
  };

  return (
    <section className={isMoving ? "room-stage muted" : "room-stage"}>
      <div className="room-stage-header">
        <p className="eyebrow">Current visible room</p>
        <h1>{room.name}</h1>
        <p className="hint">Use W A S D to move around the room.</p>
      </div>

      <div className="layered-room">
        {/* Layer 1: Background */}
        <img
          key={`bg-${room.id}`}
          className="room-bg"
          src={`/assets/rooms/${room.id}.png`}
          alt={room.name}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Layer 2: Objects */}
        {room.objects.map(obj => {
          const objCX = obj.x + (obj.width || 0) / 2;
          const objCY = obj.y + (obj.height || 0) / 2;
          
          // Check proximity
          const dist = Math.hypot(posRef.current.x - objCX, posRef.current.y - objCY);
          const isNear = dist <= PROXIMITY_RADIUS;
          const isInspectingThis = inspectingObjectId === obj.id;

          return (
            <div 
              key={obj.id}
              style={{
                position: 'absolute',
                left: `${(obj.x / CANVAS_W) * 100}%`, 
                top: `${(obj.y / CANVAS_H) * 100}%`,
                width: obj.width ? `${(obj.width / CANVAS_W) * 100}%` : 'auto',
                height: obj.height ? `${(obj.height / CANVAS_H) * 100}%` : 'auto',
                pointerEvents: 'none' // Let clicks pass through object unless it's a button
              }}
            >
              <div
                className="room-object-btn"
                style={{ width: '100%', height: '100%', position: 'relative' }}
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
              </div>

              {/* Popup Inspect khi người chơi lại gần */}
              {isNear && canExplore && !isMoving && !isInspectingThis && (
                <div className="inspect-popup" style={{ pointerEvents: 'auto' }}>
                  <button onClick={(e) => startInspection(e, obj.id)} className="btn-inspect">
                    🔍 Khám xét
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Layer 3: Floor Items */}
        {room.floorItems?.map(item => {
          const ix = item.x ?? CANVAS_W / 2;
          const iy = item.y ?? CANVAS_H / 2;
          const dist = Math.hypot(posRef.current.x - ix, posRef.current.y - iy);
          const isNear = dist <= PROXIMITY_RADIUS;

          return (
            <div key={item.id} style={{
              position: 'absolute',
              left: `${(ix / CANVAS_W) * 100}%`,
              top: `${(iy / CANVAS_H) * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10
            }}>
              <div style={{
                background: "rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "4px 8px",
                borderRadius: 4,
                color: "#fff",
                fontSize: 12,
                textAlign: 'center'
              }}>
                <div>{item.name}</div>
                {isNear && canExplore && !isMoving && (
                  <button 
                    onClick={() => onPickupFloorItem?.(item.id)}
                    style={{
                      background: '#10b981',
                      border: 'none',
                      color: 'white',
                      borderRadius: 4,
                      padding: '2px 8px',
                      marginTop: 4,
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    Nhặt
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Layer 4: Players */}
        {players.map((player) => {
          const isSelf = player.id === selfPlayerId;
          const px = isSelf ? posRef.current.x : player.x;
          const py = isSelf ? posRef.current.y : player.y;

          const style = {
            left: `${(px / CANVAS_W) * 100}%`,
            top: `${(py / CANVAS_H) * 100}%`,
            background: player.appearance?.avatarColor || "#38bdf8",
            transform: 'translate(-50%, -50%)',
            position: 'absolute' as const,
            transition: isSelf ? 'none' : 'left 0.1s linear, top 0.1s linear',
            zIndex: 20
          };

          const isInspectingThisLocal = isSelf && inspectingObjectId;
          const isInspectingGlobal = inspectingPlayers[player.id];

          return (
            <div
              key={player.id}
              className={`room-avatar ${talkingIds.has(player.id) ? "speaking" : ""} ${isSelf ? "self-avatar" : ""}`}
              title={player.name}
              style={style}
            >
              {player.name.slice(0, 1).toUpperCase()}

              {/* Progress bar khi đang khám xét hiển thị trên đầu nhân vật */}
              {isInspectingThisLocal && inspectingObjectId && (
                <div className="inspect-progress-container player-top">
                  <span className="inspect-progress-text">{getFunnyInspectionText(inspectingObjectId, "Đồ vật")}</span>
                  <div className="inspect-progress-bg">
                    <div className="inspect-progress-fill" style={{ width: `${inspectProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Hiển thị bong bóng thoại cho người chơi khác đang khám xét */}
              {!isSelf && isInspectingGlobal && (
                <div className="inspect-bubble">
                  <span style={{ fontSize: '1.2rem' }}>🔍</span>
                  {getFunnyInspectionText(isInspectingGlobal, "Đồ vật")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
