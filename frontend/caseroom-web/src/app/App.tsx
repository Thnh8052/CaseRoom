import { useCallback, useState, useEffect } from "react";
import { ControlPanel } from "../features/game/components/ControlPanel";
import { CurrentRoomView } from "../features/game/components/CurrentRoomView";
import { VisiblePlayersPanel } from "../features/game/components/VisiblePlayersPanel";
import { InventoryPanel } from "../features/game/components/InventoryPanel";
import { RoomTransitionOverlay } from "../features/game/components/RoomTransitionOverlay";
import { ReconnectingOverlay } from "../features/game/components/ReconnectingOverlay";
import { JoinScreen } from "../features/lobby/components/JoinScreen";
import { LobbyScreen } from "../features/lobby/components/LobbyScreen";
import { NotebookModal } from "../features/notebook/components/NotebookModal";
import { useGameHub } from "../features/game/hooks/useGameHub";
import { useRoomTransition } from "../features/game/hooks/useRoomTransition";
import { usePushToTalk } from "../features/voice/hooks/usePushToTalk";
import { useVoiceHub } from "../features/voice/hooks/useVoiceHub";
import { useToast } from "../shared/ui/ToastProvider";
import "../styles/main.css";
import "../styles/pages/play.css";
import "../styles/components/notebook.css";
import "../styles/components/toast.css";
import "../styles/components/modal.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5050";

/**
 * Component gốc của ứng dụng CaseRoom.
 * Đóng vai trò làm "Nhạc trưởng" (Orchestrator) liên kết các luồng:
 * - Game SignalR (Tọa độ, phòng, tương tác vật thể)
 * - Voice WebRTC (Đàm thoại P2P)
 * - Push To Talk (Sự kiện phím V)
 * - UI Components (Bản đồ, danh sách người chơi)
 */
export default function App() {
  const [sessionId, setSessionId] = useState("test-room");
  const [playerName, setPlayerName] = useState("");
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const { addToast } = useToast();

  // Khởi tạo luồng kết nối WebRTC (Chỉ quản lý SDP/ICE, không quản lý trạng thái di chuyển)
  const voiceHub = useVoiceHub(API_BASE_URL);

  // Khởi tạo luồng kết nối Game (Chịu trách nhiệm đồng bộ vị trí, phòng)
  // Khi GameHub đổi phòng thành công -> Báo cho VoiceHub đổi kênh Voice theo.
  const gameHub = useGameHub({
    apiBaseUrl: API_BASE_URL,
    onSelfRoomChanged: voiceHub.refreshRoom
  });

  // Quản lý hiệu ứng chuyển cảnh mượt mà giữa các phòng
  const roomTransition = useRoomTransition({
    rooms: gameHub.snapshot?.rooms ?? [],
    moveToRoom: gameHub.moveToRoom
  });

  // Bắt sự kiện bàn phím (Phím V) để bật/tắt micro. Chỉ cho phép nói khi không đang chuyển cảnh.
  const pushToTalk = usePushToTalk({
    enabled: Boolean(gameHub.self) && !roomTransition.isMoving,
    onChange: voiceHub.setPushToTalk
  });

  // Flow tham gia Session: 
  // 1. Kết nối vào GameHub lấy Session/Room.
  // 2. Kết nối vào VoiceHub để bắt đầu bắt cặp WebRTC P2P với những người cùng phòng.

  useEffect(() => {
    if (gameHub.latestUnlockedClue) {
      addToast({
        title: "Manh mối mới!",
        description: gameHub.latestUnlockedClue.title,
        type: 'clue'
      });
      gameHub.clearLatestUnlockedClue();
    }
  }, [gameHub.latestUnlockedClue, addToast, gameHub.clearLatestUnlockedClue]);

  useEffect(() => {
    if (gameHub.latestAcquiredItem) {
      addToast({
        title: "Nhặt được vật phẩm!",
        description: gameHub.latestAcquiredItem.name,
        type: 'info'
      });
      gameHub.clearLatestAcquiredItem();
    }
  }, [gameHub.latestAcquiredItem, addToast, gameHub.clearLatestAcquiredItem]);

  const joinAndStartVoice = useCallback(async (mode?: string, explicitSessionId?: string) => {
    try {
      const targetSessionId = explicitSessionId || sessionId;
      const result = await gameHub.join(targetSessionId, playerName);
      if (mode === "SinglePlayer") {
        await gameHub.selectMode("SinglePlayer");
      }
      await voiceHub.start(targetSessionId, result.player.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not join session.");
    }
  }, [gameHub, playerName, sessionId, voiceHub]);

  const leaveSession = useCallback(async () => {
    await voiceHub.stop();
    await gameHub.stop();
  }, [voiceHub, gameHub]);

  if (!gameHub.self || !gameHub.snapshot || !gameHub.currentRoom) {
    return (
      <JoinScreen
        sessionId={sessionId}
        playerName={playerName}
        onSessionIdChange={setSessionId}
        onPlayerNameChange={setPlayerName}
        onJoin={joinAndStartVoice}
      />
    );
  }

  if (gameHub.snapshot.phase === "Lobby") {
    return (
      <LobbyScreen
        sessionId={sessionId}
        players={gameHub.snapshot.players}
        snapshot={gameHub.snapshot}
        availableCases={gameHub.availableCases}
        isHost={gameHub.isHost}
        selfPlayer={gameHub.latestSelf}
        onSelectMode={gameHub.selectMode}
        onSelectCase={gameHub.selectCase}
        onStartBriefing={gameHub.startBriefing}
        onToggleReady={gameHub.toggleReady}
        onSetAppearance={gameHub.setAppearance}
        onLeave={leaveSession}
      />
    );
  }

  return (
    <main className="shell">
      <ControlPanel
        gameStatus={gameHub.status}
        voiceStatus={voiceHub.status}
        currentRoom={gameHub.currentRoom}
        rooms={gameHub.snapshot.rooms}
        isPushToTalkDown={pushToTalk.isPushToTalkDown}
        isMoving={roomTransition.isMoving}
        targetRoom={roomTransition.targetRoom}
        onMoveToRoom={roomTransition.moveWithTransition}
        onInteractObject={gameHub.interactObject}
        onStartPushToTalk={pushToTalk.startPushToTalk}
        onStopPushToTalk={pushToTalk.stopPushToTalk}
        isHost={gameHub.isHost}
        canExplore={gameHub.canExplore}
        snapshot={gameHub.snapshot}
        onStartBriefing={gameHub.startBriefing}
        onStartExploration={gameHub.startExploration}

      />

      <section className="map-panel">
        <CurrentRoomView
          room={gameHub.currentRoom}
          players={gameHub.visiblePlayers}
          selfPlayerId={gameHub.self?.id}
          talkingIds={voiceHub.talkingIds}
          inspectingPlayers={gameHub.inspectingPlayers}
          isMoving={roomTransition.isMoving}
          canExplore={gameHub.canExplore}
          onInteractObject={gameHub.interactObject}
          onStartInspection={gameHub.startInspection}
          onCancelInspection={gameHub.cancelInspection}
          onCompleteInspection={gameHub.completeInspection}
          onPickupFloorItem={gameHub.pickupFloorItem}
          onUpdatePosition={gameHub.updatePosition}
        />
        <RoomTransitionOverlay
          isMoving={roomTransition.isMoving}
          targetRoom={roomTransition.targetRoom}
        />
      </section>

      <div>
        <VisiblePlayersPanel
          currentRoom={gameHub.currentRoom}
          players={gameHub.visiblePlayers}
          talkingIds={voiceHub.talkingIds}
          inspectingPlayers={gameHub.inspectingPlayers}
        />

        {gameHub.latestSelf && (
          <InventoryPanel
            inventory={gameHub.latestSelf.inventory ?? []}
            onDropItem={gameHub.dropItem}
            onGiveItem={gameHub.giveItem}
            visiblePlayers={gameHub.visiblePlayers.filter(p => p.id !== gameHub.latestSelf?.id)}
          />
        )}
      </div>

      {/* Result Modal */}
      {gameHub.inspectionResult && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: 400, textAlign: 'center' }}>
            <h2 style={{ color: '#38bdf8', marginBottom: 16 }}>Khám Xét</h2>
            <p style={{ marginBottom: 24, fontSize: '1.1rem' }}>{gameHub.inspectionResult.result}</p>
            <button className="btn-primary-large" onClick={gameHub.clearInspectionResult}>Đóng</button>
          </div>
        </div>
      )}

      {/* Nút Sổ tay góc phải dưới */}
      {gameHub.snapshot?.phase === "Exploration" && (
        <button
          className="btn-notebook"
          onClick={() => setIsNotebookOpen(true)}
        >
          📓 Sổ tay
          <span className="clue-count">{gameHub.myClues.length}</span>
        </button>
      )}

      {/* Notebook Modal */}
      {isNotebookOpen && (
        <NotebookModal
          clues={gameHub.myClues}
          role={gameHub.self?.role || "Detective"}
          onClose={() => setIsNotebookOpen(false)}
          streamAskDetectiveAi={gameHub.streamAskDetectiveAi}
          tamperClue={gameHub.tamperClue}
          visiblePlayers={gameHub.visiblePlayers.filter(p => p.id !== gameHub.latestSelf?.id)}
          shareClue={gameHub.shareClue}
        />
      )}

      {/* Reconnecting Overlay */}
      {gameHub.status === "Reconnecting" && <ReconnectingOverlay />}
    </main>
  );
}
