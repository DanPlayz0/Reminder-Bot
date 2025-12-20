import { BaseMessageOptions, ComponentType } from "discord.js";

export default function textDisplay(content: string): BaseMessageOptions['components'] {
  return [{
    type: ComponentType.TextDisplay,
    content
  }]
}