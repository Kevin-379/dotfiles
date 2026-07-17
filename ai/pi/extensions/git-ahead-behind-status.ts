import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "git-ahead-behind";
const REFRESH_THROTTLE_MS = 60_000;
const GIT_TIMEOUT_MS = 4_000;

export interface GitRefStatus {
	branch: string;
	ahead: number;
	behind: number;
}

export function parseGitRefStatus(output: string): GitRefStatus | undefined {
	let branch: string | undefined;
	let oid: string | undefined;
	let ahead = 0;
	let behind = 0;

	for (const line of output.split("\n")) {
		if (line.startsWith("# branch.head ")) {
			branch = line.slice("# branch.head ".length);
		} else if (line.startsWith("# branch.oid ")) {
			oid = line.slice("# branch.oid ".length);
		} else if (line.startsWith("# branch.ab ")) {
			const match = line.slice("# branch.ab ".length).match(/^\+(\d+) -(\d+)$/);
			if (!match) continue;

			ahead = Number(match[1]);
			behind = Number(match[2]);
			if (!Number.isSafeInteger(ahead) || !Number.isSafeInteger(behind)) return;
		}
	}

	if (!branch) return;
	if (branch === "(detached)") {
		branch = oid && oid !== "(initial)" ? `detached@${oid.slice(0, 7)}` : "detached";
	}

	return { branch, ahead, behind };
}

export function formatGitRefStatus(
	theme: Pick<ExtensionContext["ui"]["theme"], "fg">,
	status: GitRefStatus,
): string {
	const parts = [theme.fg("muted", `(${status.branch}`)];
	if (status.ahead > 0) {
		parts.push(theme.fg("warning", `↑${status.ahead}`));
	}
	if (status.behind > 0) {
		parts.push(theme.fg("error", `↓${status.behind}`));
	}
	return `${parts.join(" ")}${theme.fg("muted", ")")}`;
}

export function isLikelyGitRefChangeCommand(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;

	const command = (value as Record<string, unknown>).command;
	if (typeof command !== "string") return false;

	return /\bgit(?:\s+(?:-C|-c|--git-dir|--work-tree|--namespace|--config-env)\s+\S+|\s+--\S+|\s+-\S+)*\s+(?:am|branch|checkout|cherry-pick|commit|fetch|merge|pull|push|rebase|remote|reset|revert|switch|tag|update-ref|worktree)\b/.test(command);
}

export default function (pi: ExtensionAPI) {
	let generation = 0;
	let pending = false;
	const bashArgsByToolCallId = new Map<string, unknown>();
	let queuedRefresh: { ctx: ExtensionContext; force: boolean } | undefined;
	let lastRefreshAt = 0;

	const clear = (ctx: ExtensionContext) => {
		if (ctx.mode === "tui") {
			ctx.ui.setStatus(STATUS_KEY, undefined);
		}
	};

	const refresh = async (ctx: ExtensionContext, force = false) => {
		if (ctx.mode !== "tui") return;

		if (pending) {
			queuedRefresh = { ctx, force: force || queuedRefresh?.force === true };
			return;
		}

		const now = Date.now();
		if (!force && now - lastRefreshAt < REFRESH_THROTTLE_MS) return;

		pending = true;
		lastRefreshAt = now;
		const refreshGeneration = generation;
		const cwd = ctx.cwd;
		try {
			const result = await pi.exec(
				"git",
				[
					"--no-optional-locks",
					"-c",
					"credential.interactive=false",
					"status",
					"--porcelain=v2",
					"--branch",
				],
				{ cwd, timeout: GIT_TIMEOUT_MS },
			);
			if (generation !== refreshGeneration || ctx.cwd !== cwd) return;

			const status = result.code === 0 ? parseGitRefStatus(result.stdout) : undefined;
			ctx.ui.setStatus(STATUS_KEY, status ? formatGitRefStatus(ctx.ui.theme, status) : undefined);
		} catch {
			if (generation === refreshGeneration && ctx.cwd === cwd) {
				clear(ctx);
			}
		} finally {
			pending = false;
			const next = queuedRefresh;
			queuedRefresh = undefined;
			if (next) {
				void refresh(next.ctx, next.force);
			}
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		generation += 1;
		lastRefreshAt = 0;
		clear(ctx);
		await refresh(ctx, true);
	});

	pi.on("agent_settled", async (_event, ctx) => {
		await refresh(ctx);
	});

	pi.on("tool_execution_start", (event) => {
		if (event.toolName === "bash") {
			bashArgsByToolCallId.set(event.toolCallId, event.args);
		}
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		const args = bashArgsByToolCallId.get(event.toolCallId);
		bashArgsByToolCallId.delete(event.toolCallId);

		if (event.toolName !== "bash" || event.isError || !isLikelyGitRefChangeCommand(args)) return;
		await refresh(ctx, true);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		generation += 1;
		queuedRefresh = undefined;
		bashArgsByToolCallId.clear();
		clear(ctx);
	});
}
