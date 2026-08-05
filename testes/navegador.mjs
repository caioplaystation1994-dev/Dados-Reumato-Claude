// Resolve o Chromium do Playwright.
//
// Em um clone normal, `npm install` coloca o playwright em node_modules e o
// primeiro candidato resolve. Em ambientes onde ele está instalado
// globalmente (contêineres de CI, por exemplo), o segundo caminho serve de
// alternativa — por isso a resolução é dinâmica em vez de um import estático.
const CANDIDATOS = [
  'playwright',
  '/opt/node22/lib/node_modules/playwright/index.mjs'
];

export async function abrirNavegador() {
  for (const caminho of CANDIDATOS) {
    try {
      const { chromium } = await import(caminho);
      return chromium.launch();
    } catch (e) {
      if (!/Cannot find|ERR_MODULE_NOT_FOUND/.test(e.message)) throw e;
    }
  }
  throw new Error('Playwright não encontrado. Rode "npm install" na pasta testes/.');
}

export const APP = 'file://' + new URL('../investimentos.html', import.meta.url).pathname;

export const CABECALHO_JSON = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

export const iso = d => d.toISOString().slice(0, 10);

export function criarContador() {
  const falhas = [];
  const ok = (nome, condicao, obtido, esperado) => {
    if (condicao) console.log('  ✓ ' + nome);
    else {
      console.log('  ✗ ' + nome + ' → obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado));
      falhas.push(nome);
    }
  };
  return { ok, falhas };
}

export const perto = (a, e, tol) => Math.abs(a - e) <= (tol === undefined ? 0.01 : tol);

// Capturas de tela ficam fora do controle de versão
import { mkdirSync } from 'node:fs';
export function capturas(nome) {
  const pasta = new URL('./capturas/', import.meta.url).pathname;
  mkdirSync(pasta, { recursive: true });
  return pasta + nome;
}
