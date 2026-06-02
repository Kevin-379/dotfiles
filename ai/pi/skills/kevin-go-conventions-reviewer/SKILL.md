---
name: kevin-go-conventions-reviewer
description: "Reviews Go code for Kevin's personal coding conventions: parse don't verify, 100% new-line coverage via the verify skill, multiline readability, top-down structure, semantic naming, and explicit tests/mocks. Use when reviewing Go PRs, diffs, commits, or when the user asks for Kevin's convention-focused code review."
---

# Kevin Go Conventions Reviewer

## Quick start

Review only Kevin's personal conventions. Do not perform broad correctness, security,
performance, or architecture review unless it directly violates a convention below. Output only must-fix comments:

```md
- `path:line` — [rule] Problem. Required change.
Coverage gate: [pass/fail/missing evidence] from the verify skill.
```

## Workflow

Optimize for fewest review iterations: collect every must-fix issue in one pass. Do not stop at
the first finding.

1. Inspect changed Go production and test code once; build the file/line map for comments.
2. Load and use `~/.agents/skills/verify` for 100% new-line coverage.
3. Run cheap mechanical scans: multiline readability, semantic naming, and mock chains.
4. Review tests for complete assertions, table-driven coverage, and explicit mock counts.
5. Review semantic structure: parse-don't-verify first, then top-down file organization.
6. Emit only must-fix findings. No nits, optional suggestions, or general review comments.

## Rules

### 100% new-line coverage

Changed/new Go lines must have 100% line coverage. Use the verify skill for evidence. Must-fix when coverage evidence is missing, changed-line coverage is below 100%, or tests do not exercise the new behavior/parsed state.

### Multiline readability

Favor readable vertical formatting over dense lines.

Must-fix when:
- a call has more than 3 arguments and is not split one argument per line
- long names, expressions, struct literals, or composite literals make a line hard to scan
- chained calls put multiple method calls on one line, especially mocks, metrics, builders, or fluent APIs

Preferred chain style:

```go
mock.Let().
	GetThing().
	With(ctx, req).
	Return(resp, nil).
	Times(1)
```

Try to keep code under 80 columns, but prioritize readability over mechanical wrapping.

### Semantic naming

Use domain names instead of abstract buckets. Must-fix names like `shapeA`, `shapeB`, `foo`, or
`data2` when they hide meaning. Prefer `immediatePerMin`, `delayedPerMin`, `flatTier`,
`withCredits`, and `withoutCredits`.

Test names should generally follow `should_return_<value>_when_<condition>`.

### Tests and mocks

Tests should verify complete behavior with minimal noise.

Must-fix when:
- multiple field-by-field assertions should be one full struct/response assertion
- similar cases should be table-driven but are split into repetitive tests
- mock expectations omit explicit `.With`/`.When` or `.Times`/`.MaxTimes`
- tests or subtests omit `t.Parallel()`
- expected values are computed in a way that obscures the intended output

Prefer hardcoded expected structs and clear table cases. All tests and subtests should call `t.Parallel()`.

### Parse, don't verify

Parse raw inputs once at the boundary into typed/domain objects. Core logic should consume parsed objects, not repeat raw proto/request/map/string/role/shape checks.

Must-fix when code:
- repeats raw checks across multiple call sites
- passes raw inputs deep into business/rendering logic when a parsed domain object would be clearer
- uses scattered validation instead of a focused parser/helper/domain method

Prefer made-up patterns like:
- `ParseCheckoutRequest(req)` returning `CheckoutInput`; downstream uses the parsed fields.
- `SelectPrimaryRequester(requesters)` returning `*Requester`; call sites stop checking roles.
- domain methods like `invoice.TotalDiscountedAmount()` hiding repeated field math.

### Top-down structure

Organize files from high-level to low-level: public entrypoints/exported methods,
orchestration, domain helpers, low-level formatting/conversion/extraction helpers, then test
helpers/builders after tests unless the file already uses a different local pattern.

Must-fix when new code makes the reader jump around to understand the feature.
