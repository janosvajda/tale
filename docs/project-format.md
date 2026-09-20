# Initial project JSON

[`tale.project.json`](../tale.project.json) is the first editor project, manually
mapped from `.tale/project.tale`. `formatVersion: 1` versions this provisional
JSON format independently of the Tale language version. The initial editor uses
this project as its example and the compiler's independently authored fixture.

| Field | Meaning |
| --- | --- |
| `id`, `name` | Stable project identifier and editable display name. |
| `environments` | User-managed entries with stable `id` and editable `name`. Empty here because this Tale applies project-wide. |
| `itemTypes` | Project-owned type definitions: stable `id`, editable `label`, associated Tale `tag`, and an editable `color` accent in `#RRGGBB` form. Users may define new tags; instances share their tag's colour. |
| `diagram.items` | Rectangles with stable IDs, editable `title`, type references, structured properties, and board geometry. Textual property values are editable content; titles are display data. |
| `diagram.connections` | Directed arrows referring to item IDs, independent of item nesting. Optional `bend: {x, y}` stores the quadratic curve's control point in board coordinates. |
| `diagram.viewport` | Saved world-to-screen transform: `screen = world * zoom + (x, y)`. Zoom must be positive. |
| `exports` | Compiler output definitions pointing to a Tale root item, an optional environment ID, and a path relative to the deployment target. `null` environment means project-wide. Deploy compiles these outputs into `.tale` files. |

All IDs must be unique within their collection. All type, item, and environment
references must resolve. Positions use board coordinates; sizes must be positive.
Moving or renaming an item does not change its ID or rule meaning. Property
values retain JSON types: booleans, numbers, strings, lists, and objects.

Every item has a nonempty title. Each defined tag has a distinct, persistent
colour in the project catalogue. The initial colours are editable starting
values; the future UI must provide legible contrast and visible tag labels.
The catalogue includes every currently defined tag, including unused task tags
`PLAN` and `OVERRIDES`. `DETERMINISM` is instantiated for compiled output.
Catalogue entries do not produce output
sections until instantiated and connected to an exported Tale. There is no need
to add empty task sections to a project policy.

This example uses `contains` arrows from one Tale root to its sections. Their
`order` values define section output order, not task execution order. Orders must
be unique among a parent's containment arrows. Board positions and JSON object
key order do not determine section ordering or permissions.

Connections can represent branches, cycles, and multiple references without
duplicating items. This initial Tale's containment structure is acyclic. Future
flow relationships must define their own semantics; a compiler must not silently
interpret every arrow as "run next", expand cycles recursively, or discard
unsupported relationships. Saving a graph and compiling it are separate abilities.

The initial mapping preserves the existing Tale:

- The root's `version` produces `TALE v0`; each child type supplies its section tag.
- Ordinary properties become directives. Lists become space-separated values;
  booleans become `true` or `false`. Their display order is not semantic.
- `GOAL.text` becomes the goal text, with each stored line indented in the output.
- `SCOPE.mode` follows the section tag; each `paths` entry occupies its own line.
- `PROOF.steps` is ordered. Run steps retain the command, expected exit code, and
  condition. Review and stop steps preserve the existing project-policy syntax.
- `DETERMINISM.rerun_check` and `clean_build_check` store numeric `runs`
  attributes, emitted as `rerun_check runs=2` and `clean_build_check runs=2`.
- Layout, titles, colours, display labels, and project IDs are editor data and
  are not emitted. Editing a title does not rename its associated Tale tag.

Tag names start with A–Z and contain only A–Z, digits, and underscores. Built-in
tags retain their documented property validation. User-defined tags compile as
their own section headers, with properties in sorted key order followed by the
item's custom sections. They need no compiler plugin. This preserves declarative
content; new names do not acquire executable semantics automatically.

The compiler quotes string values when needed and rejects invalid built-in
properties and graph relationships outside its supported mapping, rather than losing them.
`PLAN`, `PROOF`, and `OVERRIDES` use ordered `steps`. Known run/review/stop steps
have the shapes in the sample; other task directives use `operation`, optional
`args`, `attributes`, and nested `children`. Attribute keys are sorted, and the
compiler never executes these directives. Unsupported task semantics still
require a language definition and runner; editable tags are not proof of runtime
enforcement.
Environment combination and override semantics remain to be designed; this
example does not introduce presets or implicit overrides. Rule meanings remain
defined in [project-policy.md](project-policy.md).

The built editor must produce byte-identical Tales from the same JSON across
repeated sessions and clean builds. Layout and labels remain non-semantic;
save/reopen without rule changes must preserve the generated bytes. The project
policy defines exact encoding and the end-to-end acceptance checks. Neither a
JSON-only comparison nor normalized Tale text satisfies that requirement.

Deploy compiles the current diagram using its `exports` list, writes the generated
`.tale` files into the destination's `.tale/` directory, and updates selected agent
instructions to load those exact files. The deployed bytes match Preview Tale.
Compilation errors prevent deployment; JSON is never a deployment artifact.
Save and Save As write the editor project JSON to the user's working project path.
Deploy uses an independent destination and does not change that save location.

### User-created item sections

An item may also contain an ordered `sections` list, independent of its tag's
predefined properties. Any item can have any number of repeated section types.
Each section has its own `id`, editable `title`, and `type`:

- `text`: a `text` string, including empty drafts and multiple lines.
- `checkboxes`: an `options` list, allowing multiple selected options.
- `radio`: an `options` list, allowing at most one selected option.

Each option has an `id`, editable `label`, and boolean `selected`. No selection
is allowed while authoring. Section IDs are unique within their item; option IDs
are unique within their section. Duplicating a section creates fresh IDs. Existing
project JSON without `sections` remains valid and compiles identically.

The compiler appends user sections after the containing item's predefined
properties, preserving section and option order. This is a declarative extension
of the current Tale mapping (not an executable instruction):

```tale
  section "Communication" type=text
    text "Discuss first.\nKeep changes small."
  section "Allowed tools" type=checkboxes
    selected "TypeScript" "Biome"
  section "Approval" type=radio
    selected "Required"
```

Titles and literal content use JSON string quoting to preserve punctuation and
newlines. Section titles are semantic, unlike diagram item titles. Only selected
options become agreement content; unselected alternatives remain in the project
JSON. A bare `selected` line means no choice was made. Text line endings normalize
to LF. IDs and editing controls are not emitted. Sections attached to the Tale
root appear below `TALE v0`, before its child tags. A GOAL may use custom sections
in place of its legacy text field; other required Tale fields retain their checks.

### Requirements and checks

`REQUIREMENT` and `CHECK` are additive item tags; existing project JSON remains
valid. Requirement properties are `action`, `subject`, `condition`, `expected`,
and `mandatory`. Check properties are `action`, `executable`, `arguments`,
`protected_files`, and `timeout_ms`. Their `id` is the diagram item ID and is
compiled into the Tale. `verified_by` arrows go from Requirement to Check and
compile into the requirement's sorted `verified_by` references. They do not define
execution order. Both items must be contained in the same exported root.

Draft project validation permits incomplete contracts. Compilation runs the
contract validator before producing any artifact. Verification approvals and
results are not authority-bearing fields in project JSON; approval snapshots live
outside the target. See [executable contracts](contracts.md) for the schema's
conditions, checks, proof/change steps, and execution semantics.
