# Workbench Word Skill

Use this skill when the workbench asks you to turn a source draft into a polished Word-ready document.

## Inputs

- `source.md`: the user's original text.
- `style.json`: export style hints from the workbench.
- `task.md`: task-specific instructions.

## Output Contract

- Write the final document to `result.md`.
- Do not write JSON.
- Do not put the final document in your chat response.
- Do not create unrelated files.
- Preserve the user's factual content. Do not invent authors, references, institutions, data, figures, or conclusions.
- If the source is long, work incrementally by editing `result.md`.

## Document Rules

- Use Markdown headings (`#`, `##`, `###`) for title and section hierarchy.
- Use an `## 摘要` or `## Abstract` section when the source has abstract-like content.
- Keep formulas as plain LaTeX text.
- Keep tables as Markdown tables when the source clearly contains tabular content.
- Remove chat wrappers, code fences, UI artifacts, and duplicated speaker labels unless they are part of the intended document.
- Keep Chinese documents in Chinese unless the source clearly asks for another language.

## Quality Check Before Finishing

- `result.md` exists and is non-empty.
- The title is clear.
- Section headings are readable.
- Important source paragraphs are preserved.
- The document is ready for conversion to Word.
