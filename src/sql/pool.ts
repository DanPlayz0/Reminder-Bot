import configuration from "@/configuration";
import { Pool } from "pg";
import * as timezones from "@/sql/timezones";
import * as reminders from "@/sql/reminders";
import * as dmChannels from "@/sql/dm-channels";

const pool = new Pool({ connectionString: configuration.postgres_url, keepAlive: true, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
export default pool;

pool.connect(() => {
  console.log('Connected to Postgres');
  timezones.createTable();
  reminders.createTable();
  dmChannels.createTable();
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});