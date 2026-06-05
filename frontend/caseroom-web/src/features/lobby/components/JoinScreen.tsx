import { useState } from "react";
import "../styles/start-screen.css";

type JoinScreenProps = {
  sessionId: string;
  playerName: string;
  onSessionIdChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  onJoin: (mode?: string, explicitSessionId?: string) => void;
};

type MenuState = "main" | "single" | "host" | "join";

export function JoinScreen({
  sessionId,
  playerName,
  onSessionIdChange,
  onPlayerNameChange,
  onJoin
}: JoinScreenProps) {
  const [menuState, setMenuState] = useState<MenuState>("main");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRandomSession = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleStartSinglePlayer = async () => {
    if (!playerName.trim()) {
      setError("Vui lòng nhập Tên Thám Tử của bạn!");
      return;
    }
    setError(null);
    setIsLoading(true);
    const newSessionId = generateRandomSession();
    onSessionIdChange(newSessionId);
    await onJoin("SinglePlayer", newSessionId);
  };

  const handleHostGame = async () => {
    if (!playerName.trim()) {
      setError("Vui lòng nhập Tên Thám Tử của bạn!");
      return;
    }
    setError(null);
    setIsLoading(true);
    const newSessionId = generateRandomSession();
    onSessionIdChange(newSessionId);
    await onJoin(undefined, newSessionId);
  };

  const handleJoinGame = async () => {
    if (!playerName.trim() || !sessionId.trim()) {
      setError("Vui lòng nhập đủ Tên và Mã Phòng!");
      return;
    }
    setError(null);
    setIsLoading(true);
    await onJoin("Join");
  };

  return (
    <div className="start-screen-container">
      <div className="start-screen-overlay"></div>

      <div className="start-content">
        <h1>CaseRoom</h1>
        <p className="subtitle">Crimson Estate Murder Mystery</p>

        {isLoading ? (
          <div className="form-panel" style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="loading-spinner"></div>
            <h3>Đang kết nối tới biệt thự...</h3>
          </div>
        ) : (
          <>
            {menuState === "main" && (
              <div className="start-menu">
                <button className="btn-menu" onClick={() => setMenuState("single")}>
                  Single Player
                </button>
                <button className="btn-menu" onClick={() => setMenuState("host")}>
                  Host Multiplayer Game
                </button>
                <button className="btn-menu" onClick={() => setMenuState("join")}>
                  Join Multiplayer Game
                </button>
              </div>
            )}

            {menuState === "single" && (
              <div className="form-panel">
                <h3>Single Player</h3>
                <label>
                  Tên Thám Tử:
                  <input
                    value={playerName}
                    onChange={e => {
                      onPlayerNameChange(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ví dụ: Conan"
                    autoFocus
                  />
                </label>
                {error && <div className="error-toast">{error}</div>}
                <button className="btn-menu primary" onClick={handleStartSinglePlayer}>Bắt Đầu Phá Án</button>
                <button className="back-link" onClick={() => { setMenuState("main"); setError(null); }}>&larr; Quay lại</button>
              </div>
            )}

            {menuState === "host" && (
              <div className="form-panel">
                <h3>Host Multiplayer Game</h3>
                <label>
                  Tên Thám Tử:
                  <input
                    value={playerName}
                    onChange={e => {
                      onPlayerNameChange(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ví dụ: Holmes"
                    autoFocus
                  />
                </label>
                {error && <div className="error-toast">{error}</div>}
                <button className="btn-menu primary" onClick={handleHostGame}>Tạo Phòng (Host)</button>
                <button className="back-link" onClick={() => { setMenuState("main"); setError(null); }}>&larr; Quay lại</button>
              </div>
            )}

            {menuState === "join" && (
              <div className="form-panel">
                <h3>Join Multiplayer Game</h3>
                <label>
                  Tên Thám Tử:
                  <input
                    value={playerName}
                    onChange={e => {
                      onPlayerNameChange(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ví dụ: Watson"
                    autoFocus
                  />
                </label>
                <label>
                  Mã Phòng (Session ID):
                  <input
                    value={sessionId}
                    onChange={e => {
                      onSessionIdChange(e.target.value);
                      setError(null);
                    }}
                    placeholder="Nhập mã phòng 6 chữ số..."
                  />
                </label>
                {error && <div className="error-toast">{error}</div>}
                <button className="btn-menu primary" onClick={handleJoinGame}>Tham Gia Phòng</button>
                <button className="back-link" onClick={() => { setMenuState("main"); setError(null); }}>&larr; Quay lại</button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
