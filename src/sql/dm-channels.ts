import pool from "./pool";

export async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_channels (
      user_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT NULL
    );
  `);
}

interface DMChannel {
  user_id: string;
  channel_id: string;
}

export async function getDMChannel(userId: string) {
  const result = await pool.query(`SELECT * FROM dm_channels WHERE user_id = $1`, [userId]);
  return result.rows[0] as DMChannel | null;
}

export async function setDMChannel(userId: string, channelId: string) {
  await pool.query(
    `INSERT INTO dm_channels (user_id, channel_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET channel_id = EXCLUDED.channel_id`,
    [userId, channelId]
  );
}
