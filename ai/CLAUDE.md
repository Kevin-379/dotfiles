## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. MCP Usage

**Use engwiki, t3 and omni-mcp mcps. omni-mcp has all other MCP tool calls.**

omni-mcp proxies all 416+ MCP servers at Uber. Instead of calling server-specific tools directly, route through omni-mcp's three tools:

1. **`discover_tools`** — List all available tools on a specific MCP server.
   - Input: `{ "server_name": "<server>" }`
   - Returns: Array of `{ server, tool_name, description }`.

2. **`get_tool_schema`** — Get the full input schema for a specific tool.
   - Use when: You need to know exact parameter names, types, and required fields before calling a tool.
   - Input: `{ "server_name": "<server>", "tool_name": "<tool>" }`
   - Returns: JSON Schema for the tool's input parameters.

3. **`invoke_tool`** — Execute a tool on any server.
   - Use when: You're ready to call a tool with the correct arguments.
   - Input: `{ "server": "<server>", "tool": "<tool>", "arguments": { ... } }`
   - Returns: The tool's response.

**Workflow:**
```
IF you know the server, tool name, AND required arguments:
  → Call invoke_tool directly. No need to discover or inspect.

IF you know the server but not the exact tool name:
  → Call discover_tools(server_name) to list available tools.
  → Then invoke_tool with the correct tool.

IF you know the server and tool but not the exact arguments:
  → Call get_tool_schema(server_name, tool_name) to get the schema.
  → Then invoke_tool with the correct arguments.

IF you don't know which server to use:
  → Use discover_tools or check available server documentation.
  → Then follow the steps above.
```

**Rules:**
- **Skip discover/inspect when you can.** Go straight to `invoke_tool` when you have enough info.
- **Parallelize independent calls.** If you need data from multiple servers, call them all at once.
- **Handle large responses.** Summarize or extract relevant parts rather than dumping everything.
- **Don't guess server or tool names.** Typos in server/tool names will fail silently.
- **Time parameters.** Many tools accept RFC3339 timestamps (e.g., `2026-03-25T10:00:00Z`). Some accept relative offsets (e.g., `"2h"`, `"30m"`). Check the tool schema.

**Do not** call MCP server tools directly (e.g. `mcp__engwiki__confluence_search`). Always go through omni-mcp.

## 6. Coding Style

**Write code that is easy to read and consistent with project conventions.**

- Order struct fields top-down (most significant fields first, matching logical flow).
- Format multi-argument calls, method chains, and nested structs across multiple lines — one argument or field per line.
- Use the Read and Edit tools instead of shell commands like `sed`, `awk`, or `python` for file modifications.

## 7. Testing

**Tests should be clear, minimal, and assert complete state.**

- Assert entire structs, not individual fields — verify the full output in one assertion.
- Hardcode values in unit tests — avoid helper functions or computed expected values that obscure intent.
- Consolidate test cases — don't create separate tests for trivially similar scenarios; use table-driven tests and merge cases where it makes sense.

## 8. Disk / Cache Safety

**Never delete `~/.cache/git-bzl` — it is unrecoverable.**

- `~/.cache/git-bzl` is the sole source of truth for git-bzl; deletion is permanent and unrecoverable.
- Safe caches to clear (will rebuild): `~/.cache/bazel`, `~/.cache/ulsp`, `~/.cache/pkgdrv`, `~/.cache/gopls`.

## 9. Git Rules

1. **NEVER create a git worktree** without explicit user approval.
2. **NEVER create a PR** (via `arh publish`, `gh pr create`, or any other tool) without explicit user approval.
3. **NEVER post comments on a PR** without explicit user approval.
