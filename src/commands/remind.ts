import { deleteUserReminderById, getUserReminderById, getUserReminders } from "@/sql/reminders";
import textDisplay from "@/utils/textDisplay";
import {
  ApplicationCommandDataResolvable,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  ButtonStyle,
  CacheType,
  ComponentType,
  Interaction,
  InteractionContextType,
  MessageFlags,
} from "discord.js";
import moment from "moment";
import { getModalData, handleCreate } from "./reminder-message";
import { MAX_COMPONENTS, MAX_REMINDER_MESSAGE_LENGTH } from "@/utils/constants";

export const command: ApplicationCommandDataResolvable = {
  type: ApplicationCommandType.ChatInput,
  name: "remind",
  contexts: [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel],
  integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
  description: "Manage your reminders.",
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "list",
      description: "List your reminders.",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "include_sent",
          description: "Include sent reminders in the list.",
          required: false,
          choices: [
            { name: "Yes", value: "yes" },
            { name: "No (Default)", value: "no" },
          ],
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "create",
      description: "Create a new reminder.",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "time",
          description: "The time for the reminder (e.g., 'in 10 minutes', 'tomorrow at 3pm').",
          required: true,
        },
        {
          type: ApplicationCommandOptionType.String,
          name: "message",
          description: "The message for the reminder.",
          required: true,
          min_length: 1,
          max_length: MAX_REMINDER_MESSAGE_LENGTH,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "create-modal",
      description: "Open a modal to create a new reminder.",
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "delete",
      description: "Delete a reminder from the database.",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "reminder_id",
          description: "The ID of the reminder to delete.",
          required: true,
          autocomplete: true,
        },
      ],
    },
  ],
};
const DELETE_REMINDER_CUSTOM_ID_PREFIX = "reminder:delete:";

export const shouldHandleCommand = (interaction: Interaction<CacheType>): boolean => {
  if ((interaction.isAutocomplete() || interaction.isChatInputCommand()) && interaction.commandName === command.name) return true;
  if (interaction.isButton() && interaction.customId.startsWith(DELETE_REMINDER_CUSTOM_ID_PREFIX)) return true;

  return false;
};

function dateToRelativeMarkdown(date: Date) {
  if (!date || !date.getTime()) return "**Invalid Date**";
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:R>`;
}

export const handleCommand = async (interaction: Interaction<CacheType>) => {
  if (interaction.isChatInputCommand() && interaction.commandName === command.name) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "list") {
      const includeSent = interaction.options.getString("include_sent", false) === "yes";

      const reminders = await getUserReminders(interaction.user.id, includeSent);
      if (reminders.length === 0) {
        return interaction.reply({
          components: textDisplay(`You have no ${includeSent ? "" : "upcoming "}reminders.`),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }

      function isPast(date: Date, present: string, past: string) {
        return date.getTime() < Date.now() ? past : present;
      }

      interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [
          {
            type: ComponentType.Container, // 1
            components: reminders.slice(0,(MAX_COMPONENTS-1)/3).map((reminder, index) => ({
              type: ComponentType.Section, // n + 1
              components: [
                {
                  type: ComponentType.TextDisplay, // n +2
                  content: `#${index+1} ${isPast(reminder.remind_at, "Reminding", "Reminded")} ${dateToRelativeMarkdown(reminder.remind_at)}:\n${reminder.message.slice(0, 100)}`,
                }
              ],
              accessory: {
                type: ComponentType.Button, // n+3
                label: "Delete Reminder",
                style: ButtonStyle.Danger,
                custom_id: `${DELETE_REMINDER_CUSTOM_ID_PREFIX}${reminder.id}`,
              },
            })),
          },
        ],
      });
      return;
    } else if (subcommand === "create") {
      return handleCreate(interaction, interaction.options.getString("time", true), interaction.options.getString("message", true));
    } else if (subcommand === "create-modal") {
      return interaction.showModal(getModalData(""));
    } else if (subcommand === "delete") {
      const reminderId = interaction.options.getString("reminder_id", true);
      const reminder = await getUserReminderById(interaction.user.id, parseInt(reminderId));
      if (!reminder)
        return interaction.reply({
          content: `Reminder with ID ${reminderId} not found. Make sure to select the reminder from the autocomplete list.`,
          flags: MessageFlags.Ephemeral,
        });
      await deleteUserReminderById(interaction.user.id, parseInt(reminderId));

      return interaction.reply({
        content: `Reminder with ID ${reminderId} has been deleted.\nReminder Message was set to remind ${dateToRelativeMarkdown(reminder.remind_at)}${reminder.sent_at ? ` and was sent ${dateToRelativeMarkdown(reminder.sent_at)}` : ""}: \`\`\`md\n${reminder.message}\`\`\``,
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (interaction.isAutocomplete() && interaction.commandName === command.name) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === "reminder_id") {
      const reminders = await getUserReminders(interaction.user.id, true);
      const filtered = reminders.filter((reminder) => reminder.id.toString().startsWith(focusedOption.value)).slice(0, 25);
      return interaction.respond(
        filtered.map((reminder) => ({
          name: `#${reminder.id} - ${reminder.message.slice(0, 50)} (${moment(reminder.remind_at).fromNow()})`,
          value: reminder.id.toString(),
        }))
      );
    }
  } else if (interaction.isButton() && interaction.customId.startsWith(DELETE_REMINDER_CUSTOM_ID_PREFIX)) {
    const reminderId = interaction.customId.slice(DELETE_REMINDER_CUSTOM_ID_PREFIX.length);
    const reminder = await getUserReminderById(interaction.user.id, parseInt(reminderId));
    if (!reminder) {
      return interaction.reply({
        content: `Reminder with ID ${reminderId} not found or already deleted.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    await deleteUserReminderById(interaction.user.id, parseInt(reminderId));

    return interaction.reply({
      content: `Reminder with ID ${reminderId} has been deleted.\nReminder Message was set to remind ${dateToRelativeMarkdown(reminder.remind_at)}${reminder.sent_at ? ` and was sent ${dateToRelativeMarkdown(reminder.sent_at)}` : ""}: \`\`\`md\n${reminder.message}\`\`\``,
      flags: MessageFlags.Ephemeral,
    });
  }
};
