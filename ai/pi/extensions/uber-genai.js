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
	pi.registerProvider("anthropic", {
		baseUrl: GATEWAY,
		apiKey: "!usso -ussh genai-api -print",
		headers: HEADERS,
		models: [
			{
				id: "claude-opus-4-6",
				name: "Claude Opus 4.6",
				api: "anthropic-messages",
				reasoning: true,
				thinkingLevelMap: {
					minimal: null,
					xhigh: "max",
				},
				input: ["text", "image"],
				cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
				contextWindow: 1000000,
				maxTokens: 128000,
			},
			{
				id: "claude-opus-4-7",
				name: "Claude Opus 4.7",
				api: "anthropic-messages",
				reasoning: true,
				thinkingLevelMap: {
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
				contextWindow: 1000000,
				maxTokens: 128000,
			},
			{
				id: "claude-sonnet-4-6",
				name: "Claude Sonnet 4.6",
				api: "anthropic-messages",
				reasoning: true,
				thinkingLevelMap: {
					minimal: null,
				},
				input: ["text", "image"],
				cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
				contextWindow: 1000000,
				maxTokens: 64000,
			},
		],
	});

	pi.registerProvider("openai", {
		baseUrl: GATEWAY_V1,
		apiKey: "!usso -ussh genai-api -print",
		headers: HEADERS,
		models: [
			{
				id: "gpt-5.5",
				name: "GPT-5.5",
				api: "openai-responses",
				reasoning: true,
				thinkingLevelMap: {
					off: "none",
					minimal: null,
					xhigh: "xhigh",
				},
				input: ["text", "image"],
				cost: { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 },
				contextWindow: 272000,
				maxTokens: 128000,
			},
			{
				id: "gpt-5.5-pro",
				name: "GPT-5.5 Pro",
				api: "openai-responses",
				reasoning: true,
				input: ["text", "image"],
				cost: { input: 30, output: 180, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 1050000,
				maxTokens: 128000,
			},
		],
	});
}
