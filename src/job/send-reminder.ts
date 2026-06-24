import { custom_id_prefix as DeleteMessageCustomId } from "@/commands/delete_reminder_message";
import { custom_id_prefix as RemindLaterCustomId } from "@/commands/remind-later";
import { getDMChannel, setDMChannel } from "@/sql/dm-channels";
import { findRemindersWithinNextMinute, markReminderAsSent } from "@/sql/reminders";
import { rest } from "@/utils/discord";
import { ButtonStyle, ComponentType, MessageFlags, RESTPostAPICurrentUserCreateDMChannelResult, Routes } from "discord-api-types/v10";

let failureCount = 0;

async function getOrCreateDMChannel(userId: string) {
  const existingChannelId = (await getDMChannel(userId))?.channel_id;
  if (existingChannelId) return existingChannelId;

  const channel = (await rest.post(Routes.userChannels(), {
    body: { recipient_id: userId },
  })) as RESTPostAPICurrentUserCreateDMChannelResult;

  await setDMChannel(userId, channel.id);
  console.log(`Created new DM channel ${channel.id} for user ${userId}.`);
  return channel.id;
}

function isCannotSendDMError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error.code === 50007 || error.code === 50278);
}

export default async function findAndSendReminders() {
  let minuteFails = 0;
  const reminders = await findRemindersWithinNextMinute();

  for (const reminder of reminders) {
    console.log(`Sending reminder to user ${reminder.user_id}: ${reminder.message}`);

    try {
      const dmChannelId = await getOrCreateDMChannel(reminder.user_id);
      await rest.post(Routes.channelMessages(dmChannelId), {
        body: {
          flags: MessageFlags.IsComponentsV2,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: `${reminder.message}\n-# This reminder was created <t:${Math.floor(reminder.created_at.getTime() / 1000)}:f>`,
            },
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Danger,
                  label: "Delete Message",
                  custom_id: `${DeleteMessageCustomId}:${reminder.id}`,
                },
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Secondary,
                  label: "Remind Later",
                  custom_id: `${RemindLaterCustomId}${reminder.id}`,
                },
              ],
            },
          ],
        },
      });
      await markReminderAsSent(reminder.id);
    } catch (error) {
      if (isCannotSendDMError(error)) {
        console.log(`Cannot send messages to user ${reminder.user_id}, marking reminder as sent.`);
        await markReminderAsSent(reminder.id);
        continue;
      }

      console.log(`Failed to send reminder to user ${reminder.user_id}:`, error);
      minuteFails++;
    }
  }

  if (minuteFails > 0) {
    failureCount += minuteFails;
    console.log(`Failed to send ${minuteFails} reminders in the last minute.`);
  }
  if (failureCount >= 10) {
    console.log(`Failed to send ${failureCount} reminders in a row, pausing reminder sending for 10 minutes.`);
    failureCount = 0;
    await new Promise((resolve) => setTimeout(resolve, 10 * 60000));
  }
}
