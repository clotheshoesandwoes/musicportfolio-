# Cover art

Drop song artwork in this folder using the track's slug as the filename:

- `covers/rolla.jpg`
- `covers/told-that-girl.jpg`
- `covers/uh-im-sick.jpg`

Supported: `.jpg`, `.jpeg`, `.png`, `.webp`. The prototype tries each extension in order and falls back to a procedural gradient if nothing matches.

Slugify rule: lowercase, strip punctuation, spaces → hyphens. Title "Told That Girl" → `told-that-girl.jpg`.

Recommended: 1000×1000 or larger, square.
