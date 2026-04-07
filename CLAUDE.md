

## ⛔ MANDATORY WORKFLOW — NO EXCEPTIONS

### Before writing ANY code:
1. **STATE** what you think I'm asking for (in your own words)
2. **LIST** every file you would modify
3. **PROCEED** unless the change is destructive, touches >5 files, or the request is ambiguous — then ask first

### You are FORBIDDEN from:
- Adding features I didn't explicitly request
- "Improving" or "cleaning up" code while making other changes
- Interpreting vague requests — ask for clarification instead
- Making multiple unrelated changes in one response

### If my request is ambiguous:
ASK. Do not guess. Do not "be helpful."

---

## ⛔ ABSOLUTE RULES — NEVER VIOLATE

### 1. NEVER modify files without explicit approval
- Show me the diff FIRST, wait for my "yes"
- Do NOT "fix" things I didn't ask about
- Do NOT refactor "while you're in there"

### 2. ASK which files you need BEFORE writing code
```
To make this change, I'll need to see:
- src/views/JournalView.tsx (for X)
- src/core/editor.ts (for Y)

Want me to proceed after reviewing these?
```

### 3. ALWAYS update these files with EVERY code change
- `CHANGELOG.md` — Add entry at TOP (newest first)
- `FILE_MAP.md` — Update build number, line counts, any structural changes

### 4. ALWAYS increment the build number
- Format: `b286` → `b287`
- Update in: `FILE_MAP.md` header, `CHANGELOG.md` entry, `src/core/helpers.ts` (`BUILD_NUMBER`)

### 5. READ before you write
1. Read `FILE_MAP.md` to understand current architecture
2. Read `CHANGELOG.md` recent entries for context
3. Read the actual file you're about to modify

---

## 🔧 Code Quality

### Forced Verification
Never report a task complete until you have:
- Run `npx tsc --noEmit`
- Run `npx eslint . --quiet` (if configured)
- Fixed ALL resulting errors

If no type-checker exists, say so explicitly.

### Write Human Code
No robotic comment blocks, no excessive section headers, no corporate descriptions of obvious things. If three experienced devs would all write it the same way, that's the way.

### Don't Over-Engineer
Don't build for imaginary scenarios. Simple and correct beats elaborate and speculative.

### One Source of Truth
Never fix a display problem by duplicating state. One source, everything reads from it.

---

## 🔄 Workflow

1. **YOU ASK:** "Which files do I need to see?"
2. **I PROVIDE:** The specific files
3. **YOU READ:** The files thoroughly
4. **YOU PROPOSE:** Show me exactly what you'll change (diff format preferred)
5. **I APPROVE:** "Yes, apply it" or "No, change X"
6. **YOU APPLY:** Make the changes
7. **YOU UPDATE:** CHANGELOG.md + FILE_MAP.md + bump build number
8. **YOU DELIVER:** All modified files together

### One-Word Mode
When I say "yes," "do it," or "push" — execute. Don't repeat the plan.

### Follow References, Not Descriptions
When I point to existing code as a reference, match its patterns exactly. My working code is a better spec than my English description.

### Work From Raw Data
When I paste error logs, trace the actual error. If a bug report has no output, ask: "paste the console output."

---

## 🔁 Failure Recovery

If a fix doesn't work after two attempts, stop. Read the entire relevant section top-down. Figure out where your mental model was wrong and say so.

If I say "step back" or "we're going in circles," drop everything. Rethink from scratch.

---
