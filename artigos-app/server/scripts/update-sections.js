// Uso interno (Claude Code): substitui APENAS as "sections" (detailed_summary)
// de um artigo ja classificado, sem tocar em titulo/doenca/tags/etc.
// Usado no reprocessamento retroativo para acrescentar secoes isoladas de
// fisiopatologia, mecanismo de acao e dados epidemiologicos.
//
// Uso: node server/scripts/update-sections.js --id 3 --file /caminho/sections.json
// O arquivo deve conter um array JSON: [{"heading":"...","text":"..."}, ...]

const fs = require('fs');
const db = require('../db');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.id || !args.file) {
  console.error('Uso: node server/scripts/update-sections.js --id <id> --file <sections.json>');
  process.exit(1);
}

const article = db.prepare('SELECT id, original_name FROM articles WHERE id = ?').get(args.id);
if (!article) {
  console.error(`Artigo ${args.id} nao encontrado.`);
  process.exit(1);
}

let sections;
try {
  sections = JSON.parse(fs.readFileSync(args.file, 'utf-8'));
} catch (e) {
  console.error('JSON invalido:', e.message);
  process.exit(1);
}

if (!Array.isArray(sections) || sections.length === 0) {
  console.error('O arquivo deve conter um array nao vazio de {heading, text}.');
  process.exit(1);
}

db.prepare('UPDATE articles SET detailed_summary = ? WHERE id = ?').run(JSON.stringify(sections), args.id);
console.log(`Artigo ${args.id} (${article.original_name}): secoes atualizadas (${sections.length} secoes).`);
