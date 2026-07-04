// Uso interno (Claude Code): aplica uma classificacao (feita por leitura manual do artigo)
// a um registro ja existente no banco, marcando-o como 'concluido'.
//
// Uso: node server/scripts/classify.js --id 3 --json '{"title":"...","authors":"...","year":"2023","disease":"...","topics":"a, b, c","summary":"...","sections":[{"heading":"Objetivo","text":"..."}],"secondary_diseases":["..."],"subtopic":"...","evidence_level":"Ensaio Clinico Randomizado","clinical_applicability":["Diagnostico","Tratamento"]}'
// Ou, para conteudo longo (recomendado): node server/scripts/classify.js --id 3 --file /caminho/dados.json
//
// Campos novos (opcionais):
//   secondary_diseases: array de doencas/temas adicionais alem do "disease" principal
//   subtopic: subtema/manifestacao especifica dentro da doenca (ex: "Manifestacoes Neurologicas")
//   evidence_level: nivel de evidencia (ex: "Ensaio Clinico Randomizado", "Revisao Sistematica/Metanalise",
//     "Estudo de Coorte/Observacional", "Revisao Narrativa", "Protocolo de Estudo", "Bula/Documento Regulatorio")
//   clinical_applicability: array com valores entre "Diagnostico", "Tratamento", "Prognostico", "Prevencao", "Monitorizacao"

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

if (!args.id || (!args.json && !args.file)) {
  console.error('Uso: node server/scripts/classify.js --id <id> (--json \'{"...":"..."}\' | --file <caminho.json>)');
  process.exit(1);
}

let data;
try {
  const raw = args.file ? fs.readFileSync(args.file, 'utf-8') : args.json;
  data = JSON.parse(raw);
} catch (e) {
  console.error('JSON invalido:', e.message);
  process.exit(1);
}

const article = db.prepare('SELECT id, original_name FROM articles WHERE id = ?').get(args.id);
if (!article) {
  console.error(`Artigo com id ${args.id} nao encontrado.`);
  process.exit(1);
}

const detailedSummary = Array.isArray(data.sections) && data.sections.length > 0
  ? JSON.stringify(data.sections)
  : null;

const secondaryDiseases = Array.isArray(data.secondary_diseases) && data.secondary_diseases.length > 0
  ? JSON.stringify(data.secondary_diseases)
  : null;

const clinicalApplicability = Array.isArray(data.clinical_applicability) && data.clinical_applicability.length > 0
  ? JSON.stringify(data.clinical_applicability)
  : null;

db.prepare(
  `UPDATE articles SET title = ?, authors = ?, year = ?, disease = ?, topics = ?, summary = ?, detailed_summary = ?,
   secondary_diseases = ?, subtopic = ?, evidence_level = ?, clinical_applicability = ?, status = 'concluido', error = NULL WHERE id = ?`
).run(
  data.title || article.original_name,
  data.authors || '',
  data.year || '',
  data.disease || 'Nao especificado',
  data.topics || '',
  data.summary || '',
  detailedSummary,
  secondaryDiseases,
  data.subtopic || null,
  data.evidence_level || null,
  clinicalApplicability,
  args.id
);

console.log(`Artigo ${args.id} (${article.original_name}) classificado com sucesso.`);
