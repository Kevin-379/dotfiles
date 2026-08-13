import assert from "node:assert/strict";
import test from "node:test";

import { countTurns, formatTurnCounts } from "../extensions/turn-count-status.ts";

test("countTurns counts active messages", () => {
	assert.deepEqual(
		countTurns([
			{ type: "message", message: { role: "user" } },
			{ type: "message", message: { role: "assistant", stopReason: "stop" } },
			{ type: "message", message: { role: "assistant", stopReason: "error" } },
			{ type: "message", message: { role: "assistant", stopReason: "aborted" } },
		]),
		{ prompts: 1, requests: 1 },
	);
});

test("countTurns includes compaction retained tail", () => {
	assert.deepEqual(
		countTurns([
			{
				type: "compaction",
				retainedTail: [
					{ role: "user" },
					{ role: "assistant", stopReason: "stop" },
				],
			},
			{ type: "message", message: { role: "user" } },
			{ type: "message", message: { role: "assistant", stopReason: "stop" } },
		]),
		{ prompts: 2, requests: 2 },
	);
});

test("formatTurnCounts hides empty count", () => {
	assert.equal(formatTurnCounts({ prompts: 0, requests: 0 }), undefined);
	assert.equal(formatTurnCounts({ prompts: 2, requests: 1 }), "2·1");
});
