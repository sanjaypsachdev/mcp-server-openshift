# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build          # tsc compile to dist/

# Development (no compile step)
npm run dev            # tsx src/index.ts (stdio)
npm run dev:http       # tsx src/index.ts --http (SSE on :3000)

# Run the server
npm run start          # dist/index.js (stdio, default)
npm run start:sse      # dist/index.js --sse --port=3000

# Test
npm test               # vitest (run once)
npm run test:watch     # vitest --watch
npm run test:coverage  # vitest --coverage (requires ≥80% on all metrics)

# Single test file
npx vitest run tests/oc-login.test.ts

# Lint
npm run lint           # eslint src/
npm run lint:fix       # eslint src/ --fix
```

## Architecture

### MCP server structure

`src/index.ts` is the single entry point. It creates `OpenShiftMCPServer`, which wires together all four MCP capability types:

- **Tools** — 14 `oc_*` tools, each in `src/tools/oc-*.ts`
- **Resources** — 3 static read-only resources in `src/resources/`
  - `openshift://cluster-info`, `openshift://project-list`, `openshift://app-templates`
- **Prompts** — 2 prompt templates in `src/prompts/`
- **Sampling** — pod-log sampling handler in `src/sampling/pod-logs.ts`

Transport is auto-detected: stdio by default; HTTP/SSE when `--http`, `--sse`, `--port=N`, or `MCP_TRANSPORT=sse/http` is set.

### Tool pattern

Every tool file exports two things:
1. A `Tool` object (the MCP tool definition with `name`, `description`, `inputSchema`)
2. A `handle*` async function that takes typed args and returns an MCP `content` response

Input validation uses **Zod schemas** defined in `src/models/tool-models.ts`. All schemas and their inferred TypeScript types live there; individual tool files import from it.

### Utility layer (`src/utils/`)

| File | Purpose |
|------|---------|
| `openshift-manager.ts` | Singleton that spawns `oc` subprocesses. All tool handlers go through here. 10 MB output buffer, 30 s default timeout. |
| `tool-base.ts` | Higher-level helper functions (`createToolContext`, `initializeTool`, `verifyResource`, `executeCommand`, etc.) that compose the other utilities into standard patterns. |
| `response-formatter.ts` | Produces consistent `MCPResponse` objects with progress log sections, error analysis, and troubleshooting steps. |
| `progress-logger.ts` | `ProgressLogger` class — timestamped, leveled log entries embedded in responses. |
| `validation-helpers.ts` | DNS-1123 name validation, namespace validation, multi-check composition (`validateMultiple`). |
| `resource-helpers.ts` | Pre-flight `validateResourceForOperation` used by tools that operate on existing resources. |

### Key design decisions

- `OpenShiftManager` is a singleton (`getInstance()`). All tools share one instance; there is no per-request state.
- Tools execute `oc` CLI commands as child processes — the server requires `oc` in `PATH` at runtime.
- `oc_login` enforces HTTPS-only server URLs and blocks private/metadata IP ranges.
- Tests mock `OpenShiftManager` via `vi.mock('../src/utils/openshift-manager.js')`.
- The project is ESM-only (`"type": "module"`); all internal imports must use `.js` extensions.
