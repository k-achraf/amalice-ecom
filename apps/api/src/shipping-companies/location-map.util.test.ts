import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProposal, classifyCommune, resolveCourierWilaya } from './location-map.util'

const c = (name: string, postalCode: string | null = null, hasStopDesk = false) => ({ name, postalCode, hasStopDesk })
const list = [c('El Kerma', '31000'), c('Oran', '31001'), c('Bir El Djir', '31002')]

test('classifyCommune: exact normalized equality is matched', () => {
  const r = classifyCommune('ORAN', list)
  assert.equal(r.status, 'matched')
  assert.equal(r.matchedCommune?.name, 'Oran')
})

test('classifyCommune: near spelling is review with the near match first', () => {
  const r = classifyCommune('El karma', list)
  assert.equal(r.status, 'review')
  assert.equal(r.suggestions[0]?.name, 'El Kerma')
})

test('classifyCommune: nothing close is unmapped; empty courier list too', () => {
  assert.equal(classifyCommune('Tamanrasset centre', list).status, 'unmapped')
  assert.equal(classifyCommune('Oran', []).status, 'unmapped')
  assert.ok(classifyCommune('Tamanrasset centre', list).suggestions.length <= 5)
})

test('resolveCourierWilaya: saved wilaya row wins, else default parent for 59-69', () => {
  const row = { ourWilayaId: '59', ourCommune: '', courierWilayaId: '47', courierCommune: null, courierPostalCode: null }
  assert.deepEqual(resolveCourierWilaya('59', row), { id: '47', source: 'mapped' })
  assert.deepEqual(resolveCourierWilaya('59', null), { id: '3', source: 'default' })
  assert.deepEqual(resolveCourierWilaya('16', null), { id: '16', source: 'default' })
})

test('buildProposal: order > map > auto > default > none', () => {
  const communesOf = () => list
  const base = { ourWilayaId: '31', ourCommune: 'El karma', current: null, communeRow: null, wilayaRow: null, communesOf }
  const cur = { courierWilayaId: '31', courierCommune: 'Oran', courierPostalCode: null }
  assert.equal(buildProposal({ ...base, current: cur }).source, 'order')
  const communeRow = { ourWilayaId: '31', ourCommune: 'El karma', courierWilayaId: '31', courierCommune: 'El Kerma', courierPostalCode: null }
  const mapped = buildProposal({ ...base, communeRow })
  assert.equal(mapped.source, 'map')
  assert.equal(mapped.courierPostalCode, '31000')
  assert.equal(buildProposal(base).source, 'auto')
  const none = buildProposal({ ...base, ourCommune: 'Zzzzzzzz' })
  assert.equal(none.source, 'default')
  assert.equal(none.courierCommune, null)
  assert.equal(buildProposal({ ...base, ourWilayaId: null }).source, 'none')
})
