import pool from "./pool";

type EntityType = 'guild' | 'user';

export async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS timezones (
      entity_id TEXT NOT NULL,        -- guild ID or user ID
      type TEXT NOT NULL CHECK (type IN ('guild', 'user')), 
      timezone TEXT NOT NULL,         -- e.g., "America/New_York"
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_id, type)  -- ensures only one timezone per guild/user
    );
  `);
}

// Get timezone for an entity
export async function getTimezone(entityId: string, type: EntityType): Promise<string | null> {
  const result = await pool.query(
    `SELECT timezone FROM timezones WHERE entity_id = $1 AND type = $2`,
    [entityId, type]
  );
  return result.rows[0]?.timezone ?? null;
}

// Set or update timezone
export async function setTimezone(entityId: string, type: EntityType, timezone: string) {
  await pool.query(
    `
    INSERT INTO timezones(entity_id, type, timezone)
    VALUES($1, $2, $3)
    ON CONFLICT(entity_id, type)
    DO UPDATE SET timezone = EXCLUDED.timezone, updated_at = CURRENT_TIMESTAMP
    `,
    [entityId, type, timezone]
  );
}

// Delete timezone
export async function deleteTimezone(entityId: string, type: EntityType) {
  await pool.query(
    `DELETE FROM timezones WHERE entity_id = $1 AND type = $2`,
    [entityId, type]
  );
}