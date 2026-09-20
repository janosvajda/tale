# Project policy tags

`.tale/project.tale` uses the proposed project-policy extension to the README's
v0 task format. This document defines its tags. The desktop editor now edits the
project JSON and compiles supported sections; a general Tale text parser and PLAN executor are not implemented. The
[contract verifier](contracts.md) executes approved Requirement/Check contracts. Loading the file gives an agent instructions, not
enforced permissions. Existing task examples retain their original meaning.

## Project and task contracts

`META TYPE project` declares standing rules. It requires `META`, `GOAL`, `SCOPE`,
and `PROOF`, but has no `PLAN`: loading it does not authorize implementation.
`TYPE task` (also the default for existing examples) retains the README's task
structure, including `PLAN`. Each task must satisfy applicable project rules.
Tasks may narrow permissions but cannot silently relax project rules.

Tags are uppercase section names. Indented properties contain explicit values;
quoted strings preserve spaces. Repeated `SCOPE` sections are combined.
Unknown tags or values must be reported, never silently ignored.

## Meanings

| Tag | Meaning |
| --- | --- |
| `META` | Project identity, contract type, implementation language, runtime, and test tool. HTML and CSS remain valid UI assets alongside TypeScript. |
| `GOAL` | Short project purpose; not authorization to implement the whole product. |
| `REQUIREMENT` | Stable requirement ID, action, structured condition and mandatory flag, with links to the Checks that must verify it. |
| `CHECK` | Approved executable adapter, arguments, timeout and protected proof files. |
| `PRODUCT` | Required product capabilities. These describe the product being built, not features implemented by this document. |
| `ARCHITECTURE` | Separate the visual editor, first-party SVG library, Electron UI, application logic, and preload bridge. Dependencies and process boundaries are defined below; no directory structure is prescribed. |
| `EDITOR` | Board-first interface with compact controls and concise text. Every item has an editable title and editable content. Dragging and arrow attachment must remain accurate under pan, zoom, movement, and resizing. Tags have distinct, stable colours and visible labels. |
| `DEPLOYMENT` | Deploy compiles the current diagram into deterministic `.tale` files under the selected project's `.tale/` directory and updates selected agent references. JSON is saved only by Save / Save As. |
| `DEPENDENCIES` | Deny unlisted direct packages, including UI and diagram libraries. `allow` permits the named platform package; `development_allow` permits named development tools. Built-in runtime/browser APIs are allowed. Transitive packages belong to the approved package's dependency graph, not a separate permission to import them directly. Changes to the allowlist or selected package versions require approval. |
| `AGREEMENT` | Before implementation, establish the goal, files that may change, and completion checks. Ask about material uncertainty. Reuse an explicit approval that already covers this work. |
| `CHANGES` | Keep changes necessary for the task. Refactoring, renames, deletions, and restoring deleted code require specific approval. Preserve existing user work. Approval of a task does not authorize unrelated cleanup. |
| `SCOPE` | Limit writable files and distinguish forbidden changes from changes requiring specific approval; details below. |
| `QUALITY` | Enable TypeScript strict checking and Biome lint/format checks. Do not suppress diagnostics or weaken configuration to make a change pass. |
| `TESTING` | Assert observable behavior, cover changed behavior, and add regression coverage for bug fixes. Editor changes also require an interaction check, which may be manual with recorded steps and results. An assertion that merely reproduces implementation logic is insufficient. Do not weaken expectations to hide a defect. |
| `AGENTIC_TESTS` | Retain the README's draft-to-frozen lifecycle for matching agent-authored tests. Filesystem scope still applies. Freezing requires the future runner and lock store. |
| `DETERMINISM` | For this project policy, require byte-identical compiled Tale artifacts from the same project JSON, across repeated exports and clean builds. Details below; existing task-level determinism retains the README's meaning. |
| `PROOF` | Required commands and review evidence for each task. Commands must pass when applicable; a review is an explicit assessment, not an automated test result. Stop once the agreed checks pass. |

`PRODUCT editor miro_style` means a direct-manipulation board, not a form or
list editor. Initial items are rectangles and arrows. Connections support
branches, loops, and multiple references. Each project JSON preserves items,
properties, stable identifiers, connections, and layout on save/open. Types
and environments are editable, with no mandatory preset list.

`tags diagram_items` means the future editor exposes tags as diagram items
with editable properties. Compilation preserves their meaning in concise Tale
syntax; visual layout and help text stay in the editor/project JSON.
`PRODUCT output .tale/*.tale` and `DEPLOYMENT mode compiled_tales` require
compiled Tale artifacts. `project_json save_save_as_only` keeps the editor's
project file separate. `agent_entrypoints official` selects the loaders described
in [agent integration](agent-integration.md).

## Editor and module boundaries

`tag_coverage all_defined` covers every tag in the README and the project-policy
extension, including `PLAN`, `DETERMINISM`, and `OVERRIDES`. The editor palette
must expose them even when the current project does not instantiate them.
Adding a defined tag includes its editable properties, colour, and compilation
mapping. Unknown imported tags must be preserved and reported, never dropped.

The visual editor owns board interactions and project-model updates. It uses
the SVG library for drawing, geometry, hit testing, and coordinate transforms.
The SVG library is our own reusable TypeScript module, with no Tale-policy,
Electron, or application dependencies. The editor must work without Electron;
the Electron UI hosts it and provides project controls through injected APIs.
Application logic owns project operations and Tale compilation without UI or
SVG imports. Filesystem adapters run in Electron's main process. The preload
bridge exposes only named, typed operations; no raw IPC, arbitrary channel,
shell-command, or unrestricted filesystem API is exposed to the renderer.

`ipc_validation sender_payload_result` requires checking the sender and request
data in the main process, authorizing the requested operation/target, and
validating responses at the UI boundary. TypeScript types alone do not validate
runtime input. Enable context isolation and renderer sandboxing, and disable
renderer Node integration. These requirements follow Electron's official
[security](https://www.electronjs.org/docs/latest/tutorial/security) and
[context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
guidance. Project text is inert data: render it as text, never execute imported
HTML, SVG scripts, or command strings merely by loading or editing a project.

`EDITOR` keeps the board dominant, controls compact, and instructions contextual.
No promotional hero headings or large explanatory panels occupy the workspace.
Item titles and text are editable; structured rule values retain their types.
Colour identifies the tag consistently, alongside a visible label, with legible
text and selection states. Colour alone must not carry meaning.

`viewport fit_app_window` and `app_scroll deny` keep the editor within the app
window, with no horizontal or vertical page scrolling. Navigate the board by
panning and zooming. Support touchpad pinch and mouse-wheel zoom anchored at
the pointer; these gestures change the board viewport, not the page/browser zoom.
`draggable all_diagram_objects` includes nodes and arrows. Attached arrows remain
attached during path adjustment; dragging an endpoint explicitly reconnects it.
Text editing must remain usable without accidentally starting a drag.

`toolbar all_diagram_items` exposes rectangles, arrows, and every defined tag
item, including user-added types. Use visible labels and compact, discoverable
groups or menus so the toolbar remains reachable without scrolling the app.
`menu open_json save save_as deploy` provides Open, Save, Save As, and Deploy.
Open loads an existing project JSON; Save writes to its current file (or requests
a location for an unsaved project); Save As selects and adopts a new location.
Deploy selects a destination project without changing the working save location.
Cancellation leaves the project intact; unsaved edits must not be silently lost.

`editor_cases` requires interaction checks for dragging at different pan/zoom
settings without pointer drift, connecting to a visible target with a precise
preview, keeping endpoints attached after move/resize, and preserving titles,
text, values, and colours after save/reopen. `tag_coverage` checks the complete
defined tag catalogue. `ipc_changes boundary_tests` requires verifying valid
requests and rejecting invalid senders, malformed data, and unauthorized targets.
These acceptance requirements are exercised by the Electron tests. A policy
edit alone does not constitute evidence that they pass.

`property_controls semantic_typed` requires labelled choices, boolean switches,
individual list entries, numeric controls, and structured steps. JSON syntax is
not an editing interface. `raw_json_editing deny` keeps the storage representation
out of the inspector; diagram summaries use readable labels.

`test_files paired_sibling` and `test_pattern {name}.test.ts` require each
application TypeScript source to have a neighbouring test file. Tests must assert
behaviour; file existence alone is insufficient. The repository check also covers
new TypeScript sources outside `src`, excluding tests themselves, dependencies,
and generated files. `test_pair_check npm_run_lint` runs this check alongside
Biome because Biome provides no native file-pair rule. Browser pairs execute in
Electron; Node pairs use `node:test`. `npm run verify` runs both.

## Deployment

Compile the current in-memory diagram, including unsaved rule edits, using the
same compiler as Preview Tale. Write every configured `.tale` output beneath the
user-selected destination's `.tale/` directory, creating directories as needed.
The same JSON must produce byte-identical deployed files on repeated runs and
across clean builds. Do not serialize the editor project during deployment.
Save / Save As alone writes that JSON to its user-selected location; deployment
must not change the working save location or mark unsaved edits as saved.

Let users choose agents and their official project entry points using the
[agent integration](agent-integration.md) catalogue. Detect existing files or
create missing files. Preserve filename case, unrelated instructions and activation
headers. Update one managed block per instruction file, referencing the exact
compiled `.tale` paths. Replace old JSON references inside Tale-owned blocks.

Preview every output before writing. If `.tale/` already exists, require explicit
overwrite confirmation for the generated files shown in the preview. Preserve
other files. Changing the destination or agent selection resets confirmation.
Reject stale previews if inspected files change before deployment. Compilation
errors or missing outputs must stop deployment before any write. Cancellation or
failed writes must not truncate existing files or report success.

`deploy_e2e compiled_tales_agent_entrypoint` checks exact deployed bytes, absence
of a deployed JSON project, selected agent references, overwrite confirmation,
cancellation, repeated deployment and save/reopen. The independently authored
Tale fixture remains the byte-exact oracle through two clean builds and two
editor sessions per build.

## Scope and approval

Paths are repository-relative and case-sensitive. `*` matches within one path
segment; `**` spans directories. `approved_task_files` is a reserved value,
expanded to the concrete files or patterns agreed for the current task.
Everything outside that set is unwritable, including newly created files.

`deny` wins over `allow` and approval-required entries. An approval-required
path must also be within the task's agreed files. Approval names the affected
paths or code regions and permitted operation; approval of a language or
general project direction does not satisfy it. Existing explicit approval
covering the same change is sufficient. Policy changes themselves require
approval, preventing an agent from granting itself wider permissions.

Existing `hash_lock file="..."` and `hash_lock region="...#function:..."`
protect files and code regions as described in the README. An `OVERRIDES unlock`
records an exception only after user approval; writing the directive is not
approval. No source regions are named in this project policy because source
code does not exist yet. A missing or ambiguous protected region must be
reported instead of treating it as unlocked.

## Proof applicability

`editor_e2e json_to_tale_determinism` requires an automated test through the built
editor: open a fixed project JSON, export its Tales, save/reopen without semantic
edits, and export again. Compare output paths and raw file bytes against both
the first export and an independently reviewed expected fixture. Repeated wrong
or empty output must not count as success. The initial fixture is
`tale.project.json`, with `.tale/project.tale` as its expected output.

`DETERMINISM target compiled_tales` applies to every exported Tale. With the same
JSON, compiler version, and export selection, require identical bytes on macOS,
Windows, and Linux. `rerun_check runs=2` requires at least two independent editor
sessions; `clean_build_check runs=2` repeats the test with two clean application
builds of the same source and pinned toolchain. Existing output files must not
be reused as generated results. Build artifacts themselves need not be identical.

`comparison byte_exact` permits no normalization before comparison. Emit UTF-8
without BOM, LF line endings, and exactly one final newline. Define stable
section/directive ordering and quoting; exclude timestamps, machine paths, and
random identifiers. Expected fixtures must not be automatically rewritten by
the test. Intentional output-format changes require review of the new fixture.
This artifact comparison is stricter than the README's normalized task receipts.

`npm run test:e2e` builds and launches the editor for this acceptance test. It
uses native Electron input for dragging and injected wheel gestures for zoom;
dialog selection is controlled by the harness while IPC and file writes are real.
Passing locally does not establish that other operating systems have passed.

`when=code_changed` extends `run` to apply when a task changes application code,
tests, dependencies, or build/quality configuration. Documentation-only tasks
still need their agreed checks and diff review. The named npm scripts are
implemented in `package.json`. An applicable missing script is an unmet check,
never a passing result.

`review scope unrelated_behavior added_lines` requires checking the diff
against approved files, examining effects outside the requested behavior, and
accounting for added code. Record actual evidence and remaining uncertainty;
command success alone does not prove minimality or cross-platform behavior.
`stop after_agreed_checks` ends the task without extending it to adjacent work.

## Executable contract enforcement

The generic Requirement/Check layer and its baseline gate are defined in
[Executable contracts](contracts.md). `AGREEMENT` records approval and conflict
policy; `PROOF contract_verify` requires external approval and mandatory coverage;
`OVERRIDES request_change` records a request, never self-approval. The example
checks actual deployment artifacts using protected adapter and reference files.
The independent expected `.tale` fixture is not regenerated by the verifier.
