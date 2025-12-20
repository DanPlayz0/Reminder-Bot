import textDisplay from "@/utils/textDisplay";
import { nlpTimestamp } from "@/utils/time-nlp";
import { ApplicationCommandDataResolvable, ApplicationCommandType, ApplicationIntegrationType, ButtonStyle, CacheType, ComponentType, Interaction, InteractionContextType, MessageFlags, SeparatorSpacingSize } from "discord.js";

export const command: ApplicationCommandDataResolvable = {
  type: ApplicationCommandType.Message,
  name: "Remind Me",
  contexts: [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel],
  integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
};

const CREATE_MODAL_CUSTOM_ID = "create-reminder-message";
const CONFIRM_BUTTON_CUSTOM_ID = "confirm-reminder-message";

export const shouldHandleCommand = (interaction: Interaction<CacheType>): boolean => {
  if (interaction.isMessageContextMenuCommand() && interaction.commandName === command.name) return true;
  if (interaction.isModalSubmit() && interaction.customId == CREATE_MODAL_CUSTOM_ID) return true;
  if (interaction.isButton() && interaction.customId == CONFIRM_BUTTON_CUSTOM_ID) return true;
  return false;
}

export const handleCommand = async (interaction: Interaction<CacheType>) => {
  if (interaction.isMessageContextMenuCommand()) {
    return interaction.showModal({
      title: "Create Reminder",
      custom_id: CREATE_MODAL_CUSTOM_ID,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: `This reminder will have a message attached to it, the message by: <@${interaction.targetMessage.author.id}> (\`${interaction.targetMessage.author.tag}\`, ${interaction.targetMessage.author.id}). View more info at the bottom of this modal.`,
        },
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
              placeholder: "in 1 hour and 2 days",
            }
          ]
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "message",
              style: 2,
              label: "Notes for the reminder (optional)",
              required: false,
              placeholder: "Add this as a sticker",
            }
          ]
        },
        {
          type: ComponentType.TextDisplay,
          content: `Referenced Message: ${interaction.targetMessage.url}\n` + (interaction.targetMessage.content ? "```md\n"+interaction.targetMessage.content+"\n```" : ""),
        }
      ]
    });
  } else if (interaction.isModalSubmit() && interaction.customId == CREATE_MODAL_CUSTOM_ID) {
    const time = interaction.fields.getTextInputValue("time");
    let sendReminderAt: Date;
    try {
      const nlpResult = nlpTimestamp(time, {
        instant: interaction.createdAt,
        userId: interaction.user.id,
        guildId: "guildId" in interaction ? interaction.guildId ?? undefined : undefined,
      });
      if (!nlpResult) throw new Error("Could not parse time");
      sendReminderAt = nlpResult.start;
    } catch {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "❌ Unable to parse the time you provided. Please try again with a different format.",
      });
    }
    const markdownTimeSeconds = Math.floor(sendReminderAt.getTime() / 1000);
    
    interaction.reply({
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: `**Please review the reminder below.** If it is correct, please press "Confirm".\nIt will be sent <t:${markdownTimeSeconds}:F> (<t:${markdownTimeSeconds}:R>).`
        },
        {
          type: ComponentType.Container,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: `### You requested this reminder on <t:${Math.floor(interaction.createdAt.getTime() / 1000)}:D>.`
            },
            {
              type: ComponentType.Separator,
              divider: true,
              spacing: SeparatorSpacingSize.Small
            },
            {
              type: ComponentType.TextDisplay,
              content: [
                `**When:** <t:${markdownTimeSeconds}:F> (<t:${markdownTimeSeconds}:R>)`,
                `**Notes:** ${interaction.fields.getTextInputValue("message") || "_No additional notes provided._"}`,
                `**Referenced Message by <@${interaction.message?.author.id}>:** ${interaction.message?.content ? "```md\n"+interaction.message.content+"\n```" : interaction.message?.url}`
              ].join("\n")
            }
          ]
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Success,
              label: "Confirm",
              custom_id: CONFIRM_BUTTON_CUSTOM_ID
            }
          ]
        }
      ]
    });
  } else if (interaction.isButton() && interaction.customId == CONFIRM_BUTTON_CUSTOM_ID) {
    //@ts-expect-error
    await interaction.update({ components: textDisplay(`Your reminder has been created and will be sent at ${interaction.message.components[1].components[2].content}`) });
    // await new Promise((resolve) => setTimeout(resolve, 2980)); // Simulate async operation
    // createReminder()
  }
  // Your logic to handle the command
  // You can use the `interaction` object to interact with the user and perform the desired action
}
