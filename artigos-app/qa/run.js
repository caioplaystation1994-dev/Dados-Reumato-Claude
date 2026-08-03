// Runner da suíte de regressão.
//
// Motivo de existir dentro do repositório: a suíte antiga vivia em /tmp e foi
// apagada num reinício de container. Pior: o laço que a executava só procurava
// as palavras PAGEERROR/FATAL na saída, então um script AUSENTE ("Cannot find
// module") era contado como aprovado — a suíte passou a reportar sucesso sem
// executar nada. Este runner falha alto em três casos: arquivo inexistente,
// código de saída diferente de zero, e qualquer marcador de falha na saída.
//
// Uso: node qa/run.js [nome-parcial-do-teste]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TESTS_DIR = path.join(__dirname, 'tests');
const REPO_ROOT = path.join(__dirname, '..', '..');
const HTML = path.join(REPO_ROOT, 'organizador_artigos.html');
const FAIL_MARKERS = /PAGEERROR|CONSOLE ERROR|FATAL|ASSERT FAIL/;

if (!fs.existsSync(HTML)) {
  console.error('FALHA: organizador_artigos.html não existe — rode o export antes.');
  process.exit(1);
}

const filter = process.argv[2];
const files = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.js')).sort()
  .filter((f) => !filter || f.includes(filter));

if (files.length === 0) {
  console.error('FALHA: nenhum teste encontrado em ' + TESTS_DIR + (filter ? ' com filtro "' + filter + '"' : ''));
  process.exit(1);
}

let failed = 0;
files.forEach((f) => {
  const full = path.join(TESTS_DIR, f);
  let out = '';
  let ok = true;
  try {
    out = execFileSync('node', [full], { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
  } catch (err) {
    ok = false;
    out = (err.stdout || '') + (err.stderr || '') + (err.message || '');
  }
  if (FAIL_MARKERS.test(out)) ok = false;
  if (!ok) {
    failed++;
    console.log('FALHOU  ' + f);
    out.split('\n').filter(Boolean).slice(-12).forEach((l) => console.log('        ' + l));
  } else {
    console.log('ok      ' + f);
  }
});

console.log('\n' + (files.length - failed) + '/' + files.length + ' testes passaram.');
process.exit(failed > 0 ? 1 : 0);
