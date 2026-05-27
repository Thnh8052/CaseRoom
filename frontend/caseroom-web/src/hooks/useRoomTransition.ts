import { useCallback, useMemo, useState } from "react";
import type { MapRoom } from "../types";

type UseRoomTransitionOptions = {
  rooms: MapRoom[];
  moveToRoom: (roomId: string) => Promise<void> | void;
  minimumDelayMs?: number;
};

/**
 * Hook tạo hiệu ứng chờ (Delay/Transition) khi chuyển phòng.
 * Đảm bảo màn hình loading hiện lên đủ lâu (minimumDelayMs) để tạo cảm giác chuyển cảnh mượt mà,
 * tránh việc load quá nhanh gây chớp màn hình (Flickering).
 */
export function useRoomTransition({ rooms, moveToRoom, minimumDelayMs = 850 }: UseRoomTransitionOptions) {
  const [isMoving, setIsMoving] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetRoom = useMemo(() => {
    if (!targetRoomId) return null;
    return rooms.find(room => room.id === targetRoomId) ?? null;
  }, [rooms, targetRoomId]);

  const moveWithTransition = useCallback(async (roomId: string) => {
    if (isMoving) return;

    setError(null);
    setTargetRoomId(roomId);
    setIsMoving(true);

    const delay = wait(minimumDelayMs);

    try {
      await moveToRoom(roomId);
      await delay;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move to that room.");
    } finally {
      setIsMoving(false);
      setTargetRoomId(null);
    }
  }, [isMoving, minimumDelayMs, moveToRoom]);

  return {
    isMoving,
    targetRoom,
    targetRoomId,
    error,
    moveWithTransition
  };
}

function wait(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}
