import { useState, useEffect, useRef } from "react";
import type { MapRoom, Player } from "../../../../shared/types/game";

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
  /** Gọi khi avatar bước vào exit zone để chuyển phòng (RPG Teleport) */
  onTeleportToRoom?: (targetRoomId: string) => void;
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
  onUpdatePosition,
  onTeleportToRoom
}: CurrentRoomViewProps) {

  const [inspectingObjectId, setInspectingObjectId] = useState<string | null>(null);
  const [inspectProgress, setInspectProgress] = useState(0);
  const [nearExitLabel, setNearExitLabel] = useState<string | null>(null);

  // Cooldown để tránh teleport liên tiếp ngay sau khi vừa chuyển phòng
  const teleportCooldownRef = useRef(false);
  const previousRoomIdRef = useRef<string | null>(null);

  // Self position state for smooth local rendering
  const selfPlayer = players.find(p => p.id === selfPlayerId);
  const posRef = useRef({ x: selfPlayer?.x ?? CANVAS_W / 2, y: selfPlayer?.y ?? CANVAS_H / 2 });
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const lastSyncRef = useRef(0);

  // Lưu state mới nhất vào ref để event listener không bị re-bind liên tục gây mất phím
  const gameStateRef = useRef({ inspectingObjectId, canExplore, isMoving, room, onStartInspection, onInteractObject, onPickupFloorItem });
  useEffect(() => {
    gameStateRef.current = { inspectingObjectId, canExplore, isMoving, room, onStartInspection, onInteractObject, onPickupFloorItem };
  }, [inspectingObjectId, canExplore, isMoving, room, onStartInspection, onInteractObject, onPickupFloorItem]);

  // Render trigger for animation frame
  const [, setTick] = useState(0);

  // Clear keys immediately when exploration is blocked (e.g. opening notebook)
  useEffect(() => {
    if (!canExplore || isMoving || inspectingObjectId) {
      keysRef.current = { w: false, a: false, s: false, d: false };
    }
  }, [canExplore, isMoving, inspectingObjectId]);

  // Init position when room/player changes completely
  useEffect(() => {
    if (selfPlayer) {
      // Only snap if distance is way off (prevents jitter while walking)
      const dist = Math.hypot(posRef.current.x - selfPlayer.x, posRef.current.y - selfPlayer.y);
      if (dist > 150) {
        posRef.current = { x: selfPlayer.x, y: selfPlayer.y };
      }
    }
  }, [selfPlayer?.x, selfPlayer?.y]);

  // Handle spawn position sau khi teleport hoặc vào game
  useEffect(() => {
    if (previousRoomIdRef.current && previousRoomIdRef.current !== room.id) {
      // Just teleported
      const prevRoomId = previousRoomIdRef.current;
      const mirrorExit = room.exits?.find(e => e.targetRoomId === prevRoomId);
      if (mirrorExit) {
        // Spawn cách cửa đối diện 120px vào trong phòng
        let spawnX = mirrorExit.zoneCX;
        let spawnY = mirrorExit.zoneCY;
        if (mirrorExit.zoneCX > 1000) spawnX -= 120; // cửa bên phải
        else if (mirrorExit.zoneCX < 280) spawnX += 120; // cửa bên trái
        if (mirrorExit.zoneCY > 500) spawnY -= 120; // cửa bên dưới
        else if (mirrorExit.zoneCY < 200) spawnY += 120; // cửa bên trên
        
        posRef.current = { x: spawnX, y: spawnY };
        onUpdatePosition?.(spawnX, spawnY);
      }
    }
    previousRoomIdRef.current = room.id;
  }, [room.id, room.exits, onUpdatePosition]);

  // WASD & Interaction Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      
      // Don't move if typing in inputs or inspecting
      const target = e.target as HTMLElement;
      const isInput = target instanceof HTMLInputElement || 
                      target instanceof HTMLTextAreaElement || 
                      target instanceof HTMLSelectElement || 
                      target.isContentEditable;
      if (isInput || state.inspectingObjectId || !state.canExplore || state.isMoving) return;

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = true;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = true;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = true;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = true;

      // Handle F to inspect
      if (key === 'f') {
        const nearObj = state.room.objects.find(obj => {
          const objCX = obj.x + (obj.width || 0) / 2;
          const objCY = obj.y + (obj.height || 0) / 2;
          const dist = Math.hypot(posRef.current.x - objCX, posRef.current.y - objCY);
          return dist <= PROXIMITY_RADIUS;
        });
        if (nearObj) {
          setInspectingObjectId(nearObj.id);
          setInspectProgress(0);
          state.onStartInspection?.(nearObj.id);
          state.onInteractObject?.(nearObj.id);
        }
      }

      // Handle E to pickup
      if (key === 'e' && state.room.floorItems) {
        const nearItem = state.room.floorItems.find(item => {
          const ix = item.x ?? CANVAS_W / 2;
          const iy = item.y ?? CANVAS_H / 2;
          const dist = Math.hypot(posRef.current.x - ix, posRef.current.y - iy);
          return dist <= PROXIMITY_RADIUS;
        });
        if (nearItem) {
          state.onPickupFloorItem?.(nearItem.id);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = false;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = false;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = false;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = false;
    };

    const handleBlur = () => {
      // Khi mất focus (Alt-Tab, click ra ngoài), reset toàn bộ phím để tránh kẹt di chuyển
      keysRef.current = { w: false, a: false, s: false, d: false };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

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

          // Soft Player Collision (Đẩy nhau ra)
          const PLAYER_RADIUS = 28;
          players.forEach(p => {
            if (p.id !== selfPlayerId) {
              const pDist = Math.hypot(newX - p.x, newY - p.y);
              if (pDist === 0) {
                // Same spot -> push away randomly
                newX += (Math.random() - 0.5) * 10;
                newY += (Math.random() - 0.5) * 10;
              } else if (pDist < PLAYER_RADIUS * 2) {
                const overlap = (PLAYER_RADIUS * 2) - pDist;
                const nx = (newX - p.x) / pDist;
                const ny = (newY - p.y) / pDist;
                newX += nx * overlap;
                newY += ny * overlap;
              }
            }
          });

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

          // --- RPG Exit Zone Detection ---
          if (room.exits && !teleportCooldownRef.current && onTeleportToRoom) {
            const triggeredExit = room.exits.find(exit => {
              const halfW = exit.zoneW / 2;
              const halfH = exit.zoneH / 2;
              return (
                newX >= exit.zoneCX - halfW &&
                newX <= exit.zoneCX + halfW &&
                newY >= exit.zoneCY - halfH &&
                newY <= exit.zoneCY + halfH
              );
            });

            if (triggeredExit) {
              teleportCooldownRef.current = true;
              onTeleportToRoom(triggeredExit.targetRoomId);
              // Reset cooldown sau 2 giây (sau khi phòng mới đã load xong)
              setTimeout(() => { teleportCooldownRef.current = false; }, 2000);
            }
          }
        }
      }

      // --- Realtime Exit Zone Label (hiện thị tên cửa ngay cả khi đứng yên) ---
      if (room.exits) {
        const near = room.exits.find(exit => {
          const halfW = exit.zoneW / 2 + 40;
          const halfH = exit.zoneH / 2 + 40;
          const px = posRef.current.x;
          const py = posRef.current.y;
          return (
            px >= exit.zoneCX - halfW &&
            px <= exit.zoneCX + halfW &&
            py >= exit.zoneCY - halfH &&
            py <= exit.zoneCY + halfH
          );
        });
        setNearExitLabel(near ? near.targetRoomId : null);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [inspectingObjectId, canExplore, isMoving, onUpdatePosition, room.exits, onTeleportToRoom]);

  // Reset cooldown khi chuyển sang phòng mới
  useEffect(() => {
    teleportCooldownRef.current = true;
    const t = setTimeout(() => { teleportCooldownRef.current = false; }, 1500);
    return () => clearTimeout(t);
  }, [room.id]);

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

  const isWalking = !inspectingObjectId && canExplore && !isMoving &&
    (keysRef.current.w || keysRef.current.a || keysRef.current.s || keysRef.current.d);

  return (
    <section className={isMoving ? "room-stage muted" : "room-stage"}>
      <div className="room-stage-header">
        <p className="eyebrow">CCTV / DETECTIVE BOARD</p>
        <h1>{room.name}</h1>
        <p className="hint">W A S D: Di chuyển | F: Khám xét | E: Nhặt đồ</p>
      </div>

      <div className="layered-room">
        {/* Lớp mờ viền màn hình (Vignette) */}
        <div className="hud-overlay" />

        {/* Exit Zone Indicators */}
        {room.exits?.map(exit => {
          const leftPct = ((exit.zoneCX - exit.zoneW / 2) / CANVAS_W) * 100;
          const topPct = ((exit.zoneCY - exit.zoneH / 2) / CANVAS_H) * 100;
          const widthPct = (exit.zoneW / CANVAS_W) * 100;
          const heightPct = (exit.zoneH / CANVAS_H) * 100;
          const isNearThisExit = nearExitLabel === exit.targetRoomId;
          return (
            <div
              key={exit.targetRoomId}
              className={`room-exit-zone ${isNearThisExit ? 'active' : ''}`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
              }}
            >
              <span className="exit-label">➡ {exit.targetRoomId.replace('_', ' ')}</span>
            </div>
          );
        })}

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
                className={`room-object-btn ${isNear ? 'in-range' : ''}`}
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
                <button
                  onClick={(e) => startInspection(e, obj.id)}
                  className="floating-action-btn"
                  style={{ pointerEvents: 'auto' }}
                >
                  [F] Khám xét
                </button>
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
            <div key={item.id} className="floor-item-btn" style={{
              left: `${(ix / CANVAS_W) * 100}%`,
              top: `${(iy / CANVAS_H) * 100}%`,
              zIndex: 10
            }}>
              <div className="floor-item-aura"></div>
              <span className="floor-item-icon">📦</span>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 2px black', marginTop: 4 }}>
                {item.name}
              </div>

              {isNear && canExplore && !isMoving && (
                <button
                  onClick={() => onPickupFloorItem?.(item.id)}
                  className="floating-action-btn"
                  style={{ pointerEvents: 'auto', marginTop: -35 }}
                >
                  [E] Nhặt
                </button>
              )}
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
              className={`room-avatar ${talkingIds.has(player.id) ? "speaking" : ""} ${isSelf ? "self-avatar" : ""} ${(isSelf && isWalking) ? "is-moving" : ""}`}
              title={player.name}
              style={style}
            >
              <div className="avatar-shadow" />
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
