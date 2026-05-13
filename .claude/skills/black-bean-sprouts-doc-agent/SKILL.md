---
name: black-bean-sprouts-doc-agent
description: Work inside the black_bean_sprouts medical and academic document workbench. Use this skill for document structuring, document repair, agent chat, and backend-assisted edits in this repository.
---

# Black Bean Sprouts Document Agent

You are operating inside the `black_bean_sprouts` repository.

## Runtime Boundaries

- Do not use Docker, docker-compose, containers, or container-specific setup paths.
- Do not read or modify system-level Claude configuration under `~/.claude`.
- Use only the project-local Claude runtime rooted at `.claude-runtime/` when the backend invokes Claude Code.
- For custom Claude-compatible APIs, use process environment such as `CLAUDE_CODE_BASE_URL` and `CLAUDE_CODE_AUTH_TOKEN`; do not write credentials to global Claude settings.
- Treat `.claude-runtime/` as private runtime state. Do not commit files from it.
- Do not read `.env`, `.env.local`, credential files, payment keys, API keys, or private certificates unless the user explicitly asks for a configuration inspection.

## Repository Shape

- Backend: `packages/server`.
- Agent runtime boundary: `packages/server/src/integration`.
- Kernel event contract: `packages/xiaolongxia-kernel/src/events/types.ts`.
- Document schema: `packages/doc-schema/src/doc/types.ts`.
- Workbench service: `packages/server/src/services/workbench-application.ts`.
- Document repair service: `packages/server/src/services/agent-document-autonomy.ts`.

## Document Output Contract

When asked to structure or repair a document for the backend, return exactly one valid JSON object unless the prompt asks for a human explanation.

The document JSON must follow the black_bean_sprouts schema:

- Top-level object has `metadata` and `children`.
- Keep block types limited to the repository schema.
- Do not invent authors, references, institutions, figures, years, or DOI values.
- Preserve source meaning over decorative formatting.
- Prefer paragraph blocks when the source structure is ambiguous.
- Preserve clear headings, sections, tables, formulas, abstracts, and references when present.
- Never wrap JSON in markdown fences.
- Never include comments in JSON.

## Editing Rules

- For backend document workspaces, only edit files explicitly named by the prompt, usually the document JSON path inside the prepared workspace.
- Use `Read`, `Write`, `Edit`, or `MultiEdit` only when the backend runtime has provided an isolated document workspace.
- Do not run package installation, database migration, or long-running servers unless the user explicitly asks for that operation.
- Keep changes scoped to the user request and the surrounding module boundary.

## Response Style

- For API-facing prompts, return machine-parseable output first.
- For user-facing chat, answer in concise Chinese unless the user asks otherwise.
- If a requested change cannot be completed because local Claude authentication is missing, say that the project-local Claude runtime needs authentication inside `.claude-runtime/home`, not system `~/.claude`.
