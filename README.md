<h1 align="center">Tale — Tales for AI agents</h1>

<p align="center">

  <img src="tale_logo_readme_small.png" alt="Tale logo" width="350" height="350" />

</p>


## About Me and what is Tale

Hey, I’m Janos, an experienced software engineer with more than 20 years of experience in software industry. I’m also a psychology student with a deep interest in human psychology, consciousness, thinking, AI, and the communication between humans and AI.

The reason I created Tale is that I felt we are still trying to communicate with AI using old tools, existing methodologies, and principles that may no longer be valid.

I believe we need to change the way we communicate if we want to work successfully with AI in the future. **Communication is the key.**

We also need to change our mindset. We do not necessarily need rigid, predefined languages like HTML, traditional configuration formats, interfaces, or pseudo-languages for every kind of interaction. AI can understand many different kinds of structures, concepts, relationships, and logic.

Because of that, I believe the whole concept of **how humans communicate with AI needs to evolve**.

This is what I am trying to explore and implement with Tale.

Tale allows people and teams to create their **own project-specific communication language** instead of forcing every project into the same predefined structure. It also provides communication TAGs that can help humans and AI share goals, rules, expectations, decisions, warnings, acceptance criteria, and other important information more clearly.

My goal with Tale is to help make **human–AI collaboration more natural, understandable, flexible, and effective**.


## Core Philosophy of Tale 

Tale starts from a simple idea: **AI coding agents should not be treated only as software tools**. They are like tiny mirrors of our thinking: super enthusiastic, keen to communicate, and yes — they make mistakes.

Traditional development tools are designed to behave predictably based on configuration. This approach has worked very well for a long time, but I believe this era is gradually coming to an end, because AI agents are different. They interpret context, make decisions, infer missing details, and can approach the same task in different ways. As agents become more capable, trying to control all of their behaviour through larger prompts, configuration files, or tool integrations alone becomes increasingly fragile.

Tale therefore treats human-agent collaboration primarily as a **communication problem**. Its goal is to make important expectations explicit, persistent, structured, and easy for both humans and agents to understand.

A useful analogy is an enthusiastic junior developer working on an unfamiliar codebase. They may be technically capable and highly motivated, but they do not yet know which parts of the system are fragile, which decisions have already been made, what must not change, or how large a change is appropriate. If the task is too broad, too vague, or missing important context, they may solve the immediate problem while unintentionally creating another one.

AI coding agents often behave in a similar way. They can produce substantial amounts of working code very quickly, but without clear boundaries they may refactor unrelated code, modify behaviour that was already correct, or rewrite a test simply because it blocks the current implementation.

In both cases, the solution is not simply to provide more information. What matters is giving clear goals, small enough tasks, explicit boundaries, relevant context, and a way to preserve decisions and behaviours that have already been proven correct.

Tale is a concept and a tool for reducing communication barriers between humans and AI. Its goal is to make expectations, rules, responsibilities, decisions, repetitive tasks, acceptance criteria, and feedback easier to express, understand, and preserve over time.

Tale is not limited to software development. The same communication problems appear in any project where humans and AI work together: instructions may be ambiguous, important context may be lost, rules may be repeated inconsistently, acceptance criteria may be unclear, and different kinds of information may need different levels of importance or enforcement.

Tags provide a simple way to structure this communication. Built-in tags cover common needs such as goals, scope, requirements, checks, change limits, tests, and proof, but the vocabulary is intentionally open. Individuals and teams can create their own tags to represent the concepts, rules, decisions, workflows, and communication patterns that matter in their own projects.

The aim is not to force every interaction into a fixed schema. It is to provide a simple shared structure that helps humans and AI communicate more clearly, repeatedly, and consistently, while allowing different layers of communication—from general guidance and context to explicit rules, acceptance criteria, and verifiable constraints.

## Tale diagrams are made for humans

People do not naturally think in configuration files, schemas, or isolated rule sets. We think in **ideas, relationships, intentions, examples, warnings, priorities, exceptions, and associations**.

Some of those thoughts may be very high-level — such as the purpose of a project or the way we want an AI agent to behave — while others may be extremely specific, such as **which compiler option to use, which files must not change, or which linter must pass**.

**Tale allows all of these different kinds of thoughts to exist together.**

This is one of the central ideas behind Tale:

**Communication with AI should not be designed in the same way as configuration for traditional software.**

Traditional software needs strict formats because a parser must understand them. A configuration file separates concepts into predefined fields because software can only process the structures that its developers explicitly implemented.

**An AI agent is different.**

It can understand **natural language, concepts, relationships, examples, technical instructions, and project-specific terminology**.

Because of this, humans do not necessarily need one configuration system for architecture, another for coding rules, another for project requirements, another for workflow, and another document explaining the original intention behind all of them.

**They can tell one coherent Tale.**

The challenge is no longer only making information machine-readable.

The challenge is helping humans express what they mean **clearly, consistently, and without creating a large, contradictory, repetitive, or disorganized collection of instructions**.

**This is where the diagram helps.**

The diagram gives humans a place to **organize their thinking before it reaches the AI**.

They can separate ideas, connect related concepts, identify priorities, describe rules, record decisions, define acceptance criteria, and move between **high-level intentions and very specific instructions** without forcing everything into the same rigid structure.

## TAGs are shared human words

Tale TAGs follow the same philosophy.

A Tale **TAG is not a tag in the HTML or XML sense**. It is not primarily a syntax element that exists because a parser requires a predefined keyword.

A TAG is much closer to **a handwritten note placed on a refrigerator with a magnet so that somebody does not forget something important**.

`GOAL`, `DO_NOT_CHANGE`, `CUSTOMER_EXPECTATION`, `USE_THIS_LINTER`, `ASK_BEFORE_DEPLOYING`, or `THINGS_WE_LEARNED` can all be meaningful TAGs if they help the humans and AI working on the project understand each other.

**TAGs are simply shared words attached to pieces of information.**

Their usefulness comes from **human meaning**, not from belonging to a fixed vocabulary.

If those TAGs are **clear, well organized, relevant, and non-contradictory**, they give the AI a much better picture of what the humans actually want.

If they are vague, duplicated, conflicting, or overloaded with unnecessary information, communication becomes harder — **just as it does between people**.

The purpose of Tale is therefore **not to invent another configuration format for AI**.

It is to give humans a simple way to **organize and communicate their thoughts to AI agents in a form that remains understandable to both sides**.


Some Tale information is **advisory**: it communicates context, expectations, conventions, warnings, or lessons learned to the agent. Other information can be **mechanically verified or enforced**, such as explicit requirements, checks, protected files, or acceptance criteria.

**Tale keeps that boundary visible instead of pretending that every human expectation can automatically be enforced by software.**

TAGs should be thought of as **notes used during an ongoing communication**.

Imagine that an AI agent keeps making the same kind of mistake. Instead of repeating the same warning in every prompt, you can create a new TAG such as:

`DO_NOT_BE_SILLY`

and write inside it exactly what should not happen again.

For example:

- do not rewrite a passing test only to make a new implementation pass;
- do not refactor unrelated files while fixing a small bug;
- do not replace an existing pattern unless there is a clear reason;
- do not expand the scope of the task without asking first.

The name of the TAG does not need to belong to a predefined language. It only needs to be **clear and meaningful to the humans and AI agents working on the project**.

In this sense, a TAG is similar to a note you would leave for another person so that an important point is not forgotten.

Some notes may be technical.  
Some may describe behaviour.  
Some may contain project history.  
Some may record a decision.  
Some may warn about a repeated mistake.  
Some may define what “done” means.  
Some may simply explain how the team wants to work.

**The purpose of TAGs is not to classify everything perfectly. Their purpose is to make important communication visible, reusable, and harder to forget.**

Over time, a Tale can therefore become more than a list of rules. It can become a **shared memory between humans and AI agents**: a place where recurring problems, successful patterns, decisions, expectations, and project-specific knowledge can accumulate instead of being rediscovered in every conversation.

Some of those notes can later become formal requirements or checks if the team decides they should be mechanically verified. Others may remain advisory because their value comes from context and judgement rather than strict enforcement.

**Not every useful instruction needs to become a rule, and not every rule needs to become executable.**


### Small iterations over uncontrolled change

Agents should be given work in understandable, reviewable steps. Where appropriate, Tale can communicate that the agent should change the minimum necessary code, avoid unrelated refactors, and preserve behaviour that has already been proven.

A passing end-to-end test, an accepted interface, or another verified result can represent accumulated knowledge: **this part works; do not casually break it while solving the next problem**. Tale's requirements, checks, change boundaries, and Agentic Test lifecycle are intended to make this kind of knowledge explicit.

### Intent over narration

Tale separates **intent** (goals, constraints, agreements, and expected outcomes) from **implementation** (the edits performed by an agent). It does not attempt to prescribe how an agent must reason internally.

### Proof over trust

For mechanically verifiable requirements, completion should be demonstrated rather than assumed. A task is complete when its declared proof passes; “looks correct” is not a verification result.

### Constraints should be explicit

Scope, protected files, determinism requirements, accepted behaviour, and approval boundaries should not be hidden in conversational history. Tale makes them visible and persistent. Where the current verifier supports enforcement, violations can become execution errors; other rules remain explicit instructions to the agent.

### Communication should be extensible

No fixed vocabulary can anticipate every team, project, agent, or future workflow. Tale provides built-in tags for common patterns, but users can extend the language with project-specific tags and sections without changing Tale itself.

---

## Run the desktop editor

From a checkout, with Node.js 22.12 or newer and npm installed, run:

```sh
npm start
```

The first run installs the pinned dependencies, builds the TypeScript, and opens

Electron. Later runs rebuild and launch. Closing the last window exits the app

and its launcher; there is no background development watcher.

The editor opens `tale.project.json` as an unsaved example. Drag rectangles to

move them, drag a corner to resize, and use Arrow or a node's connection port

to connect items. Select an arrow to adjust its curve or reconnect its endpoints.

Use the mouse wheel or pinch to zoom, hold Space and drag to pan, and use Fit to see the board.

Select an item to edit its title and typed properties. The project name opens

settings for types, colours, environments, and Tale outputs.

The File menu provides New, Open JSON, Save, Save As, and Deploy. Save and Save As write the

editor's JSON project to your chosen file. Deploy compiles the current diagram

and writes its deterministic `.tale` outputs into the destination project's

`.tale/` directory. Its dialog lets

you choose agents and instruction files, preview changes, and confirm overwriting

an existing Tale deployment. Existing instructions and unrelated files are preserved;

missing instruction files are created. See [agent integration](docs/agent-integration.md).

Preview Tale and Deploy use the same compiler and produce identical `.tale` bytes. Neither operation executes commands written in rules.

The board saves branches, shared references, and cycles. Compilation currently

supports the documented Tale root/section containment mapping. Undefined flow

semantics, invalid built-in properties, and cyclic containment produce explicit

errors rather than invented output. Add sections to any item using Free text,

Checkboxes (multiple choices), or Radio buttons (one choice). Edit section titles

and options directly; no JSON syntax is needed. Each section has its own duplicate

and delete icons.

### Board navigation

| Input | Behavior |
| --- | --- |
| Mouse wheel in **Mouse** mode | Zoom around the pointer. |
| Two-finger scrolling in **Trackpad** mode | Pan horizontally and vertically. |
| Pinch, or Ctrl / Cmd + wheel | Zoom around the pointer. |
| Wheel in **Trackpad** mode | Pan vertically; Shift + wheel pans horizontally. |
| Right-button drag, middle-button drag, or Space + left drag | Pan, including when the pointer starts over an item. |
| Hand tool + drag | Pan. |
| Zoom buttons / Fit | Change zoom / fit the diagram in view. |

Nothing needs to be selected to navigate. Selection does not change wheel behaviour

and navigation never moves the selected items. Clicking the board dismisses open

File and Add item menus; Escape dismisses them too. Scrolling a menu or inspector

stays within that control instead of navigating the board.

The selector beside the zoom controls offers **Mouse** (the default) and

**Trackpad**, remembered on this device independently of the project JSON.

Mouse mode always zooms with wheel scrolling, including smooth-scrolling and

Magic Mouse input. Trackpad mode pans with two-finger scrolling. Pinch zoom works

in both modes. Automatic device detection is intentionally not used because smooth-scrolling mice

and trackpads can send indistinguishable events; old Auto preferences are treated as

Mouse. In Mouse mode a two-finger scroll also zooms. These are Miro's explicit

navigation modes; Tale does not claim automatic hardware detection.

### Tags: built-in and fully customizable

Tags are fully customizable building blocks: users can define **new tags**, choose

their labels and colours, and author their content with free text, checkboxes,

and radio-button sections. The catalogue belongs to each project; it is not

a closed list, and projects do not need to use every built-in tag. No code or external

library is needed to author a new tag.

Open **Manage types & environments** from Add item (or click the project name),

enter a type name and a new tag such as `TEAM_RULES`, and choose **＋ Item type**.

The tag field also suggests built-in tags. Tags use uppercase letters, numbers, and

underscores, starting with a letter. Add an instance from the palette, edit its

sections, and connect it to a Tale root with a **Contains** arrow. Save retains

the definition and content in JSON; Preview and Deploy compile it into `.tale`.

Colours and display labels can be changed in project settings.

Built-in identifiers retain their defined syntax and validation. For example,

renaming a display label does not turn `CHECK` into a different executable rule.

New tags compile as declarative sections; assigning a tag name does not automatically

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
| `TESTING` | Required test behaviour and coverage: assertions, regressions, UI/IPC cases, determinism checks, and sibling test-file policy. |
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

The verifier also provides a CLI gate with a pinned approval digest. The baseline,

digest, and verifier executable must be protected from agent writes; the verifier is not an OS sandbox.

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

The Electron tests open real windows, automate board interactions, and exercise real IPC/file operations with deterministic

dialog selections. They compare generated file bytes to `.tale/project.tale`

through two clean builds and two editor sessions per build, including save/reopen.

The expected fixture is never regenerated by the tests. A screenshot is written

to `artifacts/editor.png`.

The first implementation is verified on macOS. Windows and Linux still need independent execution of these checks; distributable installers are not included yet.

The executable contract subset now has a verifier. Full PLAN execution and an OS

sandbox remain separate from this implementation.

## TALE — Task Agreement & Logic Engine

**Tale** is a contract language for autonomous software work.

It is designed for communication between **AI coding agents and the humans who work with them**, rather than as another prompt format.

A Tale file does not describe **how to think** — it defines:

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

- a description of an agent's internal reasoning

A Tale task is:

- **executable**

- **verifiable**

- **scope-enforced**

- **deterministic (when declared)**

- **replayable and auditable**

Executable Tale requirements must define how they are mechanically verified. Advisory or descriptive tags may communicate information that is not mechanically enforceable.

---

## The Three Laws of Tale

### Law 1 — Proof or it didn’t happen

Every executable Tale task **must** define how success is mechanically verified.

### Law 2 — Scope is enforced

An executable Tale task **must** define where work may and may not occur. Enforced scope violations are execution errors.

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

The project's own compact rules are stored in [.tale/project.tale](.tale/project.tale).

They exercise a proposed `TYPE project` extension that includes standing coding

rules and approval requirements. Its syntax and semantics are documented in

[Project policy tags](docs/project-policy.md). The executable Requirement/Check

subset is enforced by the [contract verifier](docs/contracts.md); the remaining

standing rules are instructions unless represented by explicit checks. The task format and examples below use the same contract model.

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