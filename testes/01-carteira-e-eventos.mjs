import { abrirNavegador, APP } from './navegador.mjs';

const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };

// ---- séries simuladas -------------------------------------------------
const CDI_DIA = 0.04;                       // % ao dia útil
const cdiSerie = [];
for (let i = 400; i >= 0; i--) {
  const d = new Date(HOJE); d.setDate(d.getDate() - i);
  if (d.getDay() === 0 || d.getDay() === 6) continue;
  cdiSerie.push({ data: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: String(CDI_DIA) });
}
const ipcaSerie = [];
for (let i = 12; i >= 1; i--) {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() - i, 1);
  ipcaSerie.push({ data: `01/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.40' });
}
const histIndice = (base) => {
  const out = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(HOJE); d.setDate(d.getDate() - i);
    out.push({ date: Math.floor(d.getTime() / 1000), close: base * (1 + (30 - i) * 0.001) });
  }
  return out;
};

const cabec = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

async function novaPagina(browser, dados) {
  const p = await browser.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });

  await p.route('**api.bcb.gov.br**', r => {
    const s = r.request().url().includes('sgs.12') ? cdiSerie : ipcaSerie;
    r.fulfill({ status: 200, headers: cabec, body: JSON.stringify(s) });
  });
  await p.route('**brapi.dev/api/quote/**', r => {
    const url = decodeURIComponent(r.request().url());
    if (url.includes('BVSP')) return r.fulfill({ status: 200, headers: cabec,
      body: JSON.stringify({ results: [{ symbol: '^BVSP', regularMarketPrice: 140000, historicalDataPrice: histIndice(130000) }] }) });
    if (url.includes('XFIX11')) return r.fulfill({ status: 200, headers: cabec,
      body: JSON.stringify({ results: [{ symbol: 'XFIX11', regularMarketPrice: 10, historicalDataPrice: histIndice(9.5) }] }) });
    const alvo = url.split('/quote/')[1].split('?')[0].split(',');
    const precos = { PETR4: [38, 37, 'Petróleo e Gás'], ITSA4: [11, 10.8, 'Bancos'], AAPL: [220, 218, 'Technology'], MXRF11: [10.2, 10.1, 'FII de papel'] };
    r.fulfill({ status: 200, headers: cabec, body: JSON.stringify({
      results: alvo.filter(t => precos[t]).map(t => ({
        symbol: t, regularMarketPrice: precos[t][0], regularMarketPreviousClose: precos[t][1],
        regularMarketChangePercent: (precos[t][0] / precos[t][1] - 1) * 100,
        currency: t === 'AAPL' ? 'USD' : 'BRL', sector: precos[t][2]
      })) }) });
  });
  await p.route('**brapi.dev/api/v2/crypto**', r => r.fulfill({ status: 200, headers: cabec,
    body: JSON.stringify({ coins: [{ coin: 'BTC', regularMarketPrice: 500000, regularMarketPreviousClose: 490000, currency: 'BRL' }] }) }));
  await p.route('**brapi.dev/api/v2/currency**', r => r.fulfill({ status: 200, headers: cabec,
    body: JSON.stringify({ currency: [{ fromCurrency: 'USD', toCurrency: 'BRL', bidPrice: '5.5000' }] }) }));
  await p.route('**tesourodireto.com.br**', r => r.fulfill({ status: 200, headers: cabec,
    body: JSON.stringify({ response: { TrsrBdTradgList: [{ TrsrBd: { nm: 'Tesouro Selic 2029', untrRedVal: 1500 } }] } }) }));

  if (dados) await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), dados);
  await p.goto(APP);
  return { p, erros };
}

const b = await abrirNavegador();
const falhas = [];
function ok(nome, cond, obtido, esperado) {
  if (cond) console.log('  ✓ ' + nome);
  else { console.log('  ✗ ' + nome + ' → obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); falhas.push(nome); }
}
const perto = (a, e, tol) => Math.abs(a - e) <= (tol === undefined ? 0.01 : tol);

// ======================================================================
console.log('\n[1] Eventos societários, taxas em USD e efeito câmbio');
{
  const dados = {
    versao: 2,
    transacoes: [
      { id: 1, data: '2025-01-10', ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 30, cambio: 1, taxas: 5, taxasMoeda: 'BRL' },
      { id: 2, data: '2025-02-10', ticker: 'PETR4', classe: 'acao', tipo: 'desdobramento', moeda: 'BRL', fator: 2 },
      { id: 3, data: '2025-03-10', ticker: 'PETR4', classe: 'acao', tipo: 'venda', moeda: 'BRL', quantidade: 50, preco: 20, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
      { id: 4, data: '2025-01-05', ticker: 'ITSA4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
      { id: 5, data: '2025-06-01', ticker: 'ITSA4', classe: 'acao', tipo: 'bonificacao', moeda: 'BRL', quantidade: 10, preco: 0, cambio: 1 },
      { id: 6, data: '2025-07-01', ticker: 'XPTO3', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 5, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
      { id: 7, data: '2025-08-01', ticker: 'XPTO3', classe: 'acao', tipo: 'grupamento', moeda: 'BRL', fator: 10 },
      { id: 8, data: '2025-04-01', ticker: 'AAPL', classe: 'stock', tipo: 'compra', moeda: 'USD', quantidade: 10, preco: 200, cambio: 5, taxas: 10, taxasMoeda: 'USD' },
      { id: 9, data: '2025-05-01', ticker: 'MXRF11', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 1000, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
      { id: 10, data: '2025-09-01', ticker: 'MXRF11', classe: 'fii', tipo: 'venda', moeda: 'BRL', quantidade: 500, preco: 11, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }
    ],
    proventos: [{ id: 20, data: menosDias(40), ticker: 'MXRF11', tipo: 'Rendimento (FII)', valor: 60 }],
    rendafixa: [], cotacoes: {
      PETR4: { preco: 38, moeda: 'BRL', fechamentoAnterior: 37, fonte: 'brapi', data: iso(HOJE) },
      ITSA4: { preco: 11, moeda: 'BRL', fonte: 'brapi', data: iso(HOJE) },
      AAPL: { preco: 220, moeda: 'USD', fonte: 'brapi', data: iso(HOJE) },
      MXRF11: { preco: 10.2, moeda: 'BRL', fonte: 'brapi', data: iso(HOJE) },
      XPTO3: { preco: 50, moeda: 'BRL', fonte: 'brapi', data: iso(HOJE) }
    },
    ativos: {}, snapshots: [], series: {},
    config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
  };
  const { p, erros } = await novaPagina(b, dados);
  const r = await p.evaluate(() => {
    const c = consolidar().lista;
    const g = t => c.find(x => x.ticker === t);
    return { petr: g('PETR4'), itsa: g('ITSA4'), xpto: g('XPTO3'), aapl: g('AAPL'), mxrf: g('MXRF11') };
  });
  ok('desdobramento dobra a quantidade sem mexer no custo', r.petr.qtd === 150 && perto(r.petr.custo, 2253.75), [r.petr.qtd, r.petr.custo], [150, 2253.75]);
  ok('preço médio após split', perto(r.petr.pm, 15.025), r.petr.pm, 15.025);
  ok('lucro realizado usa o PM ajustado', perto(r.petr.realizado, 248.75), r.petr.realizado, 248.75);
  ok('bonificação sem custo dilui o preço médio', r.itsa.qtd === 110 && perto(r.itsa.custo, 1000) && perto(r.itsa.pm, 9.0909, 0.001), [r.itsa.qtd, r.itsa.pm], [110, 9.0909]);
  ok('grupamento 10:1 reduz a quantidade', r.xpto.qtd === 10 && perto(r.xpto.custo, 500), [r.xpto.qtd, r.xpto.custo], [10, 500]);
  ok('taxas em US$ entram no custo convertidas', perto(r.aapl.custo, 10050), r.aapl.custo, 10050);
  ok('custo na moeda de origem preservado', perto(r.aapl.custoOrig, 2010), r.aapl.custoOrig, 2010);
  ok('câmbio médio da posição', perto(r.aapl.fxMedio, 5), r.aapl.fxMedio, 5);
  ok('ganho do ativo isolado', perto(r.aapl.ganhoAtivo, 1045), r.aapl.ganhoAtivo, 1045);
  ok('efeito câmbio isolado', perto(r.aapl.ganhoCambio, 1005), r.aapl.ganhoCambio, 1005);
  ok('ativo + câmbio = lucro total', perto(r.aapl.ganhoAtivo + r.aapl.ganhoCambio, r.aapl.lucro), r.aapl.lucro, 2050);
  ok('variação do dia por ativo', perto(r.petr.varPct, 2.7027, 0.001) && perto(r.petr.resultadoDia, 150), [r.petr.varPct, r.petr.resultadoDia], [2.70, 150]);
  ok('DY 12m calculado sobre o valor atual', perto(r.mxrf.dy12, 60 / (500 * 10.2) * 100, 0.01), r.mxrf.dy12, 1.176);
  ok('sem erros de console', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[2] Renda fixa: CDI real, IOF, marcação a mercado, carência e FGC');
{
  const dados = {
    versao: 2, transacoes: [], proventos: [], cotacoes: {}, ativos: {}, snapshots: [],
    rendafixa: [
      { id: 1, nome: 'CDB Banco A', tipo: 'CDB', emissor: 'Banco A', indexador: 'CDI', taxa: 110, valorAplicado: 10000, dataAplicacao: menosDias(200), vencimento: menosDias(-500), liquidez: 'diaria' },
      { id: 2, nome: 'CDB curto', tipo: 'CDB', emissor: 'Banco A', indexador: 'CDI', taxa: 100, valorAplicado: 5000, dataAplicacao: menosDias(10), liquidez: 'diaria' },
      { id: 3, nome: 'LCI Banco B', tipo: 'LCI', emissor: 'Banco B', indexador: 'CDI', taxa: 95, valorAplicado: 240000, dataAplicacao: menosDias(100), liquidez: 'carencia', carenciaAte: menosDias(-30) },
      { id: 4, nome: 'CDB Banco B', tipo: 'CDB', emissor: 'Banco B', indexador: 'PRE', taxa: 12, valorAplicado: 60000, dataAplicacao: menosDias(60), liquidez: 'vencimento', vencimento: menosDias(-400) },
      { id: 5, nome: 'Tesouro Selic 2029', tipo: 'Tesouro Direto', emissor: 'Tesouro Nacional', indexador: 'SELIC', taxa: 0.1, valorAplicado: 14000, dataAplicacao: menosDias(150), qtdTitulos: 10, puAtual: 1500, liquidez: 'diaria' }
    ],
    series: {}, config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
  };
  const { p, erros } = await novaPagina(b, dados);
  await p.evaluate(() => atualizarSeries(true));
  const r = await p.evaluate(() => {
    const db = getDB();
    const g = id => { const t = db.rendafixa.find(x => x.id === id); return { t, c: calcRF(t, db) }; };
    return { cdb: g(1), curto: g(2), lci: g(3), pre: g(4), tes: g(5), fgc: exposicaoEmissores(), pontos: (db.series.cdi || {}).dados.length };
  });
  ok('série do CDI baixada', r.pontos > 250, r.pontos, '>250');
  const esperadoCDB = 10000 * Math.pow(1 + CDI_DIA / 100 * 1.10, r.cdb.c.du);
  ok('CDB remunera pelo CDI diário real', perto(r.cdb.c.bruto, esperadoCDB, 0.5), r.cdb.c.bruto, esperadoCDB);
  ok('método identificado como série do BCB', /Banco Central/.test(r.cdb.c.metodo), r.cdb.c.metodo, 'CDI diário do Banco Central');
  ok('IOF de 66% no 10º dia', r.curto.c.iofPct === 66 && r.curto.c.iof > 0, [r.curto.c.iofPct, r.curto.c.iof], [66, '>0']);
  ok('IOF entra antes do IR', perto(r.curto.c.liquido, r.curto.c.valor - r.curto.c.iof - r.curto.c.ir), r.curto.c.liquido, 0);
  ok('LCI isenta de IR e de IOF', r.lci.c.isento && r.lci.c.ir === 0 && r.lci.c.iof === 0, [r.lci.c.ir, r.lci.c.iof], [0, 0]);
  ok('LCI em carência sinalizada', r.lci.c.emCarencia && r.lci.c.diasCarencia === 30, [r.lci.c.emCarencia, r.lci.c.diasCarencia], [true, 30]);
  ok('CDB só no vencimento não é resgatável', r.pre.c.soVencimento && !r.pre.c.resgatavel, r.pre.c.resgatavel, false);
  ok('IR de 20% entre 181 e 360 dias', r.cdb.c.aliq === 20, r.cdb.c.aliq, 20);
  ok('marcação a mercado usa PU × quantidade', r.tes.c.mtm === 15000 && r.tes.c.valor === 15000, r.tes.c.valor, 15000);
  ok('ágio sobre a curva calculado', perto(r.tes.c.agio, 15000 - r.tes.c.curva, 0.01), r.tes.c.agio, 15000 - r.tes.c.curva);
  const bancoB = r.fgc.find(e => e.emissor === 'Banco B');
  ok('FGC soma só o que é coberto', perto(bancoB.coberto, r.lci.c.valor + r.pre.c.valor, 1), bancoB.coberto, 'LCI+CDB');
  ok('FGC acusa excedente acima de R$ 250 mil', bancoB.excedente > 0, bancoB.excedente, '>0');
  const tesouro = r.fgc.find(e => e.emissor === 'Tesouro Nacional');
  ok('Tesouro fora da cobertura do FGC', tesouro.coberto === 0 && tesouro.naoCoberto === 15000, tesouro, 'sem FGC');
  ok('sem erros de console', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[3] TWR, benchmarks e histórico de patrimônio');
{
  const snaps = [];
  const valores = [10000, 10100, 10201, 10300];
  for (let i = 0; i < 4; i++) {
    snaps.push({ data: menosDias(4 - i), patrimonio: valores[i], custo: 10000, valorVar: valores[i], custoVar: 10000,
      rfBruto: 0, rfAplicado: 0, proventosAcum: 0, realizadoAcum: 0, completo: true });
  }
  const dados = {
    versao: 2,
    transacoes: [{ id: 1, data: menosDias(4), ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 100, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }],
    proventos: [], rendafixa: [], ativos: {}, snapshots: snaps,
    cotacoes: { PETR4: { preco: 103, moeda: 'BRL', fonte: 'brapi', data: iso(HOJE) } },
    series: {}, config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
  };
  const { p, erros } = await novaPagina(b, dados);
  await p.evaluate(() => atualizarSeries(true));
  const r = await p.evaluate(() => ({
    serie: serieTWR(), total: twrPeriodo(null), snaps: getDB().snapshots.length,
    cdi: benchPeriodo('cdi', getDB().snapshots[0].data, hojeISO()),
    ibov: benchPeriodo('ibov', getDB().snapshots[0].data, hojeISO())
  }));
  ok('snapshot do dia criado automaticamente', r.snaps === 5, r.snaps, 5);
  ok('série de retornos diários gerada', r.serie.length === 4, r.serie.length, 4);
  ok('TWR composta corretamente', perto(r.total.retorno, (10300 / 10000 - 1) * 100, 0.2), r.total.retorno, 3.0);
  ok('TWR anualizada só com 30+ dias', r.total.anualizado === null, r.total.anualizado, null);
  ok('CDI acumulado disponível para o período', r.cdi > 0, r.cdi, '>0');
  ok('Ibovespa acumulado disponível', r.ibov !== null && r.ibov > 0, r.ibov, '>0');

  // aporte no meio do período não pode virar rentabilidade
  const r2 = await p.evaluate(() => {
    const db = getDB();
    const d = db.snapshots[2].data;
    db.transacoes.push({ id: 99, data: d, ticker: 'VALE3', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 1, preco: 5000, cambio: 1, taxas: 0, taxasMoeda: 'BRL' });
    db.snapshots.forEach((sn, i) => { if (i >= 2) sn.patrimonio += 5000; });
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return twrPeriodo(null);
  });
  ok('aporte não infla a rentabilidade', perto(r2.retorno, r.total.retorno, 0.35), r2.retorno, r.total.retorno);
  ok('sem erros de console', erros.length === 0, erros, []);
  await p.close();
}

console.log(falhas.length ? '\n❌ ' + falhas.length + ' verificação(ões) falharam' : '\n✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length ? 1 : 0);
