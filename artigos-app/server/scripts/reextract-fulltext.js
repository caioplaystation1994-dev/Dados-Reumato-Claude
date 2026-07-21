// Uso interno (Claude Code): re-extrai o full_text de artigos ja existentes
// usando pdftotext -layout (mais fiel que o pdf-parse original, especialmente
// para tabelas, que antes ficavam com celulas coladas sem espaco).
//
// Uso: node server/scripts/reextract-fulltext.js [--id N]
// Sem --id, reprocessa todos os artigos que tem um PDF salvo em uploads/.

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const db = require('../db');
const { UPLOAD_DIR } = require('../paths');

function extractWithPdftotext(pdfPath) {
  return execFileSync('pdftotext', [pdfPath, '-'], { maxBuffer: 1024 * 1024 * 100 }).toString('utf-8');
}

const idArgIndex = process.argv.indexOf('--id');
const onlyId = idArgIndex !== -1 ? Number(process.argv[idArgIndex + 1]) : null;

const articles = onlyId
  ? db.prepare('SELECT id, filename, original_name FROM articles WHERE id = ?').all(onlyId)
  : db.prepare('SELECT id, filename, original_name FROM articles WHERE filename IS NOT NULL ORDER BY id').all();

const updateStmt = db.prepare('UPDATE articles SET full_text = ? WHERE id = ?');

let ok = 0;
let failed = 0;

articles.forEach((a) => {
  const pdfPath = path.join(UPLOAD_DIR, a.filename);
  if (!fs.existsSync(pdfPath)) {
    console.log(`#${a.id} (${a.original_name}): PDF nao encontrado em uploads/, pulado.`);
    failed++;
    return;
  }
  try {
    const text = extractWithPdftotext(pdfPath);
    if (!text.trim()) throw new Error('texto vazio');
    updateStmt.run(text, a.id);
    console.log(`#${a.id} (${a.original_name}): OK (${text.length} chars)`);
    ok++;
  } catch (err) {
    console.log(`#${a.id} (${a.original_name}): ERRO - ${err.message}`);
    failed++;
  }
});

console.log(`\nConcluido: ${ok} atualizados, ${failed} com problema, de ${articles.length} total.`);
