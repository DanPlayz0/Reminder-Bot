import configuration from "@/configuration";
import {
  APIApplicationCommandInteractionDataBasicOption,
  APIApplicationCommandInteractionDataSubcommandOption,
  APIInteraction,
  APIInteractionResponse,
  APIMessageApplicationCommandInteractionData,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
  APITextInputComponent,
  ApplicationCommandOptionType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10";
import { createPublicKey, verify } from "crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifyDiscordRequest(signature: string | undefined, timestamp: string | undefined, body: Buffer) {
  if (!configuration.public_key) throw new Error("DISCORD_PUBLIC_KEY is required.");
  if (!signature || !timestamp) return false;

  const key = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(configuration.public_key, "hex")]),
    format: "der",
    type: "spki",
  });

  return verify(null, Buffer.concat([Buffer.from(timestamp), body]), key, Buffer.from(signature, "hex"));
}

export function pong(): APIInteractionResponse {
  return { type: InteractionResponseType.Pong };
}

export function messageResponse(data: any): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data,
  };
}

export function updateMessageResponse(data: any): APIInteractionResponse {
  return {
    type: InteractionResponseType.UpdateMessage,
    data,
  };
}

export function modalResponse(data: any): APIInteractionResponse {
  return {
    type: InteractionResponseType.Modal,
    data,
  };
}

export function autocompleteResponse(choices: { name: string; value: string }[]): APIInteractionResponse {
  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: { choices },
  };
}

export function deferredUpdateResponse(): APIInteractionResponse {
  return { type: InteractionResponseType.DeferredMessageUpdate };
}

export function ephemeralText(content: string): APIInteractionResponse {
  return messageResponse({
    content,
    flags: MessageFlags.Ephemeral,
  });
}

export function isApplicationCommand(interaction: APIInteraction) {
  return interaction.type === InteractionType.ApplicationCommand;
}

export function isAutocomplete(interaction: APIInteraction) {
  return interaction.type === InteractionType.ApplicationCommandAutocomplete;
}

export function isMessageComponent(interaction: APIInteraction): interaction is APIMessageComponentInteraction {
  return interaction.type === InteractionType.MessageComponent;
}

export function isModalSubmit(interaction: APIInteraction): interaction is APIModalSubmitInteraction {
  return interaction.type === InteractionType.ModalSubmit;
}

export function getUserId(interaction: APIInteraction) {
  return interaction.member?.user.id ?? interaction.user?.id ?? "";
}

export function getCreatedAt(interaction: APIInteraction) {
  return new Date(Number(BigInt(interaction.id) >> 22n) + 1420070400000);
}

export function getSubcommand(interaction: APIInteraction) {
  if (!isApplicationCommand(interaction) && !isAutocomplete(interaction)) return undefined;
  const data = interaction.data as { options?: { type: number }[] };
  return data.options?.find((option) => option.type === ApplicationCommandOptionType.Subcommand) as
    | APIApplicationCommandInteractionDataSubcommandOption
    | undefined;
}

export function getOption(subcommand: APIApplicationCommandInteractionDataSubcommandOption | undefined, name: string) {
  return subcommand?.options?.find((option) => option.name === name) as APIApplicationCommandInteractionDataBasicOption | undefined;
}

export function getFocusedOption(interaction: APIInteraction) {
  const subcommand = getSubcommand(interaction);
  return subcommand?.options?.find((option) => "focused" in option && option.focused) as
    | (APIApplicationCommandInteractionDataBasicOption & { focused: true })
    | undefined;
}

export function getModalValue(interaction: APIModalSubmitInteraction, customId: string) {
  for (const row of interaction.data.components as any[]) {
    const input = row.components?.find((component: APITextInputComponent) => component.custom_id === customId) as APITextInputComponent | undefined;
    if (input) return input.value || "";
  }
  return "";
}

export function getMessageCommandTarget(interaction: APIInteraction) {
  if (!isApplicationCommand(interaction)) return undefined;
  return interaction.data as APIMessageApplicationCommandInteractionData;
}
