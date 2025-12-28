import textDisplay from "@/utils/textDisplay";
import {
  CacheType,
  Interaction, MessageFlags,
  Routes
} from "discord.js";

export const custom_id_prefix = "delete_reminder_message"

export const shouldHandle = (interaction: Interaction<CacheType>): boolean => {
  if (interaction.isButton() && interaction.customId.startsWith(custom_id_prefix)) return true;
  return false;
};

export const handle = async (interaction: Interaction<CacheType>) => {
  if (!interaction.isButton()) return;
  if (interaction.message.deletable) {
    await interaction.deferUpdate();
    // await interaction.message.delete(); // Apparently djs doesn't like uncached DM channels
    await interaction.client.rest.delete(Routes.channelMessage(interaction.channelId, interaction.message.id));
  }
  else {
    await interaction.reply({
      components: textDisplay("Could not delete the reminder message."),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
};
