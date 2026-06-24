import { custom_id_prefix as DeleteMessageCustomId } from "@/commands/delete_reminder_message";
import { custom_id_prefix as RemindLaterCustomId } from "@/commands/remind-later";
import { getDMChannel, setDMChannel } from "@/sql/dm-channels";
import { disableUserReminderById, findRemindersWithinNextMinute, markReminderAsSent, scheduleReminderRetry } from "@/sql/reminders";
import { rest } from "@/utils/discord";
import { logError, logMessage } from "@/utils/logger";
import { ButtonStyle, ComponentType, MessageFlags, RESTPostAPICurrentUserCreateDMChannelResult, Routes } from "discord-api-types/v10";

const MAX_SEND_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const GLOBAL_FAILURE_THRESHOLD = 5;
const GLOBAL_COOLDOWN_MS = 2 * 60 * 1000;

let consecutiveDiscordFailures = 0;
let globalBackoffUntil = 0;
let sendLoopRunning = false;

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

function isDiscordAvailabilityError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const maybeError = error as { code?: number | string; status?: number };
  if (maybeError.status && (maybeError.status === 429 || maybeError.status >= 500)) return true;
  return maybeError.code === "UND_ERR_CONNECT_TIMEOUT" || maybeError.code === "UND_ERR_HEADERS_TIMEOUT" || maybeError.code === "ECONNRESET" || maybeError.code === "ETIMEDOUT";
}

function nextRetryAt(attempts: number) {
  const backoffMs = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
  const jitterMs = Math.floor(Math.random() * Math.min(backoffMs * 0.25, 30_000));
  return new Date(Date.now() + backoffMs + jitterMs);
}

export default async function findAndSendReminders() {
  if (sendLoopRunning) return;
  if (Date.now() < globalBackoffUntil) return;

  sendLoopRunning = true;
  try {
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
        consecutiveDiscordFailures = 0;
      } catch (error) {
        if (isCannotSendDMError(error)) {
          console.log(`Cannot send messages to user ${reminder.user_id}, marking reminder as sent.`);
          await markReminderAsSent(reminder.id);
          continue;
        }

        logError(`Failed to send reminder to user ${reminder.user_id}`, error, {
          reminderId: reminder.id,
          userId: reminder.user_id,
          attempts: reminder.send_attempts,
        });
        const attempts = reminder.send_attempts + 1;
        if (attempts >= MAX_SEND_ATTEMPTS) {
          console.log(`Reminder ${reminder.id} failed ${attempts} times, disabling it.`);
          await disableUserReminderById(reminder.user_id, reminder.id);
        } else {
          const retryAt = nextRetryAt(reminder.send_attempts);
          console.log(`Reminder ${reminder.id} retry ${attempts}/${MAX_SEND_ATTEMPTS} scheduled for ${retryAt.toISOString()}.`);
          await scheduleReminderRetry(reminder.id, retryAt);
        }

        if (isDiscordAvailabilityError(error)) {
          consecutiveDiscordFailures++;
          if (consecutiveDiscordFailures >= GLOBAL_FAILURE_THRESHOLD) {
            globalBackoffUntil = Date.now() + GLOBAL_COOLDOWN_MS;
            logMessage(`Discord API appears unhealthy, backing off all reminder sends until ${new Date(globalBackoffUntil).toISOString()}.`, {
              consecutiveDiscordFailures,
            });
            break;
          }
        }
      }
    }
  } finally {
    sendLoopRunning = false;
  }
}
