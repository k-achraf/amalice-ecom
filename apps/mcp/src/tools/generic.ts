import { z } from 'zod'
import { type ToolContext, safe } from './util.js'

// The curated tools cover the common jobs. These two reach EVERYTHING else the token is allowed to
// do (call center, reconciliation, landing pages, settings, ...): the agent first looks an endpoint up,
// then calls it. The API checks every call against the token abilities, so nothing here can exceed them.
export function registerGenericTools({ server, api, abilities }: ToolContext) {
  if (abilities.length === 0) return

  server.registerTool(
    'find_api_endpoints',
    {
      title: 'Find API endpoints',
      description:
        'Search the admin API for endpoints this token may call (only those it has the ability for). Returns method, path, required ability, parameters and, when documented, the request body schema. Use it before call_api when no dedicated tool exists. Filter with q (words from the path/summary) and/or section (e.g. "call_center", "reconciliation").',
      inputSchema: {
        q: z.string().optional().describe('Words to look for, e.g. "remittance" or "landing page"'),
        section: z.string().optional().describe('Ability section id, e.g. orders, products, shipping, funnels, settings')
      },
      annotations: { readOnlyHint: true }
    },
    safe((q) => api.get('/mcp/endpoints', q))
  )

  server.registerTool(
    'call_api',
    {
      title: 'Call admin API',
      description:
        `Call any admin API endpoint this token is allowed to use. path must start with /admin/. GET needs the section's :read ability, POST/PUT/PATCH :write, DELETE :delete. This token holds: ${abilities.join(', ')}. ` +
        'Prefer the dedicated tools when one exists; use find_api_endpoints to discover paths and body shapes. Money is in cents. These calls change real data: do exactly what the user asked and report what changed.',
      inputSchema: {
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
        path: z.string().startsWith('/admin/'),
        query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
        body: z.unknown().optional().describe('JSON body for POST/PUT/PATCH')
      },
      annotations: { destructiveHint: true }
    },
    safe(({ method, path, query, body }) => api.request(method, path, { query, body }))
  )
}
