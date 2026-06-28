---
name: mcp-usage
description: Use when calling MCP tools, discovering MCP servers, inspecting schemas, or deciding between built-in mcp tools and aifx mcp commands.
---

# MCP Usage

Use `mcp({})` for `engwiki` and `t3` only.

- Status: `mcp({ })`
- Search tools: `mcp({ search: "confluence page" })`
- Schema: `mcp({ describe: "engwiki_confluence_search" })`
- Call: `mcp({ tool: "engwiki_confluence_search", args: '{"query":"bazel"}' })`

Use direct `aifx mcp` commands for other Uber MCPs:

```bash
# Search featured MCP servers first; use --all only if needed, it will take a long time to run
aifx mcp search <keyword>
aifx mcp search <keyword> --all

# List servers / tools
aifx mcp list -o json
aifx mcp call <server> --list-tools
aifx mcp call <server> --list-tools --filter <tool-name>

# Inspect schema before unfamiliar calls
aifx mcp call <server> <tool> --schema

# Call tool; save large output to disk
aifx mcp call <server> <tool> --args '<json>' -o <output-file>
aifx mcp call <server> <tool> --args-file <args-file> -o <output-file>
```

## Rules

- Parallelize independent calls.
- Save large outputs with `-o <file>`.
- Do not guess server/tool names.
- Check schema before unfamiliar tools, especially time formats.
- Prefer featured servers; use `--all` only when featured search fails.
