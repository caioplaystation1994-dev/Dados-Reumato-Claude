// Roda todas as suítes em sequência e resume o resultado.
// Uso: node testes/executar.mjs
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pasta = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(pasta).filter(f => /^\d\d-.*\.mjs$/.test(f)).sort();

function rodar(arquivo) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [join(pasta, arquivo)], { stdio: 'inherit' });
    p.on('close', codigo => resolve(codigo === 0));
  });
}

let falharam = [];
for (const s of suites) {
  console.log('\n══════ ' + s + ' ══════');
  if (!await rodar(s)) falharam.push(s);
}

console.log('\n' + '═'.repeat(50));
if (falharam.length) {
  console.log('❌ ' + falharam.length + ' de ' + suites.length + ' suíte(s) com falha: ' + falharam.join(', '));
  process.exit(1);
}
console.log('✅ ' + suites.length + ' suíte(s), todas passando');
