import { getReminderById } from "@/sql/reminders";
import { ephemeralText, isMessageComponent, modalResponse } from "@/utils/interactions";
import { APIInteraction, APIInteractionResponse } from "discord-api-types/v10";
import { getModalData } from "./reminder-message";

export const custom_id_prefix = "remind-later:";

export const shouldHandle = (interaction: APIInteraction): boolean => {
  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(custom_id_prefix)) return true;
  return false;
};

export const handle = async (interaction: APIInteraction): Promise<APIInteractionResponse | undefined> => {
  if (!isMessageComponent(interaction)) return;

  const reminderId = interaction.data.custom_id.slice(custom_id_prefix.length);
  const reminder = await getReminderById(Number(reminderId));
  if (!reminder) return ephemeralText("Reminder not found.");

  return modalResponse(getModalData(reminder.message));
};
