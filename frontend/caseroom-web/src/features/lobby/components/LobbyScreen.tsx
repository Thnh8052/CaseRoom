import { useState } from "react";
import { GameSetupPanel } from "./GameSetupPanel";
import { CharacterSetupModal } from "./CharacterSetupModal";
import type { Player, SessionSnapshot, CaseSummary, GameMode, CharacterAppearance } from "../../../shared/types/game";
import "../styles/lobby.css";

type Props = {
  sessionId: string;
  players: Player[];
  snapshot: SessionSnapshot;
  availableCases: CaseSummary[];
  isHost: boolean;
  selfPlayer: Player | null;
  onSelectMode: (mode: GameMode) => void;
  onSelectCase: (caseId: string) => void;
  onStartBriefing: () => void;
  onToggleReady: () => void;
  onSetAppearance: (appearance: CharacterAppearance) => void;
  onLeave: () => void;
};

export function LobbyScreen({
  sessionId,
  players,
  snapshot,
  availableCases,
  isHost,
  selfPlayer,
  onSelectMode,
  onSelectCase,
  onStartBriefing,
  onToggleReady,
  onSetAppearance,
  onLeave
}: Props) {
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);

  return (
    <div className="lobby-screen" style={{ position: 'relative' }}>
      {/* Nút Thoát Phòng đặt ở góc trên cùng bên trái */}
      <button
        className="btn-edit-appearance"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          fontWeight: 'bold',
          zIndex: 10
        }}
        onClick={onLeave}
      >
        &larr; Thoát Phòng
      </button>

      {/* Left Column: Players */}
      <div className="glass-panel" style={{ marginTop: '40px' }}>
        <div>
          <h2 className="lobby-header">
            CaseRoom {snapshot.selectedMode !== "SinglePlayer" && <span className="lobby-session-id">#{sessionId}</span>}
          </h2>
          {snapshot.selectedMode !== "SinglePlayer" && <p className="lobby-subtitle">Waiting for investigators to join...</p>}
        </div>

        <div className="player-list">
          {players.map(p => {
            const isPlayerHost = snapshot.hostPlayerId === p.id;
            return (
              <div key={p.id} className="lobby-player-card">
                <div
                  className="lobby-player-avatar"
                  style={{ background: p.appearance?.avatarColor || "linear-gradient(135deg, #38bdf8, #818cf8)" }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="lobby-player-info">
                  <span className="lobby-player-name">{p.name}</span>
                  <span className="lobby-player-role">
                    {isPlayerHost ? "Host" : "Investigator"}
                  </span>
                  {selfPlayer?.id === p.id && (
                    <button
                      onClick={() => setShowAppearanceModal(true)}
                      className="btn-edit-appearance"
                    >
                      Edit Appearance
                    </button>
                  )}
                </div>
                <div className="lobby-player-status">
                  {p.isReady ? (
                    <span className="badge-ready">READY</span>
                  ) : snapshot.selectedMode !== "SinglePlayer" ? (
                    <span className="badge-waiting">WAITING</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Setup */}
      <div className="glass-panel lobby-setup-panel">
        <GameSetupPanel
          cases={availableCases}
          selectedMode={snapshot.selectedMode}
          selectedCase={snapshot.selectedCase ?? null}
          phase={snapshot.phase}
          isHost={isHost}
          onSelectMode={onSelectMode}
          onSelectCase={onSelectCase}
        />

        {/* Dành cho tất cả người chơi: Nút Toggle Ready */}
        <div className="lobby-actions">
          <button
            className={`btn-primary-large btn-ready ${selfPlayer?.isReady ? 'ready' : ''}`}
            onClick={onToggleReady}
          >
            {selfPlayer?.isReady ? "BỎ SẴN SÀNG" : "SẴN SÀNG"}
          </button>

          {isHost && (
            <button
              className="btn-primary-large btn-start"
              disabled={!snapshot.selectedCase || players.some(p => !p.isReady)}
              onClick={onStartBriefing}
            >
              Start Briefing
            </button>
          )}
        </div>
      </div>

      {showAppearanceModal && (
        <CharacterSetupModal
          initialAppearance={selfPlayer?.appearance}
          onSave={onSetAppearance}
          onClose={() => setShowAppearanceModal(false)}
        />
      )}
    </div>
  );
}
