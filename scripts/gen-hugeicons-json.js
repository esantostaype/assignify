// scripts/gen-hugeicons-json.js
// Genera public/hugeicons/{stroke,duotone}.json desde los módulos vendored
// (src/lib/hugeicons/*.js), filtrados a las claves de ICON_NAMES (sin los alias
// *StrokeRounded/*DuotoneRounded, para no duplicar el peso). Esos JSON se sirven
// estáticos y la galería los carga en runtime, así webpack ya no compila ~85k
// líneas de datos en cada build.
//   node scripts/gen-hugeicons-json.js
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const stroke = require(path.join(root, 'src/lib/hugeicons/stroke.js'))
const duotone = require(path.join(root, 'src/lib/hugeicons/duotone.js'))

const cat = fs.readFileSync(path.join(root, 'src/components/hugeicons/iconCatalog.ts'), 'utf8')
const start = cat.indexOf('ICON_NAMES')
const block = cat.slice(start, cat.indexOf('];', start))
const names = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])

const pick = (src) => {
  const out = {}
  for (const n of names) if (src[n]) out[n] = src[n]
  return out
}

const outDir = path.join(root, 'public/hugeicons')
fs.mkdirSync(outDir, { recursive: true })
const s = pick(stroke)
const d = pick(duotone)
fs.writeFileSync(path.join(outDir, 'stroke.json'), JSON.stringify(s))
fs.writeFileSync(path.join(outDir, 'duotone.json'), JSON.stringify(d))
console.log(`names=${names.length} stroke=${Object.keys(s).length} duotone=${Object.keys(d).length}`)
