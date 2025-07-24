import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import fs from 'fs';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Viteのフロントエンド
    methods: ["GET", "POST"]
  }
});

// --- 定数 ---
const READING_TIME_SECONDS = 600; // 10 minutes
const READING_TIME_SECONDS_EXTENSION = 180; // 3 minutes

// --- シナリオデータ読み込み ---
const scenarioPath = path.join(__dirname, '../client/public/scenario.json');
const scenarioData = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));
const maxPlayers = scenarioData.characters.filter((c: any) => c.type === 'PC').length;

// --- 型定義 ---
// プレイヤー情報
interface Player {
  id: string;       // Socket ID (揮発性)
  userId: string;   // ユーザーID (永続的)
  name: string;     // プレイヤー名
  isMaster: boolean;
  connected: boolean; // 接続状態
  acquiredCardCount: {
    firstDiscussion: number;
    secondDiscussion: number;
  };
}

// 情報カード
interface InfoCard {
  id: string;
  name: string;
  content: string;
  owner: string | null; // userId of the owner
  isPublic: boolean;
}

// ゲームの進行状況
type GamePhase =
  | 'waiting'
  | 'schedule'
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

// ルーム情報
interface Room {
  id: string;
  players: Player[];
  masterUserId: string; // ルームマスターのuserId
  maxPlayers: number;
  gamePhase: GamePhase;
  characterSelections: Record<string, string | null>; // { [characterId]: userId | null }
  readingTimerEndTime: number | null; // HO読み込みタイマー終了時刻 (Unixタイムスタンプ)
  infoCards: InfoCard[];
  discussionTimer: {
    endTime: number | null;
    isTicking: boolean;
    phase: 'firstDiscussion' | 'secondDiscussion' | null;
    endState: 'none' | 'requested' | 'timeup'; // none: 通常, requested: マスターが強制終了を要求, timeup: 時間切れ
  };
  votes: Record<string, string>; // { [voterUserId]: votedCharacterId }
  voteResult: {
    votedCharacterId: string;
    count: number;
  } | null;
  lastActivityTime: number; // 最終アクティビティ時刻
}

// --- サーバー状態 ---
const rooms: Record<string, Room> = {};

// --- ヘルパー関数 ---
const generateRoomId = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const updateRoomActivity = (room: Room) => {
  room.lastActivityTime = Date.now();
};

const calculateVoteResult = (room: Room) => {
  const voteCounts: Record<string, number> = {};
  Object.values(room.votes).forEach(votedCharId => {
    voteCounts[votedCharId] = (voteCounts[votedCharId] || 0) + 1;
  });

  let maxVotes = 0;
  let winners: string[] = [];
  for (const charId in voteCounts) {
    if (voteCounts[charId] > maxVotes) {
      maxVotes = voteCounts[charId];
      winners = [charId];
    } else if (voteCounts[charId] === maxVotes) {
      winners.push(charId);
    }
  }

  // 決選投票が必要な場合
  if (winners.length > 1) {
    io.to(room.id).emit('voteTied', { winners });
    // 投票をリセット
    room.votes = {};
    io.to(room.id).emit('voteStateUpdated', room.votes);
    return;
  }

  // 投票結果確定
  room.voteResult = { votedCharacterId: winners[0], count: maxVotes };
  // gamePhaseはまだ'voting'のまま。クライアントからの要求で'ending'に遷移する
  console.log(`Room ${room.id}: Vote result is finalized.`);
  io.to(room.id).emit('voteResultFinalized', {
    result: room.voteResult,
    votes: room.votes
  });
};


// --- Socket.IO通信ロジック ---
io.on('connection', (socket: Socket) => {
  console.log(`A user connected: ${socket.id}`);

  // ルーム作成
  socket.on('createRoom', ({ username, userId }: { username: string, userId: string }) => {
    const roomId = generateRoomId();
    const master: Player = { id: socket.id, userId, name: username, isMaster: true, connected: true, acquiredCardCount: { firstDiscussion: 0, secondDiscussion: 0 } };

    const characterSelections: Record<string, string | null> = {};
    scenarioData.characters.forEach((char: any) => {
      if (char.type === 'PC') {
        characterSelections[char.id] = null;
      }
    });

    const newRoom: Room = {
      id: roomId,
      players: [master],
      masterUserId: userId,
      maxPlayers: maxPlayers,
      gamePhase: 'waiting',
      characterSelections: characterSelections,
      readingTimerEndTime: null,
      infoCards: JSON.parse(JSON.stringify(scenarioData.infoCards || [])),
      discussionTimer: { endTime: null, isTicking: false, phase: null, endState: 'none' },
      votes: {},
      voteResult: null,
      lastActivityTime: Date.now(),
    };
    rooms[roomId] = newRoom;
    socket.join(roomId);
    console.log(`Room created: ${roomId} by ${username} (userId: ${userId})`);
    // 接続した本人に、ルーム情報と自身の情報を返す
    socket.emit('roomCreated', { 
      roomId, 
      players: newRoom.players, 
      masterUserId: newRoom.masterUserId, 
      maxPlayers: newRoom.maxPlayers, 
      gamePhase: newRoom.gamePhase,
      characterSelections: newRoom.characterSelections,
      infoCards: newRoom.infoCards,
      yourPlayer: master, 
      discussionTimer: newRoom.discussionTimer,
      votes: newRoom.votes,
      voteResult: newRoom.voteResult,
    });
  });

  // ルーム参加
  socket.on('joinRoom', ({ username, userId, roomId }: { username: string, userId: string, roomId: string }) => {
    const upperRoomId = roomId.toUpperCase();
    const room = rooms[upperRoomId];
    if (!room) {
      socket.emit('roomNotFound');
      return;
    }
    updateRoomActivity(room);

    // 既存プレイヤーの再接続か？
    const existingPlayer = room.players.find(p => p.userId === userId);
    if (existingPlayer) {
      existingPlayer.id = socket.id; // Socket IDを更新
      existingPlayer.connected = true;
      console.log(`Player reconnected: ${username} (userId: ${userId}) in room: ${upperRoomId}`);
    } else {
      // 新規プレイヤーの参加
      if (room.players.length >= room.maxPlayers) {
        socket.emit('roomFull');
        return;
      }
      const newPlayer: Player = { id: socket.id, userId, name: username, isMaster: false, connected: true, acquiredCardCount: { firstDiscussion: 0, secondDiscussion: 0 } };
      room.players.push(newPlayer);
      console.log(`${username} (userId: ${userId}) joined room: ${upperRoomId}`);
    }

    socket.join(upperRoomId);

    // 接続した本人に、現在のルームの全情報を返す
    socket.emit('roomJoined', { 
      roomId: upperRoomId, 
      players: room.players, 
      masterUserId: room.masterUserId, 
      maxPlayers: room.maxPlayers, 
      gamePhase: room.gamePhase,
      characterSelections: room.characterSelections,
      readingTimerEndTime: room.readingTimerEndTime,
      infoCards: room.infoCards,
      yourPlayer: room.players.find(p => p.userId === userId),
      discussionTimer: room.discussionTimer,
      votes: room.votes,
      voteResult: room.voteResult,
    });

    // 他のプレイヤーにプレイヤーリストの更新を通知
    io.to(upperRoomId).emit('updatePlayers', { players: room.players });
  });

  // ゲーム開始 (ルームマスターのみ)
  socket.on('startGame', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (room && room.masterUserId === userId) {
      updateRoomActivity(room);
      room.gamePhase = 'schedule';
      console.log(`Game started in room: ${roomId}. Phase: ${room.gamePhase}`);
      io.to(roomId).emit('gamePhaseChanged', room.gamePhase);
    }
  });

  // キャラクター選択
  socket.on('selectCharacter', ({ roomId, userId, characterId }: { roomId: string, userId: string, characterId: string | null }) => {
    const room = rooms[roomId];
    if (!room) return;
    updateRoomActivity(room);

    const currentSelections = room.characterSelections;

    // --- 選択解除の場合 ---
    if (characterId === null) {
      for (const charId in currentSelections) {
        if (currentSelections[charId] === userId) {
          currentSelections[charId] = null;
          break; // 1ユーザー1キャラなので見つけたら抜ける
        }
      }
      io.to(roomId).emit('characterSelectionUpdated', currentSelections);
      console.log(`Room ${roomId}: Character selection cancelled by ${userId}`, currentSelections);
      return;
    }

    // --- 新規選択の場合 ---
    // 既に他の誰かが選択している場合は何もしない
    if (currentSelections[characterId] && currentSelections[characterId] !== userId) {
      console.log(`Character ${characterId} already selected by another user.`);
      return; 
    }

    // 自分が既に選択している他のキャラクターを解除
    for (const charId in currentSelections) {
      if (currentSelections[charId] === userId) {
        currentSelections[charId] = null;
      }
    }

    // 新しいキャラクターを選択
    currentSelections[characterId] = userId;

    io.to(roomId).emit('characterSelectionUpdated', currentSelections);
    console.log(`Room ${roomId}: Character selection updated by ${userId}`, currentSelections);
  });

  // キャラクター選択確定 (ルームマスターのみ)
  socket.on('confirmCharacters', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (room && room.masterUserId === userId) {
      updateRoomActivity(room);
      room.gamePhase = 'commonInfo';
      const endTime = Date.now() + READING_TIME_SECONDS * 1000;
      room.readingTimerEndTime = endTime;
      console.log(`Characters confirmed in room: ${roomId}. Phase: ${room.gamePhase}`);
      io.to(roomId).emit('charactersConfirmed', { 
        gamePhase: room.gamePhase,
        readingTimerEndTime: endTime 
      });
    }
  });

  // HOタイマー延長 (ルームマスターのみ)
  socket.on('extendReadingTimer', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (room && room.masterUserId === userId && room.readingTimerEndTime) {
      updateRoomActivity(room);
      const newEndTime = room.readingTimerEndTime + READING_TIME_SECONDS_EXTENSION * 1000;
      room.readingTimerEndTime = newEndTime;
      console.log(`Reading time extended in room: ${roomId}`);
      io.to(roomId).emit('readingTimeExtended', { endTime: newEndTime });
    }
  });

  // 第一議論へ進む (ルームマスターのみ)
  socket.on('proceedToFirstDiscussion', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (room && room.masterUserId === userId) {
      updateRoomActivity(room);
      room.gamePhase = 'firstDiscussion';
      // タイマー情報をリセット
      room.readingTimerEndTime = null; 
      console.log(`Proceeding to first discussion in room: ${roomId}. Phase: ${room.gamePhase}`);
      io.to(roomId).emit('gamePhaseChanged', room.gamePhase);
    }
  });

  // --- 議論タイマー関連 (ルームマスターのみ) ---
  socket.on('startDiscussionTimer', ({ roomId, userId, phase, durationSeconds }: { roomId: string, userId: string, phase: 'firstDiscussion' | 'secondDiscussion', durationSeconds: number }) => {
    const room = rooms[roomId];
    if (!room || room.masterUserId !== userId) return;
    updateRoomActivity(room);

    room.discussionTimer = {
      endTime: Date.now() + durationSeconds * 1000,
      isTicking: true,
      phase: phase,
      endState: 'none',
    };
    console.log(`Room ${roomId}: ${phase} timer started.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  socket.on('pauseDiscussionTimer', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (!room || room.masterUserId !== userId || !room.discussionTimer.endTime) return;
    updateRoomActivity(room);

    const remainingTime = room.discussionTimer.endTime - Date.now();
    room.discussionTimer.isTicking = false;
    // 残り時間を保持するためにendTimeを更新
    room.discussionTimer.endTime = remainingTime;

    console.log(`Room ${roomId}: Discussion timer paused.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  socket.on('resumeDiscussionTimer', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (!room || room.masterUserId !== userId || !room.discussionTimer.endTime) return;
    updateRoomActivity(room);

    // endTimeは一時停止時に残り時間(ms)に変換されているはず
    const newEndTime = Date.now() + room.discussionTimer.endTime;
    room.discussionTimer.isTicking = true;
    room.discussionTimer.endTime = newEndTime;

    console.log(`Room ${roomId}: Discussion timer resumed.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  // 議論強制終了を「要求」する (ルームマスターのみ)
  socket.on('requestEndDiscussion', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (!room || room.masterUserId !== userId) return;
    updateRoomActivity(room);

    room.discussionTimer.endState = 'requested';
    console.log(`Room ${roomId}: Master requested to end discussion.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  // 議論強制終了を「キャンセル」する (ルームマスターのみ)
  socket.on('cancelEndDiscussion', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (!room || room.masterUserId !== userId) return;
    updateRoomActivity(room);

    room.discussionTimer.endState = 'none';
    console.log(`Room ${roomId}: Master canceled to end discussion.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  // 議論を実際に終了させる (ルームマスターの確認後)
  socket.on('confirmEndDiscussion', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (!room || room.masterUserId !== userId) return;
    updateRoomActivity(room);

    if (room.discussionTimer.phase === 'firstDiscussion') {
      room.gamePhase = 'interlude';
    } else if (room.discussionTimer.phase === 'secondDiscussion') {
      room.gamePhase = 'voting';
    }
    // タイマーリセット
    room.discussionTimer = { endTime: null, isTicking: false, phase: null, endState: 'none' }; 

    console.log(`Room ${roomId}: Discussion ended by master. New phase: ${room.gamePhase}`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
    io.to(roomId).emit('gamePhaseChanged', room.gamePhase);
  });


  // --- 情報カード関連 ---
  socket.on('getCard', ({ roomId, userId, cardId }: { roomId: string, userId: string, cardId: string }) => {
    const room = rooms[roomId];
    if (!room || (room.gamePhase !== 'firstDiscussion' && room.gamePhase !== 'secondDiscussion')) return;
    updateRoomActivity(room);

    const player = room.players.find(p => p.userId === userId);
    const card = room.infoCards.find(c => c.id === cardId);
    if (!player || !card || card.owner) return;

    const phaseKey = room.gamePhase;
    const phaseSettings = scenarioData.discussionPhaseSettings[phaseKey];
    const maxCards = phaseSettings?.maxCardsPerPlayer || 99;
    const currentCount = player.acquiredCardCount[phaseKey];

    if (currentCount >= maxCards) {
      socket.emit('getCardError', { message: `これ以上カードを取得できません。(${phaseKey === 'firstDiscussion' ? '第一議論' : '第二議論'}の上限: ${maxCards}枚)` });
      return;
    }

    card.owner = userId;
    player.acquiredCardCount[phaseKey]++; // カウントを増やす

    console.log(`Room ${roomId}: Card "${card.name}" taken by user ${userId}. Count for ${phaseKey}: ${player.acquiredCardCount[phaseKey]}`);
    io.to(roomId).emit('infoCardsUpdated', room.infoCards);
    // プレイヤー情報も更新されたので通知
    io.to(roomId).emit('updatePlayers', { players: room.players });
  });

  socket.on('makeCardPublic', ({ roomId, userId, cardId }: { roomId: string, userId: string, cardId: string }) => {
    const room = rooms[roomId];
    if (!room) return;
    const card = room.infoCards.find(c => c.id === cardId);
    if (!card || card.owner !== userId) return;
    updateRoomActivity(room);
    card.isPublic = true;
    console.log(`Room ${roomId}: Card "${card.name}" made public by user ${userId}`);
    io.to(roomId).emit('infoCardsUpdated', room.infoCards);
    io.to(roomId).emit('updatePlayers', { players: room.players });
  });

  socket.on('transferCard', ({ roomId, userId, cardId, targetUserId }: { roomId: string, userId: string, cardId: string, targetUserId: string }) => {
    const room = rooms[roomId];
    if (!room) return;
    const card = room.infoCards.find(c => c.id === cardId);
    if (!card || card.owner !== userId) return;
    const targetPlayer = room.players.find(p => p.userId === targetUserId);
    if (!targetPlayer) return;
    updateRoomActivity(room);
    card.owner = targetUserId;
    console.log(`Room ${roomId}: Card "${card.name}" transferred from ${userId} to ${targetUserId}`);
    io.to(roomId).emit('infoCardsUpdated', room.infoCards);
    io.to(roomId).emit('updatePlayers', { players: room.players });
  });

  // --- 投票関連 ---
  socket.on('submitVote', ({ roomId, userId, votedCharacterId }: { roomId: string, userId: string, votedCharacterId: string }) => {
    const room = rooms[roomId];
    if (!room || room.gamePhase !== 'voting') return;
    updateRoomActivity(room);

    room.votes[userId] = votedCharacterId;
    console.log(`Room ${roomId}: User ${userId} voted for ${votedCharacterId}`);
    io.to(roomId).emit('voteStateUpdated', room.votes);

    // 全員投票したかチェック
    const pcPlayers = room.players.filter(p => {
      const charId = Object.keys(room.characterSelections).find(key => room.characterSelections[key] === p.userId);
      return charId && scenarioData.characters.find((c:any) => c.id === charId)?.type === 'PC';
    });

    if (Object.keys(room.votes).length === pcPlayers.length) {
      console.log(`Room ${roomId}: All players have voted.`);
      calculateVoteResult(room);
    }
  });

  

  

  // ルーム退室
  socket.on('leaveRoom', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (room) {
      const playerIndex = room.players.findIndex(p => p.userId === userId);
      if (playerIndex > -1) {
        const player = room.players[playerIndex];
        socket.leave(roomId);
        // プレイヤーリストから削除
        room.players.splice(playerIndex, 1);
        // キャラクター選択を解除
        for (const charId in room.characterSelections) {
          if (room.characterSelections[charId] === userId) {
            room.characterSelections[charId] = null;
          }
        }
        console.log(`Player ${player.name} (userId: ${userId}) left room: ${roomId}`);
        io.to(roomId).emit('updatePlayers', { players: room.players, characterSelections: room.characterSelections });
      } else {
        // 既に切断などでプレイヤーリストにいない場合
        socket.leave(roomId);
      }
    }
  });

  // ルーム解散 (ルームマスターのみ)
  socket.on('closeRoom', ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = rooms[roomId];
    if (room && room.masterUserId === userId) {
      console.log(`Room closed by master: ${roomId}`);
      io.to(roomId).emit('roomClosed');
      // TODO: 将来的にはルーム情報をアーカイブするなど、即時削除しない方が良いかもしれない
      delete rooms[roomId];
    }
  });

  // 接続切断
  socket.on('disconnect', () => {
    console.log(`A user disconnected: ${socket.id}`);
    let roomToUpdate: Room | undefined;

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const player = room.players.find(p => p.id === socket.id);

      if (player) {
        player.connected = false;
        console.log(`Player ${player.name} (userId: ${player.userId}) disconnected from room: ${roomId}`);
        roomToUpdate = room;

        // プレイヤーが全員切断状態かチェック
        const allDisconnected = room.players.every(p => !p.connected);
        if (allDisconnected) {
          console.log(`All players disconnected in room ${roomId}. Deleting room.`);
          delete rooms[roomId];
          roomToUpdate = undefined; // 更新は不要
          break;
        }

        // ルームマスターが切断しても、マスター情報は変更しない
        // if (player.isMaster) {
        //   const newMaster = room.players.find(p => p.connected && !p.isMaster);
        //   if (newMaster) {
        //     newMaster.isMaster = true;
        //     room.masterUserId = newMaster.userId;
        //     console.log(`Master disconnected. New master is ${newMaster.name} in room ${roomId}`);
        //   } else {
        //     // 接続中のプレイヤーが他にいない場合、ルームを削除
        //     console.log(`Master disconnected and no other players available. Deleting room ${roomId}`);
        //     delete rooms[roomId];
        //     roomToUpdate = undefined; // 更新は不要
        //     break;
        //   }
        // }
        break; // 一人のユーザーは一つのルームにしかいないはず
      }
    }

    if (roomToUpdate) {
      // プレイヤーの状態（接続状態、マスター情報）が変更されたことを通知
      io.to(roomToUpdate.id).emit('updatePlayers', { 
        players: roomToUpdate.players,
        masterUserId: roomToUpdate.masterUserId
      });
    }
  });

  
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- サーバーサイドタイマー監視 ---
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    // タイマーが動作中かつ、終了時刻を過ぎており、まだタイムアップ処理がされていない場合
    if (room.discussionTimer.isTicking && room.discussionTimer.endTime && now >= room.discussionTimer.endTime && room.discussionTimer.endState !== 'timeup') {
      console.log(`Room ${roomId}: Discussion time is up.`);
      room.discussionTimer.isTicking = false;
      room.discussionTimer.endState = 'timeup';
      io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
    }
  }
}, 1000); // 1秒ごとにチェック


// --- 定期的なルームクリーンアップ処理 ---
const ROOM_CLEANUP_INTERVAL = 1000 * 60 * 60; // 1時間ごと
const ROOM_INACTIVITY_TIMEOUT = 1000 * 60 * 60 * 6; // 6時間

setInterval(() => {
  const now = Date.now();
  console.log('Running room cleanup job...');
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (now - room.lastActivityTime > ROOM_INACTIVITY_TIMEOUT) {
      console.log(`Room ${roomId} is inactive for too long. Deleting.`);
      io.to(roomId).emit('roomClosed'); // 接続中のユーザーがいれば通知
      delete rooms[roomId];
    }
  }
}, ROOM_CLEANUP_INTERVAL);