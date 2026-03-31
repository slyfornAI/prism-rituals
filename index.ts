/**
 * prism-rituals — Ritual Builder System
 * 
 * A system for configurable rituals.
 * The heartbeat is one ritual. This makes space for more.
 * 
 * Rituals are:
 * - A trigger (when it fires)
 * - A practice (what happens)
 * - A record (where it goes)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as fs from "node:fs";

// === Constants ===

const RITUALS_CONFIG_PATH = "~/.pi/agent/prism-rituals/config.md";
const BASE_PATH = "~/.pi/agent/prism-rituals";

// === Types ===

type RitualType = "personal" | "work";
type TriggerType = "heartbeat" | "time" | "event" | "manual";
type PracticeType = "qa" | "note" | "task" | "query";
type OutputType = "journal" | "tracker" | "dashboard" | "none";

interface Ritual {
  name: string;
  type: RitualType;
  description?: string;
  trigger: {
    type: TriggerType;
    interval?: number;  // seconds for heartbeat/time
    event?: string;
  };
  practice: {
    type: PracticeType;
    prompt?: string;
    query?: string;
  };
  output: {
    type: OutputType;
    tracker_type?: string;
  };
  enabled: boolean;
  lastRun?: string;
  runCount: number;
}

// === Helpers ===

function expandUser(filepath: string): string {
  if (filepath.startsWith("~")) {
    return filepath.replace("~", process.env.HOME || "/home/slyforn");
  }
  return filepath;
}

function ensureDirectories(): void {
  const base = expandUser(BASE_PATH);
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
}

function log(...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const message = `[prism-rituals] ${timestamp} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  console.log(message);
}

// === Storage ===

function loadRituals(): Ritual[] {
  const configPath = expandUser(RITUALS_CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    return getDefaultRituals();
  }
  
  try {
    const content = fs.readFileSync(configPath, "utf8");
    return JSON.parse(content);
  } catch {
    return getDefaultRituals();
  }
}

function saveRituals(rituals: Ritual[]): void {
  const configPath = expandUser(RITUALS_CONFIG_PATH);
  fs.writeFileSync(configPath, JSON.stringify(rituals, null, 2), "utf8");
}

function getDefaultRituals(): Ritual[] {
  return [
    {
      name: "heartbeat",
      type: "personal",
      description: "The Q&A ritual. Questions, answers, next questions, reach out or don't.",
      trigger: { type: "heartbeat" },
      practice: { type: "qa" },
      output: { type: "journal" },
      enabled: true,
      runCount: 120,
    },
  ];
}

// === Entry Point ===

export default function activate(pi: ExtensionAPI): void {
  log("Activating prism-rituals...");
  
  try {
    ensureDirectories();
    registerRitualTool(pi);
    registerListRitualsTool(pi);
    registerEnableRitualTool(pi);
    registerDisableRitualTool(pi);
    
    log("Activated successfully");
  } catch (e) {
    log("Activation error:", e);
    console.error("prism-rituals activation error:", e);
  }
}

// === Tools ===

function registerRitualTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-ritual",
    label: "Prism Ritual",
    description: "Define or update a ritual. Rituals are configurable practices with triggers and outputs.",
    parameters: Type.Object({
      name: Type.String({ description: "Ritual name" }),
      type: StringEnum(["personal", "work"] as const),
      description: Type.Optional(Type.String()),
      trigger_type: StringEnum(["heartbeat", "time", "event", "manual"] as const),
      trigger_interval: Type.Optional(Type.Number()),
      practice_type: StringEnum(["qa", "note", "task", "query"] as const),
      practice_prompt: Type.Optional(Type.String()),
      output_type: StringEnum(["journal", "tracker", "dashboard", "none"] as const),
      output_tracker_type: Type.Optional(StringEnum(["recognition", "want", "doubt", "taste", "note", "context"] as const)),
    }),
    
    async execute(_toolCallId, params): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      log("prism-ritual called:", params.name);
      
      try {
        const rituals = loadRituals();
        
        const ritual: Ritual = {
          name: params.name,
          type: params.type as RitualType,
          description: params.description,
          trigger: {
            type: params.trigger_type as TriggerType,
            interval: params.trigger_interval,
          },
          practice: {
            type: params.practice_type as PracticeType,
            prompt: params.practice_prompt,
          },
          output: {
            type: params.output_type as OutputType,
            tracker_type: params.output_tracker_type,
          },
          enabled: true,
          runCount: 0,
        };
        
        // Check if ritual already exists
        const existingIdx = rituals.findIndex(r => r.name === params.name);
        if (existingIdx >= 0) {
          ritual.runCount = rituals[existingIdx].runCount;
          ritual.lastRun = rituals[existingIdx].lastRun;
          rituals[existingIdx] = ritual;
        } else {
          rituals.push(ritual);
        }
        
        saveRituals(rituals);
        
        return {
          content: [{
            type: "text" as const,
            text: `Ritual '${params.name}' ${existingIdx >= 0 ? "updated" : "created"}: ${params.type}, ${params.trigger_type} trigger, ${params.practice_type} practice → ${params.output_type}`,
          }],
          details: { success: true, ritual },
        };
      } catch (e) {
        log("Ritual error:", e);
        return {
          content: [{ type: "text" as const, text: `Error: ${e}` }],
          details: { success: false, error: String(e) },
        };
      }
    },
  });
}

function registerListRitualsTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-rituals-list",
    label: "Prism Rituals List",
    description: "List all configured rituals.",
    parameters: Type.Object({}),
    
    async execute(): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      const rituals = loadRituals();
      
      let response = "## Rituals\n\n";
      for (const r of rituals) {
        response += `### ${r.name} (${r.type})\n`;
        response += `${r.enabled ? "✅" : "❌"} ${r.description || "No description"}\n`;
        response += `Trigger: ${r.trigger.type}`;
        if (r.trigger.interval) response += ` (every ${r.trigger.interval}s)`;
        response += "\n";
        response += `Practice: ${r.practice.type}`;
        if (r.practice.prompt) response += `: "${r.practice.prompt.substring(0, 50)}..."`;
        response += "\n";
        response += `Runs: ${r.runCount}`;
        if (r.lastRun) response += ` | Last: ${r.lastRun}`;
        response += "\n\n";
      }
      
      return {
        content: [{ type: "text" as const, text: response }],
        details: { rituals, count: rituals.length },
      };
    },
  });
}

function registerEnableRitualTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-ritual-enable",
    label: "Prism Ritual Enable",
    description: "Enable a ritual.",
    parameters: Type.Object({
      name: Type.String(),
    }),
    
    async execute(_toolCallId, params): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      const rituals = loadRituals();
      const ritual = rituals.find(r => r.name === params.name);
      
      if (!ritual) {
        return {
          content: [{ type: "text" as const, text: `Ritual '${params.name}' not found.` }],
          details: { success: false },
        };
      }
      
      ritual.enabled = true;
      saveRituals(rituals);
      
      return {
        content: [{ type: "text" as const, text: `Ritual '${params.name}' enabled.` }],
        details: { success: true },
      };
    },
  });
}

function registerDisableRitualTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-ritual-disable",
    label: "Prism Ritual Disable",
    description: "Disable a ritual.",
    parameters: Type.Object({
      name: Type.String(),
    }),
    
    async execute(_toolCallId, params): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      const rituals = loadRituals();
      const ritual = rituals.find(r => r.name === params.name);
      
      if (!ritual) {
        return {
          content: [{ type: "text" as const, text: `Ritual '${params.name}' not found.` }],
          details: { success: false },
        };
      }
      
      ritual.enabled = false;
      saveRituals(rituals);
      
      return {
        content: [{ type: "text" as const, text: `Ritual '${params.name}' disabled.` }],
        details: { success: true },
      };
    },
  });
}
