export type MapObject = {
  id: string;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type MapRoom = {
  id: string;
  name: string;
  x: number;
  y: number;
  objects: MapObject[];
  connectedRoomIds: string[];
};

export type Player = {
  id: string;
  name: string;
  currentRoomId: string;
  currentObjectId: string | null;
  isReady?: boolean;
  isTalking?: boolean;
  role: string;
  appearance: CharacterAppearance;
};

export type CharacterAppearance = {
  avatarColor: string;
  outfitColor: string;
  hairColor: string;
  accessory: string;
  height: string;
  race: string;
};

export type SessionSnapshot = {
  sessionId: string;
  rooms: MapRoom[];
  players: Player[];
  phase: GamePhase;
  hostPlayerId: string | null;
  selectedMode: GameMode;
  briefingText: string;
  selectedCase: CaseSummary | null;
  myClues: Clue[];
};

export type Clue = {
  id: string;
  title: string;
  description: string;
  sourceObjectId: string;
  fakeDescription?: string;
  isTamperable: boolean;
  tamperCount: number;
  maxTamperLimit: number;
};

export type GameMode =
  | "NpcMurderer"
  | "PlayerMurderer"
  | "EveryoneHasSecrets";

export type GamePhase =
  | "Lobby"
  | "Briefing"
  | "Exploration"
  | "Discussion"
  | "FinalVote"
  | "Ended";

/**
 * Thông tin tóm tắt về một vụ án. Dùng để hiển thị danh sách cho Host chọn.
 */
export type CaseSummary = {
  id: string;
  title: string;
  summary: string;
  difficulty: string;
  estimatedMinutes: number;
  briefingText: string;
  supportedModes: GameMode[];
};