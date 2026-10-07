---
name: mcp-usage
description: Use when calling MCP tools, discovering MCP servers, inspecting schemas, or deciding which MCP workflow to use.
---

# MCP Usage

Prefer a matching domain skill before the generic MCP workflow. If the skill identifies the server, inspect that server directly; no discovery needed.

Choose MCP workflow by domain:

- **T3 / Jira:** Read `~/agent-marketplace/claude-code/plugins/core/dev-workflow/jira-tools/skills/jira-tools/SKILL.md`.
- **EngWiki / Atlassian / Confluence:** See `~/agent-marketplace/claude-code/plugins/domain/saas-skills/engwiki-skills/` (multiple skills; choose the relevant one under `skills/`).
- **All others:** See `~/agent-marketplace/claude-code/plugins/core/dev-workflow/code-mode/` (multiple skills; choose the matching domain skill under `skills/`, use `skills/mcp-call/SKILL.md` for generic MCP calls).
- For Google-related fetching, see `~/agent-marketplace/claude-code/plugins/core/productivity/google-workspace/` (multiple skills; choose the relevant one under `skills/`).
- **GitHub PR comments:** Use `~/agent-marketplace/claude-code/plugins/core/dev-workflow/code-inbox-manager/scripts/pr_metadata.py --repo <owner/repo> --pr <N>` (not `gh`).

Use `aifx mcp` commands for discovery and calls:

```bash
# Discover servers from the registry
aifx mcp list -o json

# Search tools, not a standalone server registry lookup
# Default: featured servers; matches tool names/descriptions and server names
aifx mcp search <pattern>

# Scope tool search to known servers
aifx mcp search <pattern> --servers <server>

# Search all Gateway servers; also matches server descriptions (expensive)
aifx mcp search <pattern> --all

# Inspect tools on a known server
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
- Prefer matching domain skills and direct inspection of known servers.
- Use `aifx mcp list -o json` for server discovery.
