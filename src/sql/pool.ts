import configuration from "@/configuration";
import { Pool } from "pg";
import * as timezones from "@/sql/timezones";
import * as reminders from "@/sql/reminders";
import * as dmChannels from "@/sql/dm-channels";
import { logError } from "@/utils/logger";

const pool = new Pool({ connectionString: configuration.postgres_url, keepAlive: true, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
export default pool;

let postgresReady = false;

export function isPostgresReady() {
  return postgresReady;
}

export const postgresReadyPromise = (async () => {
  await pool.query("SELECT 1");
  console.log("Connected to Postgres");
  await timezones.createTable();
  await reminders.createTable();
  await dmChannels.createTable();
  postgresReady = true;
})().catch((error) => {
  postgresReady = false;
  logError("Failed to initialize Postgres", error);
});

pool.on('error', (err) => {
  postgresReady = false;
  logError('Unexpected error on idle Postgres client', err);
});
