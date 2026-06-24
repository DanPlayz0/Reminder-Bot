import { createReminder } from "@/sql/reminders";
import { getTimezone } from "@/sql/timezones";
import { MAX_REMINDER_MESSAGE_LENGTH } from "@/utils/constants";
import {
  ephemeralText,
  getCreatedAt,
  getMessageCommandTarget,
  getModalValue,
  getUserId,
  isApplicationCommand,
  isModalSubmit,
  messageResponse,
  modalResponse,
} from "@/utils/interactions";
import textDisplay from "@/utils/textDisplay";
import { nlpTimestamp } from "@/utils/time-nlp";
import { Timezones } from "@/utils/timezone";
import {
  APIInteraction,
  APIInteractionResponse,
  APIModalInteractionResponseCallbackData,
  APITextInputComponent,
  ApplicationCommandType,
  ApplicationIntegrationType,
  ComponentType,
  InteractionContextType,
  MessageFlags,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import moment from "moment";

export const command: RESTPostAPIApplicationCommandsJSONBody = {
  type: ApplicationCommandType.Message,
  name: "Remind Me",
  contexts: [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel],
  integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
};

const CREATE_MODAL_CUSTOM_ID = "create-reminder-message";

export const shouldHandleCommand = (interaction: APIInteraction): boolean => {
  if (isApplicationCommand(interaction) && interaction.data.type === ApplicationCommandType.Message && interaction.data.name === command.name) return true;
  if (isModalSubmit(interaction) && interaction.data.custom_id === CREATE_MODAL_CUSTOM_ID) return true;
  return false;
};

export function getModalData(content: string): APIModalInteractionResponseCallbackData {
  const messageInput: APITextInputComponent = {
    type: ComponentType.TextInput,
    custom_id: "message",
    style: 2,
    label: "Reminder content",
    required: true,
    placeholder: "Add this as a sticker",
    min_length: 1,
    max_length: MAX_REMINDER_MESSAGE_LENGTH,
    ...(content ? { value: content } : {}),
  };

  return {
    title: "Create Reminder",
    custom_id: CREATE_MODAL_CUSTOM_ID,
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.TextInput,
            custom_id: "time",
            style: 1,
            label: "When should I remind you?",
            required: true,
            min_length: 1,
            max_length: 256,
            placeholder: "in 1 hour and 2 days",
          },
        ],
      },
      {
        type: ComponentType.ActionRow,
        components: [messageInput],
      },
    ],
  };
}

export const handleCommand = async (interaction: APIInteraction): Promise<APIInteractionResponse | undefined> => {
  if (isApplicationCommand(interaction) && interaction.data.type === ApplicationCommandType.Message) {
    const data = getMessageCommandTarget(interaction);
    const targetMessage = data?.resolved?.messages?.[data.target_id];
    const guildId = interaction.guild_id || "@me";
    const channelId = targetMessage?.channel_id || interaction.channel_id || "@me";
    const messageId = targetMessage?.id || data?.target_id;

    return modalResponse(getModalData(`https://discord.com/channels/${guildId}/${channelId}/${messageId}`));
  }

  if (isModalSubmit(interaction) && interaction.data.custom_id === CREATE_MODAL_CUSTOM_ID) {
    return handleCreate(interaction, getModalValue(interaction, "time"), getModalValue(interaction, "message"));
  }
};

export async function handleCreate(interaction: APIInteraction, time: string, message: string) {
  const userId = getUserId(interaction);
  const userTimezone = await getTimezone(userId, "user");
  let sendReminderAt: Date;

  try {
    const nlpResult = nlpTimestamp(time, {
      instant: getCreatedAt(interaction),
      userId,
      guildId: interaction.guild_id,
      timezone: moment.tz(userTimezone || Timezones.EST).zoneAbbr(),
    });
    if (!nlpResult) throw new Error("Could not parse time");
    sendReminderAt = nlpResult.start;
  } catch {
    return ephemeralText(`Unable to parse the time you provided. Please try again with a different format.\n\nIn case you forgot what you wrote: \`\`\`md\n${message}\`\`\``);
  }

  const markdownTimeSeconds = Math.floor(sendReminderAt.getTime() / 1000);

  await createReminder({
    user_id: userId,
    remind_at: sendReminderAt,
    message,
  });

  return messageResponse({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: textDisplay(
      [
        `Okay! I will remind you about the following at <t:${markdownTimeSeconds}:F> *(<t:${markdownTimeSeconds}:R>)*`,
        `${
          userTimezone
            ? ""
            : "-# Warning: I couldn't find your timezone, so the time I interpreted this reminder for is based on EST. You can set your timezone using `/timezone set`.\n"
        }`,
        `Your reminder message:\n\`\`\`md\n${message.slice(0, 2048)}\`\`\``,
      ].join("\n")
    ),
  });
}
