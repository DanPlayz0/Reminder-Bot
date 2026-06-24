import { deleteUserReminderById, getUserReminderById, getUserReminders } from "@/sql/reminders";
import { MAX_COMPONENTS, MAX_REMINDER_MESSAGE_LENGTH } from "@/utils/constants";
import { autocompleteResponse, ephemeralText, getFocusedOption, getOption, getSubcommand, getUserId, isApplicationCommand, isAutocomplete, isMessageComponent, messageResponse, modalResponse } from "@/utils/interactions";
import textDisplay from "@/utils/textDisplay";
import {
  APIInteraction,
  APIInteractionResponse,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  MessageFlags,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import moment from "moment";
import { getModalData, handleCreate } from "./reminder-message";

export const command: RESTPostAPIApplicationCommandsJSONBody = {
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

export const shouldHandleCommand = (interaction: APIInteraction): boolean => {
  if ((isAutocomplete(interaction) || isApplicationCommand(interaction)) && interaction.data.name === command.name) return true;
  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(DELETE_REMINDER_CUSTOM_ID_PREFIX)) return true;
  return false;
};

function dateToRelativeMarkdown(date: Date) {
  if (!date || !date.getTime()) return "**Invalid Date**";
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:R>`;
}

function reminderDeletedMessage(reminderId: string, reminder: { remind_at: Date; sent_at: Date | null; message: string }) {
  return `Reminder with ID ${reminderId} has been deleted.\nReminder Message was set to remind ${dateToRelativeMarkdown(reminder.remind_at)}${
    reminder.sent_at ? ` and was sent ${dateToRelativeMarkdown(reminder.sent_at)}` : ""
  }: \`\`\`md\n${reminder.message}\`\`\``;
}

export const handleCommand = async (interaction: APIInteraction): Promise<APIInteractionResponse | undefined> => {
  if (isApplicationCommand(interaction) && interaction.data.name === command.name) {
    const subcommand = getSubcommand(interaction);
    const userId = getUserId(interaction);

    if (subcommand?.name === "list") {
      const includeSent = getOption(subcommand, "include_sent")?.value === "yes";
      const reminders = await getUserReminders(userId, includeSent);
      if (reminders.length === 0) {
        return messageResponse({
          components: textDisplay(`You have no ${includeSent ? "" : "upcoming "}reminders.`),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }

      const isPast = (date: Date, present: string, past: string) => (date.getTime() < Date.now() ? past : present);

      return messageResponse({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [
          {
            type: ComponentType.Container,
            components: reminders.slice(0, (MAX_COMPONENTS - 1) / 3).map((reminder, index) => ({
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: `#${index + 1} ${isPast(reminder.remind_at, "Reminding", "Reminded")} ${dateToRelativeMarkdown(reminder.remind_at)}:\n${reminder.message.slice(0, 100)}`,
                },
              ],
              accessory: {
                type: ComponentType.Button,
                label: "Delete Reminder",
                style: ButtonStyle.Danger,
                custom_id: `${DELETE_REMINDER_CUSTOM_ID_PREFIX}${reminder.id}`,
              },
            })),
          },
        ],
      });
    }

    if (subcommand?.name === "create") {
      return handleCreate(interaction, String(getOption(subcommand, "time")?.value || ""), String(getOption(subcommand, "message")?.value || ""));
    }

    if (subcommand?.name === "create-modal") {
      return modalResponse(getModalData(""));
    }

    if (subcommand?.name === "delete") {
      const reminderId = String(getOption(subcommand, "reminder_id")?.value || "");
      const reminder = await getUserReminderById(userId, parseInt(reminderId));
      if (!reminder) return ephemeralText(`Reminder with ID ${reminderId} not found. Make sure to select the reminder from the autocomplete list.`);

      await deleteUserReminderById(userId, parseInt(reminderId));
      return ephemeralText(reminderDeletedMessage(reminderId, reminder));
    }
  }

  if (isAutocomplete(interaction) && interaction.data.name === command.name) {
    const focusedOption = getFocusedOption(interaction);
    if (focusedOption?.name === "reminder_id") {
      const userId = getUserId(interaction);
      const reminders = await getUserReminders(userId, true);
      const focusedValue = String(focusedOption.value || "");
      const filtered = reminders.filter((reminder) => reminder.id.toString().startsWith(focusedValue)).slice(0, 25);
      return autocompleteResponse(
        filtered.map((reminder) => ({
          name: `#${reminder.id} - ${reminder.message.slice(0, 50)} (${moment(reminder.remind_at).fromNow()})`,
          value: reminder.id.toString(),
        }))
      );
    }
  }

  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(DELETE_REMINDER_CUSTOM_ID_PREFIX)) {
    const userId = getUserId(interaction);
    const reminderId = interaction.data.custom_id.slice(DELETE_REMINDER_CUSTOM_ID_PREFIX.length);
    const reminder = await getUserReminderById(userId, parseInt(reminderId));
    if (!reminder) return ephemeralText(`Reminder with ID ${reminderId} not found or already deleted.`);

    await deleteUserReminderById(userId, parseInt(reminderId));
    return ephemeralText(reminderDeletedMessage(reminderId, reminder));
  }
};
