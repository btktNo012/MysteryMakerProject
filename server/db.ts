import { Pool, PoolConfig } from 'pg';
import { log } from './logger';
import { Room } from './types';

let poolConfig: PoolConfig;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
  log('Connecting to Render PostgreSQL with SSL.');
} else {
  poolConfig = {
    user: 'm_master',
    host: 'localhost',
    database: 'mystery_maker',
    password: 'password',
    port: 5432,
  };
  log('Connecting to local PostgreSQL.');
}

export const pool = new Pool(poolConfig);

// ルーム情報テーブルが存在しない場合、新規作成
export const initializeDatabase = async () => {
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
    // 例外発生時
    log('Error initializing database:', err);
    process.exit(1);
  } finally {
    client.release();
  }
};
// ルームIDをキーにルーム情報を取得
export const getRoomFromDB = async (roomId: string): Promise<Room | null> => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT game_state FROM rooms WHERE room_id = $1', [roomId.toUpperCase()]);
    if (res.rows.length > 0) {
      // ルーム情報が存在する場合、1件目を返却
      return res.rows[0].game_state as Room;
    }
    // 存在しない場合はnullを返却
    return null;
  } catch (err) {
    // 例外発生時
    log(`Error getting room ${roomId} from DB:`, err);
    return null;
  } finally {
    client.release();
  }
};

// ルーム情報を保存
export const saveRoomToDB = async (room: Room) => {
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

// ルーム情報を削除
export const deleteRoomFromDB = async (roomId: string) => {
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

// 議論フェイズ中のルーム一覧を取得
export const listDiscussionRoomIds = async (): Promise<string[]> => {
  const client = await pool.connect();
  try {
    
    const query = `
      SELECT room_id
      FROM rooms
      WHERE
        (game_state->'discussionTimer'->>'isTicking')::boolean = true;
    `;
    const res = await client.query(query);
    return res.rows.map((r) => r.room_id);
  } catch (err) {
    log('Error listing room ids:', err);
    return [];
  } finally {
    client.release();
  }
};

