import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "git-ahead-behind";
const REFRESH_THROTTLE_MS = 60_000;
const GIT_TIMEOUT_MS = 2_000;

export interface GitRefStatus {
	branch: string;
	ahead: number;
	behind: number;
}

export async function readGitRefStatus(cwd: string): Promise<GitRefStatus | undefined> {
	let dir = resolve(cwd);
	for (;;) {
		const gitPath = join(dir, ".git");
		let head: string | undefined;
		try {
			head = await readFile(join(gitPath, "HEAD"), "utf8");
		} catch {
			try {
				const pointer = (await readFile(gitPath, "utf8")).trim();
				if (pointer.startsWith("gitdir: ")) {
					head = await readFile(join(resolve(dir, pointer.slice(8)), "HEAD"), "utf8");
				}
			} catch {}
		}

		if (head !== undefined) {
			const content = head.trim();
			const branch = content.startsWith("ref: refs/heads/")
				? content.slice("ref: refs/heads/".length)
				: /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(content)
					? `detached@${content.slice(0, 7)}`
					: undefined;
			return branch ? { branch, ahead: 0, behind: 0 } : undefined;
		}

		const parent = dirname(dir);
		if (parent === dir) return;
		dir = parent;
	}
}

export function queryGitAheadBehind(
	cwd: string,
	signal: AbortSignal,
): Promise<Pick<GitRefStatus, "ahead" | "behind"> | undefined> {
	if (signal.aborted) return Promise.resolve(undefined);

	return new Promise((resolveResult) => {
		const child = spawn(
			"git",
			["rev-list", "--left-right", "--count", "HEAD...@{u}"],
			{
				cwd,
				detached: process.platform !== "win32",
				stdio: ["ignore", "pipe", "ignore"],
				env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
			},
		);
		let output = "";
		let settled = false;
		const finish = (result?: Pick<GitRefStatus, "ahead" | "behind">) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			signal.removeEventListener("abort", cancel);
			child.stdout?.destroy();
			resolveResult(result);
		};
		const cancel = () => {
			// Kill the process group: Git wrappers can trap SIGTERM and leave Git running.
			try {
				if (process.platform !== "win32" && child.pid) {
					process.kill(-child.pid, "SIGKILL");
				} else {
					child.kill("SIGKILL");
				}
			} catch {}
			finish();
		};
		const timeout = setTimeout(cancel, GIT_TIMEOUT_MS);
		signal.addEventListener("abort", cancel, { once: true });
		child.stdout?.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.on("error", () => finish());
		child.on("close", (code) => {
			const match = output.trim().match(/^(\d+)\s+(\d+)$/);
			if (code !== 0 || !match) return finish();
			const ahead = Number(match[1]);
			const behind = Number(match[2]);
			finish(Number.isSafeInteger(ahead) && Number.isSafeInteger(behind) ? { ahead, behind } : undefined);
		});
	});
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
	let controller: AbortController | undefined;
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
		controller = new AbortController();
		try {
			const status = await readGitRefStatus(cwd);
			if (generation !== refreshGeneration || ctx.cwd !== cwd) return;
			ctx.ui.setStatus(STATUS_KEY, status ? formatGitRefStatus(ctx.ui.theme, status) : undefined);
			if (!status) return;

			const counts = await queryGitAheadBehind(cwd, controller.signal);
			if (generation !== refreshGeneration || ctx.cwd !== cwd || !counts) return;
			ctx.ui.setStatus(STATUS_KEY, formatGitRefStatus(ctx.ui.theme, { ...status, ...counts }));
		} catch {
			if (generation === refreshGeneration && ctx.cwd === cwd) {
				clear(ctx);
			}
		} finally {
			controller = undefined;
			pending = false;
			const next = queuedRefresh;
			queuedRefresh = undefined;
			if (next) {
				void refresh(next.ctx, next.force);
			}
		}
	};

	pi.on("session_start", (_event, ctx) => {
		generation += 1;
		controller?.abort();
		lastRefreshAt = 0;
		clear(ctx);
		void refresh(ctx, true);
	});

	pi.on("agent_settled", (_event, ctx) => {
		void refresh(ctx);
	});

	pi.on("tool_execution_start", (event) => {
		if (event.toolName === "bash") {
			bashArgsByToolCallId.set(event.toolCallId, event.args);
		}
	});

	pi.on("tool_execution_end", (event, ctx) => {
		const args = bashArgsByToolCallId.get(event.toolCallId);
		bashArgsByToolCallId.delete(event.toolCallId);

		if (event.toolName !== "bash" || event.isError || !isLikelyGitRefChangeCommand(args)) return;
		void refresh(ctx, true);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		generation += 1;
		controller?.abort();
		queuedRefresh = undefined;
		bashArgsByToolCallId.clear();
		clear(ctx);
	});
}
