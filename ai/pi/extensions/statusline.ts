import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import * as os from "os";

const YELLOW_PCT = 20;
const ORANGE_PCT = 30;
const RED_PCT = 40;
const BAR_WIDTH = 20;

function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
	if (n >= 1_000) return `${Math.floor(n / 1_000)}k`;
	return `${n}`;
}

function fmtCost(n: number): string {
	return `$${n.toFixed(2)}`;
}

function fmtDuration(ms: number): string {
	const secs = Math.floor(ms / 1000);
	if (secs >= 3600) {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		return m > 0 ? `${h}hr ${m}m` : `${h}hr`;
	}
	if (secs >= 60) {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return s > 0 ? `${m}m ${s}s` : `${m}m`;
	}
	return `${secs}s`;
}

function progressBar(pct: number): string {
	const clamped = Math.min(100, Math.max(0, Math.floor(pct)));
	const filled = Math.round((clamped / 100) * BAR_WIDTH);
	const empty = BAR_WIDTH - filled;
	return `[${"█".repeat(filled)}${"░".repeat(empty)} ${clamped}%]`;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					// --- session token/cost totals from branch messages ---
					// NOTE: token breakdown (i:/o:/~/+) was removed. Cache reads accumulate
					// across all turns (e.g. 500k cached × 15 turns = 7.5m), so session totals
					// can never add up to the current context size shown in the bar.
					// Last-turn breakdown would be coherent but hard to act on mid-session.
					// Cost already signals overspend; a future improvement could emit a
					// one-time notification when cache efficiency drops below a threshold
					// (e.g. cacheRead / (input + cacheRead) < 50% after turn 3).
					let cost = 0;
					let firstTimestamp: number | null = null;

					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							cost += m.usage.cost.total;
							if (firstTimestamp === null) firstTimestamp = m.timestamp;
						}
					}

					// --- context usage (for progress bar) ---
					const ctxUsage = ctx.getContextUsage();
					const pct = ctxUsage?.percent ?? null;
					const totalTok = ctxUsage?.tokens ?? 0;

					// --- token color ---
					const tokColor: "success" | "warning" | "error" | "accent" =
						pct === null ? "accent"
						: pct >= RED_PCT ? "error"
						: pct >= ORANGE_PCT ? "warning"
						: pct >= YELLOW_PCT ? "accent"
						: "success";

					// --- line 1: user@host:dir (branch) | tokens [bar] ---
					const user = process.env["USER"] ?? process.env["UBER_LDAP_UID"] ?? "";
					let host = os.hostname();
					const dotIdx = host.indexOf(".");
					if (dotIdx > 0) host = host.slice(0, dotIdx);
					const userHost = user && host ? `${user}@${host}` : user || host;

					const cwd = process.cwd();
					const home = os.homedir();
					const dir = cwd === home ? "~" : cwd.split("/").at(-1) ?? cwd;

					const branch = footerData.getGitBranch();
					const branchStr = branch ? ` (${branch})` : "";

					const location = theme.fg("success", userHost)
						+ theme.fg("dim", ":")
						+ theme.fg("accent", dir)
						+ theme.fg("muted", branchStr);

					const bar = pct !== null ? ` ${progressBar(pct)}` : "";
					const tokStr = `${fmtTokens(totalTok)}${bar}`;
					const tokenPart = theme.fg(tokColor, tokStr);

					const sep = ` ${theme.fg("dim", "|")} `;
					const line1 = truncateToWidth(location + sep + tokenPart, width);

					// --- line 2: model | cost | duration | ↑in ↓out ~cr +cw ---
					const parts: string[] = [];

					const model = ctx.model?.id;
					if (model) parts.push(theme.fg("warning", model));

					if (cost > 0) parts.push(theme.fg("accent", fmtCost(cost)));

					if (firstTimestamp !== null) {
						const elapsed = Date.now() - firstTimestamp;
						parts.push(theme.fg("muted", fmtDuration(elapsed)));
					}

					const line2 = truncateToWidth(
						parts.join(sep),
						width,
					);

					return [line1, line2];
				},
			};
		});
	});
}
