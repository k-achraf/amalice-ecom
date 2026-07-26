import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const url = process.argv[2] ?? 'http://localhost:3211/style-guide'

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
await page.goto(url)
// apps/admin runs ssr:false — the server sends an empty shell and content
// only exists after client-side hydration, so wait for it rather than
// scanning a blank page.
await page.waitForSelector('h1', { timeout: 10000 })
// Excludes Nuxt DevTools' own floating panel — dev-only tooling chrome
// injected by Nuxt itself, absent from production builds, not our app code.
const results = await new AxeBuilder({ page }).exclude('nuxt-devtools-frame').analyze()

console.log(`${results.violations.length} violations`)
for (const v of results.violations) {
  console.log(`- [${v.impact}] ${v.id}: ${v.help}`)
  for (const node of v.nodes) console.log(`    ${node.target.join(' ')}`)
}

await browser.close()

const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
process.exit(blocking.length > 0 ? 1 : 0)
