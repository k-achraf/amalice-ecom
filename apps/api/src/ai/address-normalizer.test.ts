import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restoreOriginalWords } from './address-normalizer.service'

// The cleaned street line may only drop words (the commune/wilaya names): it must
// never add or reword anything, and must keep the customer's own spelling.

const cases: [name: string, cleaned: string, original: string, expected: string | null][] = [
  ['restores an accent the model dropped', 'rue didouche mourad n 12 pres du marche', 'rue didouche mourad n 12 pres du marché hussin dey', 'rue didouche mourad n 12 pres du marché'],
  ['drops commune words, keeps the rest as written', 'cité 1000 logt pres du marché', 'cité 1000 logt pres du marché bab ezouar', 'cité 1000 logt pres du marché'],
  ['rejects a corrected typo (new word)', 'rue didouche mourad', 'rue didouch mourad hussin dey', null],
  ['rejects an added word', 'rue didouche mourad centre', 'rue didouche mourad', null],
  ['rejects a translation', 'street didouche', 'rue didouche', null],
  ['ignores case and stray punctuation', 'Cité 1000, Logt.', 'cité 1000 , logt .', 'cité 1000 logt'],
  ['keeps Arabic as written', 'حي 1000 مسكن', 'حي 1000 مسكن بجانب السوق', 'حي 1000 مسكن'],
  ['writes Arabic diacritics back as the customer typed them', 'حي النصر', 'حيّ النَّصر', 'حيّ النَّصر'],
  ['empty answer → null so the caller keeps the original', '   ', 'rue x', null],
  ['punctuation only → null', ' , . ', 'rue x', null]
]

for (const [name, cleaned, original, expected] of cases) {
  test(`restoreOriginalWords: ${name}`, () => {
    assert.equal(restoreOriginalWords(cleaned, original), expected)
  })
}
