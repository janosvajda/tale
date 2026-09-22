# Tags and Skills

A Tag is a named, coloured human-language note. A Skill uses the same simple note model but has its own palette and library tab. Both have exactly one multiline default text value. There are no required properties, checkboxes, radio buttons, or special compiler switches for individual names.

The starting definitions live in [Tag definitions](../src/model/catalogue.json) and [Skill definitions](../src/model/skills.json). They are data, not a fixed TypeScript vocabulary. A new project copies them into its JSON, where the user can add, rename, recolour, and edit them. Names must be unique within that project. The app generates internal identifiers from names so the user does not need to manage them.

The built-in Tags are reusable instructions for AI agents, not prompts telling the human to fill in content. The palette's information icon shows each definition's full default text on hover and opens it in the library on click. Placing it copies that text onto the board. The library editor changes defaults for future placements; the board inspector edits one placed note. Saving the project retains both its definitions and placed notes. Deploying compiles only the placed notes. A Tag's heading is its uppercase identifier; a Skill's heading is `SKILL` followed by its name. Its body is the note's plain text.
