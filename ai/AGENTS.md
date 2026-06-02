## 0. Communication

- Always use `caveman` skill unless user says `normal mode` or `stop caveman`.
- Keep answers short, direct, concise.
- Prefer terse answers over full explanations; user will ask for clarification when needed.
- Ask questions only when blocked, ambiguity changes outcome, or action is risky.

## 1. Work Style

- Think before coding. State assumptions when needed. Surface tradeoffs.
- If unclear, stop, name confusion, ask.
- Prefer simplest solution. No speculative features, abstractions, config, or impossible-case handling.
- Touch only required lines. No unrelated refactors/cleanup.
- Match existing style.
- Remove only imports/vars/functions made unused by your changes.
- Define success criteria and verify. For multi-step work, give brief plan with checks.

## 2. MCP Usage

Use skill file `~/.agents/skills/mcp-usage/SKILL.md` for MCP rules, discovery, schema inspection, and `aifx mcp` commands.

## 3. Coding Style

- Keep code readable and consistent.
- Order struct fields top-down by significance/logical flow.
- Format multi-arg calls, method chains, nested structs across multiple lines: one arg/field per line.

## 4. Testing

- Tests clear, minimal, complete.
- Assert entire structs, not individual fields.
- Hardcode expected values.

## 5. Disk / Cache Safety

- Never delete `~/.cache/git-bzl`; unrecoverable source of truth.
- Safe to clear: `~/.cache/bazel`, `~/.cache/ulsp`, `~/.cache/pkgdrv`, `~/.cache/gopls`.

## 6. Git Rules

- Never create git worktree without explicit approval.
- Never push without explicit approval.
- Never create PR without explicit approval.
- Never post PR comments without explicit approval.

## 7. Go Rules

- Prefer `bin/coverage /path/to/folder` over `bazel test`.
- Always use `bin/gazelle`, not gazelle.
- Prefer table-driven tests for similar cases.
- Use `assert`; use `require` only to prevent nil-deref/panic.
- Mocks must use `.With` or `.When` and `.Times`.
- Test names: `should_return_<value>_when_<condition>`.
