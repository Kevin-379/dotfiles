import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "turn-count";

export interface TurnCounts {
	prompts: number;
	requests: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addMessageTurn(counts: TurnCounts, message: unknown): void {
	if (!isRecord(message)) return;

	if (message.role === "user") {
		counts.prompts++;
	} else if (message.role === "assistant") {
		// error/aborted responses are excluded from pi's own cost accounting.
		if (message.stopReason === "error" || message.stopReason === "aborted") return;
		counts.requests++;
	}
}

export function countTurns(entries: unknown[]): TurnCounts {
	const counts = { prompts: 0, requests: 0 };

	for (const entry of entries) {
		if (!isRecord(entry)) continue;

		if (entry.type === "message") {
			addMessageTurn(counts, entry.message);
		} else if (entry.type === "compaction" && Array.isArray(entry.retainedTail)) {
			for (const message of entry.retainedTail) {
				addMessageTurn(counts, message);
			}
		}
	}

	return counts;
}

export function formatTurnCounts(counts: TurnCounts): string | undefined {
	return counts.prompts > 0 || counts.requests > 0 ? `${counts.prompts}·${counts.requests}` : undefined;
}

export default function (pi: ExtensionAPI) {
	const render = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;

		const value = formatTurnCounts(countTurns(ctx.sessionManager.buildContextEntries()));
		ctx.ui.setStatus(STATUS_KEY, value ? ctx.ui.theme.fg("muted", value) : undefined);
	};

	pi.on("session_start", (_event, ctx) => render(ctx));
	pi.on("session_tree", (_event, ctx) => render(ctx));
	pi.on("session_compact", (_event, ctx) => render(ctx));
	pi.on("message_end", (_event, ctx) => render(ctx));
	pi.on("agent_settled", (_event, ctx) => render(ctx));

	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.mode === "tui") {
			ctx.ui.setStatus(STATUS_KEY, undefined);
		}
	});
}
