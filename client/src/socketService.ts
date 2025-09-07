import { Socket } from 'socket.io-client';
import { type GamePhase, type Player, type CharacterSelections, type InfoCard, type DiscussionTimer, type VoteState, type VoteResult, type GameLogEntry } from './types';

// App.tsxから渡される状態更新関数群の型定義
export interface SocketEventHandlers {
  setGamePhase: (phase: GamePhase) => void;
  setRoomId: (roomId: string) => void;
  setPlayers: (players: Player[]) => void;
  setMyPlayer: (player: Player | null) => void;
  setErrorMessage: (message: string | null) => void;
  setLoadingMessage: (message: string | null) => void;
  setCharacterSelections: (selections: CharacterSelections) => void;
  setInfoCards: (cards: InfoCard[]) => void;
  setDiscussionTimer: (timer: DiscussionTimer) => void;
  setVoteState: (voteState: VoteState) => void;
  setVoteResult: (result: VoteResult | null) => void;
  setGameLog: (log: GameLogEntry[]) => void;
  setReadingTimerEndTime: (time: number | null) => void;
  setSelectedCharacterId: (id: string | null) => void;
  dispatchModal: (action: any) => void; // App.tsxのmodalReducerに依存
  handleRoomClosed: () => void;
  setDiscussionHowtoSeq: (s: number) => void;
}

/**
 * サーバーからのイベントを一括で登録します。
 */
export const registerEventListeners = (socket: Socket, handlers: SocketEventHandlers) => {
  // ルーム作成完了
  socket.on('roomCreated', (data) => {
    console.log('Room created:', data);
    handlers.setRoomId(data.roomId);
    handlers.setPlayers(data.players);
    handlers.setMyPlayer(data.yourPlayer);
    handlers.setCharacterSelections(data.characterSelections);
    handlers.setInfoCards(data.infoCards);
    handlers.setDiscussionTimer(data.discussionTimer);
    handlers.setVoteState(data.votes);
    handlers.setVoteResult(data.voteResult);
    handlers.setGameLog(data.gameLog);
    handlers.setGamePhase(data.gamePhase);
    handlers.dispatchModal({ type: 'CLOSE', modal: 'createRoom' });
    handlers.setLoadingMessage(null);
    localStorage.setItem('roomId', data.roomId);
  });

  // ルーム参加・復帰完了
  socket.on('roomJoined', (data) => {
    console.log('Room joined:', data);
    handlers.setRoomId(data.roomId);
    handlers.setPlayers(data.players);
    handlers.setMyPlayer(data.yourPlayer);
    handlers.setCharacterSelections(data.characterSelections);
    handlers.setInfoCards(data.infoCards);
    handlers.setDiscussionTimer(data.discussionTimer);
    handlers.setVoteState(data.votes);
    handlers.setVoteResult(data.voteResult);
    handlers.setGameLog(data.gameLog);
    handlers.setGamePhase(data.gamePhase);
    handlers.setReadingTimerEndTime(data.readingTimerEndTime);
    handlers.dispatchModal({ type: 'CLOSE', modal: 'findRoom' });
    handlers.dispatchModal({ type: 'CLOSE', modal: 'expMurder' });
    handlers.setLoadingMessage(null);
    localStorage.setItem('roomId', data.roomId);
  });

  // プレイヤー情報更新
  socket.on('updatePlayers', (data: { players: Player[] }) => {
    handlers.setPlayers(data.players);
    // App.tsx側でuserIdRefを使って更新していた部分は、App.tsxに残すか、別の方法を考える必要があります。
    // 今回は一旦App.tsx側でこのイベントをリッスンし続ける形とします。
  });

  // ゲームフェーズ変更
  socket.on('gamePhaseChanged', (newPhase) => {
    console.log('Game phase changed to:', newPhase);
    handlers.setGamePhase(newPhase);
    if (newPhase === 'firstDiscussion') {
      // 第一議論フェイズ開始時はHO読み上げタイマーをリセット
      handlers.dispatchModal({ type: 'CLOSE', modal: 'hoReadForcedEnd' });
      handlers.dispatchModal({ type: 'CLOSE', modal: 'hoReadEnd' });
      handlers.setReadingTimerEndTime(null);
      // 第一議論フェイズ開始時はチュートリアルツアーを開始
      handlers.setDiscussionHowtoSeq(1);
    }
    if (newPhase === 'debriefing') {
      // 感想戦開始時はHO読み上げタイマーをリセット
      handlers.setReadingTimerEndTime(null);
    }
  });

  // キャラクター選択状況更新
  socket.on('characterSelectionUpdated', handlers.setCharacterSelections);

  // 情報カード更新
  socket.on('infoCardsUpdated', (updatedInfoCards) => {
    console.log('Info cards updated');
    handlers.setInfoCards(updatedInfoCards);
  });

  // ゲームログ更新
  socket.on('gameLogUpdated', (log) => {
    console.log('Game log updated');
    handlers.setGameLog(log);
  });

  // 議論タイマー更新
  socket.on('discussionTimerUpdated', (timer) => {
    console.log('Discussion timer updated', timer);
    handlers.setDiscussionTimer(timer);
  });

  // 投票状況更新
  socket.on('voteStateUpdated', (votes) => {
    console.log('Vote state updated', votes);
    handlers.setVoteState(votes);
  });

  // 決選投票
  socket.on('voteTied', () => {
    console.log('Vote tied, re-voting required.');
    handlers.dispatchModal({ type: 'OPEN', modal: 'voteTied' });
    handlers.setVoteState({}); // 投票状況をリセット
  });

  // 投票結果確定（モーダル表示用）
  socket.on('voteResultFinalized', ({ result, votes }) => {
    console.log('Vote result finalized', result);
    handlers.setVoteResult(result);
    handlers.setVoteState(votes);
    handlers.dispatchModal({ type: 'OPEN', modal: 'voteResult' }); // モーダルを表示
  });

  // HOタイマー延長
  socket.on('readingTimeExtended', ({ endTime }) => {
    handlers.setReadingTimerEndTime(endTime);
    handlers.dispatchModal({ type: 'CLOSE', modal: 'hoReadEnd' });
  });

  // エラーハンドリング
  socket.on('roomNotFound', () => {
    handlers.setErrorMessage('ルームが見つかりません。');
    localStorage.removeItem('roomId');
    handlers.setLoadingMessage(null);
  });
  socket.on('roomFull', () => {
    handlers.setErrorMessage('そのルームは満員です。')
    handlers.setLoadingMessage(null);
  });

  // ルーム解散を受信
  socket.on('roomClosed', () => {
    console.log('Room closed by server');
    //ルーム解散クライアント側処理
    handlers.handleRoomClosed();
  });
};


// --- イベント送信 (Emitters) ---

// ルーム作成
export const emitCreateRoom = (socket: Socket, username: string, userId: string) => {
  socket.emit('createRoom', { username, userId });
};

// ルーム入室
export const emitJoinRoom = (socket: Socket, username: string, userId: string, roomId: string, isSpectator?: boolean) => {
  socket.emit('joinRoom', { username, userId, roomId, isSpectator });
};

// ルーム退室
export const emitLeaveRoom = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('leaveRoom', { roomId, userId });
};

// ルーム解散
export const emitCloseRoom = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('closeRoom', { roomId, userId });
};

// ゲーム開始
export const emitStartGame = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('startGame', { roomId, userId });
};

// キャラクター選択
export const emitSelectCharacter = (socket: Socket, roomId: string, userId: string, characterId: string | null) => {
  socket.emit('selectCharacter', { roomId, userId, characterId });
};

// キャラクター確定
export const emitConfirmCharacters = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('confirmCharacters', { roomId, userId });
};

// タイマー延長
export const emitExtendReadingTimer = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('extendReadingTimer', { roomId, userId });
};

// 第一議論フェイズ終了
export const emitProceedToFirstDiscussion = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('proceedToFirstDiscussion', { roomId, userId });
};

// 情報カード取得
export const emitGetCard = (socket: Socket, roomId: string, userId: string, cardId: string) => {
  socket.emit('getCard', { roomId, userId, cardId });
};

// 情報カード全体公開
export const emitMakeCardPublic = (socket: Socket, roomId: string, userId: string, cardId: string) => {
  socket.emit('makeCardPublic', { roomId, userId, cardId });
};

// 情報カード譲渡
export const emitTransferCard = (socket: Socket, roomId: string, userId: string, cardId: string, targetUserId: string) => {
  socket.emit('transferCard', { roomId, userId, cardId, targetUserId });
};

// 議論タイマー開始
export const emitStartDiscussionTimer = (socket: Socket, roomId: string, userId: string, phase: 'firstDiscussion' | 'secondDiscussion', durationSeconds: number) => {
  socket.emit('startDiscussionTimer', { roomId, userId, phase, durationSeconds });
};

// 議論タイマー一時停止
export const emitPauseDiscussionTimer = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('pauseDiscussionTimer', { roomId, userId });
};

// 議論タイマー再開
export const emitResumeDiscussionTimer = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('resumeDiscussionTimer', { roomId, userId });
};

// 議論強制終了
export const emitRequestEndDiscussion = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('requestEndDiscussion', { roomId, userId });
};

// 議論強制終了の中止
export const emitCancelEndDiscussion = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('cancelEndDiscussion', { roomId, userId });
};

// 議論フェイズ終了確定
export const emitConfirmEndDiscussion = (socket: Socket, roomId: string, userId: string) => {
  socket.emit('confirmEndDiscussion', { roomId, userId });
};

// 投票
export const emitSubmitVote = (socket: Socket, roomId: string, userId: string, votedCharacterId: string) => {
  socket.emit('submitVote', { roomId, userId, votedCharacterId });
};

// フェーズ移行
export const emitChangeGamePhase = (socket: Socket, roomId: string, newPhase: GamePhase) => {
  socket.emit('changeGamePhase', { roomId, newPhase });
};

// スキル使用
export const emitUseActiveSkill = (socket: Socket, roomId: string, userId: string, skillId: string, payload: any) => {
  socket.emit('useActiveSkill', { roomId, userId, skillId, payload });
};

// 準備中/準備完了の設定
export const emitSetStandBy = (socket: Socket, roomId: string, userId: string, value: boolean) => {
  socket.emit('setStandBy', { roomId, userId, value });
};
