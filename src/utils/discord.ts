import configuration from "@/configuration";
import { REST } from "discord.js";

if (!configuration.token) {
  throw new Error("DISCORD_TOKEN is required.");
}
if (!configuration.public_key) {
  throw new Error("DISCORD_PUBLIC_KEY is required.");
}

export const rest = new REST({ version: "10" }).setToken(configuration.token);
