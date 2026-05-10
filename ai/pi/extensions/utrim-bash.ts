/**
 * utrim-bash integration for pi.
 *
 * Routes pi's bash tool through `utrim-bash hook`, which inspects the
 * command and (for known large-output commands like `gh pr view`,
 * `git log -p`, `bazel build`, `kubectl logs`, etc.) rewrites it to
 * pipe through `utrim-bash filter <kind>`.
 *
 * Set UTRIM_DISABLED=1 to bypass — utrim-bash itself short-circuits.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "child_process";

const UTRIM_BIN = "utrim-bash";
const HOOK_TIMEOUT_MS = 5000;

function rewriteCommand(command: string): string {
	const result = spawnSync(UTRIM_BIN, ["hook"], {
		input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
		encoding: "utf8",
		timeout: HOOK_TIMEOUT_MS,
	});

	if (result.error || result.status !== 0) return command;

	const stdout = (result.stdout ?? "").trim();
	if (!stdout) return command;

	try {
		const rewritten = JSON.parse(stdout)?.hookSpecificOutput?.updatedInput?.command;
		return typeof rewritten === "string" && rewritten.length > 0 ? rewritten : command;
	} catch {
		return command;
	}
}

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	const bashTool = createBashTool(cwd, {
		spawnHook: ({ command, cwd, env }) => ({
			command: rewriteCommand(command),
			cwd,
			env,
		}),
	});

	pi.registerTool({
		...bashTool,
		execute: async (id, params, signal, onUpdate, _ctx) => {
			return bashTool.execute(id, params, signal, onUpdate);
		},
	});
}
