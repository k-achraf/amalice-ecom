import { hex } from 'wcag-contrast'

// Polaris surfaces: light page bg #F1F1F1, dark surface from cod-platform-plan.md.
const LIGHT_PAGE = '#F1F1F1' // Polaris page background
const DARK_SURFACE = '#12181A' // dark-theme surface

// After DS-08: brand is an achromatic neutral ramp, #1A1A1A at the 900 stop.
// --ui-primary resolves to brand-900 (light) / brand-50 (dark) — NOT 500/600,
// since brand-500 (#949494 grey) is meaningless as a "primary." The remap in
// main.css points --ui-primary at the 900 stop directly.
//
// Status colors (success/error/info) keep the chromatic base-at-500 ramps;
// their 500/600 stops need the same flat-text-on-white check as DS-01. warning
// is unchanged from DS-01 (gold #C99A2E).
const pairs = [
  ['#1A1A1A' /* brand-900 */, '#FFFFFF', 4.5, 'primary (brand-900) on white'],
  ['#1A1A1A' /* brand-900 */, LIGHT_PAGE, 4.5, 'primary (brand-900) on Polaris page bg'],
  ['#F8F8F8' /* brand-50 */, DARK_SURFACE, 4.5, 'primary (brand-50) on dark surface'],
  ['#949494' /* brand-500 raw */, '#FFFFFF', 4.5, 'brand-500 raw on white — expected to fail (neutral, remapped)'],
  ['#198640' /* success-500 */, '#FFFFFF', 4.5, 'success-500 on white'],
  ['#379c55' /* success-600 */, '#FFFFFF', 4.5, 'success-600 on white'],
  ['#7bdd91' /* success-300 */, LIGHT_PAGE, 3.0, 'success-300 on page bg (large/non-text)'],
  ['#CD0E0E' /* error-500 */, '#FFFFFF', 4.5, 'error-500 on white'],
  ['#0A74C8' /* info-500 */, '#FFFFFF', 4.5, 'info-500 on white'],
  ['#2b88de' /* info-600 */, '#FFFFFF', 4.5, 'info-600 on white'],
  ['#755500' /* warning-600 */, '#FFFFFF', 4.5, 'warning-600 on white (unchanged from DS-01)']
]

let allPass = true
let expectFailFailures = 0
for (const [fg, bg, min, label] of pairs) {
  const ratio = hex(fg, bg)
  const pass = ratio >= min
  const expectedFail = label.includes('expected to fail')
  if (!pass && !expectedFail) allPass = false
  if (expectedFail && pass) {
    // didn't fail when it was expected to — fine, just note it
    expectFailFailures++
  }
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${ratio.toFixed(2)}:1 (need >= ${min})`)
}

process.exit(allPass ? 0 : 1)
