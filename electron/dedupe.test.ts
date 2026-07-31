// Duplicate collapsing: Windows keeps a stale endpoint id for a device it has
// re-enumerated, so the same physical device is listed twice (once live, once
// as a leftover). Only leftovers may be dropped, never a device the user can
// still act on.

import { describe, expect, it } from "vitest";
import { dedupeEndpoints } from "./dedupe.js";
import type { Endpoint, EndpointState } from "./audioctl.js";

const NVIDIA = "{1}.HDAUDIO\\FUNC_01&VEN_10DE\\5&2A12AD2E&0&0001";
const REALTEK = "{1}.USB\\VID_0B05&PID_1B9B&MI_00\\9&10574C6A&0&0000";

function endpoint(
  id: string,
  name: string,
  state: EndpointState,
  association: string | null = NVIDIA,
): Endpoint {
  return {
    id,
    name,
    flow: "render",
    state,
    isDefault: false,
    isDefaultComms: false,
    formFactor: 9,
    association,
    volume: null,
    mute: null,
  };
}

describe("dedupeEndpoints", () => {
  it("drops the leftover id of a re-enumerated device and reports the supersession", () => {
    // The reported bug: a rebooted TV comes back under a new id, Windows keeps
    // the old one forever as notpresent, and both wear the same name.
    const { endpoints, supersessions } = dedupeEndpoints([
      endpoint("{ghost}", "LG (NVIDIA High Definition Audio)", "notpresent"),
      endpoint("{live}", "LG (NVIDIA High Definition Audio)", "active"),
    ]);
    expect(endpoints.map((e) => e.id)).toEqual(["{live}"]);
    expect(supersessions).toEqual([{ ghostId: "{ghost}", liveId: "{live}" }]);
  });

  it("collapses a pile of identical leftovers into one row", () => {
    const { endpoints } = dedupeEndpoints([
      endpoint("{g1}", "NVIDIA Output (NVIDIA High Definition Audio)", "notpresent"),
      endpoint("{g2}", "NVIDIA Output (NVIDIA High Definition Audio)", "notpresent"),
      endpoint("{g3}", "NVIDIA Output (NVIDIA High Definition Audio)", "notpresent"),
    ]);
    expect(endpoints).toHaveLength(1);
  });

  it("hides an unplugged twin of a live device but keeps two live ones", () => {
    const unplugged = dedupeEndpoints([
      endpoint("{a}", "Microphone (Realtek USB Audio)", "active", REALTEK),
      endpoint("{b}", "Microphone (Realtek USB Audio)", "unplugged", REALTEK),
    ]);
    expect(unplugged.endpoints.map((e) => e.id)).toEqual(["{a}"]);

    // Two identical monitors on one adapter are two real devices; never hide
    // something the user can select right now.
    const both = dedupeEndpoints([
      endpoint("{a}", "LG (NVIDIA High Definition Audio)", "active"),
      endpoint("{b}", "LG (NVIDIA High Definition Audio)", "active"),
    ]);
    expect(both.endpoints).toHaveLength(2);
    expect(both.supersessions).toEqual([]);
  });

  it("keeps a disabled twin, which still has an Enable button of its own", () => {
    const { endpoints } = dedupeEndpoints([
      endpoint("{a}", "Speakers (Realtek USB Audio)", "active", REALTEK),
      endpoint("{b}", "Speakers (Realtek USB Audio)", "disabled", REALTEK),
    ]);
    expect(endpoints).toHaveLength(2);
  });

  it("never merges across adapters, flows, names, or an unreadable association", () => {
    const otherAdapter = dedupeEndpoints([
      endpoint("{a}", "Digital Output (High Definition Audio Device)", "active"),
      endpoint("{b}", "Digital Output (High Definition Audio Device)", "notpresent", REALTEK),
    ]);
    expect(otherAdapter.endpoints).toHaveLength(2);

    const otherName = dedupeEndpoints([
      endpoint("{a}", "Speakers (Realtek USB Audio)", "active"),
      endpoint("{b}", "Speakers (Realtek USB2.0 Audio)", "notpresent"),
    ]);
    expect(otherName.endpoints).toHaveLength(2);

    const otherFlow = dedupeEndpoints([
      { ...endpoint("{a}", "Line (Adapter)", "active"), flow: "capture" },
      endpoint("{b}", "Line (Adapter)", "notpresent"),
    ]);
    expect(otherFlow.endpoints).toHaveLength(2);

    const unreadable = dedupeEndpoints([
      endpoint("{a}", "Speakers (Adapter)", "active", null),
      endpoint("{b}", "Speakers (Adapter)", "notpresent", null),
    ]);
    expect(unreadable.endpoints).toHaveLength(2);
  });

  it("keeps enumeration order and returns the same array shape when nothing collapses", () => {
    const input = [
      endpoint("{a}", "A (Adapter)", "active"),
      endpoint("{b}", "B (Adapter)", "active"),
    ];
    const { endpoints, supersessions } = dedupeEndpoints(input);
    expect(endpoints.map((e) => e.id)).toEqual(["{a}", "{b}"]);
    expect(supersessions).toEqual([]);
  });
});
