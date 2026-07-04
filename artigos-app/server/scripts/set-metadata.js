// Uso interno (Claude Code): atualiza APENAS os campos de metadata novos
// (secondary_diseases, subtopic, evidence_level, clinical_applicability)
// de um artigo ja classificado, sem tocar em title/summary/sections.
//
// Uso: node server/scripts/set-metadata.js --id 3 --json '{"subtopic":"...","evidence_level":"...","clinical_applicability":["Diagnostico"],"secondary_diseases":["..."]}'

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

if (!args.id || !args.json) {
  console.error('Uso: node server/scripts/set-metadata.js --id <id> --json \'{"subtopic":"...","evidence_level":"...","clinical_applicability":["..."],"secondary_diseases":["..."]}\'');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(args.json);
} catch (e) {
  console.error('JSON invalido:', e.message);
  process.exit(1);
}

const article = db.prepare('SELECT id, original_name FROM articles WHERE id = ?').get(args.id);
if (!article) {
  console.error(`Artigo com id ${args.id} nao encontrado.`);
  process.exit(1);
}

const secondaryDiseases = Array.isArray(data.secondary_diseases) && data.secondary_diseases.length > 0
  ? JSON.stringify(data.secondary_diseases)
  : null;

const clinicalApplicability = Array.isArray(data.clinical_applicability) && data.clinical_applicability.length > 0
  ? JSON.stringify(data.clinical_applicability)
  : null;

db.prepare(
  `UPDATE articles SET secondary_diseases = ?, subtopic = ?, evidence_level = ?, clinical_applicability = ? WHERE id = ?`
).run(
  secondaryDiseases,
  data.subtopic || null,
  data.evidence_level || null,
  clinicalApplicability,
  args.id
);

console.log(`Metadata do artigo ${args.id} (${article.original_name}) atualizada.`);
