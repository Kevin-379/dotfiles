import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "session-cost";

export interface TaskflowCostSnapshot {
	runId: string;
	cost: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractNativeAssistantCost(message: unknown): number | undefined {
	if (!isRecord(message) || message.role !== "assistant") return;
	if (message.stopReason === "error" || message.stopReason === "aborted") return;
	if (!isRecord(message.usage) || !isRecord(message.usage.cost)) return;

	const cost = message.usage.cost.total;
	return typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : undefined;
}

export function extractTaskflowCostSnapshot(details: unknown): TaskflowCostSnapshot | undefined {
	if (!isRecord(details) || !isRecord(details.state)) return;

	const { runId, phases } = details.state;
	if (typeof runId !== "string" || runId.length === 0 || !isRecord(phases)) return;

	let cost = 0;
	for (const phase of Object.values(phases)) {
		if (!isRecord(phase) || !isRecord(phase.usage)) continue;

		const phaseCost = phase.usage.cost;
		if (typeof phaseCost === "number" && Number.isFinite(phaseCost) && phaseCost >= 0) {
			cost += phaseCost;
			if (!Number.isFinite(cost)) return;
		}
	}

	return { runId, cost };
}

export function extractTaskflowCostSnapshotFromResult(value: unknown): TaskflowCostSnapshot | undefined {
	return extractTaskflowCostSnapshot(isRecord(value) && "details" in value ? value.details : value);
}

export function collectTaskflowCostsFromBranch(entries: unknown[]): Map<string, number> {
	const costs = new Map<string, number>();

	for (const entry of entries) {
		if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;

		const message = entry.message;
		if (message.role !== "toolResult" || message.toolName !== "taskflow") continue;

		const snapshot = extractTaskflowCostSnapshot(message.details);
		if (snapshot) costs.set(snapshot.runId, snapshot.cost);
	}

	return costs;
}

export function sumTaskflowCosts(costs: ReadonlyMap<string, number>): number | undefined {
	let total = 0;
	for (const cost of costs.values()) {
		if (!Number.isFinite(cost) || cost < 0) return;

		total += cost;
		if (!Number.isFinite(total)) return;
	}
	return total;
}

export function combineNativeAndTaskflowCost(
	nativeCost: number | undefined,
	taskflowCosts: ReadonlyMap<string, number>,
): number | undefined {
	if (nativeCost === undefined || !Number.isFinite(nativeCost) || nativeCost < 0) return;

	const taskflowCost = sumTaskflowCosts(taskflowCosts);
	if (taskflowCost === undefined) return;

	const total = nativeCost + taskflowCost;
	return Number.isFinite(total) ? total : undefined;
}

export function formatSessionCost(total: number | undefined): string | undefined {
	return total !== undefined && Number.isFinite(total) && total > 0 ? `$${total.toFixed(2)}` : undefined;
}

export default function (pi: ExtensionAPI) {
	let nativeCost: number | undefined = 0;
	let taskflowCosts = new Map<string, number>();

	const render = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;

		const value = formatSessionCost(combineNativeAndTaskflowCost(nativeCost, taskflowCosts));
		ctx.ui.setStatus(STATUS_KEY, value ? ctx.ui.theme.fg("accent", value) : undefined);
	};

	const restore = (ctx: ExtensionContext) => {
		nativeCost = 0;
		taskflowCosts = new Map();

		for (const entry of ctx.sessionManager.getBranch()) {
			if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;

			const native = extractNativeAssistantCost(entry.message);
			if (native === undefined || nativeCost === undefined) continue;

			nativeCost += native;
			if (!Number.isFinite(nativeCost)) nativeCost = undefined;
		}
		taskflowCosts = collectTaskflowCostsFromBranch(ctx.sessionManager.getBranch());
		render(ctx);
	};

	const applyTaskflowSnapshot = (value: unknown, ctx: ExtensionContext) => {
		const snapshot = extractTaskflowCostSnapshotFromResult(value);
		if (!snapshot) return;

		taskflowCosts.set(snapshot.runId, snapshot.cost);
		render(ctx);
	};

	pi.on("session_start", (_event, ctx) => {
		restore(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		restore(ctx);
	});

	pi.on("message_end", (event, ctx) => {
		const cost = extractNativeAssistantCost(event.message);
		if (cost === undefined) return;

		if (nativeCost !== undefined) {
			nativeCost += cost;
			if (!Number.isFinite(nativeCost)) nativeCost = undefined;
		}
		render(ctx);
	});

	pi.on("tool_execution_update", (event, ctx) => {
		if (event.toolName === "taskflow") {
			applyTaskflowSnapshot(event.partialResult, ctx);
		}
	});

	pi.on("tool_execution_end", (event, ctx) => {
		if (event.toolName === "taskflow") {
			applyTaskflowSnapshot(event.result, ctx);
		}
	});

	pi.on("agent_settled", (_event, ctx) => {
		restore(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		nativeCost = 0;
		taskflowCosts.clear();
		if (ctx.mode === "tui") {
			ctx.ui.setStatus(STATUS_KEY, undefined);
		}
	});
}
