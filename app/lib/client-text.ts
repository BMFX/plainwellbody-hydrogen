import { format } from "~/lib/content";

// Interface text for browser-only code (clientAction), which can't use hooks. The root
// layout hands it over on render.
let clientText: Record<string, string> = {};

export function setClientText(text: Record<string, string>) {
  clientText = text;
}

export function clientT(key: string, vars?: Record<string, string | number>) {
  return format(clientText, key, vars);
}
