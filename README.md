<h1 align="center">Tale — Tales for AI agents</h1>
<p align="center">
  <img src="tale_logo_readme_small.png" alt="Tale logo" width="350" height="350" />
</p>

## Run the desktop editor

From a checkout, with Node.js 22.12 or newer and npm installed:

```sh
npm start
```

The first run installs the pinned dependencies, builds the TypeScript, and opens
Electron. Later runs rebuild and launch. Closing the last window exits the app
and its launcher; there is no background development watcher.

The editor opens `tale.project.json` as an unsaved example. Drag rectangles to
move them, drag their corner to resize, and use Arrow or a node's connection port
to connect items. Select an arrow to adjust its curve or reconnect its endpoints.
Use the mouse wheel or pinch to zoom, hold Space and drag to pan, and use Fit to see the board.
Select an item to edit its title and typed properties. The project name opens
settings for types, colours, environments, and Tale outputs.

File provides New, Open JSON, Save, Save As, and Deploy. Save and Save As write the
editor's JSON project to your chosen file. Deploy compiles the current diagram
and writes its deterministic `.tale` outputs into the destination project's
`.tale/` directory. Its dialog lets
you choose agents and instruction files, preview changes, and confirm overwriting
an existing Tale deployment. Existing instructions and unrelated files are kept;
missing instruction files are created. See [agent integration](docs/agent-integration.md).
Preview Tale and Deploy use the same compiler and produce identical `.tale` bytes. It never executes the commands written in rules.

The board saves branches, shared references, and cycles. Compilation currently
supports the documented Tale root/section containment mapping. Undefined flow
semantics, invalid built-in properties, and cyclic containment produce explicit
errors rather than invented output. Add sections to any item using Free text,
Checkboxes (multiple choices), or Radio buttons (one choice). Edit section titles
and options directly; no JSON syntax is needed. Each section has its own duplicate
and delete icons.

### Board navigation

Navigation follows [Miro's documented mouse and trackpad controls](https://help.miro.com/hc/en-us/articles/360017731053-Using-Miro-with-a-mouse-trackpad-or-touchscreen):

| Input | Behavior |
| --- | --- |
| Mouse wheel in **Mouse** mode | Zoom around the pointer. |
| Two-finger scrolling in **Trackpad** mode | Pan horizontally and vertically. |
| Pinch, or Ctrl / Cmd + wheel | Zoom around the pointer. |
| Wheel in **Trackpad** mode | Pan vertically; Shift + wheel pans horizontally. |
| Right-button drag, middle-button drag, or Space + left drag | Pan, including when the pointer starts over an item. |
| Hand tool + drag | Pan. |
| Zoom buttons / Fit | Change zoom / fit the diagram in view. |

Nothing needs to be selected to navigate. Selection never changes wheel behavior
and navigation never moves the selected items. Clicking the board dismisses open
File and Add item menus; Escape dismisses them too. Scrolling a menu or inspector
stays within that control instead of navigating the board.

The selector beside the zoom controls offers **Mouse** (the default) and
**Trackpad**, remembered on this device independently of the project JSON.
Mouse mode always zooms with wheel scrolling, including smooth-scrolling and
Magic Mouse input. Trackpad mode pans with two-finger scrolling. Pinch zoom works
in both modes. Automatic device guessing has been removed because smooth mice
and trackpads can send indistinguishable events; old Auto preferences become
Mouse. In Mouse mode a two-finger scroll also zooms. These are Miro's explicit
navigation modes; Tale does not claim automatic hardware detection.

### Tags: built-in and fully customizable

Tags are fully customizable building blocks: users can define **new tags**, choose
their labels and colours, and author their content with free text, checkboxes,
and radio-button sections. The catalogue belongs to each project; it is not a
closed list or a requirement to use every built-in tag. No code or external
library is needed to author a new tag.

Open **Manage types & environments** from Add item (or click the project name),
enter a type name and a new tag such as `TEAM_RULES`, and choose **＋ Item type**.
The tag field also suggests built-ins. Tags use uppercase letters, numbers, and
underscores, starting with a letter. Add an instance from the palette, edit its
sections, and connect it to a Tale root with a **Contains** arrow. Save retains
the definition and content in JSON; Preview and Deploy compile it into `.tale`.
Colours and display labels can be changed in project settings.

Built-in identifiers retain their defined syntax and validation. For example,
renaming a display label does not turn `CHECK` into a different executable rule.
New tags compile as declarative sections; assigning a name does not automatically
add runtime enforcement. Use linked `REQUIREMENT` / `CHECK` items for executable
acceptance criteria.

All built-in tags are listed below. A tag is a diagram item; `TALE v0` is the
output root. Examples show individual directives, not complete files.

| Tag | Purpose and representation |
| --- | --- |
| `TALE` | Export root; `version: v0` produces the `TALE v0` header. Its Contains arrows determine section order. |
| `META` | Identity and implementation context: `ID`, `TYPE`, `TITLE`, `LANGUAGE`, `RUNTIME`, `FRAMEWORK`, `DATABASE`, `IAC`, `TEST_FRAMEWORK`, `HTTP_TEST_TOOL`. |
| `GOAL` | Concise intended outcome. Each line of its text is indented below `GOAL`. |
| `REQUIREMENT` | Observable acceptance criterion: `id`, `action`, `subject`, `condition`, `expected`, `mandatory`, `verified_by`. Conditions: `exists`, `absent`, `equals_file`, `unchanged`, `command_succeeds`. IDs and check links come from the diagram. |
| `CHECK` | Verification command: `id`, `action`, `executable`, `arguments`, `protected_files`, `timeout_ms`. Execution requires an approved baseline. |
| `PRODUCT` | Product capabilities and outputs, such as `platforms`, `items`, `connections`, `project_format`, `output`, `rule_types`, and `environments`. |
| `ARCHITECTURE` | Component and process boundaries, dependency direction, filesystem ownership, and IPC/security constraints; for example `separate visual_editor application`. |
| `EDITOR` | Interaction and UI requirements: layout, pan/zoom, precise dragging/connections, tag colours, toolbar coverage, and typed controls. |
| `DEPLOYMENT` | Required output, destination, agent entry points, preview/overwrite policy, preservation, and repeatability; for example `project_json save_save_as_only`. |
| `DEPENDENCIES` | Package policy: `default`, `allow`, `development_allow`, `changes`. |
| `AGREEMENT` | Scope and approval policy: `before_implementation`, `unclear_requirements`, `scope_expansion`, `existing_approval`, `contract_changes`, `structured_conflicts`, `approval_baseline`. |
| `CHANGES` | Change limits: `default`, `refactor`, `rename`, `delete`, `unrelated_changes`, `preserve_user_changes`, `restore_deleted_code`. |
| `SCOPE` | File boundaries. `mode` is `allow`, `deny`, or `require_approval`; paths are separate indented lines below, e.g. `SCOPE deny` with `.git/**`. |
| `QUALITY` | Static quality policy: `typescript_strict`, `lint`, `format`, `weaken_checks`. |
| `TESTING` | Required test behavior and coverage: assertions, regressions, UI/IPC cases, determinism checks, and sibling test-file policy. |
| `DETERMINISM` | Reproducibility: `mode`, `target`, `comparison`, `encoding`, `line_endings`, `final_newline`, `canonicalize`, `rerun_check`, `clean_build_check`. Run counts compile as `runs=2`. |
| `AGENTIC_TESTS` | Agent-authored test lifecycle: `pattern`, `allow_create`, `allow_modify`, `freeze_after`, `freeze_mode`. Automatic file freezing remains a future capability. |
| `PLAN` | Ordered proposed work, stored as steps. Operations can have arguments, attributes, and child steps. The compiler preserves these instructions; it does not execute the plan. |
| `PROOF` | Ordered completion checks: `run`, `review`, `stop`, and `contract_verify baseline=external coverage=mandatory`. Legacy commands run through normal project tooling unless authored as Checks. |
| `OVERRIDES` | Explicit change proposals, e.g. `request_change reason="Agreed format change" requirement=publish-report`. A proposal cannot grant its own approval or waive a failed requirement. |

A project Tale needs `META`, `GOAL`, `SCOPE`, and `PROOF`; a task Tale also needs
`PLAN`. `META` occurs exactly once. Other tags are included when relevant.
Every item may carry additional authored sections. For example, a custom tag
with a free-text section compiles as:

```tale
TEAM_RULES
  section "Communication" type=text
    text "Discuss the intended outcome before editing."
```

Custom-tag properties supplied in JSON compile in sorted key order; custom
sections preserve their explicit order. Changing layout, labels, or colours does
not change the generated bytes. See [project format](docs/project-format.md) for
the data mapping, [project policy](docs/project-policy.md) for the example's
rules, and [executable contracts](docs/contracts.md) for enforcement boundaries.

### Requirements and verification

Add **Requirement** and **Check** items and connect them with **Verified by**
arrows. Incomplete contracts can be saved as drafts; missing proof links and
structured conflicts block compilation and deployment. **Verify** lets you review
commands, approve an external baseline, and run checks against frozen acceptance
criteria. A passing command alone cannot satisfy an output-file requirement.

The verifier also provides a CLI gate with a pinned approval digest. Its baseline,
digest, and executable must be protected from agent writes; it is not an OS sandbox.
See [executable contracts](docs/contracts.md) for the generic tags, approval flow,
CLI usage, supported assertions, and exact enforcement boundary.

### Code boundaries

| Directory | Responsibility |
| --- | --- |
| `src/model` | Project types, validation, tag definitions, and bridge contracts |
| `src/application` | Deterministic Tale compiler, independent of UI and Electron |
| `src/svg` | First-party SVG drawing and geometry; no Tale or Electron imports |
| `src/editor` | Board interactions, selection, graph edits, and undo/redo |
| `src/ui` | App controls, palette, inspector, and native HTML/CSS |
| `src/preload` | Named IPC operations exposed through an isolated bridge |
| `src/runner` | Approved contract execution, independent file evidence, and CLI gate |
| `src/main` | Electron lifecycle, request validation, native dialogs, and file operations |

Only Electron, TypeScript, and Biome are direct dependencies. No UI, diagram,
bundler, or test framework packages are used.

### Verify

```sh
npm run verify
```

This runs strict type checks, the repository's Biome lint/format rules, Node tests,
and Electron end-to-end tests. Every TypeScript source has a sibling `name.test.ts`.
`npm run lint` runs Biome plus the dependency-free file-pair check (Biome has no
native sibling-test rule). Node pairs run with `npm test`; browser pairs run in
the built Electron renderer with `npm run test:e2e`. Test files do not require
recursive test pairs; dependencies and generated output are excluded.

The Electron tests open real windows, automate
board interactions, and exercise real IPC/file operations with deterministic
dialog selections. They compare generated file bytes to `.tale/project.tale`
through two clean builds and two editor sessions per build, including save/reopen.
The expected fixture is never regenerated by the tests. A screenshot is written
to `artifacts/editor.png`.

The first implementation is verified on macOS. Windows/Linux still need their
own execution of these checks; distributable installers are not included yet.
The executable contract subset now has a verifier. Full PLAN execution and an OS
sandbox remain separate from this implementation.

## TALE — Task Agreement & Logic Engine

**Tale** is a contract language for autonomous software work.

It is designed for **AI coding agents**, not humans issuing prompts.

A Tale file does not describe *how to think* — it defines:

- **what must become true**
- **where change is allowed**
- **how success is proven**
- **when results must be deterministic**
- **what must be protected from accidental change**

---

## What Tale Is

Tale is a **task contract**, not:
- a prompt format
- a patch format
- a workflow config
- a planning language

A Tale task is:
- **executable**
- **verifiable**
- **scope-enforced**
- **deterministic (when declared)**
- **replayable and auditable**

If a task cannot be mechanically verified, it is not a valid Tale.

---

## Core Philosophy

### Intent over narration
Tale separates **intent** (goal and constraints) from **implementation** (edits performed by an agent).

### Proof over trust
A task is only complete if its proof passes.  
“Looks correct” is not a completion state.

### Constraints are enforced, not suggested
Scope, locks, determinism rules, and Agentic Test lifecycle rules are enforced by the runner.

---

## The Three Laws of Tale

### Law 1 — Proof or it didn’t happen
Every Tale **must** define how success is mechanically verified.

### Law 2 — Scope is enforced
A Tale **must** define where work may and may not occur. Violations are execution errors.

### Law 3 — Intent ≠ Implementation
Tale specifies **what must become true**, not how an agent reasons.

---

## File Format

- Extension: `.tale`
- Line-oriented
- Human-readable
- Deterministic to parse

---

## Minimal Structure (v0)

```
TALE
META
GOAL
SCOPE
PLAN
PROOF
```

Optional sections supported in v0:

```
DETERMINISM
AGENTIC_TESTS
OVERRIDES
```

The project's own compact rules are in [.tale/project.tale](.tale/project.tale).
They exercise a proposed `TYPE project` extension, including standing coding
rules and approval requirements. Its syntax and semantics are documented in
[Project policy tags](docs/project-policy.md). The executable Requirement/Check
subset is enforced by the [contract verifier](docs/contracts.md); the remaining
standing rules are instructions unless represented by explicit checks. The task format and examples below remain unchanged.

---

## Determinism & Reliability

Tale supports **explicit determinism contracts**.

### DETERMINISM

```
DETERMINISM
  mode strict | bounded | none
  canonicalize
    - prettier
    - sort_imports
  rerun_check runs=2
```

### Determinism Modes

- **strict**  
  Repeated executions must produce identical outputs (after canonicalization).

- **bounded**  
  Only declared artifacts must be identical.

- **none**  
  No determinism guarantees.

### Deterministic rerun (strong guarantee)

```
PROOF
  deterministic_rerun runs=2
```

The runner executes the same Tale multiple times and compares **normalized receipts**.
Any difference results in failure.

---

## Locks (No Accidental Changes)

Locked files or regions **must not change**.

```
PROOF
  hash_lock file="src/core/blah.ts"
  hash_lock region="src/core/blah.ts#function:blah"
```

Any modification causes failure unless explicitly unlocked via `OVERRIDES`.

---

## Agentic Tests (Correct Lifecycle)

**Agentic Tests** are a special kind of unit test designed to test the **agent's impact** on a codebase.

If an agent breaks something (behavior, API shape, invariants, forbidden churn), these tests should fail.

### Naming Convention (TypeScript)

Agentic tests use a distinct file pattern:

- `*.ai.test.ts`

### Why “DO_NOT_TOUCH true” is wrong

Agentic tests must be **created and improved** while a feature is being developed.

“Do not touch” should only apply **after the contract is proven stable** (e.g., production-ready).

So Tale models Agentic Tests as a **lifecycle**, not a boolean.

---

### Lifecycle: Draft → Stable (Frozen)

Tale supports two states for agentic tests:

- **draft**: editable within the current task
- **stable**: frozen after success; future tasks cannot change them without an override

This is controlled by the runner using a persistent lock record (recommended):
- `.tale/locks.json` (or equivalent)

---

### Declaring Agentic Test Policy

```
AGENTIC_TESTS
  pattern src/**/*.ai.test.ts
  allow_create true
  allow_modify within_task
  freeze_after proof_pass
```

#### Semantics

- **allow_create true**  
  The agent may create new agentic tests during PLAN.

- **allow_modify within_task**  
  The agent may modify agentic tests *during this task execution only*.

- **freeze_after proof_pass**  
  After PROOF succeeds, the runner:
  1) hash-locks all matching agentic tests
  2) stores their hashes in a persistent lock file (e.g. `.tale/locks.json`)
  3) treats them as **stable** for future tasks

In future tasks, modifying stable agentic tests is rejected unless explicitly overridden.

---

### Production Freeze Mode (Optional)

If the repo is already production/stable and you want tests frozen immediately:

```
AGENTIC_TESTS
  pattern src/**/*.ai.test.ts
  freeze_mode production
```

Runner behavior:
- lock all matching files **before** PLAN executes

---

### Overriding Frozen Agentic Tests (rare)

If you truly must change a frozen agentic test, it must be explicit and justified:

```
OVERRIDES
  unlock file="src/core/api.ai.test.ts" reason="API contract changed"
```

Recommended runner behavior:
- record the override prominently in the receipt
- require determinism `mode strict`
- require `deterministic_rerun runs=2`
- optionally require an expanded proof (lint + full suite)

---

## PLAN

PLAN contains **imperative edit primitives only**.

Agents propose operations; the runner enforces:
- scope
- locks
- determinism
- Agentic Test lifecycle rules (draft vs stable)

---

## PROOF

PROOF defines how success is verified.

If any proof step fails, the Tale fails.

Common proof primitives:
- `run "cmd" expect exit=0`
- `file_exists "path"`
- `file_contains "path" "text"`
- `hash_lock file=...`
- `hash_lock region=...`
- `deterministic_rerun runs=2`

---

## Execution Model (v0)

1. Parse & validate
2. Load persistent locks (e.g. `.tale/locks.json`)
3. Enforce scope & locks
4. Execute PLAN
5. Canonicalize outputs
6. Execute PROOF
7. Determinism checks
8. If configured, freeze Agentic Tests after proof
9. Produce execution receipt

---

## Status

Tale is **v0**.

The v0 goal is correctness, determinism, and safety — not convenience.

---

## Summary

Tale treats software work as a **deterministic contract**:

> “Within this scope, make this goal true —  
> and prove it, reproducibly, without breaking anything.”
