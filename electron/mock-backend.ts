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
      volume: 65,
      mute: false,
    },
  ];
}

export class MockAudioctl implements AudioControl {
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
    this.get(id).volume = level;
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
