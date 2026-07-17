import assert from "node:assert/strict";
import test from "node:test";

import {
	formatGitRefStatus,
	isLikelyGitRefChangeCommand,
	parseGitRefStatus,
} from "../extensions/git-ahead-behind-status.ts";

const theme = {
	fg(color: string, text: string): string {
		return `<${color}>${text}</${color}>`;
	},
};

test("parseGitRefStatus parses branch divergence", () => {
	assert.deepEqual(
		parseGitRefStatus([
			"# branch.oid 54819eeb52de1dc4772dc59985fce699083dddc6",
			"# branch.head personal",
			"# branch.upstream origin/personal",
			"# branch.ab +8 -14",
		].join("\n")),
		{ branch: "personal", ahead: 8, behind: 14 },
	);
});

test("parseGitRefStatus keeps a clean branch without an upstream", () => {
	assert.deepEqual(
		parseGitRefStatus([
			"# branch.oid 54819eeb52de1dc4772dc59985fce699083dddc6",
			"# branch.head personal",
		].join("\n")),
		{ branch: "personal", ahead: 0, behind: 0 },
	);
});

test("parseGitRefStatus identifies detached HEAD", () => {
	assert.deepEqual(
		parseGitRefStatus([
			"# branch.oid 54819eeb52de1dc4772dc59985fce699083dddc6",
			"# branch.head (detached)",
		].join("\n")),
		{ branch: "detached@54819ee", ahead: 0, behind: 0 },
	);
});

test("parseGitRefStatus rejects output without a branch", () => {
	assert.equal(parseGitRefStatus("# branch.oid (initial)"), undefined);
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
