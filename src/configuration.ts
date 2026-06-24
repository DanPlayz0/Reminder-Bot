import 'dotenv/config';

const configuration = {
  token: process.env.DISCORD_TOKEN,
  public_key: process.env.DISCORD_PUBLIC_KEY,
  application_id: process.env.DISCORD_APPLICATION_ID || "1451435856714793091",
  port: Number(process.env.PORT || 3000),
  postgres_url: process.env.POSTGRES_URL,
};
export default configuration;
