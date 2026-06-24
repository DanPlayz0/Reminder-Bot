import configuration from "@/configuration";
import * as remindCommand from "@/commands/remind";
import * as reminderMessageModal from "@/commands/reminder-message";
import * as timezoneCommand from "@/commands/timezone";
import { rest } from "@/utils/discord";
import { logError } from "@/utils/logger";
import { Routes } from "discord-api-types/v10";

type JsonRecord = Record<string, unknown>;

interface CommandLike extends JsonRecord {
  name: string;
  type: number;
}

interface FetchedCommand extends CommandLike {
  id: string;
}

const commands = [reminderMessageModal.command, timezoneCommand.command, remindCommand.command] as CommandLike[];

function collectionRoute() {
  return configuration.guild_id
    ? Routes.applicationGuildCommands(configuration.application_id, configuration.guild_id)
    : Routes.applicationCommands(configuration.application_id);
}

function commandRoute(commandId: string) {
  return configuration.guild_id
    ? Routes.applicationGuildCommand(configuration.application_id, configuration.guild_id, commandId)
    : Routes.applicationCommand(configuration.application_id, commandId);
}

function omitUndefined(value: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStringPermission(value: unknown) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function normalizeLocalizations(value?: Record<string, string | null> | null) {
  if (!value || Object.keys(value).length === 0) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== null).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeChoices(choices: any[] = []): JsonRecord[] {
  return choices
    .map((choice) =>
      omitUndefined({
        name: choice.name,
        name_localizations: normalizeLocalizations(choice.name_localizations),
        value: choice.value,
      })
    )
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function normalizeOptions(options: any[] = []): JsonRecord[] {
  return options
    .map((option) =>
      omitUndefined({
        type: option.type,
        name: option.name,
        name_localizations: normalizeLocalizations(option.name_localizations),
        description: option.description,
        description_localizations: normalizeLocalizations(option.description_localizations),
        required: normalizeBoolean(option.required, false),
        choices: option.choices ? normalizeChoices(option.choices) : undefined,
        options: option.options ? normalizeOptions(option.options) : undefined,
        channel_types: option.channel_types ? [...option.channel_types].sort((left, right) => left - right) : undefined,
        min_value: option.min_value,
        max_value: option.max_value,
        min_length: option.min_length,
        max_length: option.max_length,
        autocomplete: normalizeBoolean(option.autocomplete, false),
      })
    )
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function normalizeCommand(command: CommandLike): JsonRecord {
  return omitUndefined({
    name: command.name,
    name_localizations: normalizeLocalizations(command.name_localizations as Record<string, string | null> | undefined),
    description: command.description,
    description_localizations: normalizeLocalizations(command.description_localizations as Record<string, string | null> | undefined),
    type: command.type,
    options: normalizeOptions(command.options as any[] | undefined),
    default_member_permissions: normalizeStringPermission(command.default_member_permissions),
    dm_permission: normalizeBoolean(command.dm_permission, true),
    nsfw: normalizeBoolean(command.nsfw, false),
    integration_types: Array.isArray(command.integration_types) ? [...command.integration_types].sort((left, right) => Number(left) - Number(right)) : undefined,
    contexts: Array.isArray(command.contexts) ? [...command.contexts].sort((left, right) => Number(left) - Number(right)) : undefined,
  });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonRecord)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function findCommandDiffs(left: unknown, right: unknown, path = ""): string[] {
  if (stableStringify(left) === stableStringify(right)) return [];
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) || Array.isArray(right)) {
    return [path || "<root>"];
  }

  const diffs: string[] = [];
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of [...keys].sort()) {
    diffs.push(...findCommandDiffs((left as JsonRecord)[key], (right as JsonRecord)[key], path ? `${path}.${key}` : key));
  }
  return diffs;
}

function commandsEqual(left: CommandLike, right: CommandLike) {
  return stableStringify(normalizeCommand(left)) === stableStringify(normalizeCommand(right));
}

function commandDiffSummary(left: CommandLike, right: CommandLike) {
  const diffs = findCommandDiffs(normalizeCommand(left), normalizeCommand(right));
  return diffs.slice(0, 5).join(", ") + (diffs.length > 5 ? `, +${diffs.length - 5} more` : "");
}

async function bulkSyncCommands() {
  const syncedCommands = (await rest.put(collectionRoute(), { body: commands })) as CommandLike[];
  console.log(`Bulk synced ${syncedCommands.length} command(s).`);
}

async function diffSyncCommands() {
  console.log(`Application ID: ${configuration.application_id}`);
  console.log(configuration.guild_id ? `Syncing guild commands for guild ${configuration.guild_id}.` : "Syncing global application commands.");

  const discordCommands = (await rest.get(collectionRoute())) as FetchedCommand[];
  const existingByName = new Map(discordCommands.map((command) => [command.name, command]));
  const desiredByName = new Map(commands.map((command) => [command.name, command]));

  let created = 0;
  let updated = 0;
  let deleted = 0;
  let unchanged = 0;

  for (const command of commands) {
    const existingCommand = existingByName.get(command.name);

    if (!existingCommand) {
      console.log(`Creating command: ${command.name}`);
      await rest.post(collectionRoute(), { body: command });
      created++;
      continue;
    }

    if (commandsEqual(command, existingCommand)) {
      console.log(`Command is up to date: ${command.name}`);
      unchanged++;
      continue;
    }

    console.log(`Updating command: ${command.name} (${commandDiffSummary(command, existingCommand)})`);
    await rest.patch(commandRoute(existingCommand.id), { body: command });
    updated++;
  }

  const staleCommands = discordCommands.filter((command) => !desiredByName.has(command.name));
  console.log(`Found ${staleCommands.length} stale command(s) to delete.`);

  for (const command of staleCommands) {
    console.log(`Deleting command: ${command.name}`);
    await rest.delete(commandRoute(command.id));
    deleted++;
  }

  console.log(`Command sync complete: ${created} created, ${updated} updated, ${deleted} deleted, ${unchanged} unchanged.`);
}

export async function registerCommands() {
  if (configuration.register_sync_mode === "bulk") {
    await bulkSyncCommands();
    return;
  }

  await diffSyncCommands();
}

if (require.main === module) {
  registerCommands().catch((error) => {
    logError("Failed to register application commands", error);
    process.exitCode = 1;
  });
}
