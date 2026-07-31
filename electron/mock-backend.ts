// In-memory mock backend for e2e tests and screenshots on machines without
// real audio hardware. Activated by AUDIODECK_MOCK_DEVICES=1; implements the
// same AudioControl / HeadsetQuerier surfaces as the real spawn wrappers and
// mutates its endpoint fixtures so UI actions round-trip believably.

import type { AudioControl, Endpoint } from "./audioctl.js";
import type { HeadsetQuerier, HeadsetSnapshot } from "./headsetcontrol.js";

function fixtureEndpoints(): Endpoint[] {
  return [
    {
      id: "mock-out-arctis",
      name: "Speakers (Arctis Nova Pro Wireless)",
      flow: "render",
      state: "active",
      isDefault: true,
      isDefaultComms: true,
      formFactor: 3,
      association: "{1}.USB\\VID_1038&PID_12E0&MI_00\\b&14277468&0&0000",
      volume: 40,
      mute: false,
    },
    {
      id: "mock-out-tv",
      name: "LG TV (NVIDIA High Definition Audio)",
      flow: "render",
      state: "active",
      isDefault: false,
      isDefaultComms: false,
      formFactor: 9,
      association: "{1}.HDAUDIO\\FUNC_01&VEN_10DE&DEV_00AA\\5&2a12ad2e&0&0001",
      volume: 25,
      mute: false,
    },
    {
      id: "mock-out-realtek",
      name: "Speakers (Realtek(R) Audio)",
      flow: "render",
      state: "disabled",
      isDefault: false,
      isDefaultComms: false,
      formFactor: 1,
      association: "{1}.HDAUDIO\\FUNC_01&VEN_10EC&DEV_0887\\4&1c2f3a4b&0&0001",
      volume: null,
      mute: null,
    },
    {
      id: "mock-out-airpods",
      name: "Headphones (AirPods Pro)",
      flow: "render",
      state: "unplugged",
      isDefault: false,
      isDefaultComms: false,
      formFactor: 3,
      association: "{1}.BTHENUM\\DEV_AIRPODSPRO\\7&2b3c4d5e&0&0000",
      volume: null,
      mute: null,
    },
    {
      id: "mock-out-ghost",
      name: "Digital Output (High Definition Audio Device)",
      flow: "render",
      state: "notpresent",
      isDefault: false,
      isDefaultComms: false,
      formFactor: 9,
      association: "{1}.HDAUDIO\\FUNC_01&VEN_8086&DEV_2809\\5&9f8e7d6c&0&0001",
      volume: null,
      mute: null,
    },
    {
      id: "mock-mic-arctis",
      name: "Microphone (Arctis Nova Pro Wireless)",
      flow: "capture",
      state: "active",
      isDefault: true,
      isDefaultComms: true,
      formFactor: 4,
      association: "{1}.USB\\VID_1038&PID_12E0&MI_00\\b&14277468&0&0000",
      volume: 80,
      mute: false,
    },
    {
      id: "mock-mic-brio",
      name: "Microphone (Logitech BRIO)",
      flow: "capture",
      state: "active",
      isDefault: false,
      isDefaultComms: false,
      formFactor: 4,
      association: "{1}.USB\\VID_046D&PID_085E&MI_02\\a&33221100&0&0002",
      volume: 65,
      mute: false,
    },
  ];
}

export class MockAudioctl implements AudioControl {
  /**
   * Hardware that owns its own level: the write is accepted and then quietly
   * reverted, exactly like a headset base station. The daemon reads the level
   * back, sees it did not move, and marks the endpoint volume-locked.
   */
  private static readonly IGNORES_VOLUME: ReadonlySet<string> = new Set(["mock-out-arctis"]);

  private endpoints: Endpoint[] = fixtureEndpoints();

  async list(): Promise<Endpoint[]> {
    return this.endpoints.map((e) => ({ ...e }));
  }

  async setDefault(id: string): Promise<void> {
    const target = this.get(id);
    for (const e of this.endpoints) {
      if (e.flow !== target.flow) continue;
      e.isDefault = e.id === id;
      e.isDefaultComms = e.id === id;
    }
  }

  async setVolume(id: string, level: number): Promise<void> {
    const endpoint = this.get(id);
    if (MockAudioctl.IGNORES_VOLUME.has(id)) return;
    endpoint.volume = level;
  }

  async mute(id: string): Promise<void> {
    this.get(id).mute = true;
  }

  async unmute(id: string): Promise<void> {
    this.get(id).mute = false;
  }

  async enable(id: string): Promise<void> {
    const e = this.get(id);
    e.state = "active";
    e.volume = 50;
    e.mute = false;
  }

  async disable(id: string): Promise<void> {
    const e = this.get(id);
    e.state = "disabled";
    e.isDefault = false;
    e.isDefaultComms = false;
    e.volume = null;
    e.mute = null;
  }

  async setType(id: string, formFactor: number): Promise<void> {
    this.get(id).formFactor = formFactor;
  }

  async rename(id: string, name: string, suffix?: string): Promise<void> {
    // Mirrors Windows: composed as "name (suffix)"; the parentheses always
    // come back, but both texts are writable.
    const e = this.get(id);
    const current = /\(([^)]*)\)\s*$/.exec(e.name);
    const kept = suffix ?? (current === null ? null : current[1]);
    e.name = kept === null || kept === undefined ? name : `${name} (${kept})`;
  }

  private get(id: string): Endpoint {
    const endpoint = this.endpoints.find((e) => e.id === id);
    if (endpoint === undefined) throw new Error(`mock backend: unknown endpoint ${id}`);
    return endpoint;
  }
}

/** Reports the mocked Arctis as powered on, so its endpoints read "headset-on". */
export class MockHeadsetControl implements HeadsetQuerier {
  async query(): Promise<HeadsetSnapshot> {
    return {
      version: "mock",
      devices: [
        {
          status: "success",
          device: "SteelSeries Arctis Nova Pro Wireless",
          vendor: "SteelSeries",
          product: "Arctis Nova Pro Wireless",
          id_vendor: "0x1038",
          id_product: "0x12e0",
          capabilities: ["CAP_BATTERY_STATUS"],
          battery: { status: "BATTERY_AVAILABLE", level: 78 },
        },
      ],
    };
  }
}

