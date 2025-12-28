import { Client, Events, GatewayIntentBits } from "discord.js";
import * as reminderMessageModal from "@/commands/reminder-message";
import * as timezoneCommand from "@/commands/timezone";
import * as deleteMessageButton from "@/commands/delete_reminder_message";
import * as remindLaterButton from "@/commands/remind-later";
import * as remindCommand from "@/commands/remind";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  presence: {
    activities: [{ name: "Sending you reminders" }],
  },
});

client.on(Events.ClientReady, async (client) => {
  console.log(`Logged in as ${client.user.tag}! (${client.user.id})`);
  console.log(`Invite: https://discord.com/oauth2/authorize?client_id=1451435856714793091`);

  const commands = await client.application.commands.fetch();
  if (commands.size === 0) {
    console.log("Registering application commands...");
    await client.application.commands.set([
      reminderMessageModal.command,
      timezoneCommand.command,
      remindCommand.command,
    ]);
  }
});

client.on(Events.GuildCreate, (guild) => {
  console.log(`Joined guild: ${guild.name} (${guild.id})`);
});
client.on(Events.GuildDelete, (guild) => {
  console.log(`Left guild: ${guild.name} (${guild.id})`);
});

client.on(Events.InteractionCreate, (interaction) => {
  if (reminderMessageModal.shouldHandleCommand(interaction)) return reminderMessageModal.handleCommand(interaction);
  if (timezoneCommand.shouldHandleCommand(interaction)) return timezoneCommand.handleCommand(interaction);
  if (deleteMessageButton.shouldHandle(interaction)) return deleteMessageButton.handle(interaction);
  if (remindLaterButton.shouldHandle(interaction)) return remindLaterButton.handle(interaction);
  if (remindCommand.shouldHandleCommand(interaction)) return remindCommand.handleCommand(interaction);

  console.log(interaction);
});

export default client;