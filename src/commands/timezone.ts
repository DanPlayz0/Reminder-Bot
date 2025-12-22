import { deleteTimezone, getTimezone, setTimezone } from "@/sql/timezones";
import textDisplay from "@/utils/textDisplay";
import {
  ApplicationCommandDataResolvable,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  CacheType,
  Interaction,
  InteractionContextType,
  MessageFlags,
} from "discord.js";
import moment from "moment";

export const command: ApplicationCommandDataResolvable = {
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
    }
  ],
};

export const shouldHandleCommand = (interaction: Interaction<CacheType>): boolean => {
  if ((interaction.isAutocomplete() || interaction.isChatInputCommand()) && interaction.commandName === command.name) return true;
  // if (interaction.isMessageContextMenuCommand() && interaction.commandName === command.name) return true;
  // if (interaction.isModalSubmit() && interaction.customId == CREATE_MODAL_CUSTOM_ID) return true;
  // if (interaction.isButton() && interaction.customId == CONFIRM_BUTTON_CUSTOM_ID) return true;
  return false;
};

export const handleCommand = async (interaction: Interaction<CacheType>) => {
  if (interaction.isChatInputCommand() && interaction.commandName === command.name) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "set") {
      const timezone = interaction.options.getString("timezone", true);
      if (!moment.tz.zone(timezone)) 
        return interaction.reply({
          components: textDisplay(`The timezone **${timezone}** is not valid. Please provide a valid timezone (e.g., 'America/New_York', 'UTC', 'Europe/London').`),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      await setTimezone(interaction.user.id, "user", timezone);
      return interaction.reply({
        components: textDisplay(`Your timezone has been set to **${timezone}**.`),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } else if (subcommand === "view") {
      const userTimezone = await getTimezone(interaction.user.id, "user");
      if (!userTimezone) {
        return interaction.reply({
          components: textDisplay(`You have not set a timezone yet. Use \`/timezone set <timezone>\` to set your timezone.`),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      return interaction.reply({
        components: textDisplay(`Your currently set timezone is **${userTimezone}**.`),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } else if (subcommand === "remove") {
      const userTimezone = await getTimezone(interaction.user.id, "user");
      if (!userTimezone) {
        return interaction.reply({
          components: textDisplay(`You have not set a timezone yet. Use \`/timezone set <timezone>\` to set your timezone.`),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      await deleteTimezone(interaction.user.id, "user");
      return interaction.reply({
        components: textDisplay(`Your timezone has been removed.`),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  } else if (interaction.isAutocomplete() && interaction.commandName === command.name) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name == "timezone") {
      const zones = moment.tz.names();
      if (!focusedOption.value)
        return interaction.respond([
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
        ]
          .map((zone) => ({ name: zone, value: zone }))
          .slice(0, 25));
      const results = zones.filter((zone) => zone.toLowerCase().includes(focusedOption.value.toLowerCase())).slice(0, 25);
      return interaction.respond(results.map((zone) => ({ name: zone, value: zone })).slice(0, 25) || []);
    }
  }
};
