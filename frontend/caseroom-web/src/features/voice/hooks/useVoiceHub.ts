import { useCallback, useRef, useState } from "react";
import { VoiceClient } from "../client/VoiceClient";

/**
 * Hook React bọc quanh lớp VoiceClient (WebRTC P2P).
 * Giúp đưa trạng thái "Ai đang nói" (talkingIds) và "Status" vào luồng render của React.
 */
export function useVoiceHub(apiBaseUrl: string) {
  const [status, setStatus] = useState("Voice not connected");
  const [talkingIds, setTalkingIds] = useState<Set<string>>(new Set());
  const clientRef = useRef<VoiceClient | null>(null);

  const start = useCallback(async (sessionId: string, playerId: string) => {
    await clientRef.current?.stop();
    setTalkingIds(new Set());

    const voice = new VoiceClient({
      apiBaseUrl,
      sessionId,
      playerId,
      onStatus: setStatus,
      onTalkingChanged: (talkingPlayerId, isTalking) => {
        setTalkingIds(prev => {
          const next = new Set(prev);
          if (isTalking) next.add(talkingPlayerId);
          else next.delete(talkingPlayerId);
          return next;
        });
      }
    });

    clientRef.current = voice;
    await voice.start();
  }, [apiBaseUrl]);

  const refreshRoom = useCallback(async () => {
    setTalkingIds(new Set());
    await clientRef.current?.refreshRoom();
  }, []);

  const setPushToTalk = useCallback(async (active: boolean) => {
    await clientRef.current?.setPushToTalk(active);
  }, []);

  const stop = useCallback(async () => {
    setTalkingIds(new Set());
    await clientRef.current?.stop();
    clientRef.current = null;
    setStatus("Voice not connected");
  }, []);

  return {
    status,
    talkingIds,
    start,
    refreshRoom,
    setPushToTalk,
    stop
  };
}
