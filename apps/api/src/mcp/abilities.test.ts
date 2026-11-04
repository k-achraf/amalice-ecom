import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ALL_MCP_ABILITIES, authorizeMcpRequest } from '@amalice/shared'

const ok = (abilities: string[], method: string, url: string) => authorizeMcpRequest(abilities, method, url).ok

test('read ability allows GET only', () => {
  const a = ['orders:read']
  assert.equal(ok(a, 'GET', '/admin/orders?state=Confirmed&page=2'), true)
  assert.equal(ok(a, 'GET', '/admin/orders/123/timeline'), true)
  assert.equal(ok(a, 'POST', '/admin/orders/123/transition'), false)
  assert.equal(ok(a, 'DELETE', '/admin/orders/123'), false)
})

test('write covers POST/PUT/PATCH, delete covers DELETE', () => {
  assert.equal(ok(['orders:write'], 'PATCH', '/admin/orders/1/notes'), true)
  assert.equal(ok(['orders:write'], 'PUT', '/admin/call-center/drop-pause'), false)
  assert.equal(ok(['call_center:write'], 'PUT', '/admin/call-center/drop-pause'), true)
  assert.equal(ok(['orders:write'], 'DELETE', '/admin/orders/1'), false)
  assert.equal(ok(['orders:delete'], 'DELETE', '/admin/orders/1'), true)
})

test('a section never leaks into another', () => {
  const a = ['products:read', 'products:write']
  assert.equal(ok(a, 'GET', '/admin/orders'), false)
  assert.equal(ok(a, 'GET', '/admin/users'), false)
  assert.equal(ok(a, 'POST', '/admin/attributes'), true) // attributes belong to products
  assert.equal(ok(a, 'POST', '/admin/upload-from-url'), true)
})

test('default deny: auth, token management and public routes are closed even with every ability', () => {
  const all = [...ALL_MCP_ABILITIES]
  assert.equal(ok(all, 'GET', '/admin/mcp-tokens'), false)
  assert.equal(ok(all, 'POST', '/admin/mcp-tokens'), false)
  assert.equal(ok(all, 'DELETE', '/admin/mcp-tokens/abc'), false)
  assert.equal(ok(all, 'POST', '/auth/admin/login'), false)
  assert.equal(ok(all, 'POST', '/orders'), false)
  assert.equal(ok(all, 'GET', '/admin'), false)
  assert.equal(ok(all, 'GET', '/admin/some-future-thing'), false)
})

test('path tricks are refused, not interpreted', () => {
  const a = ['orders:read']
  assert.equal(ok(a, 'GET', '/ADMIN/ORDERS'), true) // Express routes are case-insensitive, so are we
  assert.equal(ok(a, 'GET', '/admin/orders/../users'), false)
  assert.equal(ok(a, 'GET', '/admin//users'), false)
  assert.equal(ok(a, 'GET', '/admin/%75sers'), false)
  assert.equal(ok(a, 'GET', '/admin\\users'), false)
  assert.equal(ok(a, 'GET', '/admin/orders;x=/../users'), false)
  assert.equal(ok(['users:read'], 'GET', '/admin/%75sers'), false)
})

test('a token can always read its own info', () => {
  assert.equal(ok([], 'GET', '/mcp/self'), true)
  assert.equal(ok([], 'GET', '/mcp/endpoints?q=order'), true)
  assert.equal(ok([], 'POST', '/mcp/self'), false)
})

test('unknown methods are refused', () => {
  assert.equal(ok([...ALL_MCP_ABILITIES], 'TRACE', '/admin/orders'), false)
})
