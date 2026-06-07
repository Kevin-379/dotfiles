---
name: subagents
description: Use when delegating read-only one-off, parallel, or tmux-interactive tasks to fresh Pi agents from the current session.
---

# Subagents

Use fresh Pi agents to isolate context, reduce main-session noise, and run independent read-only work in parallel. Current session is leader. Child agents are followers.

## Hard Rules

- Followers must not edit files, write files, commit, push, merge, deploy, or run destructive commands.
- Do not pass implicit parent chat context.
- Give each follower an explicit task brief.
- Do not auto-discover roles, skills, MCPs, or prompts.
- Use default Pi model/config. Do not choose model.
- Follower output can be freeform markdown.
- Store temporary artifacts under `/tmp/pi-subagents/<run-id>/` when useful. Do not clean them up.
- Leader persists anything important outside `/tmp`.

## Modes

### 1. `delegate`

Use for one independent question or investigation.

Pattern:

```bash
pi --mode text --no-session -p '<TASK_BRIEF>'
```

Task brief must include:

```text
You are a read-only Pi subagent.
Do not edit files, write files, commit, push, merge, deploy, or run destructive commands.
Use only explicit context in this brief plus repository files you inspect yourself.
Return concise markdown.

Task:
<task>
```

### 2. `parallel`

Use when tasks are independent and safe to run concurrently. Max concurrency: **4**.

Pattern:

```bash
run_id="$(date +%Y%m%d-%H%M%S)-<slug>"
out="/tmp/pi-subagents/$run_id"
mkdir -p "$out"

pi --mode text --no-session -p '<TASK_BRIEF_1>' > "$out/1.md" 2> "$out/1.err" &
pi --mode text --no-session -p '<TASK_BRIEF_2>' > "$out/2.md" 2> "$out/2.err" &
pi --mode text --no-session -p '<TASK_BRIEF_3>' > "$out/3.md" 2> "$out/3.err" &
pi --mode text --no-session -p '<TASK_BRIEF_4>' > "$out/4.md" 2> "$out/4.err" &
wait
```

Leader then reads outputs, synthesizes, and notes conflicts/blockers. If more than 4 tasks, batch them.

### 3. `interactive`

Use when user wants inspectable live follower session.

Pattern:

```bash
tmux new-window -n 'pi-subagent-<slug>' "cd '$PWD' && pi \"<TASK_BRIEF>\""
```

Interactive follower runs in same cwd as leader. It starts with task already sent. User can inspect/control the tmux window.

## Brief Quality Checklist

Before launching follower, ensure brief has:

- explicit objective
- relevant file paths, PRs, Jira keys, Slack refs, or commands to inspect
- no hidden dependency on parent conversation
- no-edit restriction
- expected output shape if needed

## Leader Synthesis

After followers complete:

1. Read stdout/stderr artifacts.
2. Separate facts from speculation.
3. Deduplicate findings.
4. Highlight disagreements.
5. Decide next action or ask user if blocked.
6. Persist important conclusions outside `/tmp` if needed.

## Common Mistakes

- Passing “see above” context. Fix: write standalone brief.
- Asking follower to modify code. Fix: make follower report recommended changes only.
- Launching dependent tasks in parallel. Fix: run sequentially or make dependency explicit.
- Spawning more than 4 at once. Fix: batch.
- Treating follower result as truth. Fix: leader verifies load-bearing claims.
