import { deleteTimezone, getTimezone, setTimezone } from "@/sql/timezones";
import { autocompleteResponse, getFocusedOption, getOption, getSubcommand, getUserId, isApplicationCommand, isAutocomplete, messageResponse } from "@/utils/interactions";
import textDisplay from "@/utils/textDisplay";
import {
  APIInteraction,
  APIInteractionResponse,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import moment from "moment";

export const command: RESTPostAPIApplicationCommandsJSONBody = {
  type: ApplicationCommandType.ChatInput,
  name: "timezone",
  contexts: [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel],
  integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
  description: "Set your timezone for accurate reminders.",
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "set",
      description: "Set your timezone.",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "timezone",
          description: "Your timezone (e.g., 'America/New_York', 'UTC', 'Europe/London')",
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "view",
      description: "View your currently set timezone.",
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "remove",
      description: "Remove your currently set timezone.",
    },
  ],
};

const defaultZones = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
  "America/Chicago",
  "America/Toronto",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Melbourne",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "Asia/Hong_Kong",
  "Europe/Rome",
  "Africa/Johannesburg",
  "America/Buenos_Aires",
  "Asia/Kolkata",
  "Asia/Istanbul",
  "Pacific/Auckland",
  "Europe/Amsterdam",
  "America/Denver",
];

export const shouldHandleCommand = (interaction: APIInteraction): boolean => {
  if ((isAutocomplete(interaction) || isApplicationCommand(interaction)) && interaction.data.name === command.name) return true;
  return false;
};

export const handleCommand = async (interaction: APIInteraction): Promise<APIInteractionResponse | undefined> => {
  if (isApplicationCommand(interaction) && interaction.data.name === command.name) {
    const subcommand = getSubcommand(interaction);
    const userId = getUserId(interaction);

    if (subcommand?.name === "set") {
      const timezone = String(getOption(subcommand, "timezone")?.value || "");
      if (!moment.tz.zone(timezone)) {
        return messageResponse({
          components: textDisplay(`The timezone **${timezone}** is not valid. Please provide a valid timezone (e.g., 'America/New_York', 'UTC', 'Europe/London').`),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      await setTimezone(userId, "user", timezone);
      return messageResponse({
        components: textDisplay(`Your timezone has been set to **${timezone}**.`),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand?.name === "view") {
      const userTimezone = await getTimezone(userId, "user");
      if (!userTimezone) {
        return messageResponse({
          components: textDisplay("You have not set a timezone yet. Use `/timezone set <timezone>` to set your timezone."),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      return messageResponse({
        components: textDisplay(`Your currently set timezone is **${userTimezone}**.`),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand?.name === "remove") {
      const userTimezone = await getTimezone(userId, "user");
      if (!userTimezone) {
        return messageResponse({
          components: textDisplay("You have not set a timezone yet. Use `/timezone set <timezone>` to set your timezone."),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      await deleteTimezone(userId, "user");
      return messageResponse({
        components: textDisplay("Your timezone has been removed."),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  }

  if (isAutocomplete(interaction) && interaction.data.name === command.name) {
    const focusedOption = getFocusedOption(interaction);
    if (focusedOption?.name === "timezone") {
      const value = String(focusedOption.value || "").toLowerCase();
      const results = value ? moment.tz.names().filter((zone) => zone.toLowerCase().includes(value)).slice(0, 25) : defaultZones;
      return autocompleteResponse(results.map((zone) => ({ name: zone, value: zone })).slice(0, 25));
    }
  }
};
