import { Client, Events, GatewayIntentBits } from "discord.js";
import * as reminderMessageModal from "@/commands/reminder-message";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  presence: {
    activities: [{ name: "Sending you reminders" }],
  },
});

client.on(Events.ClientReady, async (client) => {
  console.log(`Logged in as ${client.user.tag}! (${client.user.id})`);
  console.log(`Invite: https://discord.com/oauth2/authorize?client_id=1451435856714793091`);

  await client.application.commands.set([
    reminderMessageModal.command,
  ]);
});

client.on(Events.GuildCreate, (guild) => {
  console.log(`Joined guild: ${guild.name} (${guild.id})`);
});
client.on(Events.GuildDelete, (guild) => {
  console.log(`Left guild: ${guild.name} (${guild.id})`);
});

client.on(Events.InteractionCreate, (interaction) => {
  if (reminderMessageModal.shouldHandleCommand(interaction)) return reminderMessageModal.handleCommand(interaction);

  console.log(interaction);
});

export default client;