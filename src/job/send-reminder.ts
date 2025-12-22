import { getDMChannel, setDMChannel } from "@/sql/dm-channels";
import { findRemindersWithinNextMinute, markReminderAsSent } from "@/sql/reminders";
import client from "@/utils/client";
import textDisplay from "@/utils/textDisplay";
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";

export default async function findAndSendReminders() {
  // console.log("Finding and sending reminders...");
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
      setDMChannel(reminder.user_id, dmChannelId);
      console.log(`Created new DM channel ${dmChannelId} for user ${reminder.user_id}.`);
    }

    // let sendTo = client.users.send.bind(client.users, reminder.user_id);
    // const dmChannel = await getDMChannel(reminder.user_id);
    // if (dmChannel) {

    let sendTo = null;
    const channel = await client.channels.fetch(dmChannelId).catch(() => null);
    if (channel && channel.isSendable()) sendTo = channel.send.bind(channel);
    if (!sendTo) {
      console.log(`Could not fetch DM channel ${dmChannelId} for user ${reminder.user_id}, skipping reminder.`);
      continue;
    }

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
              custom_id: `delete_reminder_message:${reminder.id}`
            }
          ]
        }
      ],
    });

    await markReminderAsSent(reminder.id);

  }
}

// # ⏰ Reminder
// https://discord.com/channels/772012572648013824/772016589654589440/1452586588331708527
// -# This reminder was set on <t:1766399836:f>