import re
src = open('design/assets/css/style.css', encoding='utf-8').read()
i = src.index('* { box-sizing')
root = src[:i]
rest = src[i:]
# Font: self-hosted variable build first, then the design's family name.
root = root.replace('--font: "Outfit", system-ui, sans-serif;', '--font: "Outfit Variable", "Outfit", system-ui, sans-serif;')
header = ("/* Leezil Admin design: ported verbatim from design/assets/css/style.css.\n"
          "   Source of truth for brand tokens and every shared layout/component class.\n"
          "   Everything after :root is in @layer components so Tailwind utilities (a later\n"
          "   layer) can still override per element. Re-run scripts/port-design-css when design/ changes. */\n")
out = header + root + "\n@layer components {\n" + rest + "\n}\n"
open('apps/admin/app/assets/css/leezil.css', 'w', encoding='utf-8').write(out)
print(len(out))
