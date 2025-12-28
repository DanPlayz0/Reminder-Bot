import pool from "./pool";

export async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel_id TEXT NULL,
      message TEXT NOT NULL,
      remind_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMPTZ NULL
    );
  `);
}

interface Reminder {
  id: number;
  user_id: string;
  channel_id: string | null;
  message: string;
  remind_at: Date;
  created_at: Date;
  sent_at: Date | null;
}

export async function findRemindersWithinNextMinute(): Promise<Reminder[]> {
  const result = await pool.query(`SELECT * FROM reminders WHERE sent_at IS NULL AND remind_at < NOW() + INTERVAL '1 minute'`);
  return result.rows as Reminder[];
}

export async function createReminder(reminder: Omit<Reminder, "id" | "created_at" | "channel_id" | "sent_at"> & { channel_id?: string | null }): Promise<Reminder> {
  const result = await pool.query(
    `INSERT INTO reminders (user_id, channel_id, message, remind_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [reminder.user_id, reminder.channel_id ?? null, reminder.message, reminder.remind_at]
  );
  return result.rows[0] as Reminder;
}

export async function markReminderAsSent(reminderId: number): Promise<void> {
  await pool.query(`UPDATE reminders SET sent_at = NOW() WHERE id = $1`, [reminderId]);
}

export async function getReminderById(id: number): Promise<Reminder | null> {
  const result = await pool.query(`SELECT * FROM reminders WHERE id = $1`, [id]);
  return result.rows[0] || null as Reminder | null;
}

export async function getUserReminders(userId: string, includeSent: boolean): Promise<Reminder[]> {
  const query = includeSent
    ? `SELECT * FROM reminders WHERE user_id = $1 ORDER BY remind_at ASC`
    : `SELECT * FROM reminders WHERE user_id = $1 AND sent_at IS NULL ORDER BY remind_at ASC`;
  const result = await pool.query(query, [userId]);
  return result.rows as Reminder[];
}

export async function getUserReminderById(user_id: string, reminder_id: number): Promise<Reminder | null> {
  const query = `SELECT * FROM reminders WHERE user_id = $1 AND id = $2`;
  const result = await pool.query(query, [user_id, reminder_id]);
  return result.rows[0] || null as Reminder | null;
}

export async function deleteUserReminderById(user_id: string, reminder_id: number): Promise<Reminder | null> {
  const query = `DELETE FROM reminders WHERE user_id = $1 AND id = $2 RETURNING *`;
  const result = await pool.query(query, [user_id, reminder_id]);
  return result.rows[0] || null as Reminder | null;
}
