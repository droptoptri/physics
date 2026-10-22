import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,readdirSync } from 'node:fs'
import ts from 'typescript'
const dictionary=JSON.parse(readFileSync(new URL('../src/translations.json',import.meta.url),'utf8'))
test('every source translation has English and Chinese text, including legal documents',()=>{
  const files=['src/App.tsx','src/main.tsx','src/legal.ts','src/preview.ts','src/api.ts','src/i18n.ts',...readdirSync('src/components').filter(f=>f.endsWith('.tsx')).map(f=>`src/components/${f}`)]
  let count=0
  for(const file of files){
    const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
    const visit=node=>{
      if(ts.isCallExpression(node)&&node.expression.getText(source)==='tr'&&ts.isStringLiteral(node.arguments[0])){
        const key=node.arguments[0].text.trim();const pair=dictionary[key]
        assert.equal(pair?.length,2,`${file}: missing translation: ${key}`)
        assert.ok(pair.every(value=>typeof value==='string'&&value.length>0),key);count++
      }
      ts.forEachChild(node,visit)
    };visit(source)
  }
  assert.ok(count>250,`Expected a complete site dictionary, checked ${count} calls`)
})
