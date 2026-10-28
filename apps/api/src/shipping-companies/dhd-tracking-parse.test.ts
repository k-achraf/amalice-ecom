import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DhdApiService, stageFromActivity } from './dhd-api.service'

// A real get/trackings/info answer (no `data` wrapper, status as a display name, operations in
// `activity`, delivery attempts in `deliveryAttempts`).
const body = {
  ECV1: {
    OrderInfo: { tracking: 'ECV1', driver_name: 'bouchellik mouloud oulid', driver_phone: '0777820080', stop_desk: 0 },
    status: 'En livraison',
    activity: [
      { date: '2026-10-27', time: '16:35:08', status: 'order_information_received_by_carrier', station: '' },
      { date: '2026-10-28', time: '12:21:27', status: 'dispatched_to_driver', scanLocation: 'HUB', station: 'Station El Eulma' }
    ],
    deliveryAttempts: []
  },
  ECV2: {
    OrderInfo: { tracking: 'ECV2', driver_name: '', driver_phone: '' },
    status: 'En livraison',
    activity: [{ date: '2026-10-28', time: '09:35:33', status: 'attempt_delivery', station: 'Station Birkhadem' }],
    deliveryAttempts: [{ created_at: '2026-10-28 09:35:33', driver: '', station: 'Station Birkhadem', text_tentative: 'Client injoignable', postponed_to: null, done_by: 'Station' }]
  }
}

test('trackings/info without a data wrapper is read per tracking', () => {
  const svc = new DhdApiService() as unknown as { entriesOf(b: unknown): Record<string, Record<string, unknown>>; toTrackingInfo(r: Record<string, unknown>): ReturnType<typeof Object> }
  const entries = svc.entriesOf(body)
  assert.deepEqual(Object.keys(entries), ['ECV1', 'ECV2'])
  const a = svc.toTrackingInfo(entries.ECV1!) as { status: string; driver_name: string; activity: { kind: string; activity?: string }[] }
  assert.equal(a.status, 'En livraison')
  assert.equal(a.driver_name, 'bouchellik mouloud oulid')
  assert.equal(a.activity.length, 2)
  assert.ok(a.activity.every((x) => x.kind === 'operation'))
  const b = svc.toTrackingInfo(entries.ECV2!) as { driver_name: string | null; activity: { kind: string; reason?: string }[] }
  assert.equal(b.driver_name, null)
  assert.equal(b.activity.filter((x) => x.kind === 'attempt')[0]?.reason, 'Client injoignable')
})

test('a data-wrapped answer (orders/status) is read too', () => {
  const svc = new DhdApiService() as unknown as { entriesOf(b: unknown): Record<string, unknown> }
  assert.deepEqual(Object.keys(svc.entriesOf({ data: { X: { status: 'en_livraison' } } })), ['X'])
  assert.deepEqual(Object.keys(svc.entriesOf({ message: 'x' })), [])
})

test('stage from the last meaningful operation', () => {
  assert.equal(stageFromActivity([{ activity: 'dispatched_to_driver' }, { activity: 'attempt_delivery' }]), 'OutForDelivery')
  assert.equal(stageFromActivity([{ activity: 'dispatched_to_driver' }, { status: 'livred' }]), 'Delivered')
  assert.equal(stageFromActivity([{ activity: 'order_information_received_by_carrier' }]), null)
})
