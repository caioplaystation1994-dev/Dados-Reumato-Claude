// Uso interno (Claude Code): cria um registro de artigo SEM passar por PDF/extração de texto —
// para o fluxo em que os dados já vêm extraídos por uma IA externa (a leitura do PDF acontece
// fora deste app) e a Claude só organiza/classifica com classify.js em seguida.
//
// Uso: node server/scripts/add-article-manual.js "<nome original do artigo>"

const db = require('../db');

const originalName = process.argv[2];
if (!originalName) {
  console.error('Uso: node server/scripts/add-article-manual.js "<nome original do artigo>"');
  process.exit(1);
}

const info = db
  .prepare(
    `INSERT INTO articles (filename, original_name, full_text, status, extracted_tables)
     VALUES (?, ?, ?, 'pendente', '[]')`
  )
  .run('(sem PDF — extraído por IA externa)', originalName, '');

console.log(JSON.stringify({ id: info.lastInsertRowid, originalName }, null, 2));
