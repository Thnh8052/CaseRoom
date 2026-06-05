import type { CaseSummary, GameMode } from "../../../shared/types/game";
import { ModeSelector } from "./ModeSelector";
import { CollapsibleCaseList } from "./CollapsibleCaseList";

type Props = {
  cases: CaseSummary[];
  selectedMode: GameMode;
  selectedCase: CaseSummary | null;
  phase: string;
  isHost: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectCase: (caseId: string) => void;
};

export function GameSetupPanel({
  cases,
  selectedMode,
  selectedCase,
  phase,
  isHost,
  onSelectMode,
  onSelectCase
}: Props) {
  const canEdit = phase === "Lobby";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {selectedMode === "SinglePlayer" ? (
        <div className="glass-panel">
          <h2 className="lobby-header">Game Mode</h2>
          <p className="lobby-subtitle">Single Player mode active.</p>
          <div className="setup-grid">
            <div className="setup-item selected" style={{ cursor: "default" }}>
              <div className="setup-item-title">NPC Murderer</div>
              <div className="setup-item-desc">Investigate and identify the NPC murderer.</div>
            </div>
          </div>
        </div>
      ) : (
        <ModeSelector
          selectedMode={selectedMode}
          isHost={isHost}
          canEdit={canEdit}
          onSelectMode={onSelectMode}
        />
      )}

      <CollapsibleCaseList
        cases={cases}
        selectedCase={selectedCase}
        selectedMode={selectedMode}
        isHost={isHost}
        canEdit={canEdit}
        onSelectCase={onSelectCase}
      />
    </div>
  );
}
