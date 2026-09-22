# Tale project JSON

The editor saves a `tale-project` JSON document with `formatVersion: 2`. This is the editable diagram source. Deploy compiles it to one `.tale/project.tale` file and never copies the JSON into the destination's `.tale/` directory. Version 1 is intentionally unsupported.

The document has a project `id`, `name`, optional `description` and `deploymentDirectory`, an `environments` list, reusable `definitions`, and a `diagram`. The deployment directory is a suggestion only; the user chooses the target again before deployment.

Each definition has `id`, `kind` (`tag` or `skill`), `name`, `tag`, `color`, and `defaultText`. The UI presents its name, colour, and one multiline text box. `id` and `tag` are internal identifiers generated from the name. Names are unique across Tags and Skills within a project. The bundled definitions are plain JSON in [catalogue.json](../src/model/catalogue.json) and [skills.json](../src/model/skills.json); projects carry their own editable copies.

Each diagram item references a Tag or Skill definition and contains an editable `title` and one `text` value, plus position and size. Placing a Tag or Skill copies its default text into the item; editing either later does not silently change the other. The project document is implicit and has no board item. Connections store endpoints, order, a human-readable relationship phrase, and drawing information. The viewport stores pan and zoom.

Compilation writes the project title and description, then each placed Tag or Skill in saved item order. It writes each item's text under its heading without interpreting it as key/value fields. Tag headings use their generated uppercase identifier and include an item title when it differs from the definition name; Skill headings use `SKILL Name`. Each outgoing arrow adds a readable sentence below its source note, using the source title, relationship phrase, and target title. No extra Tag is created for relationships. An arrow without a one-line phrase can be saved as a draft but blocks Preview and Deploy until it is described. CRLF is normalized to LF and the file ends with one newline. Colour, geometry, zoom, IDs, library defaults, deployment directory, and environment names do not affect Tale bytes. Environment names are written in selected agent instructions.

The compiler does not execute instructions in a Tale. A sentence such as “Run the tests” remains an instruction for the reader, not a command executed by the app.
