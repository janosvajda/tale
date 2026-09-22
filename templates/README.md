# Tale project templates

**File → New project** asks for a title, an optional deployment directory, and a
Tale template. The directory may be left empty or typed before it exists. Deploy
asks for the destination again, then previews the generated Tale and agent files.

| JSON diagram | Starting rules |
| --- | --- |
| [blank.json](blank.json) | Empty board with the Tag catalogue available. |
| [node-typescript-eslint-webpack.json](node-typescript-eslint-webpack.json) | Node.js, strict TypeScript, ESLint flat configuration, Webpack with ts-loader, behavior tests and completion checks. |
| [node-typescript-biome-webpack.json](node-typescript-biome-webpack.json) | Node.js, strict TypeScript, Biome linting/formatting, Webpack with ts-loader, behavior tests and completion checks. |
| [rust-clippy.json](rust-clippy.json) | Rust, Cargo, Clippy, rustfmt, behavior tests and completion checks. |

These files contain editable **agreement diagrams**, not application scaffolding. The nonblank templates connect their starting notes with meaningful, editable relationships.
Creating a project copies the selected diagram, assigns a fresh project ID and
uses the entered title. It does not run commands, install dependencies, or write
to the deployment directory. Review the starting rules for your application.
Save / Save As writes your editor project JSON; Deploy writes the compiled
`.tale/project.tale` and the selected agent instructions.

Templates use the ordinary [project JSON format](../docs/project-format.md),
including their Tag and Skill definitions, plain-language notes, connections and layout. Add a valid
project JSON file to this directory to offer another template; its `name` is the
label in the dialog. No TypeScript changes or template registration are needed.
Template files remain unchanged when users edit the copied diagrams. A project's
optional `deploymentDirectory` is editor metadata and never changes compiled Tale
bytes. A saved diagram compiles to identical bytes on repeated builds.

Tool configuration references: [Webpack TypeScript integration](https://webpack.js.org/guides/typescript/),
[typescript-eslint flat configuration](https://typescript-eslint.io/getting-started/),
[Biome setup](https://biomejs.dev/guides/getting-started/), and
[Clippy usage](https://doc.rust-lang.org/clippy/usage.html).
