 import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { Pool, PoolConfig } from 'pg';

const app = express();
const server = http.createServer(app);

// --- ログ出力関数 ---
const log = (message: string, ...args: any[]) => {
  const now = new Date();
  const timestamp = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  console.log(`[${timestamp}] ${message}`, ...args);
};

// --- DB Setup ---
let poolConfig: PoolConfig;
if (process.env.DATABASE_URL) {
  // サービス環境用設定
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
  log('Connecting to Render PostgreSQL with SSL.');
}
else {
  // ローカル環境用設定
  poolConfig = {
    user: 'm_master',
    host: 'localhost',
    database: 'mystery_maker',
    password: 'password',
    port: 5432,
  };
  log('Connecting to local PostgreSQL.');
}

const pool = new Pool(poolConfig);

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id VARCHAR(6) PRIMARY KEY,
        game_state JSONB NOT NULL,
        master_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    log('Database initialized and "rooms" table is ready.');
  } catch (err) {
    log('Error initializing database:', err);
    process.exit(1);
  } finally {
    client.release();
  }
};
// --- End DB Setup ---

const allowedOrigins = [
  "http://localhost:5173"
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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
// --- スキルデータ読み込み ---
const skillInfoPath = path.join(__dirname, '../client/public/skill_info.json');
const skillInfoData = JSON.parse(fs.readFileSync(skillInfoPath, 'utf-8'));

// --- 型定義 ---
interface Skill {
  id: string | null;
  name: string;
  type: 'passive' | 'active';
  description: string;
  used: boolean;
}

interface Player {
  id: string;
  userId: string;
  name: string;
  isMaster: boolean;
  // 観戦者フラグ（trueなら観戦者として参加）
  isSpectator?: boolean;
  connected: boolean;
  acquiredCardCount: {
    firstDiscussion: number;
    secondDiscussion: number;
  };
  skills: Skill[];
  // 準備中
  isStandBy: boolean;
}

interface InfoCard {
  id: string;
  name: string;
  content: string;
  owner: string | null;
  firstOwner: string | null;
  isPublic: boolean;
}

type GamePhase =
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

interface GameLogEntry {
  type: string;
  message: string;
}

interface Room {
  id: string;
  players: Player[];
  masterUserId: string;
  maxPlayers: number;
  gamePhase: GamePhase;
  characterSelections: Record<string, string | null>;
  readingTimerEndTime: number | null;
  infoCards: InfoCard[];
  discussionTimer: {
    endTime: number | null;
    isTicking: boolean;
    phase: 'firstDiscussion' | 'secondDiscussion' | null;
    endState: 'none' | 'requested' | 'timeup';
  };
  votes: Record<string, string>;
  voteResult: {
    votedCharacterId: string;
    count: number;
  } | null;
  gameLog: GameLogEntry[];
}

// --- DBヘルパー関数 ---
const getRoomFromDB = async (roomId: string): Promise<Room | null> => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT game_state FROM rooms WHERE room_id = $1', [roomId.toUpperCase()]);
    if (res.rows.length > 0) {
      return res.rows[0].game_state as Room;
    }
    return null;
  } catch (err) {
    log(`Error getting room ${roomId} from DB:`, err);
    return null;
  } finally {
    client.release();
  }
};

const saveRoomToDB = async (room: Room) => {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO rooms (room_id, game_state, master_user_id, last_activity_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (room_id)
      DO UPDATE SET
        game_state = EXCLUDED.game_state,
        master_user_id = EXCLUDED.master_user_id,
        last_activity_at = NOW();
    `;
    await client.query(query, [room.id, room, room.masterUserId]);
  } catch (err) {
    log(`Error saving room ${room.id} to DB:`, err);
  } finally {
    client.release();
  }
};

const deleteRoomFromDB = async (roomId: string) => {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM rooms WHERE room_id = $1', [roomId.toUpperCase()]);
    log(`Room ${roomId} deleted from DB.`);
  } catch (err) {
    log(`Error deleting room ${roomId} from DB:`, err);
  } finally {
    client.release();
  }
};

// --- ヘルパー関数 ---
const addLogToRoom = (room: Room, type: string, message: string) => {
  room.gameLog.push({ type, message });
  io.to(room.id).emit('gameLogUpdated', room.gameLog);
};
const generateRoomId = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

  if (winners.length > 1) {
    io.to(room.id).emit('voteTied', { winners });
    room.votes = {};
    io.to(room.id).emit('voteStateUpdated', room.votes);
    return;
  }

  room.voteResult = { votedCharacterId: winners[0], count: maxVotes };
  log(`Room ${room.id}: Vote result is finalized.`);
  io.to(room.id).emit('voteResultFinalized', {
    result: room.voteResult,
    votes: room.votes
  });
};

// --- Socket.IO通信ロジック ---
io.on('connection', (socket: Socket) => {
  log(`A user connected: ${socket.id}`);

  socket.on('createRoom', async ({ username, userId }: { username: string, userId: string }) => {
    const roomId = generateRoomId();
    const master: Player = { id: socket.id, userId, name: username, isMaster: true, isSpectator: false, connected: true, acquiredCardCount: { firstDiscussion: 0, secondDiscussion: 0 }, skills: [], isStandBy: false };

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
      gameLog: [],
    };

    await saveRoomToDB(newRoom);
    socket.join(roomId);
    socket.data.roomId = roomId;
    log(`Room created: ${roomId} by ${username} (userId: ${userId})`);

    socket.emit('roomCreated', {
      ...newRoom,
      yourPlayer: master,
      roomId: newRoom.id,
    });
  });

  socket.on('joinRoom', async ({ username, userId, roomId, isSpectator }: { username: string, userId: string, roomId: string, isSpectator?: boolean }) => {
    const upperRoomId = roomId.toUpperCase();
    const room = await getRoomFromDB(upperRoomId);

    if (!room) {
      socket.emit('roomNotFound');
      return;
    }

    const existingPlayer = room.players.find(p => p.userId === userId);
    if (existingPlayer) {
      existingPlayer.id = socket.id;
      existingPlayer.connected = true;
      // 既存プレイヤーの観戦フラグは原則維持（明示指定がある場合のみ更新）
      if (typeof isSpectator === 'boolean') {
        existingPlayer.isSpectator = isSpectator;
      }
      log(`Player reconnected: ${username} (userId: ${userId}) in room: ${upperRoomId}`);
    } else {
      // 参加者数（観戦者を除く）が規定人数を超えている場合は参加を拒否
      const participantCount = room.players.filter(p => !p.isSpectator).length;
      const wantSpectator = !!isSpectator;
      if (!wantSpectator && participantCount >= room.maxPlayers) {
        socket.emit('roomFull');
        return;
      }
      const newPlayer: Player = { id: socket.id, userId, name: username, isMaster: false, isSpectator: wantSpectator, connected: true, acquiredCardCount: { firstDiscussion: 0, secondDiscussion: 0 }, skills: [], isStandBy: false };
      room.players.push(newPlayer);
      log(`${username} (userId: ${userId}) joined room: ${upperRoomId}`);
    }

    await saveRoomToDB(room);
    socket.join(upperRoomId);
    socket.data.roomId = upperRoomId;

    socket.emit('roomJoined', {
      ...room,
      yourPlayer: room.players.find(p => p.userId === userId),
      roomId: room.id,
    });

    io.to(upperRoomId).emit('updatePlayers', { players: room.players });
  });

  socket.on('startGame', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (room && room.masterUserId === userId) {
      room.gamePhase = 'introduction';
      await saveRoomToDB(room);
      log(`Game started in room: ${roomId}. Phase: ${room.gamePhase}`);
      io.to(roomId).emit('gamePhaseChanged', room.gamePhase);
    }
  });

  socket.on('selectCharacter', async ({ roomId, userId, characterId }: { roomId: string, userId: string, characterId: string | null }) => {
    const room = await getRoomFromDB(roomId);
    if (!room) return;

    const currentSelections = room.characterSelections;

    if (characterId === null) {
      for (const charId in currentSelections) {
        if (currentSelections[charId] === userId) {
          currentSelections[charId] = null;
          break;
        }
      }
    } else {
      if (currentSelections[characterId] && currentSelections[characterId] !== userId) {
        return;
      }
      for (const charId in currentSelections) {
        if (currentSelections[charId] === userId) {
          currentSelections[charId] = null;
        }
      }
      currentSelections[characterId] = userId;
    }

    await saveRoomToDB(room);
    io.to(roomId).emit('characterSelectionUpdated', currentSelections);
    log(`Room ${roomId}: Character selection updated by ${userId}`, currentSelections);
  });

  socket.on('confirmCharacters', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (room && room.masterUserId === userId) {
      room.gamePhase = 'commonInfo';
      const endTime = Date.now() + scenarioData.handOutSettings.timeLimit * 1000;
      room.readingTimerEndTime = endTime;

      room.players = room.players.map(player => {
        const characterId = Object.keys(room.characterSelections).find(
          key => room.characterSelections[key] === player.userId
        );
        if (characterId) {
          const characterData = scenarioData.characters.find((c: any) => c.id === characterId);
          if (characterData && characterData.skills) {
            const newSkills = characterData.skills.map((skill: any) => ({
              ...skill,
              used: false,
            }));
            return { ...player, skills: newSkills };
          }
        }
        return { ...player, skills: [] };
      });

      await saveRoomToDB(room);
      log(`Characters confirmed in room: ${roomId}. Phase: ${room.gamePhase}`);
      io.to(roomId).emit('charactersConfirmed', {
        gamePhase: room.gamePhase,
        readingTimerEndTime: endTime
      });
      io.to(roomId).emit('updatePlayers', { players: room.players });
    }
  });

  socket.on('extendReadingTimer', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (room && room.masterUserId === userId && room.readingTimerEndTime) {
      const newEndTime = room.readingTimerEndTime + READING_TIME_SECONDS_EXTENSION * 1000;
      room.readingTimerEndTime = newEndTime;
      await saveRoomToDB(room);
      log(`Reading time extended in room: ${roomId}`);
      io.to(roomId).emit('readingTimeExtended', { endTime: newEndTime });
    }
  });

  socket.on('proceedToFirstDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (room && room.masterUserId === userId) {
      room.gamePhase = 'firstDiscussion';
      room.readingTimerEndTime = null;
      // フェーズ移動時に全員の準備状態をリセット
      room.players = room.players.map(p => ({ ...p, isStandBy: false }));
      await saveRoomToDB(room);
      log(`Proceeding to first discussion in room: ${roomId}. Phase: ${room.gamePhase}`);
      io.to(roomId).emit('gamePhaseChanged', room.gamePhase);
      io.to(roomId).emit('updatePlayers', { players: room.players });
    }
  });

  socket.on('changeGamePhase', async ({ roomId, newPhase }: { roomId: string, newPhase: GamePhase }) => {
    const room = await getRoomFromDB(roomId);
    if (room) {
      room.gamePhase = newPhase;
      await saveRoomToDB(room);
      log(`Room ${roomId} phase changed to ${newPhase} by client request.`);
    }
  });

  socket.on('startDiscussionTimer', async ({ roomId, userId, phase, durationSeconds }: { roomId: string, userId: string, phase: 'firstDiscussion' | 'secondDiscussion', durationSeconds: number }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || room.masterUserId !== userId) return;

    room.discussionTimer = {
      endTime: Date.now() + durationSeconds * 1000,
      isTicking: true,
      phase: phase,
      endState: 'none',
    };
    const logMessage = phase === 'firstDiscussion'
      ? '第一議論フェイズが開始しました。'
      : '第二議論フェイズが開始しました。';
    addLogToRoom(room, 'phase-start', logMessage);

    await saveRoomToDB(room);
    log(`Room ${roomId}: ${phase} timer started.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  socket.on('pauseDiscussionTimer', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || !room.discussionTimer.endTime) return;

    const remainingTime = room.discussionTimer.endTime - Date.now();
    room.discussionTimer.isTicking = false;
    room.discussionTimer.endTime = remainingTime;

    await saveRoomToDB(room);
    log(`Room ${roomId}: Discussion timer paused by ${userId}.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  socket.on('resumeDiscussionTimer', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || !room.discussionTimer.endTime) return;

    const newEndTime = Date.now() + room.discussionTimer.endTime;
    room.discussionTimer.isTicking = true;
    room.discussionTimer.endTime = newEndTime;

    await saveRoomToDB(room);
    log(`Room ${roomId}: Discussion timer resumed by ${userId}.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  socket.on('requestEndDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || room.masterUserId !== userId) return;

    room.discussionTimer.endState = 'requested';
    await saveRoomToDB(room);
    log(`Room ${roomId}: Master requested to end discussion.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  socket.on('cancelEndDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || room.masterUserId !== userId) return;

    room.discussionTimer.endState = 'none';
    await saveRoomToDB(room);
    log(`Room ${roomId}: Master canceled to end discussion.`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  });

  socket.on('confirmEndDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || room.masterUserId !== userId) return;

    if (room.discussionTimer.phase === 'firstDiscussion') {
      room.gamePhase = 'interlude';
      // 中間情報画面に移動時に全員の準備状態をリセット
      room.players = room.players.map(p => ({ ...p, isStandBy: false }));
    } else if (room.discussionTimer.phase === 'secondDiscussion') {
      room.gamePhase = 'voting';
    }
    room.discussionTimer = { endTime: null, isTicking: false, phase: null, endState: 'none' };

    await saveRoomToDB(room);
    log(`Room ${roomId}: Discussion ended by master. New phase: ${room.gamePhase}`);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
    io.to(roomId).emit('gamePhaseChanged', room.gamePhase);
    if (room.gamePhase === 'interlude') {
      io.to(roomId).emit('updatePlayers', { players: room.players });
    }
  });

  // 準備中/準備完了設定
  socket.on('setStandBy', async ({ roomId, userId, value }: { roomId: string, userId: string, value: boolean }) => {
    const room = await getRoomFromDB(roomId);
    if (!room) return;
    const player = room.players.find(p => p.userId === userId);
    if (!player) return;
    player.isStandBy = value;
    await saveRoomToDB(room);
    io.to(room.id).emit('updatePlayers', { players: room.players, masterUserId: room.masterUserId });
  });

  socket.on('getCard', async ({ roomId, userId, cardId }: { roomId: string, userId: string, cardId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || (room.gamePhase !== 'firstDiscussion' && room.gamePhase !== 'secondDiscussion')) return;

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
    if (!card.firstOwner) {
      card.firstOwner = userId;
    }
    player.acquiredCardCount[phaseKey]++;

    const character = scenarioData.characters.find((c: any) => room.characterSelections[c.id] === userId);
    const characterName = character ? character.name : '不明なキャラクター';
    addLogToRoom(room, 'card-get', `${characterName}が「${card.name}」を取得しました。`);

    await saveRoomToDB(room);
    log(`Room ${roomId}: Card "${card.name}" taken by user ${userId}. Count for ${phaseKey}: ${player.acquiredCardCount[phaseKey]}`);
    io.to(roomId).emit('infoCardsUpdated', room.infoCards);
    io.to(roomId).emit('updatePlayers', { players: room.players });
  });

  socket.on('makeCardPublic', async ({ roomId, userId, cardId }: { roomId: string, userId: string, cardId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room) return;
    const card = room.infoCards.find(c => c.id === cardId);
    if (!card || card.owner !== userId) return;

    card.isPublic = true;
    addLogToRoom(room, 'card-public', `「${card.name}」が全体公開されました。`);

    await saveRoomToDB(room);
    log(`Room ${roomId}: Card "${card.name}" made public by user ${userId}`);
    io.to(roomId).emit('infoCardsUpdated', room.infoCards);
    io.to(roomId).emit('updatePlayers', { players: room.players });
  });

  socket.on('transferCard', async ({ roomId, userId, cardId, targetUserId }: { roomId: string, userId: string, cardId: string, targetUserId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room) return;
    const card = room.infoCards.find(c => c.id === cardId);
    if (!card || card.owner !== userId) return;
    const targetPlayer = room.players.find(p => p.userId === targetUserId);
    if (!targetPlayer) return;

    const originalOwnerCharacter = scenarioData.characters.find((c: any) => room.characterSelections[c.id] === userId);
    const originalOwnerCharacterName = originalOwnerCharacter ? originalOwnerCharacter.name : '不明なキャラクター';
    const targetCharacter = scenarioData.characters.find((c: any) => room.characterSelections[c.id] === targetUserId);
    const targetCharacterName = targetCharacter ? targetCharacter.name : '不明なキャラクター';

    card.owner = targetUserId;
    addLogToRoom(room, 'card-transfer', `「${card.name}」が${originalOwnerCharacterName}から${targetCharacterName}に譲渡されました。`);

    await saveRoomToDB(room);
    log(`Room ${roomId}: Card "${card.name}" transferred from ${userId} to ${targetUserId}`);
    io.to(roomId).emit('infoCardsUpdated', room.infoCards);
    io.to(roomId).emit('updatePlayers', { players: room.players });
  });

  socket.on('useActiveSkill', async ({ roomId, userId, skillId, payload }: { roomId: string, userId: string, skillId: string, payload: any }) => {
    const room = await getRoomFromDB(roomId);
    if (!room) return;

    const userPlayer = room.players.find(p => p.userId === userId);
    const userCharacter = scenarioData.characters.find((c: any) => room.characterSelections[c.id] === userId);
    if (!userPlayer || !userCharacter) return;

    const skillToUse = userPlayer.skills.find(s => s.id === skillId);
    if (!skillToUse || skillToUse.used) {
      return;
    }

    if (skillId === 'skill_01') {
      const { targetCardId } = payload;
      const targetCard = room.infoCards.find(c => c.id === targetCardId);
      if (!targetCard || !targetCard.owner || targetCard.owner === userId) {
        return;
      }
      const originalOwnerId = targetCard.owner;
      const originalOwnerCharacter = scenarioData.characters.find((c: any) => room.characterSelections[c.id] === originalOwnerId);
      if (!originalOwnerCharacter) return;
      targetCard.owner = userId;
      io.to(roomId).emit('infoCardsUpdated', room.infoCards);
      const activeSkillInfo = skillInfoData.find((s: any) => s.id === skillId);
      const skillName = activeSkillInfo ? activeSkillInfo.name : '不明なスキル';
      const roomLogMessage = `${userCharacter.name}のスキル「${skillName}」が発動。${targetCard.name}を${originalOwnerCharacter.name}から手に入れました。`;
      addLogToRoom(room, 'skill-use', roomLogMessage);
      log(`Room ${roomId}: Skill "${skillName}" used by ${userCharacter.name}.`);
    }
    else if (skillId === 'skill_02') {
      const { targetCardId } = payload;
      const targetCard = room.infoCards.find(c => c.id === targetCardId);
      if (!targetCard || !targetCard.owner || targetCard.owner === userId || targetCard.isPublic) {
        return;
      }
      targetCard.isPublic = true;
      io.to(roomId).emit('infoCardsUpdated', room.infoCards);
      const activeSkillInfo = skillInfoData.find((s: any) => s.id === skillId);
      const skillName = activeSkillInfo ? activeSkillInfo.name : '不明なスキル';
      const roomLogMessage = `${userCharacter.name}のスキル「${skillName}」が発動。${targetCard.name}が全体公開されました`;
      addLogToRoom(room, 'skill-use', roomLogMessage);
      log(`Room ${roomId}: Skill "${skillName}" used by ${userCharacter.name}.`);
    }

    room.players = room.players.map(p => {
      if (p.userId !== userId) return p;
      const newSkills = p.skills.map(s => {
        if (s.id !== skillId) return s;
        return { ...s, used: true };
      });
      return { ...p, skills: newSkills };
    });

    await saveRoomToDB(room);
    io.to(roomId).emit('updatePlayers', { players: room.players });
  });

  socket.on('submitVote', async ({ roomId, userId, votedCharacterId }: { roomId: string, userId: string, votedCharacterId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (!room || room.gamePhase !== 'voting') return;

    room.votes[userId] = votedCharacterId;
    log(`Room ${roomId}: User ${userId} voted for ${votedCharacterId}`);
    io.to(roomId).emit('voteStateUpdated', room.votes);

    const pcPlayers = room.players.filter(p => {
      const charId = Object.keys(room.characterSelections).find(key => room.characterSelections[key] === p.userId);
      return charId && scenarioData.characters.find((c: any) => c.id === charId)?.type === 'PC';
    });

    if (Object.keys(room.votes).length === pcPlayers.length) {
      log(`Room ${roomId}: All players have voted.`);
      calculateVoteResult(room);
    }
    await saveRoomToDB(room);
  });

  socket.on('leaveRoom', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (room) {
      const playerIndex = room.players.findIndex(p => p.userId === userId);
      if (playerIndex > -1) {
        const player = room.players[playerIndex];
        socket.leave(roomId);
        room.players.splice(playerIndex, 1);
        for (const charId in room.characterSelections) {
          if (room.characterSelections[charId] === userId) {
            room.characterSelections[charId] = null;
          }
        }
        await saveRoomToDB(room);
        log(`Player ${player.name} (userId: ${userId}) left room: ${roomId}`);
        io.to(roomId).emit('updatePlayers', { players: room.players, characterSelections: room.characterSelections });
      } else {
        socket.leave(roomId);
      }
    }
  });

  socket.on('closeRoom', async ({ roomId, userId }: { roomId: string, userId: string }) => {
    const room = await getRoomFromDB(roomId);
    if (room && room.masterUserId === userId) {
      log(`Room closed by master: ${roomId}`);
      io.to(roomId).emit('roomClosed');
      await deleteRoomFromDB(roomId);
    }
  });

  socket.on('disconnect', async () => {
    log(`A user disconnected: ${socket.id}`);
    const roomId = socket.data.roomId;
    if (!roomId) {
      return;
    }

    const room = await getRoomFromDB(roomId);
    if (!room) {
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.connected = false;
      log(`Player ${player.name} (userId: ${player.userId}) disconnected from room: ${roomId}`);

      const allDisconnected = room.players.every(p => !p.connected);
      if (allDisconnected) {
        log(`All players disconnected in room ${roomId}. Scheduling deletion.`);
        setTimeout(async () => {
          const currentRoom = await getRoomFromDB(roomId);
          if (currentRoom && currentRoom.players.every(p => !p.connected)) {
            log(`Deleting room ${roomId} due to all players being disconnected.`);
            await deleteRoomFromDB(roomId);
          }
        }, 10000);
      } else {
        await saveRoomToDB(room);
        io.to(room.id).emit('updatePlayers', {
          players: room.players,
          masterUserId: room.masterUserId
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
  initializeDatabase();
});

// --- サーバーサイドタイマー監視 ---
setInterval(async () => {
  const client = await pool.connect();
  try {
    // ルームID
    // TODO: ルーム情報に「稼働中かどうか」を付けて絞り込みするべき
    const res = await client.query('SELECT room_id FROM rooms');
    const roomIds = res.rows.map(r => r.room_id);
    // 現在日時
    const now = Date.now();

    // ルームの数ループ
    for (const roomId of roomIds) {
      // ルーム情報取得
      const room = await getRoomFromDB(roomId);
      if (!room) continue;

      // ルームのタイマーが作動中、タイマー終了時間設定済、現在日時>=終了日時、タイムアップ判定前の場合
      if (room.discussionTimer.isTicking && room.discussionTimer.endTime && now >= room.discussionTimer.endTime && room.discussionTimer.endState !== 'timeup') {
        log(`Room ${roomId}: Discussion time is up.`);
        // タイマーを停止
        room.discussionTimer.isTicking = false;
        // 状態をタイムアップに変更
        room.discussionTimer.endState = 'timeup';
        // ルーム状態を保存
        await saveRoomToDB(room);
        // タイムアップを通知
        io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
      }
    }
  } catch (err) {
    log('Error in discussion timer check interval:', err);
  } finally {
    client.release();
  }
}, 1000);

// --- 定期的なルームクリーンアップ処理 ---
const ROOM_CLEANUP_INTERVAL = 1000 * 60 * 60 * 1; // 1時間ごと
const ROOM_INACTIVITY_TIMEOUT_MS = 1000 * 60 * 60 * 6; // 6時間

setInterval(async () => {
  const client = await pool.connect();
  try {
    log('Running room cleanup job...');
    const timeout = new Date(Date.now() - ROOM_INACTIVITY_TIMEOUT_MS);
    const res = await client.query('SELECT room_id FROM rooms WHERE last_activity_at < $1', [timeout]);

    for (const row of res.rows) {
      const roomId = row.room_id;
      log(`Room ${roomId} is inactive for too long. Deleting.`);
      io.to(roomId).emit('roomClosed');
      await deleteRoomFromDB(roomId);
    }
  } catch (err) {
    log('Error in room cleanup job:', err);
  } finally {
    client.release();
  }
}, ROOM_CLEANUP_INTERVAL);
