import { spawn } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "aifx-pool";
const ERROR_RATIO = 0.8;
const TIMEOUT_MS = 4_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

interface PoolSpendStatus {
	poolSpendUsd: number;
	capUsd: number;
}

function parsePoolSpendStatus(value: unknown): PoolSpendStatus | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return;

	const result = value as Record<string, unknown>;
	if (
		result.available !== true
		|| typeof result.pool_spend_usd !== "number"
		|| !Number.isFinite(result.pool_spend_usd)
		|| result.pool_spend_usd < 0
		|| typeof result.cap_usd !== "number"
		|| !Number.isFinite(result.cap_usd)
		|| result.cap_usd <= 0
	) return;

	return {
		poolSpendUsd: result.pool_spend_usd,
		capUsd: result.cap_usd,
	};
}

function fetchPoolSpend(): Promise<PoolSpendStatus | undefined> {
	return new Promise((resolve) => {
		let settled = false;
		let output = "";
		let outputBytes = 0;
		let timeout: ReturnType<typeof setTimeout> | undefined;

		const finish = (status?: PoolSpendStatus) => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			resolve(status);
		};

		let child;
		try {
			child = spawn("aifx", ["statusline", "show", "--agent", "pool"], {
				stdio: ["ignore", "pipe", "ignore"],
			});
		} catch {
			finish();
			return;
		}

		child.stdout?.on("data", (chunk: Buffer) => {
			outputBytes += chunk.length;
			if (outputBytes > MAX_OUTPUT_BYTES) {
				child.kill();
				finish();
				return;
			}
			output += chunk.toString();
		});

		child.on("error", () => finish());
		child.on("close", (code) => {
			if (code !== 0) return finish();
			try {
				finish(parsePoolSpendStatus(JSON.parse(output)));
			} catch {
				finish();
			}
		});

		timeout = setTimeout(() => {
			child.kill();
			finish();
		}, TIMEOUT_MS);
	});
}

function formatPoolSpend(ctx: ExtensionContext, status: PoolSpendStatus): string {
	const value = `$${Math.round(status.poolSpendUsd)} / $${Math.round(status.capUsd)}`;
	const color = status.poolSpendUsd / status.capUsd >= ERROR_RATIO ? "error" : "success";
	return ctx.ui.theme.fg(color, value);
}

export default function (pi: ExtensionAPI) {
	let pending = false;

	const refresh = async (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui" || pending) return;

		pending = true;
		try {
			const status = await fetchPoolSpend();
			ctx.ui.setStatus(STATUS_KEY, undefined);
			if (status) {
				// Statuses render in insertion order. Reinsert after tokenSpeed.
				ctx.ui.setStatus(STATUS_KEY, formatPoolSpend(ctx, status));
			}
		} finally {
			pending = false;
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		await refresh(ctx);
	});

	pi.on("agent_settled", async (_event, ctx) => {
		await refresh(ctx);
	});
}
