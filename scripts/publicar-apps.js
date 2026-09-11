#!/usr/bin/env node
/* ============================================================================
   Publica as ferramentas clínicas dentro do site (docs/app/)
   ============================================================================

   As ferramentas são desenvolvidas na branch `main`, na raiz do repositório.
   O site publicado pelo GitHub Pages sai da pasta `docs/` (branch
   claude/happy-ride-mp97bp). Este script copia os arquivos de `main` para
   `docs/app/`, aplicando em cada um:

     - <meta name="robots" content="noindex, nofollow">  (não indexar)
     - <script src="gate.js"></script>                   (tela de senha)

   Uso, a partir da branch do site:

       node scripts/publicar-apps.js

   Depois, revise com `git diff` e publique com commit + push.
   ============================================================================ */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BRANCH_FONTE = 'main';
const DESTINO = path.join(__dirname, '..', 'docs', 'app');
const APPS = [
  'documentos_ambulatorio.html',
  'laudo_imunobiologicos.html',
  'laudo_convenio_imunobio.html',
];

const INJECAO = [
  '<meta name="robots" content="noindex, nofollow">',
  '<script src="gate.js"></script>',
].join('\n');

function lerDaBranch(arquivo) {
  return execFileSync('git', ['show', `${BRANCH_FONTE}:${arquivo}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function injetar(html, arquivo) {
  if (html.includes('src="gate.js"')) {
    throw new Error(`${arquivo}: já contém o gate — a fonte em ${BRANCH_FONTE} não deveria ter sido publicada`);
  }
  // Injeta logo após o <meta charset>, antes de qualquer outro recurso, para
  // que a tela de senha apareça o quanto antes.
  const m = html.match(/<meta\s+charset=[^>]*>/i);
  if (!m) throw new Error(`${arquivo}: não encontrei a tag <meta charset> para ancorar a injeção`);
  return html.replace(m[0], `${m[0]}\n${INJECAO}`);
}

fs.mkdirSync(DESTINO, { recursive: true });

let erros = 0;
for (const arquivo of APPS) {
  try {
    const original = lerDaBranch(arquivo);
    const publicado = injetar(original, arquivo);
    fs.writeFileSync(path.join(DESTINO, arquivo), publicado);
    const kb = (Buffer.byteLength(publicado) / 1024).toFixed(0);
    console.log(`  ok  ${arquivo} (${kb} KB)`);
  } catch (e) {
    erros++;
    console.error(`  ERRO  ${arquivo}: ${e.message}`);
  }
}

if (erros) {
  console.error(`\n${erros} arquivo(s) com erro — nada foi publicado para eles.`);
  process.exit(1);
}
console.log(`\n${APPS.length} ferramenta(s) atualizada(s) em docs/app/ a partir de ${BRANCH_FONTE}.`);
