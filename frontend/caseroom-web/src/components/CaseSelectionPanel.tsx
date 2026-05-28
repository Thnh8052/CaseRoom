import type { CaseSummary } from "../types";

type Props = {
    cases: CaseSummary[];
    selectedCase: CaseSummary | null;
    isHost: boolean;
    phase: string | undefined;
    onSelectCase: (caseId: string) => void;
};

/**
 * Bảng giao diện cho phép Host chọn vụ án (Case).
 * Chỉ hiển thị hoặc tương tác được khi Game đang ở phase "Lobby".
 */
export function CaseSelectionPanel({
    cases,
    selectedCase,
    isHost,
    phase,
    onSelectCase
}: Props) {
    const canChangeCase = isHost && phase === "Lobby";

    return (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 shadow">
            <div className="mb-3">
                <h2 className="text-lg font-semibold text-slate-100">Case Selection</h2>
                <p className="text-sm text-slate-400">
                    Host selects the case before briefing starts.
                </p>
            </div>

            <div className="grid gap-3">
                {cases.map(c => {
                    const isSelected = selectedCase?.id === c.id;

                    return (
                        <button
                            key={c.id}
                            disabled={!canChangeCase}
                            onClick={() => onSelectCase(c.id)}
                            className={[
                                "rounded-xl border p-3 text-left transition",
                                isSelected
                                    ? "border-emerald-400 bg-emerald-950/40"
                                    : "border-slate-700 bg-slate-800/60 hover:bg-slate-800",
                                !canChangeCase ? "cursor-default opacity-80" : ""
                            ].join(" ")}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="font-semibold text-slate-100">{c.title}</h3>
                                {isSelected && (
                                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">
                                        Selected
                                    </span>
                                )}
                            </div>

                            <p className="mt-1 text-sm text-slate-300">{c.summary}</p>

                            <div className="mt-2 flex gap-2 text-xs text-slate-400">
                                <span>Difficulty: {c.difficulty}</span>
                                <span>•</span>
                                <span>{c.estimatedMinutes} min</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {!isHost && (
                <p className="mt-3 text-xs text-slate-500">
                    Waiting for host to choose a case.
                </p>
            )}
        </section>
    );
}