import "./sql/pool";
import "./utils/moment-init";
import configuration from "@/configuration";
import * as deleteMessageButton from "@/commands/delete_reminder_message";
import * as remindCommand from "@/commands/remind";
import * as remindLaterButton from "@/commands/remind-later";
import * as reminderMessageModal from "@/commands/reminder-message";
import * as timezoneCommand from "@/commands/timezone";
import findAndSendReminders from "@/job/send-reminder";
import { rest } from "@/utils/discord";
import { pong, verifyDiscordRequest } from "@/utils/interactions";
import { APIInteraction, APIInteractionResponse, InteractionType, Routes } from "discord-api-types/v10";
import { createServer, IncomingMessage, ServerResponse } from "http";

async function registerCommands() {
  await rest.put(Routes.applicationCommands(configuration.application_id), {
    body: [reminderMessageModal.command, timezoneCommand.command, remindCommand.command],
  });
  console.log("Registered application commands.");
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function handleInteraction(interaction: APIInteraction): Promise<APIInteractionResponse | undefined> {
  if (interaction.type === InteractionType.Ping) return pong();
  if (reminderMessageModal.shouldHandleCommand(interaction)) return reminderMessageModal.handleCommand(interaction);
  if (timezoneCommand.shouldHandleCommand(interaction)) return timezoneCommand.handleCommand(interaction);
  if (deleteMessageButton.shouldHandle(interaction)) return deleteMessageButton.handle(interaction);
  if (remindLaterButton.shouldHandle(interaction)) return remindLaterButton.handle(interaction);
  if (remindCommand.shouldHandleCommand(interaction)) return remindCommand.handleCommand(interaction);

  console.log("Unhandled interaction:", interaction);
  return undefined;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return sendJson(response, 200, { ok: true });
    }

    if (request.method !== "POST" || request.url !== "/interactions") {
      return sendJson(response, 404, { error: "Not found" });
    }

    const rawBody = await readBody(request);
    const signature = request.headers["x-signature-ed25519"]?.toString();
    const timestamp = request.headers["x-signature-timestamp"]?.toString();

    if (!verifyDiscordRequest(signature, timestamp, rawBody)) {
      return sendJson(response, 401, { error: "Invalid request signature" });
    }

    const interaction = JSON.parse(rawBody.toString("utf8")) as APIInteraction;
    const interactionResponse = await handleInteraction(interaction);
    if (!interactionResponse) return sendJson(response, 400, { error: "Unhandled interaction" });

    return sendJson(response, 200, interactionResponse);
  } catch (error) {
    console.log("Failed to handle request:", error);
    return sendJson(response, 500, { error: "Internal server error" });
  }
});

registerCommands().catch((error) => {
  console.log("Failed to register application commands:", error);
});

setInterval(() => {
  findAndSendReminders().catch((error) => {
    console.log("Failed to send reminders:", error);
  });
}, 5000);

server.listen(configuration.port, () => {
  console.log(`HTTP interaction bot listening on port ${configuration.port}.`);
  console.log(`Discord interactions endpoint: /interactions`);
});
