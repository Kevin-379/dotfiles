import assert from "node:assert/strict";
import test from "node:test";

import register from "../extensions/uber-genai.js";

function setup() {
	const models = new Map();
	const aliases = new Map();
	const handlers = new Map();
	register({
		on(event, handler) {
			handlers.set(event, handler);
		},
		registerProvider(provider, config) {
			for (const model of config.models) {
				models.set(`${provider}/${model.id}`, {
					provider,
					id: model.id,
					api: model.api,
				});
			}
		},
		registerVirtualModel(model) {
			aliases.set(`${model.provider}/${model.id}`, model);
		},
	});
	const modelRegistry = {
		find(provider, id) {
			return models.get(`${provider}/${id}`);
		},
	};
	return { aliases, handlers, modelRegistry, models };
}

test("model aliases route to registered physical models and preserve thinking levels", () => {
	const { aliases, modelRegistry } = setup();
	assert.deepEqual(
		[...aliases.keys()],
		["openai/sol", "openai/luna", "anthropic/opus", "router/coding"],
	);
	for (const [alias, model] of [
		["openai/sol", { provider: "openai", id: "gpt-6.1-sol", api: "openai-responses" }],
		["openai/luna", { provider: "openai", id: "gpt-6-luna", api: "openai-responses" }],
		["anthropic/opus", { provider: "anthropic", id: "claude-opus-5-5", api: "anthropic-messages" }],
		["router/coding", { provider: "openai", id: "gpt-6.1-sol", api: "openai-responses" }],
	] as const) {
		const definition = aliases.get(alias);
		assert.deepEqual(
			definition.thinkingLevels,
			["off", "minimal", "low", "medium", "high", "xhigh", "max"],
		);
		for (const reason of ["user", "continuation", "retry", "direct"]) {
			assert.deepEqual(
				definition.route({ thinkingLevel: "medium", reason }, { modelRegistry }),
				{ model, thinkingLevel: "medium" },
			);
		}
	}
});

test("model aliases reject missing targets", () => {
	const { aliases, modelRegistry, models } = setup();
	models.delete("openai/gpt-6.1-sol");
	assert.throws(
		() => aliases.get("router/coding").route({ thinkingLevel: "high" }, { modelRegistry }),
		{ message: "Alias router/coding: model openai/gpt-6.1-sol not found" },
	);
});

test("web search hooks handle virtual selections and physical models", () => {
	const { aliases, handlers, modelRegistry, models } = setup();
	const selections = [
		...[...aliases.values()].map(({ provider, id }) => ({ provider, id, api: "pi-virtual" })),
		...models.values(),
	];
	for (const model of selections) {
		const ctx = { model, modelRegistry };
		const anthropic = model.provider === "anthropic";
		assert.deepEqual(
			handlers.get("before_provider_request")({ payload: { model: "physical-model" } }, ctx),
			anthropic
				? {
					model: "physical-model",
					tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
				}
				: {
					model: "physical-model",
					tools: [{ type: "web_search" }],
					include: ["web_search_call.action.sources"],
				},
		);
		assert.match(
			handlers.get("before_agent_start")({ systemPrompt: "Original prompt" }, ctx).systemPrompt,
			/^Original prompt\n\n## Web Search\n/,
		);
	}
	assert.equal(
		handlers.get("before_provider_request")(
			{ payload: {} },
			{ model: { provider: "other", id: "other", api: "other" } },
		),
		undefined,
	);
});
