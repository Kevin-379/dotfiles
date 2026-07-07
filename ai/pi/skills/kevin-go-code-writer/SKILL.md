---
name: kevin-go-code-writer
description: "Writes Go code in Kevin's personal style by reading real examples first, then applying a compact coding-pattern checklist while implementing. Use when implementing or modifying Go code for Kevin in shared Go codebases, especially when matching Kevin's style matters."
---

# Kevin Go Code Writer

1. Ensure 100% new line coverage
2. Parse, don't verify
3. Structure the code top down
4. Use vertical formatting for readability:
   1. one arg per line for long or 3+ arg calls
   2. one field per line for nested structs
   3. one method per line for fluent chains, especially mocks/builders/metrics
5. Write minimal tests that cover all behavior
   1. prefer table driven tests
   2. test names: `should_return_<value>_when_<condition>`.
   3. assert entire structs instead of individual fields
   4. fixtures/builders/test clients for repeated setup
   5. `t.Parallel()` in tests/subtests unless unsafe
   6. mocks must have .With or .When and .Times or .MaxTimes
   7. production-inspired scenarios when behavior comes from real product shape/bug
6. Use golden files for large presentation structs / response trees. `AssertResponseWithFile(t, resp, "testdata/case_name.json")`
7. Examples: `references/AGENT_CODE_BEST_EXAMPLES_SKEVIN.md`.
