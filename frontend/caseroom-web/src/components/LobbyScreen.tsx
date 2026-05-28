import { GameSetupPanel } from "./GameSetupPanel";
import type { Player, SessionSnapshot, CaseSummary, GameMode } from "../types";
import "../lobby.css";

type Props = {
  sessionId: string;
  players: Player[];
  snapshot: SessionSnapshot;
  availableCases: CaseSummary[];
  isHost: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectCase: (caseId: string) => void;
  onStartBriefing: () => void;
};

export function LobbyScreen({
  sessionId,
  players,
  snapshot,
  availableCases,
  isHost,
  onSelectMode,
  onSelectCase,
  onStartBriefing
}: Props) {
  return (
    <div className="lobby-screen">
      {/* Left Column: Players */}
      <div className="glass-panel">
        <h2 className="lobby-header">
          CaseRoom <span style={{ fontSize: "1rem", color: "#38bdf8" }}>#{sessionId}</span>
        </h2>
        <p className="lobby-subtitle">Waiting for investigators to join...</p>

        <div className="player-list">
          {players.map(p => {
            const isPlayerHost = snapshot.hostPlayerId === p.id;
            return (
              <div key={p.id} className="lobby-player-card">
                <div className="lobby-player-avatar">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="lobby-player-info">
                  <span className="lobby-player-name">{p.name}</span>
                  <span className="lobby-player-role">
                    {isPlayerHost ? "Host" : "Investigator"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Setup */}
      <div className="glass-panel" style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}>
        <GameSetupPanel
          cases={availableCases}
          selectedMode={snapshot.selectedMode}
          selectedCase={snapshot.selectedCase ?? null}
          phase={snapshot.phase}
          isHost={isHost}
          onSelectMode={onSelectMode}
          onSelectCase={onSelectCase}
        />

        {isHost ? (
          <button 
            className="btn-primary-large"
            disabled={!snapshot.selectedCase}
            onClick={onStartBriefing}
          >
            Start Briefing
          </button>
        ) : (
          <div style={{ textAlign: "center", marginTop: 24, color: "#94a3b8" }}>
            Waiting for Host to start the game...
          </div>
        )}
      </div>
    </div>
  );
}
