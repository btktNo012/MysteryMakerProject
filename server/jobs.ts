import { Server } from 'socket.io';
import { log } from './logger';
import { getRoomFromDB, saveRoomToDB, deleteRoomFromDB, listDiscussionRoomIds, pool } from './db';
import { ROOM_CLEANUP_INTERVAL, ROOM_INACTIVITY_TIMEOUT_MS } from './config';

// ルームごとの単発タイマー管理
const discussionTimeouts = new Map<string, NodeJS.Timeout>();

// タイムアップイベント
const fireTimeup = async (io: Server, roomId: string) => {
  const room = await getRoomFromDB(roomId);
  if (!room) return;
  const now = Date.now();
  if (
    room.discussionTimer.isTicking &&
    room.discussionTimer.endTime !== null &&
    now >= room.discussionTimer.endTime &&
    room.discussionTimer.endState !== 'timeup'
  ) {
    log(`Room ${roomId}: Discussion time is up.`);
    room.discussionTimer.isTicking = false;
    room.discussionTimer.endState = 'timeup';
    await saveRoomToDB(room);
    io.to(roomId).emit('discussionTimerUpdated', room.discussionTimer);
  }
};

export const cancelDiscussionTimer = (roomId: string) => {
  const t = discussionTimeouts.get(roomId);
  if (t) {
    clearTimeout(t);
    discussionTimeouts.delete(roomId);
  }
};

export const scheduleDiscussionTimer = async (io: Server, roomId: string) => {
  // 既存タイマーがあればクリア
  cancelDiscussionTimer(roomId);

  const room = await getRoomFromDB(roomId);
  if (!room) return;
  if (!room.discussionTimer.isTicking || room.discussionTimer.endTime === null) return;

  const delay = room.discussionTimer.endTime - Date.now();
  if (delay <= 0) {
    // 期限が過ぎている場合は即時処理
    await fireTimeup(io, roomId);
    return;
  }

  const timeout = setTimeout(() => {
    void fireTimeup(io, roomId);
    discussionTimeouts.delete(roomId);
  }, delay);
  discussionTimeouts.set(roomId, timeout);
  log(`Room ${roomId}: Discussion timer scheduled in ${Math.ceil(delay / 1000)}s`);
};

export const rescheduleAllDiscussionTimers = async (io: Server) => {
  try {
    const roomIds = await listDiscussionRoomIds();
    for (const id of roomIds) {
      await scheduleDiscussionTimer(io, id);
    }
    log(`Rescheduled discussion timers for ${roomIds.length} room(s).`);
  } catch (err) {
    log('Error during rescheduleAllDiscussionTimers:', err);
  }
};

export const startJobs = (io: Server) => {
  // 起動時に進行中タイマーを再スケジュール
  void rescheduleAllDiscussionTimers(io);

  // ルームクリーンアップ
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
        cancelDiscussionTimer(roomId);
        await deleteRoomFromDB(roomId);
      }
    } catch (err) {
      log('Error in room cleanup job:', err);
    } finally {
      client.release();
    }
  }, ROOM_CLEANUP_INTERVAL);
};
