// src/types.ts
export interface Goal {
    text: string;           // 目標テキスト
    points: number;         // 点数
}

// キャラクター情報
export interface Character {
    id: string;             // キャラクターID
    name: string;           // キャラクター名
    type: 'PC' | 'NPC';     // キャラクタータイプ
    profile: string;        // プロフィール
    goals?: Goal[];         // 目標(PCのみ)
    storyFile?: string;     // ストーリーファイルパス(PCのみ)
    mapImageFile?: string;  // マップ画像ファイルパス(PCのみ)
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

export interface DebriefingCharacterEnding {
  id: string;
  title: string;
  file: string;
}

export interface ScenarioData {
  title: string;
  scheduleFile: string,
  synopsisFile: string,
  commonInfo: {
    textFile: string;
  };
  intermediateInfo: {
    textFile: string;
  };
  discussionPhaseSettings: {
    firstDiscussion: {
      maxCardsPerPlayer: number;
    };
    secondDiscussion: {
      maxCardsPerPlayer: number;
    };
  };
  characters: Character[];
  endings: Ending[];
  debriefing: {
    mainCommentary: DebriefingContent;
    characterEndings: DebriefingCharacterEnding[];
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
}

// キャラクター選択状況
export type CharacterSelections = Record<string, string | null>; // { [characterId]: socketId | null }

// 情報カード
export interface InfoCard {
  id: string;
  name: string;
  content: string;
  owner: string | null; // userId of the owner
  isPublic: boolean;
}

// 議論タイマー
export interface DiscussionTimer {
  endTime: number | null;
  isTicking: boolean;
  phase: 'firstDiscussion' | 'secondDiscussion' | null;
  endState: 'none' | 'requested' | 'timeup';
}

// 投票状況
export type VoteState = Record<string, string>; // { [voterUserId]: votedCharacterId }

// 投票結果
export interface VoteResult {
  votedCharacterId: string;
  count: number;
}
