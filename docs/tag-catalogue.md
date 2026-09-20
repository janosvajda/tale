# Tags are data

`src/model/catalogue.json` contains the shipped Tag definitions. The application
has no list of Tag names in its TypeScript compiler, palette, or property editor.
To ship another predefined Tag, add an entry to that JSON file and start the app.
No TypeScript change is needed. New projects copy the catalogue into their JSON.
Existing projects retain their own definitions.

A predefined Tag is **one diagram card with content already inside it**.
Its `initial` content can contain properties and free-text, checkbox, and radio
sections. Adding it to the board makes an independent copy. It does not create
or insert a separate diagram.

Users can create a Tag in **Manage tags & environments**, add it to the board,
edit its sections, then choose the **Save as predefined tag** icon in its header.
The populated definition appears in that project's palette and is preserved by
Save/Open. Editing an instance does not change the definition or other instances.
The definition's name and colour can be edited in project settings.

## Example definition

This example could be added to the JSON catalogue's `tags` array. Its content is
illustrative; teams choose their own lint rules and checks.

```json
{
  "id": "team-linting",
  "tag": "TEAM_LINTING",
  "label": "Linting agreement",
  "color": "#345678",
  "definition": {
    "initial": {
      "properties": {},
      "sections": [
        {
          "id": "intention",
          "title": "Expectation",
          "type": "text",
          "text": "Run the agreed linter before calling a change complete."
        },
        {
          "id": "checks",
          "title": "Required checks",
          "type": "checkboxes",
          "options": [
            {"id": "lint", "label": "Lint passes", "selected": true},
            {"id": "format", "label": "Formatting passes", "selected": true}
          ]
        }
      ]
    }
  }
}
```

`fields` optionally defines structured properties: `key`, display `label`,
`initial` value, and `choices`. The editor renders their native data types.
`initial.properties` determines which properties a new instance starts with;
`initial.sections` supplies its prefilled sections. Unknown/custom Tags can use
sections alone and do not need a schema or special compiler support.

## Deterministic serialization

Definitions can describe the existing compact Tale syntax with generic field
formats: `directive` (default), `header`, `lines`, `values`, `bullets`, and `steps`.
Fields serialize in their declared order; additional properties serialize in
sorted key order. Authored sections preserve their order. Definitions may declare
required fields, allowed values, or reject additional properties. These are
optional data choices, not reserved Tag names.

A definition with `role: "document"` is a document entry point. Its `requiredTags`
list can describe a project's chosen vocabulary; it is not a global requirement
for every custom document. Existing built-in definitions retain their previous
format and checks. Legacy projects acquire those definitions on opening, and Save
embeds them. Embedded definitions take precedence over the shipped catalogue.

Step formatting is also definition data. Changing a shipped formatting rule does
not change the output of a project that already embeds its definitions.

## Verification capabilities

Optional `requirement`, `check`, `proof`, and `override` roles connect Tag data to
the existing verifier. `bindings` maps a definition's property keys onto the
verifier's fixed API. Renaming a Tag does not change that capability. JSON is
inert data: it cannot install executable handlers or grant approval. Commands
still require the existing external approval flow. Ordinary custom Tags need no
verification capability at all.
