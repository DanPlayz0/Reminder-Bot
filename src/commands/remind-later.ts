import { getReminderById } from "@/sql/reminders";
import { CacheType, Interaction, MessageFlags } from "discord.js";
import { getModalData } from "./reminder-message";

export const custom_id_prefix = "remind-later:";

export const shouldHandle = (interaction: Interaction<CacheType>): boolean => {
  if (interaction.isButton() && interaction.customId.startsWith(custom_id_prefix)) return true;
  return false;
};

export const handle = async (interaction: Interaction<CacheType>) => {
  if (!interaction.isButton()) return;
  const reminderId = interaction.customId.slice(custom_id_prefix.length+1);
  const reminder = await getReminderById(Number(reminderId));
  if (!reminder) {
    await interaction.reply({
      content: "❌ | Reminder not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.showModal(getModalData(reminder.message));
};
