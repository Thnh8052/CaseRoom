import type { GameMode } from "../../../shared/types/game";

const modes: { id: GameMode; label: string; description: string }[] = [

  {
    id: "NpcMurderer",
    label: "NPC Murderer",
    description: "Players cooperate to identify the NPC murderer."
  },
  {
    id: "PlayerMurderer",
    label: "Player Murderer",
    description: "One player is secretly assigned as the murderer."
  },
  {
    id: "EveryoneHasSecrets",
    label: "Everyone Has Secrets",
    description: "Everyone hides something. One player is the murderer."
  }
];

type Props = {
  selectedMode: GameMode;
  isHost: boolean;
  canEdit: boolean;
  onSelectMode: (mode: GameMode) => void;
};

export function ModeSelector({
  selectedMode,
  isHost,
  canEdit,
  onSelectMode
}: Props) {
  return (
    <div className="glass-panel">
      <h2 className="lobby-header">Game Mode</h2>
      <p className="lobby-subtitle">Select the core mechanics of your session.</p>

      <div className="setup-grid">
        {modes.map(mode => {
          const selected = selectedMode === mode.id;

          return (
            <button
              key={mode.id}
              disabled={!isHost || !canEdit}
              onClick={() => onSelectMode(mode.id)}
              className={`setup-item ${selected ? "selected" : ""}`}
            >
              <div className="setup-item-title">{mode.label}</div>
              <div className="setup-item-desc">{mode.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
