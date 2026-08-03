// Auditoria de extração por artigo: mostra TODO percentual do resumo curado e
// o que aconteceu com ele — virou achado catalogado, foi para a fila de
// revisão, ou foi descartado (e por qual guard). Serve para conferir, ao
// incluir um artigo novo, que nenhum achado do texto ficou pelo caminho sem
// que a gente saiba o motivo.
//
// Uso: node server/scripts/audit-article.js <id> [<id> ...]
//      node server/scripts/audit-article.js --novos    (os N mais recentes)

const { execFileSync } = require('child_process');
const path = require('path');
const db = require('../db');

function run(ids) {
  // Reaproveita o próprio pipeline do export: gera o HTML num arquivo
  // temporário e lê os dois índices que ele produz, para auditar exatamente o
  // que o aplicativo vai mostrar — e não uma reimplementação que pode divergir.
  const tmp = path.join(require('os').tmpdir(), 'audit-export-' + Date.now() + '.html');
  execFileSync('node', [path.join(__dirname, 'export-html.js'), tmp], { stdio: 'pipe' });
  const html = require('fs').readFileSync(tmp, 'utf-8');
  require('fs').unlinkSync(tmp);
  const grab = (name) => JSON.parse(html.match(new RegExp('const ' + name + ' = (\\[.*?\\]);\\n', 's'))[1]);
  const findings = grab('FINDINGS_INDEX');
  const auto = grab('AUTO_FINDINGS');

  const PCT = /\d{1,3}(?:[.,]\d+)?(?:\s*[-–]\s*\d{1,3}(?:[.,]\d+)?)?\s*%/g;

  ids.forEach((id) => {
    const a = db.prepare('SELECT id, title, disease, detailed_summary FROM articles WHERE id=?').get(id);
    if (!a) { console.log('id' + id + ': não encontrado'); return; }
    let chunks = [];
    try { chunks = JSON.parse(a.detailed_summary) || []; } catch (e) { /* resumo ausente */ }

    const capturados = new Set(findings.filter((f) => f.articleId === id && f.frequencyText).map((f) => f.frequencyText.trim()));
    const naFila = new Set(auto.filter((f) => f.articleId === id).map((f) => f.frequencyText.trim()));

    let total = 0; const soltos = [];
    chunks.forEach((c) => {
      if (!c || !c.text) return;
      let m; const re = new RegExp(PCT);
      while ((m = re.exec(c.text))) {
        total++;
        const v = m[0].trim();
        if (capturados.has(v) || naFila.has(v)) continue;
        soltos.push({ v, ctx: c.text.slice(Math.max(0, m.index - 70), m.index + 12).replace(/\s+/g, ' ').trim() });
      }
    });

    console.log('\n=== id' + id + ' [' + (a.disease || '—') + '] ' + (a.title || '').slice(0, 70));
    console.log('    percentuais no resumo: ' + total +
      ' | viraram achado: ' + capturados.size +
      ' | fila de revisão: ' + naFila.size +
      ' | sem destino: ' + soltos.length);
    findings.filter((f) => f.articleId === id && f.frequencyText)
      .forEach((f) => console.log('      ✓ ' + f.finding + ' = ' + f.frequencyText));
    auto.filter((f) => f.articleId === id)
      .forEach((f) => console.log('      ~ [fila] ' + f.finding + ' = ' + f.frequencyText));
    soltos.forEach((s) => console.log('      · [sem destino] ' + s.v + '  ← ' + s.ctx));
  });

  console.log('\nLegenda: ✓ achado catalogado · ~ candidato na fila de revisão · ' +
    '· descartado por algum guard (estatística, subgrupo, desfecho, etiologia, "respectivamente"...).');
  console.log('Todo item "sem destino" merece um olhar: ou é ruído legítimo, ou é um achado que o dicionário ainda não cobre.');
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Uso: node server/scripts/audit-article.js <id> [...]  |  --novos');
  process.exit(1);
}
if (args[0] === '--novos') {
  const n = parseInt(args[1], 10) || 5;
  run(db.prepare('SELECT id FROM articles ORDER BY id DESC LIMIT ?').all(n).map((r) => r.id).reverse());
} else {
  run(args.map(Number).filter((x) => !isNaN(x)));
}
