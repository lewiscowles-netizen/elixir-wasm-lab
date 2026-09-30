# AGENTS.md

## Documentation

How to write in this repository, in code comments and in documentation. Read it before editing any file.

### Comments are one line

Every comment block is a single line. There is no exception, in any language, including tests and CI workflows. Generated files are exempt: a tool owns them.

A comment says what the code is, or names the decision it implements (`D2`), and stops. Rationale, alternatives and mechanism go in the module's README, which the comment may cite by name.

Older modules predate this rule: do not copy their style, and do not rewrite them unless asked.

### No artificial line breaks

Do not hard-wrap prose. A paragraph is one line and a bullet is one line; the editor wraps it for whatever width the reader has. A comment sentence that needs a second line is one to shorten, not to wrap. A `description` string or docstring is prose: same rule.

Why: a wrapped paragraph reflows when a word changes, so a one-word fix arrives as six changed lines with the real edit hidden among them.

Break a line only where the break carries meaning: list items, table rows, headings, fenced code.

### Documentation follows Diataxis

Every document is one of the four [Diataxis](https://diataxis.fr) types, and its shape shows which:

| Type | Answers | Here |
|---|---|---|
| Reference | What is the interface? | `docs/reference/`, module READMEs |
| How-to | How do I do this one thing? | `docs/how-to/` |
| Explanation | Why is it shaped this way? | `docs/explanation/` |
| Tutorial | Teach me from nothing | `docs/tutorials/` |

Do not mix two types in one document. Link instead.

### Say it once

A fact has one home, and everywhere else links to it. Two documents explaining the same decision drift apart, and the reader cannot tell which one is current. When you find a fact stated twice, delete the copy and link the original.

### Reading time is a budget

Ideal is under 3 minutes, and the maximum is 10. At roughly 200 words a minute that is about 600 words, and 2,000 at the limit. Check before you commit: `wc -w <file>`, divided by 200.

A document over the limit is split, by audience or by type, or cut. Length is not thoroughness: if a fact would not change what the reader does next, it does not go in.

### Plain language is encouraged

Aim for the principles of ISO 24495-1: the reader finds what they need, understands it first time, and can use it. Write for a competent engineer new to this system, and for the non-technical reader wherever one arrives. This is encouragement, not a gate: raise it in review, never block a change on phrasing alone.

- Lead with what the reader has to do or know.
- Short sentences. Active voice. Present tense. Address the reader as "you".
- Expand each acronym and abbreviation on first use in each document.
- Name a thing the same way every time; synonyms read as different things.
- Prefer the ordinary word where both are exact.
- Cut filler: "it is worth noting", "simply", "of course", "essentially".
- Absolute ISO 8601 dates — `2026-09-29`, never "last week".
- Every claim is checkable, or is marked as unverified.
