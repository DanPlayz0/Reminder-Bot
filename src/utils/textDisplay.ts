import { APIMessageTopLevelComponent, ComponentType } from "discord-api-types/v10";

export default function textDisplay(content: string): APIMessageTopLevelComponent[] {
  return [{
    type: ComponentType.TextDisplay,
    content
  }]
}
