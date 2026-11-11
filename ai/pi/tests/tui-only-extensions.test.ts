import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import startupModelExtension from "../extensions/startup-model.ts";
import statuslineExtension from "../extensions/statusline.ts";
import whimsicalExtension from "../extensions/whimsical.ts";

type Handler = (event: any, ctx: ExtensionContext) => unknown;

function setup(extension: (pi: ExtensionAPI) => void) {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, { handler: Handler }>();
	extension({
		on(event: string, handler: Handler) {
			handlers.set(event, handler);
		},
		registerCommand(name: string, command: { handler: Handler }) {
			commands.set(name, command);
		},
		getThinkingLevel() {
			return "medium";
		},
	} as unknown as ExtensionAPI);
	return { handlers, commands };
}

for (const mode of ["rpc", "json", "print"] as const) {
	test(`TUI-only extensions have no effects in ${mode} mode`, async () => {
		const ctx = {
			mode,
			hasUI: mode === "rpc",
			get model() {
				throw new Error("Non-TUI handlers must not access model state");
			},
		} as ExtensionContext;

		for (const extension of [startupModelExtension, statuslineExtension, whimsicalExtension]) {
			const { handlers, commands } = setup(extension);
			for (const [name, handler] of handlers) {
				const result = await handler(
					{ reason: name === "session_shutdown" ? "new" : "startup" },
					ctx,
				);
				assert.equal(result, undefined);
			}
			for (const { handler } of commands.values()) {
				assert.equal(await handler("clear", ctx), undefined);
			}
		}
	});
}

test("TUI-only extensions retain terminal behavior", async (t) => {
	t.mock.method(Math, "random", () => 0);
	const effects: unknown[] = [];
	const ctx = {
		mode: "tui",
		hasUI: true,
		model: { provider: "test", id: "model" },
		ui: {
			setFooter(factory: unknown) {
				effects.push({ footer: typeof factory });
			},
			setWorkingMessage(message?: string) {
				effects.push({ message });
			},
			notify(message: string, level: string) {
				effects.push({ notification: message, level });
			},
		},
	} as unknown as ExtensionContext;
	const runtimeKey = "__piStartupModelRuntimeState";
	const runtime = globalThis as typeof globalThis & Record<string, unknown>;
	const previous = runtime[runtimeKey];
	t.after(() => {
		if (previous === undefined) delete runtime[runtimeKey];
		else runtime[runtimeKey] = previous;
	});
	delete runtime[runtimeKey];

	const startup = setup(startupModelExtension);
	await startup.handlers.get("session_start")!({ reason: "reload" }, ctx);
	await startup.handlers.get("session_shutdown")!({ reason: "new" }, ctx);
	await startup.commands.get("startup-model")!.handler("--help", ctx);
	assert.deepEqual(runtime[runtimeKey], {
		pendingNewSessionModel: {
			model: "test/model",
			thinkingLevel: "medium",
		},
	});

	await setup(statuslineExtension).handlers.get("session_start")!({}, ctx);
	const whimsical = setup(whimsicalExtension);
	await whimsical.handlers.get("turn_start")!({}, ctx);
	await whimsical.handlers.get("turn_end")!({}, ctx);
	assert.deepEqual(effects, [
		{
			notification: "Usage: /startup-model [show|clear] [--global|--project] (default: --global)",
			level: "info",
		},
		{ footer: "function" },
		{ message: "Schlepping..." },
		{ message: undefined },
	]);
});
