import { useCallback, useMemo, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useToast } from "../../../shared/ui/ToastProvider";
import type { CaseSummary, Clue, GamePhase, Player, SessionSnapshot, GameMode, CharacterAppearance } from "../../../shared/types/game";

type JoinResult = {
  player: Player;
  snapshot: SessionSnapshot;
};

type MoveResult = {
  player: Player;
  snapshot: SessionSnapshot;
} | null;

type RoomOccupantsChangedPayload = {
  roomId: string;
  players: Player[];
};

type UseGameHubOptions = {
  apiBaseUrl: string;
  onSelfRoomChanged?: () => void | Promise<void>;
};

/**
 * Hook quản lý toàn bộ kết nối SignalR tới GameHub.
 * Cung cấp dữ liệu thời gian thực về phòng, người chơi (chỉ trong tầm nhìn Fog of War) và các hàm tương tác.
 */
export function useGameHub({ apiBaseUrl, onSelfRoomChanged }: UseGameHubOptions) {
  const [self, setSelfState] = useState<Player | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [status, setStatus] = useState("Not connected");
  const { addToast } = useToast();

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const sessionIdRef = useRef("");
  const selfRef = useRef<Player | null>(null);
  const snapshotRef = useRef<SessionSnapshot | null>(null);
  const [availableCases, setAvailableCases] = useState<CaseSummary[]>([]);
  const [inspectionResult, setInspectionResult] = useState<{ objectId: string, result: string } | null>(null);
  const [inspectingPlayers, setInspectingPlayers] = useState<Record<string, string>>({});
  const [latestUnlockedClue, setLatestUnlockedClue] = useState<Clue | null>(null);

  const setSelf = useCallback((player: Player | null) => {
    selfRef.current = player;
    setSelfState(player);
  }, []);

  const setSnapshotAndRef = useCallback((next: SessionSnapshot | null) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const currentRoom = useMemo(() => {
    if (!snapshot || !self) return null;
    const latestSelf = snapshot.players.find(p => p.id === self.id) ?? self;
    return snapshot.rooms.find(r => r.id === latestSelf.currentRoomId) ?? null;
  }, [snapshot, self]);

  const latestSelf = useMemo(() => {
    if (!snapshot || !self) return self;
    return snapshot.players.find(p => p.id === self.id) ?? self;
  }, [snapshot, self]);

  /**
   * Khởi tạo kết nối tới GameHub và đăng ký các sự kiện lắng nghe từ Server.
   */
  const join = useCallback(async (sessionId: string, playerName: string) => {
    if (!playerName.trim()) {
      throw new Error("Nhập tên player trước.");
    }

    let playerId = sessionStorage.getItem("caseroom_player_id");
    if (!playerId) {
      playerId = crypto.randomUUID();
      sessionStorage.setItem("caseroom_player_id", playerId);
    }

    await connectionRef.current?.stop();

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiBaseUrl}/hubs/game`)
      .withAutomaticReconnect()
      .build();

    connection.on("RoomOccupantsChanged", (payload: RoomOccupantsChangedPayload) => {
      setSnapshot(prev => {
        if (!prev) return prev;

        const currentSelf = selfRef.current;
        const currentRoomId = currentSelf?.currentRoomId;
        if (!currentRoomId || payload.roomId !== currentRoomId) {
          return prev;
        }

        const next = { ...prev, players: payload.players };
        snapshotRef.current = next;
        return next;
      });
    });
    connection.on("GamePhaseChanged", (payload: {
      phase: GamePhase;
      hostPlayerId: string | null;
      briefingText: string;
    }) => {
      setSnapshot(prev => {
        if (!prev) return prev;

        const next = {
          ...prev,
          phase: payload.phase,
          hostPlayerId: payload.hostPlayerId,
          briefingText: payload.briefingText
        };

        snapshotRef.current = next;
        return next;
      });
    });
    connection.on("GameSetupChanged", (setupInfo: { selectedMode: GameMode; selectedCase: CaseSummary | null; briefingText: string; }) => {
      setSnapshot(prev => {
        if (!prev) return prev;

        const next = {
          ...prev,
          selectedMode: setupInfo.selectedMode,
          selectedCase: setupInfo.selectedCase,
          briefingText: setupInfo.briefingText
        };

        snapshotRef.current = next;
        return next;
      });
    });
    connection.on("VoiceRoomShouldRefresh", async (payload: { playerId: string }) => {
      if (payload.playerId === selfRef.current?.id) {
        await onSelfRoomChanged?.();
      }
    });

    connection.on("ReceiveInspectionResult", (payload: { objectId: string, result: string }) => {
      setInspectionResult(payload);
    });

    connection.on("PlayerStartedInspection", (playerId: string, objectId: string) => {
      setInspectingPlayers(prev => ({ ...prev, [playerId]: objectId }));
    });

    connection.on("PlayerCancelledInspection", (playerId: string) => {
      setInspectingPlayers(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    });

    connection.on("ClueUnlocked", (clue: Clue) => {
      setLatestUnlockedClue(clue);
      setSnapshot(prev => {
        if (!prev) return prev;
        const exists = prev.myClues?.some(c => c.id === clue.id);
        if (exists) return prev;
        const next = { ...prev, myClues: [...(prev.myClues || []), clue] };
        snapshotRef.current = next;
        return next;
      });
    });

    connection.on("GameSnapshot", (newSnapshot: SessionSnapshot) => {
      setSnapshotAndRef(newSnapshot);
    });

    connection.on("GameError", (message: string) => {
      addToast({
        title: "Lỗi",
        description: message,
        type: "error"
      });
    });

    connection.onreconnecting((error) => {
      setStatus("Reconnecting");
    });

    connection.onreconnected(async (connectionId) => {
      setStatus(`Reconnected. Re-joining...`);
      try {
        const result = await connection.invoke<JoinResult>("JoinSession", sessionId, playerId, playerName);
        setSelf(result.player);
        setSnapshotAndRef(result.snapshot);
        setStatus(`Joined ${result.snapshot.sessionId} as ${result.player.name}`);
      } catch (err) {
        console.error("Failed to re-join after reconnect", err);
        setStatus("Disconnected (Re-join failed)");
      }
    });

    connection.onclose((error) => {
      setStatus("Disconnected");
    });

    await connection.start();
    connectionRef.current = connection;
    sessionIdRef.current = sessionId;

    const result = await connection.invoke<JoinResult>("JoinSession", sessionId, playerId, playerName);
    const cases = await connection.invoke<CaseSummary[]>("GetAvailableCases");
    setAvailableCases(cases);
    setSelf(result.player);
    setSnapshotAndRef(result.snapshot);
    setStatus(`Joined ${result.snapshot.sessionId} as ${result.player.name}`);
    return result;
  }, [apiBaseUrl, onSelfRoomChanged, setSelf, setSnapshotAndRef]);

  /**
   * Gửi yêu cầu di chuyển sang phòng khác lên Server.
   * Nếu thành công, tự động gọi onSelfRoomChanged để đồng bộ lại luồng Voice.
   */
  const moveToRoom = useCallback(async (roomId: string) => {
    const self = selfRef.current;
    const connection = connectionRef.current;
    if (!self || !connection) return;

    const result = await connection.invoke<MoveResult>("MoveToRoom", roomId);
    if (!result) return;

    setSelf(result.player);
    setSnapshotAndRef(result.snapshot);
    await onSelfRoomChanged?.();
  }, [onSelfRoomChanged, setSelf, setSnapshotAndRef]);

  /**
   * Tương tác với một vật thể bất kỳ trong phòng.
   */
  const interactObject = useCallback(async (objectId: string) => {
    const self = selfRef.current;
    const connection = connectionRef.current;
    if (!self || !connection) return;

    await connection.invoke("InteractObject", objectId);
  }, []);

  const startBriefing = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.invoke("StartBriefing");
  }, []);

  const startExploration = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.invoke("StartExploration");
  }, []);

  const toggleReady = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.invoke("ToggleReady");
  }, []);

  const selectMode = useCallback(async (mode: GameMode) => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.invoke("SelectMode", mode);
  }, []);

  const selectCase = useCallback(async (caseId: string) => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.invoke("SelectCase", caseId);
  }, []);

  const setAppearance = useCallback(async (appearance: CharacterAppearance) => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.invoke("SetAppearance", appearance);
  }, []);

  const completeInspection = useCallback(async (objectId: string) => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.invoke("CompleteInspection", objectId);
  }, []);

  const startInspection = useCallback(async (objectId: string) => {
    const connection = connectionRef.current;
    if (!connection) return;
    await connection.invoke("StartInspection", objectId);
  }, []);

  const cancelInspection = useCallback(async (objectId: string) => {
    if (!connectionRef.current) return;
    try {
      await connectionRef.current.invoke("CancelInspection", objectId);
    } catch (e) {
      console.error(e);
      addToast({ title: "Lỗi", description: "Không thể hủy hành động.", type: "error" });
    }
  }, [addToast]);

  const tamperClue = useCallback(async (clueId: string, fakeText: string) => {
    if (!connectionRef.current) return;
    try {
      await connectionRef.current.invoke("TamperClue", clueId, fakeText);
    } catch (e) {
      console.error(e);
      addToast({ title: "Lỗi", description: "Không thể làm giả manh mối.", type: "error" });
    }
  }, [addToast]);

  const isHost = useMemo(() => {
    return !!self && snapshot?.hostPlayerId === self.id;
  }, [self, snapshot]);

  const canExplore = snapshot?.phase === "Exploration";

  const streamAskDetectiveAi = useCallback((question: string) => {
    const connection = connectionRef.current;
    if (!connection) {
      // Return empty stream as fallback
      async function* empty(): AsyncIterable<string> { }
      return empty();
    }
    return {
      [Symbol.asyncIterator]() {
        const streamResult = connection.stream<string>("StreamAskDetectiveAi", question);
        let subscription: signalR.ISubscription<string>;
        const queue: { value?: string, error?: Error, done?: boolean }[] = [];
        let resolveNext: (() => void) | null = null;

        subscription = streamResult.subscribe({
          next: (chunk) => {
            queue.push({ value: chunk });
            if (resolveNext) {
              resolveNext();
              resolveNext = null;
            }
          },
          error: (err) => {
            queue.push({ error: err });
            if (resolveNext) {
              resolveNext();
              resolveNext = null;
            }
          },
          complete: () => {
            queue.push({ done: true });
            if (resolveNext) {
              resolveNext();
              resolveNext = null;
            }
          }
        });

        return {
          async next(): Promise<IteratorResult<string>> {
            if (queue.length > 0) {
              const item = queue.shift()!;
              if (item.error) throw item.error;
              if (item.done) return { done: true, value: undefined };
              return { done: false, value: item.value as string };
            }

            await new Promise<void>(resolve => { resolveNext = resolve; });

            const item = queue.shift()!;
            if (item.error) throw item.error;
            if (item.done) return { done: true, value: undefined };
            return { done: false, value: item.value as string };
          },
          async return(): Promise<IteratorResult<string>> {
            subscription.dispose();
            return { done: true, value: undefined as any };
          }
        };
      }
    };
  }, []);

  const stop = useCallback(async () => {
    await connectionRef.current?.stop();
    connectionRef.current = null;
    sessionIdRef.current = "";
    setSelf(null);
    setSnapshotAndRef(null);
    setStatus("Not connected");
  }, [setSelf, setSnapshotAndRef]);

  return {
    self,
    latestSelf,
    snapshot,
    currentRoom,
    visiblePlayers: snapshot?.players ?? [],
    availableCases,
    status,
    isHost,
    canExplore,
    join,
    moveToRoom,
    interactObject,
    startBriefing,
    startExploration,
    selectMode,
    selectCase,
    toggleReady,
    setAppearance,
    completeInspection,
    startInspection,
    cancelInspection,
    inspectingPlayers,
    inspectionResult,
    clearInspectionResult: useCallback(() => setInspectionResult(null), []),
    latestUnlockedClue,
    clearLatestUnlockedClue: useCallback(() => setLatestUnlockedClue(null), []),
    myClues: snapshot?.myClues || [],
    streamAskDetectiveAi,
    tamperClue
  };
}
