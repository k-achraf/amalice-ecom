# apps/mcp

Remote MCP server (Streamable HTTP, **stateless**) that lets AI agents (Claude, Gemini, any MCP client) operate Amalice. It owns no data, no secrets and no permission logic: it forwards the client's own token to `apps/api`, which decides what that token may do.

## How access works

1. In the admin: **AI → AI agents (MCP)** (`apps/admin/app/pages/settings/ai-agents.vue`, SuperAdmin). Create a token, tick abilities per section (View / Create & edit / Delete), copy it once.
2. Abilities are `"<section>:<level>"` strings. The catalog (sections, which `/admin/<segment>` belongs to which section, `authorizeMcpRequest`) lives in `packages/shared/src/mcp.ts` and is the single source of truth: API, MCP server and admin UI all read it.
3. **Enforcement is in the API**, not here: `JwtAuthGuard` accepts an admin JWT or an `amk_…` token (`apps/api/src/mcp/mcp-token.strategy.ts`), and for a token it checks method + path against its abilities before the handler runs. GET = `read`, POST/PUT/PATCH = `write`, DELETE = `delete`. Default deny: only `/admin/<mapped segment>/…`; `/auth`, `/admin/mcp-tokens` (a token can never manage tokens) and unmapped paths are refused. A token acts as a virtual SuperAdmin whose audit rows read `mcp:<token name>`.
4. This server (`src/server.ts`): `POST /mcp` with `Authorization: Bearer amk_…`; it asks `GET /mcp/self` for the token's abilities (cached 30 s) and registers only the tools that token can use. Revoked/expired/unknown token → 401.

## Tools

- **Curated tools** (`src/tools/{orders,products,shipping,analytics}.ts`): ergonomic wrappers for the common jobs (orders, products incl. full creation with images from URLs / variants / offers / upsells, stock, shipping & dispatch, funnels, visitors, sessions). `src/tools/abilities.ts` maps every tool to the abilities it needs; an unmapped tool makes startup fail, so a tool can't ship without deciding who may use it. This is only a visibility filter: the API still enforces.
- **Generic tools** (`src/tools/generic.ts`): `find_api_endpoints` (searches `GET /mcp/endpoints`, the OpenAPI document filtered to what the token may call) and `call_api` (any `/admin/*` call). They give a token reach over every section it was granted, including ones without a curated tool.
- `create_product` always creates the product hidden (`visible:false`); the owner publishes it in the admin. `add_product_images` downloads images from public URLs only (private/localhost hosts refused).
- Responses over ~60k chars are truncated (`tools/util.ts`).

## Run

```bash
cp .env.example .env    # only port/host/API url; no secrets
pnpm --filter mcp dev   # http://127.0.0.1:3004/mcp
```

Test with MCP Inspector: `npx @modelcontextprotocol/inspector` → Streamable HTTP → URL above → header `Authorization: Bearer <token from the admin>`.

## Gotchas

- ESM package (`"type": "module"`, `nodenext`): relative imports need the `.js` extension. `@amalice/shared` is ESM-only for types.
- Adding a tool: Zod raw shape for `inputSchema`, wrap the handler in `safe()`, `readOnlyHint` on reads, and **add it to `TOOL_ABILITIES`**.
- Adding an admin route segment that agents should reach: add it to a section in `packages/shared/src/mcp.ts` (unlisted segments are denied), rebuild shared.
- Agents' calls come from this server's IP, so they share the API's default throttle (60 req/min/IP). If agents hit 429, raise it for this IP only.
- The Meta ads endpoints use "the requester's own linked Facebook account"; a token has none, so those calls report not-connected.
