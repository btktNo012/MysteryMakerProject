export interface Skill {
  id: string | null;
  name: string;
  type: 'passive' | 'active';
  description: string;
  used: boolean;
}

export interface Player {
  id: string;
  userId: string;
  name: string;
  isMaster: boolean;
  isSpectator?: boolean;
  connected: boolean;
  acquiredCardCount: {
    firstDiscussion: number;
    secondDiscussion: number;
  };
  skills: Skill[];
  isStandBy: boolean;
}

export interface InfoCard {
  id: string;
  name: string;
  content: string;
  owner: string | null;
  firstOwner: string | null;
  isPublic: boolean;
}

export type GamePhase =
  | 'waiting'
  | 'introduction'
  | 'synopsis'
  | 'characterSelect'
  | 'commonInfo'
  | 'individualStory'
  | 'firstDiscussion'
  | 'interlude'
  | 'secondDiscussion'
  | 'voting'
  | 'ending'
  | 'debriefing';

export interface GameLogEntry {
  type: string;
  message: string;
}

export type DiscussionPhase = 'firstDiscussion' | 'secondDiscussion' | null;
export type DiscussionEndState = 'none' | 'requested' | 'timeup';

export interface DiscussionTimer {
  endTime: number | null; // 稼働中の絶対時刻(ms)。一時停止中はnull
  remainingMs: number | null; // 一時停止中の残り(ms)。稼働中はnull
  isTicking: boolean;
  phase: DiscussionPhase;
  endState: DiscussionEndState;
}

export interface Room {
  id: string;
  players: Player[];
  masterUserId: string;
  maxPlayers: number;
  gamePhase: GamePhase;
  characterSelections: Record<string, string | null>;
  readingTimerEndTime: number | null;
  infoCards: InfoCard[];
  discussionTimer: DiscussionTimer;
  votes: Record<string, string>;
  voteResult: {
    votedCharacterId: string;
    count: number;
  } | null;
  gameLog: GameLogEntry[];
}
