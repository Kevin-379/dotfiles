# Agent Skills Setup

## Installing skills

Skills live in `~/.agents/skills/`. Each skill is a directory with a `SKILL.md` that the agent reads when triggered.

### Matt Pocock's skill collection

A curated set of skills is available at https://github.com/mattpocock/skills. Follow the install instructions in that repo to pull them in.

### Installing individual skills

```sh
# Clone a skill into the skills directory
git clone <skill-repo> ~/.agents/skills/<skill-name>
```

## Installed skills

- brainstorming
- caveman
- checkpoint
- dispatching-parallel-agents
- executing-plans
- finishing-a-development-branch
- grill-me
- grill-with-docs
- improve-codebase-architecture
- receiving-code-review
- requesting-code-review
- session-list
- session-restore
- session-save
- subagent-driven-development
- systematic-debugging
- tdd
- test-driven-development
- using-git-worktrees
- verification-before-completion
- writing-plans
- writing-skills
- zoom-out

## Pi packages

Add these in pi's settings (or `~/.pi/agent/settings.json` under `"packages"`):

- **`npm:pi-mcp-adapter`** — MCP proxy that exposes `engwiki`, `t3`, and `omni-mcp` through pi's `mcp({})` tool
- **`npm:vim-motions-pi`** — vim keybindings in the pi TUI

## Pi extensions

Extensions live in `~/.pi/agent/extensions/`. Symlink or copy the files from `ai/pi/extensions/` in this repo.

| Extension | Purpose |
|-----------|---------|
| `cmux-notify.ts` | Fires a macOS notification (via `cmux`) + OSC 777 escape on every agent completion |
| `statusline.ts` | Custom footer: user@host, git branch, token usage bar, cost, duration |
| `whimsical.ts` | Rotating loading messages while the agent is thinking |
| `exit.ts` | Registers an `/exit` command to shut pi down cleanly |
| `utrim-bash.ts` | Trims large bash output for known heavy commands (`bazel build`, `git log -p`, etc.) |
| `uber-genai.js` | Routes models through Uber's internal MA gateway — **Uber-specific, remove on personal machines** |
