---
name: mcp-usage
description: Use when calling MCP tools, discovering MCP servers, inspecting schemas, or deciding which MCP workflow to use.
---

# MCP Usage

Choose MCP workflow by domain:

- **T3 / Jira:** See `~/agent-marketplace/claude-code/plugins/core/dev-workflow/jira-tools`.
- **EngWiki / Atlassian / Confluence:** See `~/agent-marketplace/claude-code/plugins/domain/saas-skills/engwiki-skills`.
- **All others:** See `~/agent-marketplace/claude-code/plugins/core/dev-workflow/code-mode`.
- For google related fetching, see `~/agent-marketplace/claude-code/plugins/core/productivity/google-workspace/`.

Use `aifx mcp` commands for discovery and calls:

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
