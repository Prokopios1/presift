# Agency Agents Rules

This directory contains individual persona rule markdown files imported from the [Agency Agents](https://github.com/msitarzewski/agency-agents) suite.

## Usage

Each file in `rules/` has YAML frontmatter with `trigger: manual` to ensure that personas are loaded strictly on demand rather than accumulating in the LLM context window.

1. Review [`AGENTS.md`](../AGENTS.md) at the project root to find the appropriate role.
2. Read only the single requested persona file (e.g., `.agents/rules/<slug>.md`).
3. Never batch-load or concatenate all persona files into context.
