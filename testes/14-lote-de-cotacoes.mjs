// Tickers por requisição. O plano gratuito da brapi aceita 1 por chamada;
// mandar mais derruba a consulta inteira e os ativos ficam sem cotação. O
// padrão precisa ser o que funciona em qualquer plano, e quem paga aumenta.
import { abrirNavegador, APP, CABECALHO_JSON, criarContador } from './navegador.mjs';

const { ok, falhas } = criarContador();

const tx = (id, ticker) => ({ id, data: '2026-01-05', ticker, classe: 'acao', tipo: 'compra',
  moeda: 'BRL', quantidade: 10, preco: 20, cambio: 1, taxas: 0, taxasMoeda: 'BRL' });

const base = lote => ({
  versao: 4,
  transacoes: [tx(1,'VALE3'), tx(2,'PETR4'), tx(3,'ITSA4'), tx(4,'BBAS3'), tx(5,'WEGE3')],
  proventos: [], rendafixa: [], cotacoes: {}, ativos: {}, snapshots: [], precosHist: {},
  metas: {}, series: {},
  config: { token: 't', cdi: 10.65, ipca: 4.5, usdbrl: 5.4, autoUpdate: false,
    intervaloMin: 15, ...(lote == null ? {} : { lote }) }
});

const b = await abrirNavegador();

// Conta quantos tickers vieram em cada chamada de cotação
async function medir(db) {
  const p = await b.newPage();
  const erros = [];
  const chamadas = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('**brapi.dev**', r => {
    const u = r.request().url();
    const m = u.match(/\/api\/quote\/([^?]+)/);
    if (m) {
      const tickers = decodeURIComponent(m[1]).split(',');
      chamadas.push(tickers.length);
      return r.fulfill({ status: 200, headers: CABECALHO_JSON,
        body: JSON.stringify({ results: tickers.map(t => ({ symbol: t, regularMarketPrice: 25, currency: 'BRL' })) }) });
    }
    r.fulfill({ status: 200, headers: CABECALHO_JSON, body: JSON.stringify({ results: [] }) });
  });
  await p.route('**api.bcb.gov.br**', r => r.abort());
  await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), db);
  await p.goto(APP);
  await p.waitForTimeout(700);
  await p.evaluate(() => atualizarCotacoes(true));
  await p.waitForTimeout(1200);
  const cotadas = await p.evaluate(() => Object.keys(getDB().cotacoes).length);
  await p.close();
  return { chamadas, cotadas, erros };
}

console.log('\n[1] Sem configurar, vai 1 ticker por requisição');
{
  const r = await medir(base(null));
  ok('cinco ativos, cinco chamadas', r.chamadas.length === 5, r.chamadas.length, 5);
  ok('nenhuma chamada leva mais de 1 ticker',
    r.chamadas.every(n => n === 1), r.chamadas, 'todas com 1');
  ok('os cinco foram cotados', r.cotadas === 5, r.cotadas, 5);
  ok('sem erros', r.erros.length === 0, r.erros, []);
}

console.log('\n[2] Quem tem plano pago aumenta o lote');
{
  const r = await medir(base(10));
  ok('os cinco cabem em uma chamada só', r.chamadas.length === 1, r.chamadas.length, 1);
  ok('a chamada leva os cinco tickers', r.chamadas[0] === 5, r.chamadas[0], 5);
  ok('os cinco foram cotados', r.cotadas === 5, r.cotadas, 5);
  ok('sem erros', r.erros.length === 0, r.erros, []);
}

console.log('\n[3] Valor inválido cai no padrão seguro, não em zero');
{
  for (const [valor, esperado] of [[0, 5], [-3, 5], ['abc', 5], [999, 1]]) {
    const r = await medir(base(valor));
    // 999 é aparado para o teto de 20, então os 5 cabem em uma chamada
    ok('lote ' + JSON.stringify(valor) + ' → ' + esperado + ' chamada(s)',
      r.chamadas.length === esperado, r.chamadas.length, esperado);
  }
}

await b.close();
console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
process.exit(falhas.length ? 1 : 0);
