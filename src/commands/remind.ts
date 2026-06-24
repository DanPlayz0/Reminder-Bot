import { deleteUserReminderById, disableUserReminderById, getUserReminderById, getUserReminders } from "@/sql/reminders";
import { MAX_REMINDER_MESSAGE_LENGTH } from "@/utils/constants";
import { autocompleteResponse, ephemeralText, getFocusedOption, getOption, getSubcommand, getUserId, isApplicationCommand, isAutocomplete, isMessageComponent, messageResponse, modalResponse, updateMessageResponse } from "@/utils/interactions";
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
        {
          type: ApplicationCommandOptionType.Integer,
          name: "page",
          description: "The page number to show.",
          required: false,
          min_value: 1,
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
const DISABLE_REMINDER_CUSTOM_ID_PREFIX = "reminder:disable:";
const LIST_REMINDERS_CUSTOM_ID_PREFIX = "reminder:list:";
const LIST_PAGE_SIZE = 8;

export const shouldHandleCommand = (interaction: APIInteraction): boolean => {
  if ((isAutocomplete(interaction) || isApplicationCommand(interaction)) && interaction.data.name === command.name) return true;
  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(DELETE_REMINDER_CUSTOM_ID_PREFIX)) return true;
  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(DISABLE_REMINDER_CUSTOM_ID_PREFIX)) return true;
  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(LIST_REMINDERS_CUSTOM_ID_PREFIX)) return true;
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

function reminderStatus(reminder: { remind_at: Date; sent_at: Date | null; active: boolean }) {
  if (!reminder.active) return "Inactive";
  if (reminder.sent_at) return `Sent ${dateToRelativeMarkdown(reminder.sent_at)}`;
  return `${reminder.remind_at.getTime() < Date.now() ? "Overdue" : "Reminding"} ${dateToRelativeMarkdown(reminder.remind_at)}`;
}

async function renderReminderList(userId: string, includeSent: boolean, page: number) {
  const reminders = await getUserReminders(userId, includeSent);
  if (reminders.length === 0) {
    return {
      components: textDisplay(`You have no ${includeSent ? "" : "upcoming "}reminders.`),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    };
  }

  const totalPages = Math.max(1, Math.ceil(reminders.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageReminders = reminders.slice(currentPage * LIST_PAGE_SIZE, (currentPage + 1) * LIST_PAGE_SIZE);

  return {
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [
      {
        type: ComponentType.Container,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `Reminders - Page ${currentPage + 1}/${totalPages}`,
          },
          ...pageReminders.map((reminder, index) => {
            const absoluteIndex = currentPage * LIST_PAGE_SIZE + index + 1;
            const section: any = {
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: `#${absoluteIndex} [${reminder.id}] ${reminderStatus(reminder)}:\n${reminder.message.slice(0, 100)}`,
                },
              ],
            };

            if (!reminder.sent_at && reminder.active) {
              section.accessory = {
                type: ComponentType.Button,
                label: "Disable",
                style: ButtonStyle.Secondary,
                custom_id: `${DISABLE_REMINDER_CUSTOM_ID_PREFIX}${includeSent ? "1" : "0"}:${currentPage}:${reminder.id}`,
              };
            }

            return section;
          }),
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                label: "Previous",
                style: ButtonStyle.Secondary,
                custom_id: `${LIST_REMINDERS_CUSTOM_ID_PREFIX}${includeSent ? "1" : "0"}:${currentPage - 1}`,
                disabled: currentPage === 0,
              },
              {
                type: ComponentType.Button,
                label: "Next",
                style: ButtonStyle.Secondary,
                custom_id: `${LIST_REMINDERS_CUSTOM_ID_PREFIX}${includeSent ? "1" : "0"}:${currentPage + 1}`,
                disabled: currentPage >= totalPages - 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

export const handleCommand = async (interaction: APIInteraction): Promise<APIInteractionResponse | undefined> => {
  if (isApplicationCommand(interaction) && interaction.data.name === command.name) {
    const subcommand = getSubcommand(interaction);
    const userId = getUserId(interaction);

    if (subcommand?.name === "list") {
      const includeSent = getOption(subcommand, "include_sent")?.value === "yes";
      const page = Number(getOption(subcommand, "page")?.value || 1);
      return messageResponse(await renderReminderList(userId, includeSent, page - 1));
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

  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(LIST_REMINDERS_CUSTOM_ID_PREFIX)) {
    const [, includeSentValue, pageValue] = interaction.data.custom_id.match(/^reminder:list:(\d):(-?\d+)$/) || [];
    const includeSent = includeSentValue === "1";
    const page = Number(pageValue || 0);
    return updateMessageResponse(await renderReminderList(getUserId(interaction), includeSent, page));
  }

  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(DISABLE_REMINDER_CUSTOM_ID_PREFIX)) {
    const [, includeSentValue, pageValue, reminderId] = interaction.data.custom_id.match(/^reminder:disable:(\d):(\d+):(\d+)$/) || [];
    if (!reminderId) return ephemeralText("Could not parse reminder ID.");

    await disableUserReminderById(getUserId(interaction), parseInt(reminderId));
    return updateMessageResponse(await renderReminderList(getUserId(interaction), includeSentValue === "1", Number(pageValue || 0)));
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
