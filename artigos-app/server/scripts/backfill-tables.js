// Roda a extracao de tabelas (extract-tables.js) retroativamente sobre os
// artigos que ja estao no banco e ainda nao tem extracted_tables preenchido.
// Uso: node server/scripts/backfill-tables.js

const path = require('path');
const fs = require('fs');

const db = require('../db');
const { UPLOAD_DIR } = require('../paths');
const { extractTables } = require('./extract-tables');

function main() {
  const rows = db.prepare(`SELECT id, filename, original_name FROM articles WHERE extracted_tables IS NULL`).all();
  console.log(`${rows.length} artigo(s) sem extracted_tables ainda.`);

  const update = db.prepare(`UPDATE articles SET extracted_tables = ? WHERE id = ?`);
  let totalTables = 0;
  let articlesWithTables = 0;

  rows.forEach((r) => {
    const pdfPath = path.join(UPLOAD_DIR, r.filename);
    if (!fs.existsSync(pdfPath)) {
      console.log(`  id=${r.id} (${r.original_name}): PDF nao encontrado em ${pdfPath}, pulando.`);
      update.run('[]', r.id);
      return;
    }
    const tables = extractTables(pdfPath);
    update.run(JSON.stringify(tables), r.id);
    if (tables.length > 0) {
      articlesWithTables++;
      totalTables += tables.length;
      console.log(`  id=${r.id} (${r.original_name}): ${tables.length} tabela(s)`);
    }
  });

  console.log(`Concluido: ${totalTables} tabela(s) em ${articlesWithTables}/${rows.length} artigo(s) processados.`);
}

main();
