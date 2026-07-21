// Uso interno (Claude Code): despeja em stdout os campos de um artigo (sections
// atuais e full_text) para facilitar o reprocessamento retroativo de classificacoes.
//
// Uso: node server/scripts/get-article-data.js --id 3 [--fulltext]

const db = require('../db');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.id) {
  console.error('Uso: node server/scripts/get-article-data.js --id <id> [--fulltext]');
  process.exit(1);
}

const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(args.id);
if (!a) {
  console.error(`Artigo ${args.id} nao encontrado.`);
  process.exit(1);
}

if (args.fulltext) {
  console.log(a.full_text || '');
} else {
  console.log(JSON.stringify({
    id: a.id,
    title: a.title,
    disease: a.disease,
    secondary_diseases: a.secondary_diseases,
    subtopic: a.subtopic,
    evidence_level: a.evidence_level,
    clinical_applicability: a.clinical_applicability,
    sections: a.detailed_summary ? JSON.parse(a.detailed_summary) : null,
  }, null, 2));
}
