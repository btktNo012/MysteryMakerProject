import { Server, Socket } from 'socket.io';
import { allowedOrigins } from './config';
import { log } from './logger';
import { scenarioData, skillInfoData, maxPlayers } from './data';
import { deleteRoomFromDB, getRoomFromDB, saveRoomToDB } from './db';
import { GamePhase, Player, Room } from './types';
import { READING_TIME_SECONDS_EXTENSION} from './config';
import { scheduleDiscussionTimer, cancelDiscussionTimer } from './jobs';

export const registerSocketHandlers = (io: Server) => {
  const addLogToRoom = (room: Room, type: string, message: string) => {
    room.gameLog.push({ type, message });
    io.to(room.id).emit('gameLogUpdated', room.gameLog);
  };

  const generateRoomId = (): string => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // 投票結果を集計
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

  io.on('connection', (socket: Socket) => {
    log(`A user connected: ${socket.id}`);

    // ルーム作成を受信
    socket.on('createRoom', async ({ username, userId }: { username: string, userId: string }) => {
      // リクエストのルームIDを格納
      const roomId = generateRoomId();
      // プレイヤー情報（ルームマスター）設定
      const master: Player = { id: socket.id, userId, name: username, isMaster: true, isSpectator: false, connected: true, acquiredCardCount: { firstDiscussion: 0, secondDiscussion: 0 }, skills: [], isStandBy: false };

      // キャラクター選択情報（初期状態）作成
      const characterSelections: Record<string, string | null> = {};
      // シナリオデータからプレイヤーキャラクター情報をセット
      scenarioData.characters.forEach((char: any) => {
        if (char.type === 'PC') {
          characterSelections[char.id] = null;
        }
      });

      // ルーム情報を作成
      const newRoom: Room = {
        id: roomId,
        players: [master],
        masterUserId: userId,
        maxPlayers: maxPlayers,
        gamePhase: 'waiting',
        characterSelections: characterSelections,
        readingTimerEndTime: null,
        infoCards: JSON.parse(JSON.stringify(scenarioData.infoCards || [])),
        discussionTimer: { endTime: null, remainingMs: null, isTicking: false, phase: null, endState: 'none' },
        votes: {},
        voteResult: null,
        gameLog: [],
      };

      // ルーム情報を登録
      await saveRoomToDB(newRoom);
      // 接続ユーザをルームに登録
      socket.join(roomId);
      (socket as any).data.roomId = roomId;
      log(`Room created: ${roomId} by ${username} (userId: ${userId})`);

      // ルーム作成成功をユーザに送信
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
        if (typeof isSpectator === 'boolean') {
          existingPlayer.isSpectator = isSpectator;
        }
        log(`Player reconnected: ${username} (userId: ${userId}) in room: ${upperRoomId}`);
      } else {
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
      (socket as any).data.roomId = upperRoomId;

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

    // キャラクター確定
    socket.on('confirmCharacters', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      // ルーム情報を取得
      const room = await getRoomFromDB(roomId);
      // ルームが存在する、かつ操作したのがルームマスター
      if (room && room.masterUserId === userId) {
        // ゲームフェーズを共通情報に変更
        room.gamePhase = 'commonInfo';
        // HO読み込み終了時間を計算（現在時間 + シナリオデータの読み込み時間 * 1000）
        const endTime = Date.now() + scenarioData.handOutSettings.timeLimit * 1000;
        // HO読み込み時間を設定
        room.readingTimerEndTime = endTime;

        // ルーム情報にプレイヤー情報を読み込む
        room.players = room.players.map(player => {
          // キャラクターIDを取得
          const characterId = Object.keys(room.characterSelections).find(
            key => room.characterSelections[key] === player.userId
          );
          // キャラクターが存在する
          if (characterId) {
            // キャラデータをシナリオデータから取得
            const characterData = scenarioData.characters.find((c: any) => c.id === characterId);
            // キャラクターにスキルがある場合
            if (characterData && characterData.skills) {
              // スキル情報を取得
              const newSkills = characterData.skills.map((skill: any) => ({
                ...skill,
                used: false,
              }));
              // ルーム情報にプレイヤー情報をセット（スキルあり）
              return { ...player, skills: newSkills };
            }
          }
          // ルーム情報にプレイヤー情報をセット（スキルなし）
          return { ...player, skills: [] };
        });

        // ルーム情報を更新
        await saveRoomToDB(room);
        log(`Characters confirmed in room: ${roomId}. Phase: ${room.gamePhase}`);
        // キャラクター確定をユーザに送信
        io.to(roomId).emit('charactersConfirmed', {
          gamePhase: room.gamePhase,
          readingTimerEndTime: endTime
        });
        //　キャラクター情報の更新をユーザに送信
        io.to(roomId).emit('updatePlayers', { players: room.players });
      }
    });

    // HO読み込み時間を延長
    socket.on('extendReadingTimer', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      // ルーム情報を取得
      const room = await getRoomFromDB(roomId);
      // ルームが存在する、かつ操作したのがルームマスター、かつルームのHO読み込み時間が切れている場合
      if (room && room.masterUserId === userId && room.readingTimerEndTime) {
        // 延長後のHO読み込み時間を算出（現在時間 + 延長時間 * 1000）
        const newEndTime = Date.now() + READING_TIME_SECONDS_EXTENSION * 1000;
        // ルーム情報を更新
        room.readingTimerEndTime = newEndTime;
        await saveRoomToDB(room);
        log(`Reading time extended in room: ${roomId}`);
        // タイマーの延長をユーザに送信
        io.to(roomId).emit('readingTimeExtended', { endTime: newEndTime });
      }
    });

    socket.on('proceedToFirstDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      const room = await getRoomFromDB(roomId);
      if (room && room.masterUserId === userId) {
        room.gamePhase = 'firstDiscussion';
        room.readingTimerEndTime = null;
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
        remainingMs: null,
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
      await scheduleDiscussionTimer(io, roomId);
    });

    socket.on('pauseDiscussionTimer', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      const room = await getRoomFromDB(roomId);
      if (!room || !room.discussionTimer.endTime || !room.discussionTimer.isTicking) return;

      const remainingTime = Math.max(0, room.discussionTimer.endTime - Date.now());
      room.discussionTimer.isTicking = false;
      room.discussionTimer.remainingMs = remainingTime;
      room.discussionTimer.endTime = null;

      await saveRoomToDB(room);
      log(`Room ${roomId}: Discussion timer paused by ${userId}.`);
      io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
      cancelDiscussionTimer(roomId);
    });

    socket.on('resumeDiscussionTimer', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      // ルーム情報を取得
      const room = await getRoomFromDB(roomId);
      // ルーム情報がない場合、または残り時間が設定されていない場合、何もしない
      if (!room) return;
      if (room.discussionTimer.remainingMs == null) return;

      // タイマー終了時間を再設定し、タイマーを作動状態に更新
      const newEndTime = Date.now() + room.discussionTimer.remainingMs;
      room.discussionTimer.isTicking = true;
      room.discussionTimer.endTime = newEndTime;
      room.discussionTimer.remainingMs = null;

      // ルーム情報を更新
      await saveRoomToDB(room);
      log(`Room ${roomId}: Discussion timer resumed by ${userId}.`);
      // ルーム情報の更新をユーザに送信
      io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
      await scheduleDiscussionTimer(io, roomId);
    });

    socket.on('requestEndDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      const room = await getRoomFromDB(roomId);
      if (!room || room.masterUserId !== userId) return;

      room.discussionTimer.endState = 'requested';
      await saveRoomToDB(room);
      log(`Room ${roomId}: Master requested to end discussion.`);
      io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
    });

    // 議論強制終了の中止
    socket.on('cancelEndDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      const room = await getRoomFromDB(roomId);
      if (!room || room.masterUserId !== userId) return;

      room.discussionTimer.endState = 'none';
      await saveRoomToDB(room);
      log(`Room ${roomId}: Master canceled to end discussion.`);
      io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
    });

    // 議論フェーズ終了確定
    socket.on('confirmEndDiscussion', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      const room = await getRoomFromDB(roomId);
      if (!room || room.masterUserId !== userId) return;

      if (room.discussionTimer.phase === 'firstDiscussion') {
        room.gamePhase = 'interlude';
        room.players = room.players.map(p => ({ ...p, isStandBy: false }));
      } else if (room.discussionTimer.phase === 'secondDiscussion') {
        room.gamePhase = 'voting';
      }
      room.discussionTimer = { endTime: null, remainingMs: null, isTicking: false, phase: null, endState: 'none' };

      await saveRoomToDB(room);
      log(`Room ${roomId}: Discussion ended by master. New phase: ${room.gamePhase}`);
      io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
      io.to(roomId).emit('gamePhaseChanged', room.gamePhase);
      if (room.gamePhase === 'interlude') {
        io.to(roomId).emit('updatePlayers', { players: room.players });
      }
      cancelDiscussionTimer(roomId);
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
      } else if (skillId === 'skill_02') {
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

    // 情報カード取得
    socket.on('getCard', async ({ roomId, userId, cardId }: { roomId: string, userId: string, cardId: string }) => {
      const room = await getRoomFromDB(roomId);
      if (!room || (room.gamePhase !== 'firstDiscussion' && room.gamePhase !== 'secondDiscussion')) return;

      const player = room.players.find(p => p.userId === userId);
      const card = room.infoCards.find(c => c.id === cardId);
      if (!player || !card || card.owner) return;

      const phaseKey = room.gamePhase;
      const phaseSettings = (scenarioData as any).discussionPhaseSettings[phaseKey];
      const maxCards = phaseSettings?.maxCardsPerPlayer || 99;
      const currentCount = player.acquiredCardCount[phaseKey as 'firstDiscussion' | 'secondDiscussion'];

      if (currentCount >= maxCards) {
        socket.emit('getCardError', { message: `これ以上カードを取得できません。(${phaseKey === 'firstDiscussion' ? '第一議論' : '第二議論'}の上限: ${maxCards}枚)` });
        return;
      }

      card.owner = userId;
      if (!card.firstOwner) {
        card.firstOwner = userId;
      }
      player.acquiredCardCount[phaseKey as 'firstDiscussion' | 'secondDiscussion']++;

      const character = (scenarioData as any).characters.find((c: any) => room.characterSelections[c.id] === userId);
      const characterName = character ? character.name : '不明なキャラクター';
      addLogToRoom(room, 'card-get', `${characterName}が「${card.name}」を取得しました。`);

      await saveRoomToDB(room);
      log(`Room ${roomId}: Card "${card.name}" taken by user ${userId}. Count for ${phaseKey}: ${player.acquiredCardCount[phaseKey as 'firstDiscussion' | 'secondDiscussion']}`);
      io.to(roomId).emit('infoCardsUpdated', room.infoCards);
      io.to(roomId).emit('updatePlayers', { players: room.players });
    });

    // 情報カード全体公開
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

    // 情報カード譲渡
    socket.on('transferCard', async ({ roomId, userId, cardId, targetUserId }: { roomId: string, userId: string, cardId: string, targetUserId: string }) => {
      const room = await getRoomFromDB(roomId);
      if (!room) return;
      const card = room.infoCards.find(c => c.id === cardId);
      if (!card || card.owner !== userId) return;
      const targetPlayer = room.players.find(p => p.userId === targetUserId);
      if (!targetPlayer) return;

      const originalOwnerCharacter = (scenarioData as any).characters.find((c: any) => room.characterSelections[c.id] === userId);
      const originalOwnerCharacterName = originalOwnerCharacter ? originalOwnerCharacter.name : '不明なキャラクター';
      const targetCharacter = (scenarioData as any).characters.find((c: any) => room.characterSelections[c.id] === targetUserId);
      const targetCharacterName = targetCharacter ? targetCharacter.name : '不明なキャラクター';

      card.owner = targetUserId;
      addLogToRoom(room, 'card-transfer', `「${card.name}」が${originalOwnerCharacterName}から${targetCharacterName}に譲渡されました。`);

      await saveRoomToDB(room);
      log(`Room ${roomId}: Card "${card.name}" transferred from ${userId} to ${targetUserId}`);
      io.to(roomId).emit('infoCardsUpdated', room.infoCards);
      io.to(roomId).emit('updatePlayers', { players: room.players });
    });

    // 投票を受信
    socket.on('submitVote', async ({ roomId, userId, votedCharacterId }: { roomId: string, userId: string, votedCharacterId: string }) => {
      // ルーム情報を取得
      const room = await getRoomFromDB(roomId);
      // ルームが存在しない、または投票フェイズではない場合は何もしない
      if (!room || room.gamePhase !== 'voting') return;

      // プレイヤーの投票先情報を設定
      room.votes[userId] = votedCharacterId;
      log(`Room ${roomId}: User ${userId} voted for ${votedCharacterId}`);
      // 投票情報の更新をユーザに通知
      io.to(roomId).emit('voteStateUpdated', room.votes);

      // ルーム上のPCを全て取得
      const pcPlayers = room.players.filter(p => {
        const charId = Object.keys(room.characterSelections).find(key => room.characterSelections[key] === p.userId);
        return charId && (scenarioData.characters.find((c: any) => c.id === charId)?.type === 'PC');
      });

      // PCの数＝投票者の数である場合、投票結果を集計
      if (Object.keys(room.votes).length === pcPlayers.length) {
        log(`Room ${roomId}: All players have voted.`);
        calculateVoteResult(room);
      }
      // ルーム情報を更新
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

    // ルーム解散
    socket.on('closeRoom', async ({ roomId, userId }: { roomId: string, userId: string }) => {
      // ルーム情報を取得
      const room = await getRoomFromDB(roomId);
      // ルームが存在する＆送信したのがルームマスターの場合、解散
      if (room && room.masterUserId === userId) {
        log(`Room closed by master: ${roomId}`);
        // ルームの解散を送信
        io.to(roomId).emit('roomClosed');
        // DBからルーム情報を削除
        await deleteRoomFromDB(roomId);
      }
    });

    socket.on('disconnect', async () => {
      log(`A user disconnected: ${socket.id}`);
      const roomId = (socket as any).data.roomId;
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
};
