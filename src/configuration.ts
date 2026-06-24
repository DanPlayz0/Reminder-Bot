import 'dotenv/config';

const configuration = {
  token: process.env.DISCORD_TOKEN,
  public_key: process.env.DISCORD_PUBLIC_KEY,
  application_id: process.env.DISCORD_APPLICATION_ID || "1451435856714793091",
  guild_id: process.env.DISCORD_GUILD_ID,
  register_sync_mode: process.env.REGISTER_SYNC_MODE,
  port: Number(process.env.PORT || 3000),
  sentry_dsn: process.env.SENTRY_DSN,
  sentry_environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  postgres_url: process.env.POSTGRES_URL,
};
export default configuration;
