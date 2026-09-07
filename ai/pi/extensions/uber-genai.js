// Uber MA gateway provider for pi.
//
// Routes Anthropic and OpenAI models through the MA gateway at
// genai-api.uberinternal.com. Patches globalThis.fetch to swap
// x-api-key → Authorization: Bearer for Anthropic requests (the
// gateway rejects x-api-key).
const ORG_ID = "7f16e5ad-3a7c-4a43-93e6-9ed48a74d96e";
const GATEWAY = "https://genai-api.uberinternal.com";
const GATEWAY_V1 = `${GATEWAY}/v1`;
const GATEWAY_HOST = "genai-api.uberinternal.com";
const HEADERS = { "OpenAI-Organization": ORG_ID };
const WEB_SEARCH_SOURCES_INCLUDE = "web_search_call.action.sources";
const ANTHROPIC_WEB_SEARCH_TYPE = "web_search_20250305";
const ANTHROPIC_WEB_SEARCH_MAX_USES = 5;

function isRecord(value) {
	return typeof value === "object" && value !== null;
}

function isUberOpenAiResponses(ctx) {
	return ctx.model?.provider === "openai" && ctx.model?.api === "openai-responses";
}

function isUberAnthropicMessages(ctx) {
	return ctx.model?.provider === "anthropic" && ctx.model?.api === "anthropic-messages";
}

function isNativeOpenAiWebSearchType(value) {
	return value === "web_search" || value === "web_search_preview";
}

function isNativeAnthropicWebSearchType(value) {
	return typeof value === "string" && /^web_search_\d{8}$/.test(value);
}

function sanitizeTools(tools, isNativeWebSearchType) {
	const sanitized = [];
	for (const tool of tools) {
		if (!isRecord(tool)) {
			continue;
		}

		const shouldStripFunctionVariant =
			tool.name === "web_search" && !isNativeWebSearchType(tool.type);
		if (!shouldStripFunctionVariant) {
			sanitized.push(tool);
		}
	}
	return sanitized;
}

function includeWebSearchSources(payload) {
	const payloadInclude = payload.include;
	const include = Array.isArray(payloadInclude)
		? payloadInclude.filter((value) => typeof value === "string")
		: [];
	return include.includes(WEB_SEARCH_SOURCES_INCLUDE)
		? include
		: [...include, WEB_SEARCH_SOURCES_INCLUDE];
}

function addOpenAiWebSearchToPayload(payload) {
	if (!isRecord(payload)) {
		return undefined;
	}

	const tools = Array.isArray(payload.tools) ? payload.tools : [];
	const sanitizedTools = sanitizeTools(tools, isNativeOpenAiWebSearchType);
	const hasNativeWebSearch = sanitizedTools.some((tool) =>
		isNativeOpenAiWebSearchType(tool.type),
	);

	if (!hasNativeWebSearch) {
		sanitizedTools.push({ type: "web_search" });
	}

	return {
		...payload,
		tools: sanitizedTools,
		include: includeWebSearchSources(payload),
	};
}

function addAnthropicWebSearchToPayload(payload) {
	if (!isRecord(payload)) {
		return undefined;
	}

	const tools = Array.isArray(payload.tools) ? payload.tools : [];
	const sanitizedTools = sanitizeTools(tools, isNativeAnthropicWebSearchType);
	const hasNativeWebSearch = sanitizedTools.some((tool) =>
		isNativeAnthropicWebSearchType(tool.type),
	);

	if (!hasNativeWebSearch) {
		sanitizedTools.push({
			type: ANTHROPIC_WEB_SEARCH_TYPE,
			name: "web_search",
			max_uses: ANTHROPIC_WEB_SEARCH_MAX_USES,
		});
	}

	return {
		...payload,
		tools: sanitizedTools,
	};
}

const OPENAI_WEB_SEARCH_SECTION = `
## Web Search

The native web_search tool is available in this session.
Use web_search when the user asks for current or online information.
Prefer web_search over guessing when freshness matters.
When you use web_search, include a concise summary of searches performed in your response.
`;

const _originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: input?.url ?? "";

	let host = "";
	try {
		host = new URL(url).hostname;
	} catch {}
	if (host !== GATEWAY_HOST) {
		return _originalFetch(input, init);
	}

	const headers = new Headers(
		init?.headers || (input instanceof Request ? input.headers : {}),
	);
	if (!headers.has("authorization")) {
		const token = headers.get("x-api-key") || process.env.ANTHROPIC_API_KEY;
		if (token) {
			headers.set("Authorization", `Bearer ${token}`);
		}
	}
	return _originalFetch(input, { ...init, headers });
};

export default function (pi) {
	pi.on("before_provider_request", (event, ctx) => {
		if (isUberOpenAiResponses(ctx)) {
			return addOpenAiWebSearchToPayload(event.payload);
		}
		if (isUberAnthropicMessages(ctx)) {
			return addAnthropicWebSearchToPayload(event.payload);
		}
		return undefined;
	});

	pi.on("before_agent_start", (event, ctx) => {
		if (!isUberOpenAiResponses(ctx) && !isUberAnthropicMessages(ctx)) {
			return undefined;
		}
		return {
			systemPrompt: `${event.systemPrompt}\n${OPENAI_WEB_SEARCH_SECTION}`,
		};
	});

	pi.registerProvider("anthropic", {
		baseUrl: GATEWAY,
		apiKey: "!usso -ussh genai-api -print",
		headers: HEADERS,
		// Claude models are capped at 400k instead of their native 1M: autocompaction
		// fires at contextWindow - reserveTokens, and quality degrades well before 1M.
		models: [
			{
				id: "claude-opus-5",
				name: "Claude Opus 5",
				api: "anthropic-messages",
				reasoning: true,
				compat: {
					forceAdaptiveThinking: true,
				},
				thinkingLevelMap: {
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
				contextWindow: 400000,
				maxTokens: 128000,
			},
			{
				id: "claude-fable-5",
				name: "Claude Fable 5",
				api: "anthropic-messages",
				reasoning: true,
				compat: {
					forceAdaptiveThinking: true,
				},
				thinkingLevelMap: {
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
				contextWindow: 400000,
				maxTokens: 128000,
			},
			{
				id: "claude-fable-5-1",
				name: "Claude Fable 5.1",
				api: "anthropic-messages",
				reasoning: true,
				compat: {
					forceAdaptiveThinking: true,
				},
				thinkingLevelMap: {
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
				contextWindow: 400000,
				maxTokens: 128000,
			},
			{
				id: "claude-sonnet-5",
				name: "Claude Sonnet 5",
				api: "anthropic-messages",
				reasoning: true,
				compat: {
					forceAdaptiveThinking: true,
				},
				thinkingLevelMap: {
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
				contextWindow: 400000,
				maxTokens: 128000,
			},
		],
	});

	pi.registerProvider("fireworks", {
		baseUrl: GATEWAY_V1,
		apiKey: "!usso -ussh genai-api -print",
		headers: HEADERS,
		api: "openai-completions",
		models: [
			{
				id: "kimi-k3",
				name: "Kimi K3",
				reasoning: true,
				thinkingLevelMap: {
					off: "none",
					minimal: "low",
					low: "low",
					medium: "high",
					high: "high",
					xhigh: "max",
					max: "max",
				},
				input: ["text", "image"],
				cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 0 },
				contextWindow: 1048576,
				maxTokens: 131072,
			},
		],
	});

	pi.registerProvider("openai", {
		baseUrl: GATEWAY_V1,
		apiKey: "!usso -ussh genai-api -print",
		headers: HEADERS,
		models: [
			{
				id: "gpt-6-astra",
				name: "GPT-6 Astra",
				api: "openai-responses",
				reasoning: true,
				thinkingLevelMap: {
					off: "none",
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
				contextWindow: 272000,
				maxTokens: 128000,
			},
			{
				id: "gpt-5.6-terra",
				name: "GPT-5.6 Terra",
				api: "openai-responses",
				reasoning: true,
				thinkingLevelMap: {
					off: "none",
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 2.5 },
				contextWindow: 272000,
				maxTokens: 128000,
			},
			{
				id: "gpt-5.6-luna",
				name: "GPT-5.6 Luna",
				api: "openai-responses",
				reasoning: true,
				thinkingLevelMap: {
					off: "none",
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite: 0.25 },
				contextWindow: 272000,
				maxTokens: 128000,
			},
			{
				id: "gpt-5.6-sol",
				name: "GPT-5.6 Sol",
				api: "openai-responses",
				reasoning: true,
				thinkingLevelMap: {
					off: "none",
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 },
				contextWindow: 272000,
				maxTokens: 128000,
			},
		],
	});
}
