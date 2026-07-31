// The device-type catalog: each entry pairs the audio-endpoint form factor
// (drives the glyph in Windows' modern flyout) with the matching classic icon
// in mmres.dll. Values harvested from real endpoints on 2026-07-27.

import type { EndpointFlow } from "../electron/audioctl.js";

export interface DeviceTypeDef {
  key: string;
  label: string;
  /** Which flow(s) the type makes sense for. */
  flow: EndpointFlow | "both";
  formFactor: number;
  iconPath: string;
  /**
   * Offered in the type dropdown. Unoffered types exist only so devices that
   * already carry them (TV, digital, line in) display a truthful label; the
   * modern Windows picker draws the same speaker glyph for all of them, so
   * offering them as choices would be a switch that visibly does nothing.
   */
  offered: boolean;
}

const MMRES = "%windir%\\system32\\mmres.dll";

export const DEVICE_TYPES: DeviceTypeDef[] = [
  { key: "speakers", label: "Speakers", flow: "render", formFactor: 1, iconPath: `${MMRES},-3010`, offered: true },
  { key: "headphones", label: "Headphones", flow: "render", formFactor: 3, iconPath: `${MMRES},-3011`, offered: true },
  { key: "headset", label: "Headset", flow: "both", formFactor: 5, iconPath: `${MMRES},-3015`, offered: true },
  { key: "tv", label: "TV / Display", flow: "render", formFactor: 9, iconPath: `${MMRES},-3017`, offered: false },
  { key: "digital", label: "Digital output", flow: "render", formFactor: 8, iconPath: `${MMRES},-3013`, offered: false },
  { key: "microphone", label: "Microphone", flow: "capture", formFactor: 4, iconPath: `${MMRES},-3014`, offered: true },
  { key: "linein", label: "Line in", flow: "capture", formFactor: 2, iconPath: `${MMRES},-3012`, offered: false },
];

export function deviceTypeByKey(key: string): DeviceTypeDef | undefined {
  return DEVICE_TYPES.find((t) => t.key === key);
}

/** The choices shown in the dropdown: only types that visibly change something. */
export function offeredTypesForFlow(flow: EndpointFlow): DeviceTypeDef[] {
  return DEVICE_TYPES.filter((t) => t.offered && (t.flow === flow || t.flow === "both"));
}

export function typesForFlow(flow: EndpointFlow): DeviceTypeDef[] {
  return DEVICE_TYPES.filter((t) => t.flow === flow || t.flow === "both");
}

/** Best-effort reverse lookup for showing the current type in the UI. */
export function typeKeyForFormFactor(formFactor: number | null, flow: EndpointFlow): string | null {
  if (formFactor === null) return null;
  const match = typesForFlow(flow).find((t) => t.formFactor === formFactor);
  return match?.key ?? null;
}
