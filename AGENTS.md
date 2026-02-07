# AGENTS.md

## UI Alignment Guardrails

When building or polishing UI, treat icon alignment as a release-quality detail.

### Text + Icon Controls (chips, pills, inline actions)
- Use a fixed square wrapper for icon buttons (close, dismiss, overflow, etc.).
- Prefer: `inline-flex h-5 w-5 items-center justify-center leading-none`.
- Avoid relying on uneven padding (`p-*`) alone for icon centering next to text.
- Keep icon size slightly smaller than the wrapper (for example `w-3.5 h-3.5` inside `h-5 w-5`).

### Optical QA Checklist
- Verify icon appears vertically centered relative to adjacent text baseline and pill height.
- Check for unequal top/bottom whitespace around icon.
- Validate on at least one long-text and one short-text variant of the same component.
- If alignment looks off, fix wrapper geometry first (height/width/line-height), then icon size.

### Default Fix Pattern
- For close/dismiss icons that look low or high:
  - Convert button to fixed square `inline-flex` container.
  - Add `items-center justify-center leading-none`.
  - Reduce icon size by ~0.5 step if needed.
