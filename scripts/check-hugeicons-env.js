// scripts/check-hugeicons-env.js
// Diagnóstico del login de Hugeicons. Usa el MISMO cargador que Next (@next/env), así ve las
// variables con el mismo orden de prioridad que el dev server (.env.local > .env.development.local
// > .env ...). Muestra la FORMA de cada variable (longitud, si tiene espacios/CR, comillas, # o $)
// pero NO su valor, así puedes pegar la salida sin exponer credenciales.
//   Correr en la raíz del proyecto:  node scripts/check-hugeicons-env.js
const { loadEnvConfig } = require('@next/env')

const { loadedEnvFiles } = loadEnvConfig(process.cwd())

console.log('Archivos .env que Next carga (de MENOR a MAYOR prioridad; el último gana):')
if (!loadedEnvFiles || loadedEnvFiles.length === 0) {
  console.log('  (ninguno) ⚠  Next no encontró ningún .env')
} else {
  loadedEnvFiles.forEach((f) => console.log('  -', f.path))
}
console.log('')

const keys = ['HUGEICONS_USER', 'HUGEICONS_PASSWORD', 'HUGEICONS_SESSION_TOKEN']
for (const k of keys) {
  const v = process.env[k]
  if (v == null) {
    console.log(`${k}: ❌ NO definida (Next no la ve)`)
    continue
  }
  const t = v.trim()
  const flags = []
  if (v !== t) flags.push('espacios/CR en los bordes')
  if (/["']/.test(v)) flags.push('contiene comillas')
  if (v.includes('#')) flags.push('contiene #')
  if (v.includes('$')) flags.push('contiene $')
  if (/\s/.test(t)) flags.push('espacio interno')
  const warn = flags.length ? `  ⚠ ${flags.join(', ')}` : '  ok'
  console.log(`${k}: definida · longitud ${v.length} (tras trim ${t.length})${warn}`)
}

console.log('')
console.log('Compara la "longitud (tras trim)" de USER/PASSWORD con lo que escribes en el login.')
console.log('Si no coinciden → el valor del .env no es el que crees (otro archivo lo pisa, o tiene # / comillas).')
