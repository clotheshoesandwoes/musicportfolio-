# CLAUDE.md

## Mode

I'm in auto mode 90% of the time. **Execute, don't ceremony.** No "here's the diff, want me to proceed?" — read the files, do the work, report what changed. Ask one question only if the request is genuinely ambiguous (and even then, propose a default and tell me you'll proceed unless I object).

When I say "yes" / "do it" / "push" / "go" — execute, don't repeat the plan back at me.

## Don't touch what I didn't ask about

- No "improving" unrelated code while you're in there.
- No refactoring on the side.
- No features I didn't ask for.
- If you spot something broken outside scope, mention it at the END of your message — don't fix it.
- One ask = one focused change. Don't bundle.

## Always do these (every code change, no exceptions)

1. Bump `window.BUILD_NUMBER` in `js/helpers.js` (format `b###`).
2. Update the `**Build:**` and `**Updated:**` lines at the top of `FILE_MAP.md`.
3. Add a CHANGELOG entry at the **top** of `CHANGELOG.md` (newest first), formatted like recent entries — quote the user's request, explain what changed and why, list files touched.
4. Read `FILE_MAP.md`, the most recent few `CHANGELOG.md` entries, and the actual file before editing.

If a hook or another session has already bumped the build, bump again to the next number rather than overwriting.

## Code quality

- **Verify before reporting done.** Run `npx tsc --noEmit` and `npx eslint . --quiet` if configured. Fix all resulting errors. If no checker exists, say so explicitly — don't pretend.
- Write what three experienced devs would all write the same way. No robotic comment blocks, no corporate prose, no decorative section headers.
- One source of truth. Never duplicate state to paper over a display bug — find the one source and read from it everywhere.
- Don't over-engineer. Simple and correct beats elaborate and speculative.

## When stuck

- Two failed attempts → stop. Re-read the relevant section top-down. Tell me where your mental model was wrong before trying again.
- "Step back" or "we're going in circles" → drop everything, rethink from scratch.

## My shorthand

- A pasted reference (link, screenshot, code block) is the spec. Match it. My English description is a hint; the reference is the source of truth.
- "Paste the console output" — when I report a bug with no output, I'll grab logs. Trace the actual error from the raw data, don't pattern-match on my description.
- Screenshots = ground truth for visuals. If I show you a layout problem, the pixels in the screenshot beat any description I wrote.

## Project layout pointers

- `FILE_MAP.md` — architecture, every file's purpose, current build number. Read this first when joining fresh.
- `STYLEGUIDE.md` — current Text Galaxy aesthetic (palette, typography, components). Source of truth for theming.
- `VISION.md` — design bible: project vision, art direction, scope.
- `CHANGELOG.md` — what changed and why, newest at top. Skim recent entries before touching unfamiliar code.
- `THEME.md` — historical Beta Decay reference, **not** current direction.
- `HANDOFF.md` — fresh-chat catch-up.

## Local dev

`python serve.py` (port 8000) — handles SPA route rewrites that `python -m http.server` 404s on. Don't push to Vercel during iteration unless I explicitly ask.
