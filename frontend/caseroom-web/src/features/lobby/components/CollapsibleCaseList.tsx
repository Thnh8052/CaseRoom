import { useMemo, useState } from "react";
import type { CaseSummary, GameMode } from "../../../shared/types/game";

type Props = {
  cases: CaseSummary[];
  selectedCase: CaseSummary | null;
  selectedMode: GameMode;
  isHost: boolean;
  canEdit: boolean;
  onSelectCase: (caseId: string) => void;
};

export function CollapsibleCaseList({
  cases,
  selectedCase,
  selectedMode,
  isHost,
  canEdit,
  onSelectCase
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const compatibleCases = useMemo(() => {
    const q = query.trim().toLowerCase();

    return cases.filter(c => {
      const supportsMode = c.supportedModes.includes(selectedMode);
      const matchesQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.difficulty.toLowerCase().includes(q);

      return supportsMode && matchesQuery;
    });
  }, [cases, selectedMode, query]);

  return (
    <div style={{ marginTop: 16 }}>
      <div className="lobby-header" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>Selected Case</h2>

          {selectedCase ? (
            <div style={{ marginTop: 4 }}>
              <div className="setup-item-title" style={{ color: "#38bdf8" }}>{selectedCase.title}</div>
              <div className="setup-item-desc">
                {selectedCase.difficulty} • {selectedCase.estimatedMinutes} min
              </div>
            </div>
          ) : (
            <p className="lobby-subtitle">No case selected.</p>
          )}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="case-toggle-btn"
        >
          {expanded ? "Close Catalog" : "Browse Cases"}
        </button>
      </div>

      {selectedCase && (
        <p className="setup-item-desc" style={{ marginTop: 12 }}>{selectedCase.summary}</p>
      )}

      {expanded && (
        <div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cases by name or keyword..."
            className="search-input"
          />

          <div className="case-list-scroll">
            <div className="setup-grid">
              {compatibleCases.map(c => {
                const selected = selectedCase?.id === c.id;

                return (
                  <button
                    key={c.id}
                    disabled={!isHost || !canEdit}
                    onClick={() => onSelectCase(c.id)}
                    className={`setup-item ${selected ? "selected" : ""}`}
                  >
                    <div className="setup-item-header">
                      <h3 className="setup-item-title">{c.title}</h3>
                      {selected && <span className="badge">Selected</span>}
                    </div>

                    <p className="setup-item-desc">{c.summary}</p>

                    <div className="setup-item-meta">
                      <span>{c.difficulty}</span>
                      <span>•</span>
                      <span>{c.estimatedMinutes} min</span>
                    </div>
                  </button>
                );
              })}

              {compatibleCases.length === 0 && (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>
                  No cases match this mode/search.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isHost && (
        <p className="lobby-subtitle" style={{ marginTop: 16 }}>
          Only the host can change mode or case.
        </p>
      )}
    </div>
  );
}
