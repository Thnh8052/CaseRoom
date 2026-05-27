# CaseRoom V1 Starter - privacy/refactor pass

Version 1 goal:

- Create / join a game session by code.
- Everyone starts in the `briefing` room/lobby.
- Players can move between rooms.
- Players can click/interact with fixed room objects.
- Only the current room is rendered.
- Only players in the current room are visible to the client.
- Avatars/presence are synced through SignalR.
- Same-room push-to-talk voice is available from the lobby using WebRTC.
- No database, login, AI, or evidence yet. This starter keeps state in memory so the core loop is easy to test.

## What changed in this pass

- `App.tsx` no longer owns all game/voice/keyboard logic.
- Frontend logic was split into:
  - `useGameHub()` for SignalR game state.
  - `useVoiceHub()` for the WebRTC voice client lifecycle.
  - `usePushToTalk()` for keyboard/mouse PTT handling.
- UI was split into:
  - `JoinScreen`
  - `ControlPanel`
  - `CurrentRoomView`
  - `VisiblePlayersPanel`
- The server now sends room-scoped occupant updates instead of broadcasting all player locations to everyone.
- `SessionSnapshot.players` is now treated as **visible players only**, not the full session roster.

## Requirements

- .NET 10 SDK. If you only have .NET 9, change `TargetFramework` in `CaseRoom.Api.csproj` from `net10.0` to `net9.0`.
- Node.js 22+ recommended.
- Chrome/Edge browser.
- For microphone access, open the frontend on `localhost` or HTTPS.

## Run backend

```bash
cd backend/CaseRoom.Api
dotnet restore
dotnet run
```

Backend default URL:

```text
http://localhost:5050
```

## Run frontend

```bash
cd frontend/caseroom-web
npm install
npm run dev
```

Frontend default URL:

```text
http://localhost:5173
```

## Test multiplayer locally

1. Open `http://localhost:5173` in two browser windows.
2. Use the same session code, for example `test-room`.
3. Use different player names.
4. Allow microphone permission in both windows.
5. Both players start in Briefing Room.
6. Hold `V` or press the on-screen PTT button to speak.
7. Move one player to another room.
8. That player should disappear from the other player's visible room view, and voice should stop connecting across rooms.

## Important V1 simplification

This starter uses WebRTC mesh. SignalR only does signaling; audio is peer-to-peer between browsers. For 2-6 players this is fine for development.

## Next steps after this starter

- Add PostgreSQL + EF Core.
- Add ASP.NET Core Identity login.
- Persist game rooms and player sessions.
- Replace placeholder rooms/objects with case definitions.
- Add Version 2 evidence/notebook/public board.
- Add Version 2 AI NPC and private AI context.


## V1.2 - Room transition/loading

When a player moves to another room, the client enters a `Moving...` state for at least 850ms:

- A loading overlay covers the room UI.
- Movement and object interaction buttons are disabled to prevent action spam.
- Push-to-talk is temporarily disabled while the voice room refreshes.
- Server rejects interactions if the move transition is not complete.

## V1.3 - Security & Anti-Spoofing

Realtime security improvements to prevent client spoofing:

- Network identifiers are hidden from the client to prevent internal structure leaks.
- The server strictly verifies player identities internally instead of trusting client requests for movement and interactions.
- Voice signaling enforces a same-room check to prevent cross-room audio interference and harassment.
- Added comprehensive code documentation throughout the project.
