# Loading Tales through agent instructions

The deployment dialog installs project-local references for the agents below.
The documented entry points were checked against official documentation on
2026-09-20. Installing a file does not prove an agent has loaded its contents;
agent-session verification remains separate from deployment.

## This repository's exercise

```text
AGENTS.md → read .tale/project.tale → follow the project agreement
```

`AGENTS.md` loads this repository’s Tale. The app deploys the selected project
compiled Tale files and selected agent references into a destination chosen by the user. It
does not modify personal/global agent configuration.

Creating instruction files and loading existing instruction files are different
operations. Do not assume an agent generates its configuration merely because
a project was opened. Likewise, loading an instruction file containing a link
does not establish that the linked Tale was read.

## Initial official entry points

| Agent | Project instruction entry points | Requirement for Tale integration |
| --- | --- | --- |
| Codex | `AGENTS.md`; `AGENTS.override.md` takes precedence in the same directory | Explicitly instruct the agent to read the Tale. Check the active override and configured fallback names rather than assuming a root file is effective. [Official documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md). |
| Claude Code | `CLAUDE.md`; `.claude/rules/*.md` | `CLAUDE.md` supports native `@path` imports. Resolve relative imports from the instruction file's directory. Account for scoped rules and exclusions. [Official documentation](https://code.claude.com/docs/en/memory). |
| Gemini CLI | `GEMINI.md`, or names configured through `context.fileName` | Supports native file imports. Use the documented context inspection/reload facilities to verify loading in the selected version. [Official documentation](https://geminicli.com/docs/cli/gemini-md/). |
| Cursor | `AGENTS.md`; `.cursor/rules/*.mdc` | Project rules use frontmatter. An entry-point rule should use `alwaysApply: true`; do not create a plain `.md` file in that directory and assume it activates. [Official documentation](https://cursor.com/docs/rules). |
| GitHub Copilot | `.github/copilot-instructions.md`; `.github/instructions/*.instructions.md`; agent instruction files where supported | Distinguish repository-wide instructions from path-specific rules. Feature and client support differ; verify the specific agent experience. [Official documentation](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions). |
| Windsurf / Cascade, current Devin Desktop documentation | `AGENTS.md`; `.devin/rules/*.md`; legacy `.windsurf/rules/*.md` | Use the location recognised by the installed version and an always-on activation mode for the entry point. Avoid creating duplicate preferred and fallback rules. [Official documentation](https://docs.devin.ai/desktop/cascade/memories). |
| Cline | `AGENTS.md`; `.clinerules/`; `.cline/rules/` | Preserve existing rule layout and check activation toggles. An installed but disabled rule is not an active entry point. [Official documentation](https://docs.cline.bot/customization/cline-rules). |

The user's term `agents.md` is supported as an existing filename to detect,
but it must not be advertised as equivalent to official `AGENTS.md` on every
agent and filesystem. For example, Codex documents `AGENTS.md` and configured
fallback filenames. If only lowercase `agents.md` exists, show the mismatch
and propose a supported entry point or explicit fallback configuration. Do
not silently rename or overwrite the user's file, and handle case-insensitive
filesystems without creating case-only duplicates.

## Entry-point examples

For agents that follow ordinary project instructions, use wording like:

```markdown
Before planning or changing code, read `.tale/project.tale` from the repository
root and follow that agreement. If it cannot be read, report the problem before
implementation. Do not load a duplicate copy if it is already in context.
```

For a root `CLAUDE.md`, the documented import mechanism permits:

```markdown
# Tale project agreement
@.tale/project.tale
```

Do not assume Claude's import syntax is interpreted the same way by another
agent. Each integration must establish that its selected agent/version accepts
the referenced file and actually includes its content.

## Deployment dialog

1. Select the agents to support. Codex is selected initially; other agents are
   opt-in. Each agent offers automatic detection or an explicit documented path.
2. Choose the destination project directory. Preview each file's complete proposed
   contents and whether it will be created, updated, or left unchanged.
3. If `.tale/` exists, confirm overwriting the generated `.tale` files. Other files
   inside `.tale/` are preserved. Changing agents or destination clears approval.
4. Deploy compiles the current diagram, including unsaved edits, and writes only
   one compiled `.tale` file. It references that file and lists every project environment
   in a single `tale:project` marker block per selected instruction file. All environments
   share the file; agents follow shared agreements and explicitly scoped environment
   instructions without inferring rules from environment names.
   Existing text outside that block is preserved; malformed markers are rejected.
   Cancel and folder-selection cancellation write nothing.
5. Refresh the selected agents and verify they loaded the Tale before relying on
   its agreements. A successful file deployment is not an agent-session test.

### Detection and activation

Automatic detection chooses the first existing supported file in the dropdown
order, otherwise creates the first supported path. It does not scan arbitrary
rule files or rewrite existing custom imports. Shared paths selected by several
agents receive only one managed block.

- **Codex:** a nonempty root `AGENTS.override.md` takes precedence and is updated
  even when `AGENTS.md` is selected. User-configured fallback names and global
  configuration are not inspected.
- **Claude Code:** root `CLAUDE.md`, `.claude/CLAUDE.md`, or
  `.claude/rules/tale.md`. A `CLAUDE.md` receives a native import relative to its
  directory for each generated `.tale` file; a rule file receives the plain read instruction.
- **Gemini CLI:** automatic detection respects `context.fileName` in the target's
  `.gemini/settings.json` (strict JSON). With a list, it uses the first configured
  filename. An explicit file must be enabled there. Global settings are not read.
- **Cursor:** generated `.mdc` files contain `alwaysApply: true` frontmatter.
- **Copilot:** repository instructions are the default; the optional
  `tale.instructions.md` uses `applyTo: "**"` frontmatter.
- **Windsurf / Cascade:** new rules prefer `.devin/rules/tale.md`; an existing
  `.windsurf/rules/tale.md` is reused. Generated rules use `trigger: always_on`.
- **Cline:** reuse the selected rule layout or `AGENTS.md`. Activation toggles
  must still be checked in the installed agent.

Existing activation headers are preserved. If a chosen rule is not recognized as
always active, deployment reports the problem; it does not rewrite the user's
activation settings. Filenames differing only in case are preserved with a
warning; conflicting variants are rejected. On case-sensitive systems the user
must resolve mismatches with the agent's documented filename before relying on it.

Deployment previews are held in Electron main and committed by a single-use token.
The renderer cannot supply arbitrary write paths. Files and inspected settings are
rechecked before writing; changed targets require another preview. Symbolic links
in output paths are rejected. Writes use temporary files and rename, with rollback
of completed writes on failure. This is not a transaction across process crashes.

JSON is the editor project format, written only through Save / Save As.
Deployment and Preview Tale share the deterministic compiler. Invalid diagrams
or missing outputs stop deployment before any file is written. Loading, nesting, exclusions, context
limits and agent/version behavior must be verified in a fresh agent session; none
of the application tests launch third-party coding agents.
