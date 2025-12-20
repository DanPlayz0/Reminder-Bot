import 'dotenv/config';

const configuration = {
  token: process.env.DISCORD_TOKEN,
  postgres_url: process.env.POSTGRES_URL,
};
export default configuration;