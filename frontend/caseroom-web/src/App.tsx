import { useCallback, useState } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { CurrentRoomView } from "./components/CurrentRoomView";
import { JoinScreen } from "./components/JoinScreen";
import { VisiblePlayersPanel } from "./components/VisiblePlayersPanel";
import { RoomTransitionOverlay } from "./components/RoomTransitionOverlay";
import { useGameHub } from "./hooks/useGameHub";
import { usePushToTalk } from "./hooks/usePushToTalk";
import { useRoomTransition } from "./hooks/useRoomTransition";
import { useVoiceHub } from "./hooks/useVoiceHub";
import { LobbyScreen } from "./components/LobbyScreen";
import "./styles.css";

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

  const joinAndStartVoice = useCallback(async () => {
    try {
      const result = await gameHub.join(sessionId, playerName);
      await voiceHub.start(sessionId, result.player.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not join session.");
    }
  }, [gameHub, playerName, sessionId, voiceHub]);

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
        onSelectMode={gameHub.selectMode}
        onSelectCase={gameHub.selectCase}
        onStartBriefing={gameHub.startBriefing}
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
          talkingIds={voiceHub.talkingIds}
          isMoving={roomTransition.isMoving}
        />
        <RoomTransitionOverlay
          isMoving={roomTransition.isMoving}
          targetRoom={roomTransition.targetRoom}
        />
      </section>

      <VisiblePlayersPanel
        currentRoom={gameHub.currentRoom}
        players={gameHub.visiblePlayers}
        talkingIds={voiceHub.talkingIds}
      />
    </main>
  );
}
