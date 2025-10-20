const fs = require('fs')
const path = require('path')

function walk(dir){
  const res = []
  for (const name of fs.readdirSync(dir)){
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) res.push(...walk(full))
    else res.push(full)
  }
  return res
}

describe('button type enforcement', ()=>{
  test('all interactive buttons in components have explicit type attribute', ()=>{
    const compDir = path.join(__dirname, '..', 'components')
    const files = walk(compDir).filter(f => f.endsWith('.js') || f.endsWith('.jsx'))
    const missing = []
    const buttonRegex = /<button[\s\S]*?>/g
    const typeRegex = /<button[^>]*\stype\s*=\s*"?(?:button|submit|reset)"?[^>]*>/i
    for (const f of files){
      const src = fs.readFileSync(f, 'utf8')
      const matches = src.match(buttonRegex)
      if (!matches) continue
      for (const m of matches){
        // skip if it's a submit in an explicit form (we still require type)
        if (!typeRegex.test(m)) missing.push({ file: path.relative(process.cwd(), f), snippet: m.slice(0,120) })
      }
    }
    if (missing.length){
      const msgs = missing.map(x=> `${x.file}: ${x.snippet}`)
      throw new Error('Found buttons without explicit type:\n' + msgs.join('\n'))
    }
  })
})
