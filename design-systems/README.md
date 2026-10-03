# Design systems

74 brand-inspired `DESIGN.md` files from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
(commit `f696123`, MIT, see `LICENSE`). Each describes a brand's visual
language — color tokens, typography, spacing, components, and the reasoning
behind them — for design agents to follow.

## Usage

Point Claude at one when building UI, e.g.:

> Build the pricing page following `design-systems/stripe/DESIGN.md`.

To make one the project-wide default, copy it to the repo root as `DESIGN.md`.

Several files suggest running `npx @google/design.md lint DESIGN.md` after
edits; that downloads and executes an npm package, so verify it before use.
