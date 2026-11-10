# savvy-progress

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [savvy-flow](../savvy-flow) skill, and useful with any subagents.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears as soon as something reports progress (savvy-flow does) or any subagent starts, whatever its type, and the agents panel opens with it.
- **Agents panel** (`/agents-info` toggles it): running, reviewer and planned subagents (finished runs are not shown; the state keeps only the newest 12) with model, effort, task progress, context and time. Working crabs walk, and each savvy tier animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them.
- **Role avatars** (`hooks/rolle.ts`, drawings in `hooks/rollen-kostueme.ts`): a role beats the savvy tier. The role comes from the agent type (`bauer`, `analyst`, `pruefer`, also as `plugin:type`) or from a description starting with "Bauer", "Analyst", "Prüfer" or "Rechercheur". Bauer = developer with headphones and a laptop (the claws type), Analyst = detective with the magnifier, Prüfer = white hard hat with a clipboard whose tick blinks, Rechercheur = explorer in a safari hat digging with a shovel. All other agents keep their tier avatar. The figures are drawn here in the existing pixel style (the upstream repo has no role avatars, checked 10.10.2026); `prefers-reduced-motion` stops their motion like the others.
- **Reviewers** (agent type `pruefer`, or a description starting with "Prüfer") get their own collapsible "Prüfer · N" section below "Running". They are not counted in "Running · N" or in the crew number on the "Agents N" button, and carry no time estimate. Finished reviewers stay under "Finished".

## Tools it adds

- `mcp__savvy-progress__progress`: the orchestrator reports the plan, phase and accepted tasks.
- `mcp__savvy-progress__step`: a worker defines its own steps with a percent share each (`steps`, summing to 100) and reports cumulative progress as `percent` (0-100) plus `note`; `done`/`total` still work and convert to percent. The Tasks pill shows finished/total steps summed over running agents and the mean percent of those agents. A worker that does not report shows its context fill in grey instead.

## Settings

`language`: `auto` (default), `en` or `ru`. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. Set it in `/config`, or, for a mod loaded by hand, in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "ru" } } } }
```

Install instructions are in the [repository README](../../README.md).
