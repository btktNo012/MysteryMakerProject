// src/types.ts
export interface Goal {
  text: string;           // 目標テキスト
  points: number;         // 点数
}

// キャラクター情報
export interface Character {
  id: string;
  name: string;
  nameRuby: string;
  type: 'PC' | 'NPC';
  profile: string;
  imageFile?: string;
  storyFile?: string;
  skills?: Skill[];
  goals?: { text: string; hint: string; points: number; judge: string; }[];
  mapImageFile?: string;
}
// スキル情報
export interface Skill {
  id: string | null;
  name: string;
  type: 'passive' | 'active';
  description: string;
  used: boolean;
}
// スキルの詳細情報
export interface SkillInfoData {
  id: string;
  name: string;
  description: string;
}
// エンディング情報
export interface Ending {
  votedCharId: string;
  endingFile: string;
  title: string;
}

export interface DebriefingContent {
  title: string;
  file: string;
}

export interface DebriefingCharacterInfos {
  id: string;
  title: string;
  file: string;
}

export interface ScenarioData {
  title: string;
  titleImage?: string; // Optional title image path
  introductionFile: string,
  synopsisFile: string,
  commonInfo: {
    textFile: string;
  };
  intermediateInfo: {
    textFile: string;
  };
  discussionPhaseSettings: {
    howto: string;
    firstDiscussion: {
      maxCardsPerPlayer: number;
      timeLimit: number;
    };
    secondDiscussion: {
      maxCardsPerPlayer: number;
      timeLimit: number;
    };
  };
  characters: Character[];
  endings: Ending[];
  debriefing: {
    mainCommentary: DebriefingContent;
    characterInfo: DebriefingCharacterInfos[];
  };
}

// プレイヤー情報
export interface Player {
  id: string; // Socket ID
  userId: string; // 永続的なユーザーID
  name: string;
  isMaster: boolean;
  connected: boolean;
  acquiredCardCount: {
    firstDiscussion: number;
    secondDiscussion: number;
  };
  skills: Skill[];
  // 準備中
  isStandBy: boolean;
}

// キャラクター選択状況
export type CharacterSelections = Record<string, string | null>; // { [characterId]: socketId | null }

// 情報カードの条件
export interface Condition {
  type: 'type_owner' | 'type_first_ownew' | 'type_public';
  id?: string; // 'type_owner', 'type_first_ownew'の場合、キャラクターID
}

// 情報カードの条件付き情報
export interface ConditionalInfo {
  conditions: Condition[];
  andOr: 'AND' | 'OR';
  trueInfo: string;
  falseInfo: string;
}

// 情報カード
export interface InfoCard {
  id: string;
  name: string;
  iconFile?: string;
  content: string;
  owner: string | null; // userId of the owner
  firstOwner: string | null;
  isPublic: boolean;
  conditionalInfo?: ConditionalInfo;
}
// 議論タイマー
export interface DiscussionTimer {
  endTime: number | null;
  isTicking: boolean;
  phase: 'firstDiscussion' | 'secondDiscussion' | null;
  endState: 'none' | 'requested' | 'timeup';
}
// タイマー
export interface Timer {
  initialSeconds: number; // 初期n時間（秒）
  isTicking: boolean;     // タイマーが作動中か (true: 作動, false: 一時停止)
  onTimeUp: () => void;   // 時間がゼロになったときに呼び出される関数
  resetTrigger?: any;     // この値が変わるとタイマーがリセットされる
  endTime: number | null; // 終了時間
  endState: 'none' | 'requested' | 'timeup';  // タイマー状態(none: 終了前、requested:操作中、timeup:時間切れ)
}

// 投票状況
export type VoteState = Record<string, string>; // { [voterUserId]: votedCharacterId }

// 投票結果
export interface VoteResult {
  votedCharacterId: string;
  count: number;
}

// ゲームログのエントリ
export interface GameLogEntry {
  type: string;
  message: string;
}

// ゲームフェーズ
export type GamePhase =
  'splash' |
  'start' |
  'waiting' |
  'introduction' |
  'synopsis' |
  'characterSelect' |
  'commonInfo' |
  'individualStory' |
  'firstDiscussion' |
  'interlude' |
  'secondDiscussion' |
  'voting' |
  'ending' |
  'debriefing';
