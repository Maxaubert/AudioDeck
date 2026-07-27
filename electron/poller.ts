// The 2 s daemon loop: gather state, evaluate rules, act via audioctl.
// External manual default changes surface as a default that deviates from the
// winner with no availability event; the rules engine turns that into an
// override hold, and this loop persists it.

import { evaluateAvailability } from "./availability.js";
import { decide, diffEvents, seedPriorityList } from "./rules.js";
import type { AudioControl, Endpoint, EndpointFlow } from "./audioctl.js";
import type { AudioDeckConfig } from "./config.js";
import type { DeviceAvailability } from "./availability.js";
import type { HeadsetQuerier, HeadsetSnapshot } from "./headsetcontrol.js";

export interface PollerDeps {
  audioctl: AudioControl;
  headsetControl: HeadsetQuerier;
  getConfig: () => AudioDeckConfig;
  saveConfig: (config: AudioDeckConfig) => Promise<void>;
}

interface FlowKeys {
  flow: EndpointFlow;
  priorityKey: "outputPriority" | "micPriority";
  overrideKey: "output" | "mic";
}

const FLOWS: FlowKeys[] = [
  { flow: "render", priorityKey: "outputPriority", overrideKey: "output" },
  { flow: "capture", priorityKey: "micPriority", overrideKey: "mic" },
];

/** The daemon's latest view of the machine, for the UI via IPC. */
export interface PollSnapshot {
  endpoints: Endpoint[];
  availability: DeviceAvailability[];
}

export class Poller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private paused = false;
  private ticking = false;
  /** Last poll's availability snapshot; null before the first completed tick. */
  private previous: DeviceAvailability[] | null = null;
  /**
   * Default endpoint observed on the previous acted-on tick, per flow. Lets the
   * rules engine tell an external default change (moved between ticks, engage
   * the override hold) from our own failed set-default (did not move, retry).
   */
  private lastDefaults = new Map<EndpointFlow, string | null>();
  /** Last successful gather, kept for the UI even while paused. */
  private last: PollSnapshot | null = null;

  constructor(private readonly deps: PollerDeps) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.tickAndReschedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Pause automation (tray toggle) without stopping the process. */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Latest gathered state, or null before the first completed tick. */
  snapshot(): PollSnapshot | null {
    return this.last;
  }

  /** Run one tick immediately (after a UI mutation); no-op if one is running. */
  async refreshNow(): Promise<void> {
    try {
      await this.tick();
    } catch (err) {
      console.error("[poller] refresh failed:", err);
    }
  }

  private async tickAndReschedule(): Promise<void> {
    try {
      await this.tick();
    } catch (err) {
      // Never crash the daemon: log and keep the last known state.
      console.error("[poller] tick failed:", err);
    }
    if (!this.running) return;
    this.timer = setTimeout(() => void this.tickAndReschedule(), this.deps.getConfig().pollIntervalMs);
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.evaluateOnce();
    } finally {
      this.ticking = false;
    }
  }

  private async evaluateOnce(): Promise<void> {
    let endpoints: Endpoint[];
    try {
      endpoints = await this.deps.audioctl.list();
    } catch (err) {
      console.error("[poller] audioctl list failed, keeping last known state:", err);
      return;
    }

    let headsets: HeadsetSnapshot | null;
    try {
      headsets = await this.deps.headsetControl.query();
    } catch {
      // HeadsetControl unavailable: fall back to endpoint-state detection.
      headsets = null;
    }

    const availability = evaluateAvailability(endpoints, headsets);
    this.last = { endpoints, availability };
    const config = await this.seedLists(endpoints);

    // While paused, keep the snapshot fresh so unpausing does not replay
    // stale availability transitions, but take no action.
    if (this.paused) {
      this.previous = availability;
      return;
    }

    const isFirstTick = this.previous === null;
    let override = { ...config.override };
    let overrideChanged = false;

    for (const { flow, priorityKey, overrideKey } of FLOWS) {
      const flowAvailability = availability.filter((a) => a.endpoint.flow === flow);
      const flowPrevious = this.previous?.filter((a) => a.endpoint.flow === flow) ?? [];
      const events = isFirstTick ? [] : diffEvents(flowPrevious, flowAvailability);
      for (const event of events) {
        console.log(
          `[poller] ${flow} availability: ${event.endpointId} is now ` +
            (event.becameAvailable ? "available" : "unavailable"),
        );
      }

      const currentDefaultId =
        endpoints.find((e) => e.flow === flow && e.isDefault)?.id ?? null;
      const defaultMoved =
        !this.lastDefaults.has(flow) || this.lastDefaults.get(flow) !== currentDefaultId;
      this.lastDefaults.set(flow, currentDefaultId);
      const decision = decide(
        config[priorityKey],
        flowAvailability,
        events,
        currentDefaultId,
        override[overrideKey],
        defaultMoved,
      );

      if (decision.engageOverride && !override[overrideKey]) {
        console.log(`[poller] ${flow}: external default change detected, holding override`);
        override = { ...override, [overrideKey]: true };
        overrideChanged = true;
      }
      if (decision.releaseOverride && override[overrideKey]) {
        console.log(`[poller] ${flow}: availability event released the override hold`);
        override = { ...override, [overrideKey]: false };
        overrideChanged = true;
      }

      if (decision.setDefaultTo !== null) {
        console.log(`[poller] ${flow}: setting default to ${decision.setDefaultTo}`);
        try {
          await this.deps.audioctl.setDefault(decision.setDefaultTo);
        } catch (err) {
          console.error(`[poller] ${flow}: set-default failed:`, err);
        }
      }
    }

    if (overrideChanged) {
      await this.deps.saveConfig({ ...this.deps.getConfig(), override });
    }
    this.previous = availability;
  }

  /** First-run seeding and new-device append, persisted when anything changed. */
  private async seedLists(endpoints: Endpoint[]): Promise<AudioDeckConfig> {
    const config = this.deps.getConfig();
    const outputPriority = seedPriorityList(
      config.outputPriority,
      endpoints,
      "render",
      config.excluded.output,
    );
    const micPriority = seedPriorityList(
      config.micPriority,
      endpoints,
      "capture",
      config.excluded.mic,
    );
    if (
      sameList(outputPriority, config.outputPriority) &&
      sameList(micPriority, config.micPriority)
    ) {
      return config;
    }
    const updated = { ...config, outputPriority, micPriority };
    await this.deps.saveConfig(updated);
    return updated;
  }
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
