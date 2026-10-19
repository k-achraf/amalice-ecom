import { test } from 'node:test'
import assert from 'node:assert/strict'
import { areSimilarNames, computeOrderRisk, detectFakeIdentity, isFuzzyDuplicate, isNearPhone } from '@amalice/shared'

const base = { history: { delivered: 0, returned: 0, cancelled: 0, unreachable: 0, total: 0, last24h: 0 }, wilaya: null, commune: null, phoneBlacklist: null, addressBlacklist: null, isDuplicate: false }

test('fake names are flagged', () => {
  for (const name of ['aaaa', 'test', 'Test', 'azerty', '123456', 'xxxx', 'qsdfgh', 'ab', 'تجربة']) {
    assert.ok(detectFakeIdentity({ name }).name, `${name} should be flagged`)
  }
})

test('real names are not flagged', () => {
  for (const name of ['Mohamed Benali', 'Amine', 'يوسف بن علي', 'Sofiane K', 'Nour Elhouda', 'Lyes Ait Ahmed', null]) {
    assert.equal(detectFakeIdentity({ name }).name, null, `${name} should pass`)
  }
})

test('fake addresses are flagged only when everything is filler', () => {
  assert.ok(detectFakeIdentity({ addressText: 'aaaa' }).address)
  assert.ok(detectFakeIdentity({ addressText: 'test test' }).address)
  assert.ok(detectFakeIdentity({ addressText: '123' }).address)
  assert.equal(detectFakeIdentity({ addressText: 'cité 1000 logts bt 4 n 12' }).address, null)
  assert.equal(detectFakeIdentity({ addressText: 'حي النصر شارع الاستقلال' }).address, null)
  assert.equal(detectFakeIdentity({ addressText: 'rue test pres du marche' }).address, null)
})

test('fake identity adds warning points but never reaches High alone', () => {
  const risk = computeOrderRisk({ ...base, fakeIdentity: { name: 'placeholder word', address: 'only digits' } })
  assert.ok(risk.factors.some((f) => f.code === 'FAKE_NAME'))
  assert.ok(risk.factors.some((f) => f.code === 'FAKE_ADDRESS'))
  assert.notEqual(risk.level, 'High')
  assert.equal(computeOrderRisk(base).factors.some((f) => f.code.startsWith('FAKE_')), false)
})

test('isNearPhone: one typo, swap or missing digit', () => {
  assert.equal(isNearPhone('+213674756914', '+213674756915'), true)
  assert.equal(isNearPhone('+213674756914', '+213674756941'), true)
  assert.equal(isNearPhone('+213674756914', '+21367475691'), true)
  assert.equal(isNearPhone('+213674756914', '+213674756914'), false)
  assert.equal(isNearPhone('+213674756914', '+213551234567'), false)
})

test('areSimilarNames: order, accents, one typo', () => {
  assert.equal(areSimilarNames('Mohamed Benali', 'benali mohamed'), true)
  assert.equal(areSimilarNames('Mohamed Benali', 'Mohammed Benali'), true)
  assert.equal(areSimilarNames('Amine Kaci', 'Amine Kasi'), true)
  assert.equal(areSimilarNames('Mohamed Benali', 'Karim Haddad'), false)
  assert.equal(areSimilarNames('Ali', 'Ali'), false) // too short to trust
})

test('isFuzzyDuplicate needs the same wilaya', () => {
  const a = { phone: '+213674756914', name: 'Mohamed Benali', region: 'Alger', city: 'Bab Ezzouar' }
  assert.equal(isFuzzyDuplicate(a, { ...a, phone: '+213674756915' }), true)
  assert.equal(isFuzzyDuplicate(a, { ...a, phone: '+213551234567', name: 'Mohammed Benali' }), true)
  assert.equal(isFuzzyDuplicate(a, { ...a, phone: '+213551234567', name: 'Mohammed Benali', city: 'Dar El Beida' }), false)
  assert.equal(isFuzzyDuplicate(a, { ...a, phone: '+213674756915', region: 'Oran' }), false)
  assert.equal(isFuzzyDuplicate(a, { ...a, phone: '+213551234567', name: 'Karim Haddad' }), false)
})
