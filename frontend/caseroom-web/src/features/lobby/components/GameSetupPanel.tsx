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
      <ModeSelector
        selectedMode={selectedMode}
        isHost={isHost}
        canEdit={canEdit}
        onSelectMode={onSelectMode}
      />

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
