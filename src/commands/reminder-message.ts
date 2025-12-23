import { createReminder } from "@/sql/reminders";
import { getTimezone } from "@/sql/timezones";
import textDisplay from "@/utils/textDisplay";
import { nlpTimestamp } from "@/utils/time-nlp";
import { Timezones } from "@/utils/timezone";
import {
  APIModalInteractionResponseCallbackData,
  ApplicationCommandDataResolvable,
  ApplicationCommandType,
  ApplicationIntegrationType,
  CacheType,
  ComponentType,
  Interaction,
  InteractionContextType,
  MessageFlags,
} from "discord.js";
import moment from "moment";

export const command: ApplicationCommandDataResolvable = {
  type: ApplicationCommandType.Message,
  name: "Remind Me",
  contexts: [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel],
  integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
};

const CREATE_MODAL_CUSTOM_ID = "create-reminder-message";
// const CONFIRM_BUTTON_CUSTOM_ID = "confirm-reminder-message";

export const shouldHandleCommand = (interaction: Interaction<CacheType>): boolean => {
  if (interaction.isMessageContextMenuCommand() && interaction.commandName === command.name) return true;
  if (interaction.isModalSubmit() && interaction.customId == CREATE_MODAL_CUSTOM_ID) return true;
  // if (interaction.isButton() && interaction.customId == CONFIRM_BUTTON_CUSTOM_ID) return true;
  return false;
};

export function getModalData(content: string): APIModalInteractionResponseCallbackData {
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
        components: [
          {
            type: ComponentType.TextInput,
            custom_id: "message",
            style: 2,
            label: "Reminder content",
            required: true,
            placeholder: "Add this as a sticker",
            min_length: 1,
            max_length: 2048,
            value: content,
          },
        ],
      },
    ],
  };
}

export const handleCommand = async (interaction: Interaction<CacheType>) => {
  if (interaction.isMessageContextMenuCommand()) {
    // console.log(interaction);
    return interaction.showModal(
      getModalData(
        `https://discord.com/channels/${interaction.targetMessage.guildId || interaction.guild?.id || interaction.guildId || "@me"}/${
          interaction.targetMessage.channelId
        }/${interaction.targetMessage.id}`
      )
    );
  } else if (interaction.isModalSubmit() && interaction.customId == CREATE_MODAL_CUSTOM_ID) {
    const time = interaction.fields.getTextInputValue("time");
    const message = interaction.fields.getTextInputValue("message");
    const userTimezone = await getTimezone(interaction.user.id, "user");
    let sendReminderAt: Date;
    try {
      const nlpResult = nlpTimestamp(time, {
        instant: interaction.createdAt,
        userId: interaction.user.id,
        guildId: "guildId" in interaction ? interaction.guildId ?? undefined : undefined,
        timezone: moment.tz(userTimezone || Timezones.EST).zoneAbbr(),
      });
      if (!nlpResult) throw new Error("Could not parse time");
      sendReminderAt = nlpResult.start;
    } catch {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `❌ Unable to parse the time you provided. Please try again with a different format.\n\nIn case you forgot what you wrote: \`\`\`md\n${message}\`\`\``,
      });
    }
    const markdownTimeSeconds = Math.floor(sendReminderAt.getTime() / 1000);

    await createReminder({
      user_id: interaction.user.id,
      remind_at: sendReminderAt,
      message: message,
    });

    interaction.reply({
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      components: textDisplay(
        [
          `Okay! I will remind you about the following at <t:${markdownTimeSeconds}:F> *(<t:${markdownTimeSeconds}:R>)*`,
          `${
            userTimezone
              ? ""
              : "-# ⚠️ I couldn't find your timezone, so the time I interpreted this reminder for is based on EST. You can set your timezone using `/timezone set`.\n"
          }`,
          `Your reminder message:\n\`\`\`md\n${message.slice(0, 2048)}\`\`\``,
        ].join("\n")
      ),
    });
  }
};
