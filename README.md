# CaseRoom - Multiplayer Detective Game

CaseRoom is a real-time multiplayer detective and social deduction game framework. It allows players to join sessions, explore RPG-style 2D environments, inspect objects, gather evidence, and communicate via built-in WebRTC voice chat.

## Features

- **RPG-Style 2D Movement:** Explore the map using WASD/Arrow keys with soft-collision physics between players.
- **Dynamic Glassmorphism HUD:** Modern floating UI with a collapsible player list, contextual action popups, and an interactive inventory hotbar.
- **Role Assignment:** Players are dynamically assigned roles (e.g., Detective, Murderer) with specific UI indicators and tailored mechanics.
- **Interactive Inventory & Objects:** Pick up items from the floor, drop them, give them to other players, and inspect map objects with visual progress bars.
- **Interactive Notebook:** A fully functional Notebook modal to store clues, review evidence, and chat with the Detective AI.
- **Proximity-Based Voice Chat:** Same-room push-to-talk (PTT) voice communication via WebRTC. Players can only hear others in the same room.
- **Server-Side Security:** Strict server-side validation for movement, object interactions, and item pickups based on absolute distances to prevent client-side spoofing.
- **Room Transitions:** Smooth transitions with loading overlays and cooldowns to prevent action spam.

## Requirements

- **.NET 10 SDK** (If you only have .NET 9, change `TargetFramework` in `CaseRoom.Api.csproj` from `net10.0` to `net9.0`).
- **Node.js 22+** recommended.
- **Browser:** Chrome/Edge.
- *Note:* For microphone access, the frontend must be served over `localhost` or HTTPS.

## Getting Started

### 1. Run the Backend

```bash
cd backend/CaseRoom.Api
dotnet restore
dotnet run
```
Backend will start at: `http://localhost:5050`

### 2. Run the Frontend

```bash
cd frontend/caseroom-web
npm install
npm run dev
```
Frontend will start at: `http://localhost:5173`

## Testing Multiplayer Locally

1. Open `http://localhost:5173` in two browser windows.
2. Join the same session code (e.g., `test-room`) but use different player names.
3. Allow microphone permissions in both windows.
4. Move your characters using WASD. Hold `V` or click the bottom-left PTT button to speak.
5. Move one player to another room. Notice how that player disappears from the view, and the voice connection drops (enforcing same-room audio).

## Technical Stack

- **Backend:** ASP.NET Core, SignalR (Game State Sync)
- **Frontend:** React, TypeScript, Vite, CSS (Glassmorphism & RPG Grid)
- **Voice:** WebRTC (Peer-to-peer mesh networking)

## Roadmap

- Integrate PostgreSQL + EF Core for persistent data storage.
- Add ASP.NET Core Identity for user authentication.
- Implement an overarching Database for storing Case files and Map layouts.
- Enhance the Detective AI to act as an active NPC in the game.

## Version History

### V2.0 - RPG Mechanics, Physics & Immersive HUD
* **RPG-Style 2D Movement:** Transitioned from static point-and-click to WASD/Arrow key movement.
* **Physics & Proximity:** Added soft-collision physics between players and absolute server-side validation for interactions and movement.
* **Immersive Dynamic HUD (Glassmorphism):** Completely overhauled UI with floating panels, a dropdown player list, and an inventory hotbar, replacing old static sidebars.
* **Role System & Interactive Context:** Introduced Detective/Murderer roles, a Notebook modal for AI interaction, and real-time Floor Items sync for dropping and giving items.

### V1.5 - Inventory & Evidence System Baseline
* Added foundational inventory mechanisms.
* Integrated the first iteration of the Detective AI within a standalone chat interface.
* Allowed server to broadcast state snapshots containing dropped items on the floor.

### V1.3 - Security & Anti-Spoofing
* **Strict Server Verification:** Moved logic from client to server to verify player identities, movement states, and distance.
* **Network Isolation:** Hidden internal connection IDs and data structures from clients to prevent leaks.
* **Voice Security:** Enforced strict same-room checks for WebRTC signaling to prevent cross-room audio harassment.

### V1.2 - Room Transition & Loading UX
* Introduced minimum 850ms loading screens for room transitions to prevent teleport spam.
* Automatically disable Push-to-Talk, Movement, and interactions during transitions.
* Server-side rejection of requests while a player's room transition is pending.

### V1.0 - The Core Framework
* Real-time multiplayer synchronization via SignalR.
* Same-room WebRTC peer-to-peer voice chat.
* Basic Lobby (Briefing Room) and multi-room map navigation.
* In-memory datastore for fast prototyping without external DB dependencies.
