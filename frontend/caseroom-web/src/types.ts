export type MapObject = {
  id: string;
  name: string;
  x: number;
  y: number;
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
  currentObjectId?: string | null;
  isTalking: boolean;
};

export type SessionSnapshot = {
  sessionId: string;
  rooms: MapRoom[];
  players: Player[];
};
