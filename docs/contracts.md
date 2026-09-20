# Executable contracts

Tale now has two generic diagram items: **Requirement** (`REQUIREMENT`) and
**Check** (`CHECK`). They are usable in any project; the editor project format,
programming language, and application framework are not built into their meaning.
Existing descriptive tags remain useful instructions. They are not automatically
converted into executable assertions.

## Authoring

Add the items from the palette, connect them to an exported Tale root, and connect
a requirement to its check with a **Verified by** arrow. Drawing from a Requirement
to a Check creates that relationship automatically. The inspector also has a
checklist of checks and a relationship selector. Each check and requirement must
name the same action, such as `publish`, `save`, `migrate`, or `deploy`. This name
is an association, not automatic discovery of an application entry point: the
approved executable adapter must actually exercise that operation.

A requirement has its diagram item's stable ID, an action, a condition, and a
mandatory switch. Supported conditions are:

| Condition | Evidence observed by the verifier |
| --- | --- |
| `exists` | The named project-relative regular file exists after the linked check. |
| `absent` | That path is absent after the linked check. |
| `equals_file` | The named output matches bytes captured from an approved reference file. The live output is never used to regenerate the expectation. |
| `unchanged` | The named file still matches the bytes captured at approval. |
| `command_succeeds` | The linked command completed successfully. Use an approved test adapter for behavior such as an API response. |

Paths are literal, project-relative paths, not shell expressions or globs. Symlink
components and traversal are rejected. Evidence/reference files are currently
limited to 8 MB. Commands have individual timeouts, up to five minutes, and bounded
output capture. Arguments are separate entries, not a shell command string.

A check names an executable, arguments, timeout, and at least one test/adapter file
to protect. Include all proof dependencies that the coding agent must not change;
Tale does not infer an import graph. Executables are run without an implicit shell.
`node` uses the current Node runtime, including Electron's bundled runtime in the
app. Windows `.cmd` wrappers need an explicitly chosen interpreter; use a direct
executable where possible. Process behavior follows [Node's execFile API](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback).

You can save incomplete JSON drafts. Compile and Deploy reject missing mandatory
proof links, unsupported fields, invalid commands/paths, mismatched actions,
missing containment links, and explicit present/absent contradictions for the
same action and file. Issues highlight affected board items; clicking an issue in
Verify selects its items. This is structural validation, not a universal natural
language contradiction detector. Different reference files are not assumed to
contain different bytes.

## Concise Tale representation

```tale
REQUIREMENT
  id publish-report
  action publish
  subject output/report.txt
  condition equals_file
  expected fixtures/report.txt
  mandatory true
  verified_by publish-check

CHECK
  id publish-check
  action publish
  executable python
  arguments tests/exercise_publish.py
  protected_files tests/exercise_publish.py
  timeout_ms 30000
```

IDs and verification references are compiled from diagram items and arrows.
A check can verify several requirements, and a requirement can need several
checks. Every linked check must succeed; every mandatory requirement is observed
after each linked check. Checks execute sequentially in stable ID order. There is
no implicit pipeline order in board geometry or verification arrows. Check
adapters should establish their own fixture state.

`AGREEMENT` adds `contract_changes require_approval`,
`structured_conflicts block`, and `approval_baseline external` to communicate the
approval policy. The verifier always requires its trusted baseline; changing
these words does not switch off its protections.

`PROOF` can declare `contract_verify baseline=external coverage=mandatory`.
The contract verifier implements that gate. It does not execute every legacy
`PROOF`, `PLAN`, or `OVERRIDES` directive. Existing proof commands continue through
the project's normal tooling, or can be explicitly authored as linked Checks.

`OVERRIDES` can record a proposal:

```tale
OVERRIDES
  request_change reason="New agreed report format" requirement=publish-report
```

This request must name an existing requirement and give a reason. It is not an
approval and cannot waive a failed check. Edit the requirement, review the new
contract, and approve a new baseline. Every semantic contract change invalidates
prior approval. The old baseline stays active until replacement is explicitly
confirmed. JSON stores these two proof/change operations as steps with an
`attributes` map; normal inspector controls edit those values.

## Approval and execution

1. Use **Verify**, choose the target project, and review the compiled contract,
   executable commands, and selected protected files. No command runs on open,
   save, compile, deploy, or preview.
2. Enter an approval reason and choose **Approve baseline**. Electron shows a
   native confirmation with the destination, commands, proof files, old approval
   digest, new candidate digest, and reason. Cancel does not create an approval.
3. Tale stores the approved contract, proof-file hashes and reference bytes under
   its user-data `approvals` directory, outside the target project. A changed
   contract, adapter, or reference needs a new approval. Changing layout alone
   does not change the semantic agreement, although an explicitly frozen JSON
   file is still subject to its own `unchanged` requirement.
4. Choose **Run checks**. The runner validates the pinned baseline, contract, and
   protected inputs before executing, between checks, and after execution.
   Expected bytes come from the approved snapshot. Exit-zero alone cannot satisfy
   a file requirement. Results are per check and per requirement; approval alone
   displays **not yet verified**.
5. A result describes that run only. Reopening or changing the project does not
   retain a misleading verified badge. Rerun at the point where a gate matters.

The example project freezes `scripts/prove-deployment.mjs`, which invokes the
application's actual deployment code into a disposable directory under
`artifacts/contract-deployment`. The independent verifier checks the deployed Tale
against the approved `.tale/project.tale`, rejects a deployed editor JSON file,
and checks that the editor project stayed unchanged. The adapter does not decide
its own acceptance criteria.

## CI / command-line gate

After building the trusted verifier, use:

```sh
node dist/node/src/runner/cli.js verify /path/project.json /path/target /trusted/approval.json TRUSTED_SHA256
```

The approval dialog displays the baseline path and digest. Keep the digest in
trusted CI configuration or another authority-controlled location. **Do not
recompute it from an agent-edited baseline at verification time.** The baseline
must be outside the target directory. The CLI exits zero only on success; missing
approval, changed proof inputs, changed requirements, failed commands, missing
files, wrong bytes, and timeouts produce a nonzero exit. Successful runs emit
JSON evidence, suitable for CI logs; this is a verification receipt, not a deployed
editor project. The CLI also rejects a project file changed during the run.

Configure CI/your agent supervisor to require this command before accepting work.
The renderer exposes named verification operations, not arbitrary process APIs;
Electron main holds the destination and reviewed snapshot behind an opaque token.

## Trust boundary and limits

**An external path is not an access-control boundary by itself.** The approved
baseline, pinned digest, verifier installation, and gate configuration must be
outside the coding agent's write permissions. A separate CI identity or an
appropriately restricted agent workspace can provide that boundary. Running the
verifier from this editable repository is development testing, not protection
against an agent that can rewrite the verifier itself.

This implementation prevents unapproved checks from starting through Tale and
rejects completion when its evidence fails. It is **not an OS sandbox** and does
not intercept arbitrary agent edits, reverse command side effects, prevent network
access, or police commands launched outside Tale. Check processes run with the
user's permissions; the timeout terminates the direct check process, not a
portable process-tree sandbox. Use bounded foreground adapters, not daemons.

It verifies the declared contract supplied by the authoring project against the
approval snapshot. It does not independently discover arbitrary agent configuration
or establish that an agent read its deployed instructions. Protect deployed rules
with explicit `unchanged` requirements where that matters. Narrative promises,
unrepresented product requirements, and omitted proof dependencies remain human
review responsibilities. No `approved: true` field in an editable project grants
authority.
