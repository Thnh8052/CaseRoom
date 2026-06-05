type JoinScreenProps = {
  sessionId: string;
  playerName: string;
  onSessionIdChange: (value: string) => void;
  onPlayerNameChange: (value: string) => void;
  onJoin: () => void;
};

export function JoinScreen({
  sessionId,
  playerName,
  onSessionIdChange,
  onPlayerNameChange,
  onJoin
}: JoinScreenProps) {
  return (
    <main className="shell centered">
      <section className="join-card">
        <h1>CaseRoom V1</h1>
        <p>Join lobby/briefing room. Mic permission is requested immediately after joining.</p>
        <label>
          Session code
          <input value={sessionId} onChange={e => onSessionIdChange(e.target.value)} />
        </label>
        <label>
          Player name
          <input value={playerName} onChange={e => onPlayerNameChange(e.target.value)} placeholder="Thành" />
        </label>
        <button onClick={onJoin}>Join Lobby + Enable Mic</button>
        <p className="hint">Tip: open two browser windows with the same session code.</p>
      </section>
    </main>
  );
}
