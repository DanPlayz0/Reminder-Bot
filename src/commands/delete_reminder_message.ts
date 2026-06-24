import { rest } from "@/utils/discord";
import { deferredUpdateResponse, isMessageComponent } from "@/utils/interactions";
import { logError } from "@/utils/logger";
import { APIInteraction, APIInteractionResponse, Routes } from "discord-api-types/v10";

export const custom_id_prefix = "delete_reminder_message";

export const shouldHandle = (interaction: APIInteraction): boolean => {
  if (isMessageComponent(interaction) && interaction.data.custom_id.startsWith(custom_id_prefix)) return true;
  return false;
};

export const handle = async (interaction: APIInteraction): Promise<APIInteractionResponse | undefined> => {
  if (!isMessageComponent(interaction)) return;

  const channelId = interaction.channel_id;
  const messageId = interaction.message.id;

  setImmediate(() => {
    rest.delete(Routes.channelMessage(channelId, messageId)).catch((error) => {
      logError(`Could not delete reminder message ${channelId}/${messageId}`, error, { channelId, messageId });
    });
  });

  return deferredUpdateResponse();
};
