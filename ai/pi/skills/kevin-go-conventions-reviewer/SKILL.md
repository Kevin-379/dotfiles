---
name: kevin-go-conventions-reviewer
description: "Reviews Go code for Kevin's personal coding conventions using Kevin's examples first, a short guideline checklist second, and must-fix review enforcement last. Use when reviewing Go PRs, diffs, commits, or when the user asks for Kevin's convention-focused code review."
---

# Kevin Go Conventions Reviewer

## Core model

This is a **review-only** skill. Use it after code is written to check whether the diff follows Kevin's Go conventions.

Review model:

1. **Examples calibrate taste** — compare the diff against Kevin's real code examples.
2. **Checklist constrains** — apply the compact guidelines below as hard review criteria.
3. **Must-fix findings enforce** — report only concrete convention violations.

Read examples during review:

- Start with `references/AGENT_CODE_BEST_EXAMPLES_SKEVIN.md`.
- Then read relevant groups from `references/AGENT_CODE_EXAMPLES_APPENDIX_SKEVIN.md`.
- Prefer the examples over abstract interpretation when deciding whether something matches Kevin's style.

## Quick start

Review only Kevin's personal conventions. Do not perform broad correctness, security,
performance, or architecture review unless it directly violates a convention below.

Output only must-fix comments:

```md
- `path:line` — [pattern] Problem. Required change.
Coverage gate: [pass/fail/missing evidence] from the verify skill.
```

No praise. No nits. No optional suggestions.

## Workflow

Optimize for fewest review iterations: collect every must-fix issue in one pass. Do not stop at
the first finding.

1. Inspect changed Go production and test code once; build the file/line map for comments.
2. Read examples:
   - `references/AGENT_CODE_BEST_EXAMPLES_SKEVIN.md` first.
   - Relevant groups from `references/AGENT_CODE_EXAMPLES_APPENDIX_SKEVIN.md` second.
3. Load and use `~/.agents/skills/verify` for 100% new-line coverage evidence.
4. Run cheap mechanical scans:
   - formatting / multiline readability
   - mock chains
   - table tests
   - full struct assertions
   - semantic names
5. Review semantic structure:
   - parse, don't verify
   - top-down code structure
   - easy feature-flag cleanup
6. Emit only must-fix findings.

## Checklist

Use this compact checklist. For concrete shape, prefer the examples doc.

### Parse, don't verify

Parse raw inputs once at the boundary into typed/domain objects. Core logic should consume parsed objects, not repeat raw proto/request/map/string/role/shape checks.

Must-fix when code:

- repeats raw checks across multiple call sites
- passes raw inputs deep into business/rendering logic when a parsed domain object would be clearer
- uses scattered validation instead of a focused parser/helper/domain method
- makes tests assert raw intermediate conditions instead of parsed behavior

Preferred shapes:

- `BuildTieredFareData(...) entity.TieredFareData`
- `getRefinementFlowInfo(...) *refinementFlowInfo`
- `getNavigationStrategy(...) navigationStrategy`
- domain structs like `TieredFareData`, `FlatTier`, `PerMinTier`

### Formatting

Favor readable vertical formatting over dense lines.

Must-fix when:

- a call has more than 3 arguments and is not split one argument per line
- long names, expressions, struct literals, or composite literals make a line hard to scan
- chained calls put multiple method calls on one line
- nested presentation structs are compressed horizontally

Preferred chain style:

```go
mock.Let().
	GetThing().
	With(ctx, req).
	Return(resp, nil).
	Times(1)
```

Try to keep code under 80 columns, but prioritize readability over mechanical wrapping.

### Top-down code structure

Organize files from high-level to low-level:

1. public entrypoints / exported methods
2. orchestration
3. domain helpers
4. low-level formatting / conversion / extraction helpers
5. test helpers / builders, unless local file style differs

Must-fix when new code makes the reader jump around to understand the feature.

Preferred shapes:

- controller entrypoint branches to focused helper methods
- presenter entrypoint selects a strategy, then delegates rendering
- small interfaces model behavior instead of passing raw state everywhere

### Unit test design

Tests should verify complete behavior with minimal noise.

Must-fix when:

- similar cases should be table-driven but are split into repetitive tests
- multiple field-by-field assertions should be one full struct/response assertion
- expected values are computed in a way that obscures intended output
- tests use too many overlapping cases instead of the minimum set that covers behavior
- tests omit production-inspired scenarios for behavior that came from production shape/bugs
- reusable setup is copied instead of using a fixture/builder/test client
- tests or subtests omit `t.Parallel()` unless unsafe

Prefer:

- hardcoded expected structs
- table names like `should_return_<value>_when_<condition>`
- minimal tables that cover every behavior branch
- fixture builders for repeated setup

### Mocks

Mock expectations should be explicit and readable.

Must-fix when:

- expectations omit `.With` / `.When` for meaningful inputs
- expectations omit `.Times` / `.MaxTimes`
- fluent mock chains are compressed onto one line
- repeated mock setup should be hidden behind a test-client helper

Preferred style:

```go
tc.gatewayMock.Let().
	Foo().
	With(tc.Ctx, request).
	Return(&response, nil).
	Times(1)
```

### Feature flags

Feature-flag tests should be easy to clean up when the flag is removed.

Must-fix when:

- tests do not cover both current and flagged behavior when both are live
- flag-enabled and flag-disabled assertions are tangled in one hard-to-delete test case
- removing the flag would require rewriting unrelated test setup or expected values
- golden/table cases do not make the flag-specific expected output obvious

Prefer separate, clearly named test cases for current and flagged behavior, with hardcoded expected values or golden files that can be deleted cleanly.

### Golden file testing

Use golden files for large presentation structs / response trees where full inline expected structs would be noisy.

Must-fix when:

- large presentation responses are asserted field-by-field
- golden helpers compare only fragments and miss full output drift
- golden update path is unclear or unsafe

Prefer a generic helper like:

```go
AssertResponseWithFile(t, resp, "testdata/case_name.json")
```

### Testability

Make behavior easy to test directly.

Must-fix when:

- time, randomness, external state, or context extraction blocks deterministic tests
- code needs broad integration setup when a small helper could be tested directly
- parsing / classification / decision logic is hidden inside side-effect-heavy code

Prefer injected clocks, helper functions, parsed decision objects, fixtures, and pure-ish builders.

### 100% new-line coverage

Changed/new Go lines must have 100% line coverage. Use the verify skill for evidence.

Must-fix when:

- coverage evidence is missing
- changed-line coverage is below 100%
- tests do not exercise the new behavior / parsed state

## Output discipline

Every finding must include:

- exact `path:line`
- pattern label from the checklist
- why it violates Kevin's examples/checklist
- required change

Do not include comments that are merely personal preference unless backed by these patterns.
