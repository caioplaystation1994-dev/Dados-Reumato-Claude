#!/usr/bin/env node
/* ============================================================================
   Publica as ferramentas clínicas dentro do site (docs/app/)
   ============================================================================

   As ferramentas são desenvolvidas na raiz do repositório; o site publicado
   pelo GitHub Pages sai da pasta `docs/`. Este script copia os arquivos da
   raiz para `docs/app/`, aplicando em cada um:

     - <meta name="robots" content="noindex, nofollow">  (não indexar)
     - <script src="gate.js"></script>                   (tela de senha)

   Uso:

       node scripts/publicar-apps.js

   Depois, revise com `git diff` e publique com commit + push. O workflow de
   publicação (.github/workflows/pages.yml) roda este mesmo script, então
   `docs/app/` no repositório é só uma cópia de conferência — o que vai ao ar
   é sempre gerado na hora, a partir da raiz.
   ============================================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'docs', 'app');
const APPS = [
  'documentos_ambulatorio.html',
  'laudo_imunobiologicos.html',
  'laudo_convenio_imunobio.html',
  // Carteira de investimentos: publicada atrás da mesma senha, mas de
  // propósito fora do portal em docs/app/index.html — só se chega nela pelo
  // endereço direto.
  'investimentos.html',
];

const INJECAO = [
  '<meta name="robots" content="noindex, nofollow">',
  '<script src="gate.js"></script>',
].join('\n');

function lerDaRaiz(arquivo) {
  return fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
}

function injetar(html, arquivo) {
  if (html.includes('src="gate.js"')) {
    throw new Error(`${arquivo}: já contém o gate — a fonte na raiz não deveria ter sido publicada`);
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
    const original = lerDaRaiz(arquivo);
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
console.log(`\n${APPS.length} ferramenta(s) atualizada(s) em docs/app/ a partir da raiz do repositório.`);
