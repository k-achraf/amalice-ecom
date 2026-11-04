import { Injectable } from '@nestjs/common'
import type { OpenAPIObject } from '@nestjs/swagger'
import { mcpAbilityOf, type McpAbility } from '@amalice/shared'

export interface McpEndpointInfo {
  method: string
  path: string
  ability: McpAbility
  summary?: string
  parameters: { name: string; in: string; required: boolean }[]
  body?: unknown
}

// The OpenAPI document is built once at boot (main.ts) and kept here, so an agent can
// discover endpoints in production too, where the /docs UI itself is not served.
@Injectable()
export class McpEndpointCatalog {
  private document: OpenAPIObject | null = null

  set(document: OpenAPIObject) {
    this.document = document
  }

  list(allowed: readonly string[], filter?: { q?: string; section?: string }): McpEndpointInfo[] {
    const out: McpEndpointInfo[] = []
    const q = filter?.q?.toLowerCase()
    for (const [path, item] of Object.entries(this.document?.paths ?? {})) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
        const op = item?.[method]
        if (!op) continue
        const ability = mcpAbilityOf(method, path)
        if (!ability || !allowed.includes(ability)) continue
        if (filter?.section && !ability.startsWith(`${filter.section}:`)) continue
        const summary = op.summary ?? op.description
        if (q && !`${method} ${path} ${summary ?? ''}`.toLowerCase().includes(q)) continue
        out.push({
          method: method.toUpperCase(),
          path,
          ability,
          summary,
          parameters: (op.parameters ?? []).flatMap((p) => ('name' in p ? [{ name: p.name, in: p.in, required: !!p.required }] : [])),
          body: (op.requestBody as { content?: Record<string, { schema?: unknown }> } | undefined)?.content?.['application/json']?.schema
        })
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
  }
}
