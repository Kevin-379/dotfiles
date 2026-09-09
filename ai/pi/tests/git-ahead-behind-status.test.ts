import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test, { type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import gitStatusExtension, {
	formatGitRefStatus,
	isLikelyGitRefChangeCommand,
	queryGitAheadBehind,
	readGitRefStatus,
} from "../extensions/git-ahead-behind-status.ts";

const theme = {
	fg(color: string, text: string): string {
		return `<${color}>${text}</${color}>`;
	},
};

async function temporaryDirectory(t: TestContext): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-git-status-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	return dir;
}

async function writeHEAD(dir: string, head: string): Promise<void> {
	await mkdir(join(dir, ".git"), { recursive: true });
	await writeFile(join(dir, ".git", "HEAD"), head);
}

async function fakeGit(t: TestContext, script: string): Promise<string> {
	const dir = await temporaryDirectory(t);
	await writeFile(join(dir, "git"), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
	const previous = process.env.PATH;
	process.env.PATH = `${dir}:${previous}`;
	t.after(() => { process.env.PATH = previous; });
	return dir;
}

function git(dir: string, ...args: string[]): void {
	execFileSync(
		"/usr/bin/git",
		[
			"-C", dir,
			"-c", "core.hooksPath=/dev/null",
			"-c", "commit.gpgsign=false",
			"-c", "user.name=Test",
			"-c", "user.email=test@example.invalid",
			...args,
		],
		{ stdio: "ignore", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } },
	);
}

async function waitUntil(predicate: () => boolean | Promise<boolean>): Promise<void> {
	const deadline = Date.now() + 1_500;
	while (!(await predicate())) {
		assert.ok(Date.now() < deadline, "condition did not become true");
		await delay(10);
	}
}

function harness(cwd: string) {
	const handlers = new Map<string, (...args: any[]) => unknown>();
	const statuses: Array<{ key: string; value: string | undefined }> = [];
	gitStatusExtension({
		on(event: string, handler: (...args: any[]) => unknown) {
			handlers.set(event, handler);
		},
	} as unknown as ExtensionAPI);
	const ctx = {
		cwd,
		mode: "tui",
		ui: {
			theme,
			setStatus(key: string, value: string | undefined) {
				statuses.push({ key, value });
			},
		},
	} as unknown as ExtensionContext;
	return {
		statuses,
		ctx,
		emit(event: string, data = {}) {
			return handlers.get(event)?.(data, ctx);
		},
	};
}

test("readGitRefStatus reads branch from an ancestor HEAD without an upstream", async (t) => {
	const dir = await temporaryDirectory(t);
	await writeHEAD(dir, "ref: refs/heads/user/feature-x\n");
	const nested = join(dir, "src", "package");
	await mkdir(nested, { recursive: true });
	assert.deepEqual(
		await readGitRefStatus(nested),
		{ branch: "user/feature-x", ahead: 0, behind: 0 },
	);
});

test("readGitRefStatus identifies detached HEAD", async (t) => {
	const dir = await temporaryDirectory(t);
	await writeHEAD(dir, "54819eeb52de1dc4772dc59985fce699083dddc6\n");
	assert.deepEqual(
		await readGitRefStatus(dir),
		{ branch: "detached@54819ee", ahead: 0, behind: 0 },
	);
});

test("readGitRefStatus handles missing and malformed HEAD", async (t) => {
	const dir = await temporaryDirectory(t);
	assert.equal(await readGitRefStatus(dir), undefined);
	await writeHEAD(dir, "not a HEAD\n");
	assert.equal(await readGitRefStatus(dir), undefined);
});

test("readGitRefStatus follows absolute and relative worktree pointers", async (t) => {
	const dir = await temporaryDirectory(t);
	const gitDir = join(dir, "metadata", "worktrees", "feature");
	await mkdir(gitDir, { recursive: true });
	await writeFile(join(gitDir, "HEAD"), "ref: refs/heads/worktree\n");
	for (const pointer of [gitDir, relative(dir, gitDir)]) {
		await writeFile(join(dir, ".git"), `gitdir: ${pointer}\n`);
		assert.deepEqual(
			await readGitRefStatus(dir),
			{ branch: "worktree", ahead: 0, behind: 0 },
		);
	}
});

test("formatGitRefStatus keeps branch and arrows inside one pair of parentheses", () => {
	assert.equal(
		formatGitRefStatus(theme, { branch: "personal", ahead: 8, behind: 14 }),
		"<muted>(personal</muted> <warning>↑8</warning> <error>↓14</error><muted>)</muted>",
	);
	assert.equal(
		formatGitRefStatus(theme, { branch: "personal", ahead: 0, behind: 0 }),
		"<muted>(personal</muted><muted>)</muted>",
	);
});

test("isLikelyGitRefChangeCommand detects ref-changing Git commands", () => {
	assert.equal(isLikelyGitRefChangeCommand({ command: "git pull --rebase" }), true);
	assert.equal(isLikelyGitRefChangeCommand({ command: "git status" }), false);
	assert.equal(isLikelyGitRefChangeCommand({ command: "npm test" }), false);
});

test("queryGitAheadBehind handles absent upstream, divergence, and detached HEAD", async (t) => {
	await fakeGit(t, 'exec /usr/bin/git "$@"');
	const dir = await temporaryDirectory(t);
	const signal = new AbortController().signal;
	git(dir, "init", "-b", "main");
	assert.equal(await queryGitAheadBehind(dir, signal), undefined);
	git(dir, "commit", "--allow-empty", "-m", "initial");
	assert.equal(await queryGitAheadBehind(dir, signal), undefined);
	git(dir, "branch", "upstream");
	git(dir, "branch", "--set-upstream-to=upstream");
	assert.deepEqual(await queryGitAheadBehind(dir, signal), { ahead: 0, behind: 0 });
	git(dir, "commit", "--allow-empty", "-m", "local");
	git(dir, "switch", "upstream");
	git(dir, "commit", "--allow-empty", "-m", "upstream one");
	git(dir, "commit", "--allow-empty", "-m", "upstream two");
	git(dir, "switch", "main");
	assert.deepEqual(await queryGitAheadBehind(dir, signal), { ahead: 1, behind: 2 });
	git(dir, "checkout", "--detach");
	assert.equal(await queryGitAheadBehind(dir, signal), undefined);
});

test("queryGitAheadBehind rejects failed or malformed output", async (t) => {
	const dir = await fakeGit(t, "exit 1");
	for (const script of ["printf '8 14'; exit 1", "printf 'invalid'", "printf '9007199254740992 0'"]) {
		await writeFile(join(dir, "git"), `#!/bin/sh\n${script}\n`);
		assert.equal(await queryGitAheadBehind(dir, new AbortController().signal), undefined);
	}
	await rm(join(dir, "git"));
	process.env.PATH = dir;
	assert.equal(await queryGitAheadBehind(dir, new AbortController().signal), undefined);
});

test("queryGitAheadBehind deadline kills a TERM-ignoring wrapper and descendant", async (t) => {
	const dir = await fakeGit(t, "trap '' TERM\nsleep 30 &\necho $! > child.pid\necho $$ > wrapper.pid\nwait");
	const started = performance.now();
	assert.equal(await queryGitAheadBehind(dir, new AbortController().signal), undefined);
	assert.ok(performance.now() - started < 3_500, "deadline did not bound the wait");
	for (const file of ["wrapper.pid", "child.pid"]) {
		const pid = (await readFile(join(dir, file), "utf8")).trim();
		await waitUntil(async () => {
			try {
				const stat = await readFile(`/proc/${pid}/stat`, "utf8");
				return stat.split(") ")[1].startsWith("Z ");
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
				throw error;
			}
		});
	}
	const controller = new AbortController();
	controller.abort();
	assert.equal(await queryGitAheadBehind(dir, controller.signal), undefined);
});

test("startup shows branch before counts, throttles, and refreshes after Git commands", async (t) => {
	const dir = await fakeGit(t, 'printf "%s\\n" "$*" >> calls\nsleep 0.1\nprintf "8\\t14\\n"');
	await writeHEAD(dir, "ref: refs/heads/personal\n");
	const runtime = harness(dir);
	t.after(() => runtime.emit("session_shutdown"));
	assert.equal(runtime.emit("session_start"), undefined);
	await waitUntil(() => runtime.statuses.length === 2);
	assert.deepEqual(runtime.statuses, [
		{ key: "git-ahead-behind", value: undefined },
		{ key: "git-ahead-behind", value: "<muted>(personal</muted><muted>)</muted>" },
	]);
	await waitUntil(() => runtime.statuses.length === 3);
	assert.deepEqual(runtime.statuses[2], {
		key: "git-ahead-behind",
		value: "<muted>(personal</muted> <warning>↑8</warning> <error>↓14</error><muted>)</muted>",
	});
	assert.equal(runtime.emit("agent_settled"), undefined);
	await delay(30);
	assert.equal(runtime.statuses.length, 3);
	await writeHEAD(dir, "ref: refs/heads/updated\n");
	runtime.emit("tool_execution_start", { toolName: "bash", toolCallId: "change", args: { command: "git switch updated" } });
	assert.equal(runtime.emit("tool_execution_end", { toolName: "bash", toolCallId: "change", isError: false }), undefined);
	await waitUntil(() => runtime.statuses.length === 5);
	assert.deepEqual(runtime.statuses[4], {
		key: "git-ahead-behind",
		value: "<muted>(updated</muted> <warning>↑8</warning> <error>↓14</error><muted>)</muted>",
	});
	assert.equal(
		await readFile(join(dir, "calls"), "utf8"),
		"rev-list --left-right --count HEAD...@{u}\nrev-list --left-right --count HEAD...@{u}\n",
	);
});

test("session shutdown cancels counts and prevents stale updates after restart", async (t) => {
	const dir = await fakeGit(t, 'trap "" TERM\necho started > started\nsleep 30\nprintf "8 14"');
	await writeHEAD(dir, "ref: refs/heads/old\n");
	const runtime = harness(dir);
	t.after(() => runtime.emit("session_shutdown"));
	runtime.emit("session_start");
	await waitUntil(async () => {
		try { return (await readFile(join(dir, "started"), "utf8")) === "started\n"; }
		catch { return false; }
	});
	const started = performance.now();
	runtime.emit("session_shutdown");
	await writeFile(join(dir, "git"), "#!/bin/sh\nprintf '1 2'\n");
	await writeHEAD(dir, "ref: refs/heads/new\n");
	runtime.emit("session_start");
	await waitUntil(() => runtime.statuses.at(-1)?.value?.includes("↑1") === true);
	assert.ok(performance.now() - started < 1_500, "shutdown did not cancel the pending query");
	assert.deepEqual(runtime.statuses.slice(2), [
		{ key: "git-ahead-behind", value: undefined },
		{ key: "git-ahead-behind", value: undefined },
		{ key: "git-ahead-behind", value: "<muted>(new</muted><muted>)</muted>" },
		{ key: "git-ahead-behind", value: "<muted>(new</muted> <warning>↑1</warning> <error>↓2</error><muted>)</muted>" },
	]);
});
