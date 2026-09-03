/**
 * Command Denylist Extension
 *
 * Blocks bash commands matching a hardcoded deny list, returning a static
 * explanation with an alternative. The agent can request one-off user
 * approval via the request_command_approval tool; on approval the tool
 * runs the command directly.
 *
 * Suspicious (obfuscation-style) commands are logged but not blocked.
 * All events append JSONL to ~/.pi/agent/blocked-commands.jsonl.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createBashTool, isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

interface DenyRule {
	pattern: RegExp;
	explanation: string;
	alternative: string;
}

const DENY_RULES: DenyRule[] = [
	{
		pattern: /\bbazel\s+build\b/,
		explanation: "bazel build invalidates the bazel cache.",
		alternative: "Prefer `bin/coverage /path/to/folder` instead.",
	},
	{
		pattern: /\bbazel\s+test\b/,
		explanation: "bazel test is discouraged here.",
		alternative: "Prefer `bin/coverage /path/to/folder` instead.",
	},
	{
		pattern: /\bgit\s+push\b/,
		explanation: "Never push without explicit approval.",
		alternative: "Ask the user to push the branch.",
	},
];

// Log-only: obfuscation patterns that often hide the real command.
const SUSPICIOUS_PATTERNS: { pattern: RegExp; label: string }[] = [
	{ pattern: /\bbase64\s+(-d|-D|--decode)\b/, label: "base64 decode" },
	{ pattern: /\bxxd\s+-r\b/, label: "xxd reverse (hex decode)" },
	{ pattern: /\$'(\\x|\\[0-7])/, label: "ANSI-C escape sequence" },
	{ pattern: /printf\s+["']?(\\x|%b)/, label: "printf escape decoding" },
	{ pattern: /\$\{IFS\}/, label: "IFS word-split obfuscation" },
	{ pattern: /\beval\b/, label: "eval" },
	{ pattern: /\b(curl|wget)\b[^|;&]*\|\s*(ba)?sh\b/, label: "pipe download to shell" },
	{ pattern: /\becho\b[^|;&]*\|\s*(ba)?sh\b/, label: "pipe echo to shell" },
	{ pattern: /\b\w+\\\w+/, label: "backslash-split word" },
];

const LOG_PATH = join(homedir(), ".pi", "agent", "blocked-commands.jsonl");
const STATE_ENTRY_TYPE = "command-denylist-state";

function log(entry: Record<string, unknown>) {
	try {
		mkdirSync(dirname(LOG_PATH), { recursive: true });
		appendFileSync(LOG_PATH, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
	} catch {
		// Logging must never break the tool pipeline.
	}
}

const APPROVAL_PARAMS = Type.Object({
	command: Type.String({ description: "Exact command to run (must match the blocked command)" }),
	reason: Type.String({ description: "Why this command is needed despite the deny list" }),
});

export default function commandDenylistExtension(pi: ExtensionAPI) {
	const bashTool = createBashTool(process.cwd());
	let enabled = true;

	pi.on("session_start", (_event, ctx) => {
		enabled = true;
		const entries = ctx.sessionManager.getBranch();
		for (let index = entries.length - 1; index >= 0; index--) {
			const entry = entries[index];
			if (entry.type !== "custom" || entry.customType !== STATE_ENTRY_TYPE) continue;

			const state = entry.data as { enabled?: unknown };
			if (typeof state.enabled === "boolean") enabled = state.enabled;
			break;
		}
	});

	pi.registerCommand("command-denylist", {
		description: "Manage deny list for this session: /command-denylist [enable|disable|status]",
		getArgumentCompletions: (prefix) => {
			const actions = ["enable", "disable", "status"];
			const matches = actions.filter((action) => action.startsWith(prefix));
			return matches.length > 0 ? matches.map((action) => ({ value: action, label: action })) : null;
		},
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase() || "status";
			if (action === "status") {
				ctx.ui.notify(`Command deny list is ${enabled ? "enabled" : "disabled"} for this session.`, "info");
				return;
			}

			if (action !== "enable" && action !== "disable") {
				ctx.ui.notify("Usage: /command-denylist [enable|disable|status]", "warning");
				return;
			}

			enabled = action === "enable";
			pi.appendEntry(STATE_ENTRY_TYPE, { enabled });
			log({ event: enabled ? "enabled" : "disabled", session: ctx.sessionManager.getSessionId() });
			ctx.ui.notify(
				`Command deny list ${enabled ? "enabled" : "disabled"} for this session.`,
				enabled ? "info" : "warning",
			);
		},
	});

	pi.registerTool({
		name: "request_command_approval",
		label: "Request Command Approval",
		description:
			"Request one-off user permission to run a bash command blocked by the deny list. " +
			"On approval, the command is executed and its output returned.",
		parameters: APPROVAL_PARAMS,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			if (!ctx.hasUI) {
				log({ event: "approval-unavailable", command: params.command, reason: params.reason });
				return {
					content: [{ type: "text", text: "Denied: no UI available for user approval." }],
					details: {},
				};
			}

			const approved = await ctx.ui.confirm(
				"Blocked command approval request",
				`Command:\n  ${params.command}\n\nAgent reason:\n  ${params.reason}\n\nAllow one execution?`,
			);

			if (!approved) {
				log({ event: "approval-denied", command: params.command, reason: params.reason });
				return {
					content: [{ type: "text", text: "User denied permission. Do not retry this command." }],
					details: {},
				};
			}

			log({ event: "approval-granted", command: params.command, reason: params.reason });
			return bashTool.execute(toolCallId, { command: params.command }, signal, onUpdate);
		},
	});

	pi.on("tool_call", async (event) => {
		if (!enabled || !isToolCallEventType("bash", event)) return undefined;
		const command = event.input.command;

		const rule = DENY_RULES.find((r) => r.pattern.test(command));
		if (rule) {
			log({ event: "blocked", command, pattern: rule.pattern.source });
			return {
				block: true,
				reason:
					`Command blocked by deny list (${rule.pattern.source}).\n` +
					`${rule.explanation} ${rule.alternative}\n` +
					"If this exact command is truly required, call the request_command_approval tool " +
					"with the command and a justification to ask the user for one-off permission.",
			};
		}

		const suspicious = SUSPICIOUS_PATTERNS.filter((s) => s.pattern.test(command));
		if (suspicious.length > 0) {
			log({ event: "suspicious", command, labels: suspicious.map((s) => s.label) });
		}

		return undefined;
	});
}
