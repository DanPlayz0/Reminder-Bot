import { custom_id_prefix as RemindLaterCustomId } from "@/commands/remind-later";
import { custom_id_prefix as DeleteMessageCustomId } from "@/commands/delete_reminder_message";
import { getDMChannel, setDMChannel } from "@/sql/dm-channels";
import { findRemindersWithinNextMinute, markReminderAsSent } from "@/sql/reminders";
import client from "@/utils/client";
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";

let failureCount = 0;

export default async function findAndSendReminders() {
  // console.log("Finding and sending reminders...");
  let minuteFails = 0;
  const reminders = await findRemindersWithinNextMinute();
  for (const reminder of reminders) {
    console.log(`Sending reminder to user ${reminder.user_id}: ${reminder.message}`);

    if (!client.isReady()) {
      console.log("Client not ready, cannot send reminder.");
      continue;
    }

    let dmChannelId = (await getDMChannel(reminder.user_id))?.channel_id;
    if (!dmChannelId) {
      const res = await client.users.createDM(reminder.user_id);
      dmChannelId = res.id;
      await setDMChannel(reminder.user_id, dmChannelId);
      console.log(`Created new DM channel ${dmChannelId} for user ${reminder.user_id}.`);
    }

    let sendTo = null;
    const channel = await client.channels.fetch(dmChannelId).catch(() => null);
    if (channel && channel.isSendable()) sendTo = channel.send.bind(channel);
    if (!sendTo) {
      console.log(`Could not fetch DM channel ${dmChannelId} for user ${reminder.user_id}, skipping reminder.`);
      continue;
    }

    try {
      await sendTo({
        flags: MessageFlags.IsComponentsV2,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `${reminder.message}\n-# This reminder was created <t:${Math.floor(reminder.created_at.getTime() / 1000)}:f>`
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                label: "Delete Message",
                custom_id: `${DeleteMessageCustomId}:${reminder.id}`
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: "Remind Later",
                custom_id: `${RemindLaterCustomId}:${reminder.id}`
              }
            ]
          }
        ],
      });
      await markReminderAsSent(reminder.id);
    } catch (e: any) {
      // 50007 = Cannot send messages to this user
      // 50278 = Cannot send messages to this user due to having no mutual guilds
      if ("code" in e && (e.code === 50007 || e.code === 50278)) {
        console.log(`Cannot send messages to user ${reminder.user_id}, marking reminder as sent.`);
        await markReminderAsSent(reminder.id);
        continue;
      } else {
        console.log(`Failed to send reminder to user ${reminder.user_id}:`, e);
        minuteFails++;
      }
    }
  }

  if (minuteFails > 0) {
    failureCount += minuteFails;
    console.log(`Failed to send ${minuteFails} reminders in the last minute.`);
  }
  if (failureCount >= 10) {
    console.log(`Failed to send ${failureCount} reminders in a row, pausing reminder sending for 10 minutes.`);
    failureCount = 0;
    await new Promise(resolve => setTimeout(resolve, 10*60000)); // Wait 10 minutes before trying again
  }
}