import { abrirNavegador, APP, capturas } from './navegador.mjs';
const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };
const cabec = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

const CDI_DIA = 0.04;
const cdiSerie = [];
for (let i = 900; i >= 0; i--) {
  const d = new Date(HOJE); d.setDate(d.getDate() - i);
  if (d.getDay() === 0 || d.getDay() === 6) continue;
  cdiSerie.push({ data: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: String(CDI_DIA) });
}

const falhas = [];
const ok = (n, c, o, e) => { if (c) console.log('  ✓ ' + n); else { console.log('  ✗ ' + n + ' → obtido ' + JSON.stringify(o) + ', esperado ' + JSON.stringify(e)); falhas.push(n); } };
const perto = (a, e, tol) => Math.abs(a - e) <= (tol === undefined ? 0.01 : tol);

const b = await abrirNavegador();
let requisicoes = [], tentativasQuote = 0;

async function novaPagina(dados, opts) {
  const o = opts || {};
  const p = await b.newPage();
  const erros = [], alertas = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => { alertas.push(d.message()); if (o.recusar) d.dismiss(); else d.accept(); });
  await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: cabec,
    body: JSON.stringify(r.request().url().includes('sgs.12') ? cdiSerie : []) }));
  await p.route('**brapi.dev/api/quote/**', r => {
    const url = decodeURIComponent(r.request().url());
    const alvo = url.split('/quote/')[1].split('?')[0].split(',');
    requisicoes.push(alvo);
    if (o.falharPrimeiras && tentativasQuote++ < o.falharPrimeiras) {
      return r.fulfill({ status: 429, headers: cabec, body: JSON.stringify({ message: 'rate limit' }) });
    }
    r.fulfill({ status: 200, headers: cabec, body: JSON.stringify({
      results: alvo.map(t => ({ symbol: t, regularMarketPrice: 50, regularMarketPreviousClose: 49,
        regularMarketChangePercent: 2.04, currency: 'BRL',
        regularMarketTime: Math.floor(new Date(o.pregao || iso(HOJE)).getTime() / 1000) })) }) });
  });
  await p.route('**brapi.dev/api/v2/**', r => r.fulfill({ status: 200, headers: cabec,
    body: JSON.stringify({ coins: [], currency: [{ bidPrice: '5.5' }] }) }));
  if (dados) await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), dados);
  await p.goto(APP);
  return { p, erros, alertas };
}

const vazio = {
  versao: 4, transacoes: [], proventos: [], rendafixa: [], ativos: {}, cotacoes: {}, snapshots: [],
  precosHist: {}, series: {}, metas: {},
  config: { token: 't', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, intradayMin: 0, ultimaAtualizacao: Date.now() }
};

// ======================================================================
console.log('\n[1] Cotações em lotes e repetição com espera');
{
  requisicoes = []; tentativasQuote = 0;
  const tickers = [];
  const dados = JSON.parse(JSON.stringify(vazio));
  for (let i = 0; i < 30; i++) {
    const t = 'ATV' + String(i).padStart(2, '0');
    tickers.push(t);
    dados.transacoes.push({ id: i + 1, data: menosDias(100), ticker: t, classe: 'acao', tipo: 'compra',
      moeda: 'BRL', quantidade: 10, preco: 40, cambio: 1, taxas: 0, taxasMoeda: 'BRL' });
  }
  const { p, erros } = await novaPagina(dados);
  await p.evaluate(() => atualizarCotacoes(true));
  ok('30 tickers viram 3 lotes de até 12', requisicoes.length === 3 && requisicoes[0].length === 12,
    requisicoes.map(r => r.length), [12, 12, 6]);
  const cot = await p.evaluate(() => Object.keys(getDB().cotacoes).length);
  ok('todas as cotações chegam', cot === 30, cot, 30);
  await p.close();

  // agora com as duas primeiras respostas recusadas por limite
  requisicoes = []; tentativasQuote = 0;
  const dados2 = JSON.parse(JSON.stringify(vazio));
  dados2.transacoes.push({ id: 1, data: menosDias(100), ticker: 'PETR4', classe: 'acao', tipo: 'compra',
    moeda: 'BRL', quantidade: 10, preco: 40, cambio: 1, taxas: 0, taxasMoeda: 'BRL' });
  const r2 = await novaPagina(dados2, { falharPrimeiras: 2 });
  await r2.p.evaluate(() => atualizarCotacoes(true));
  const cot2 = await r2.p.evaluate(() => (getDB().cotacoes.PETR4 || {}).preco);
  ok('erro 429 é repetido até dar certo', cot2 === 50, cot2, 50);
  ok('foram 3 tentativas', requisicoes.length === 3, requisicoes.length, 3);
  ok('sem erros', erros.length === 0 && r2.erros.length === 0, [erros, r2.erros], []);
  await r2.p.close();
}

// ======================================================================
console.log('\n[2] Data do pregão e mercado fechado');
{
  const dados = JSON.parse(JSON.stringify(vazio));
  dados.transacoes.push({ id: 1, data: menosDias(100), ticker: 'PETR4', classe: 'acao', tipo: 'compra',
    moeda: 'BRL', quantidade: 10, preco: 40, cambio: 1, taxas: 0, taxasMoeda: 'BRL' });
  const { p, erros } = await novaPagina(dados, { pregao: menosDias(3) });
  await p.evaluate(() => atualizarCotacoes(true));
  const r = await p.evaluate(() => {
    const c = getDB().cotacoes.PETR4;
    return { pregao: c.pregao, consolidado: consolidar().lista[0].pregao };
  });
  ok('data do pregão guardada', r.pregao === menosDias(3), r.pregao, menosDias(3));
  ok('pregão chega à consolidação', r.consolidado === menosDias(3), r.consolidado, menosDias(3));
  const cabecalho = await p.evaluate(() => { showPage('carteira'); return document.querySelector('#carteira-tabela thead').textContent; });
  ok('coluna reflete se o mercado está aberto', /Dia|Último pregão/.test(cabecalho), cabecalho.slice(0, 60), 'Dia ou Último pregão');
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[3] Subscrição, amortização de FII e venda acima da posição');
{
  const dados = JSON.parse(JSON.stringify(vazio));
  dados.transacoes = [
    { id: 1, data: menosDias(300), ticker: 'MXRF11', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 1000, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 2, data: menosDias(200), ticker: 'MXRF11', classe: 'fii', tipo: 'subscricao', moeda: 'BRL', quantidade: 200, preco: 9, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 3, data: menosDias(100), ticker: 'MXRF11', classe: 'fii', tipo: 'amortizacao', moeda: 'BRL', quantidade: 1200, preco: 0.5, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }
  ];
  const { p, erros, alertas } = await novaPagina(dados);
  const r = await p.evaluate(() => consolidar().lista.find(x => x.ticker === 'MXRF11'));
  ok('subscrição entra como compra', r.qtd === 1200, r.qtd, 1200);
  ok('custo soma a subscrição', perto(r.custo, 10000 + 1800 - 600), r.custo, 11200);
  ok('amortização reduz o custo, não a quantidade', r.qtd === 1200 && perto(r.pm, 11200 / 1200, 0.001), r.pm, 9.333);
  ok('amortização dentro do custo não gera lucro', r.realizado === 0, r.realizado, 0);

  // amortização acima do custo vira ganho tributável
  const r2 = await p.evaluate(d => {
    const db = getDB();
    db.transacoes.push({ id: 4, data: d, ticker: 'MXRF11', classe: 'fii', tipo: 'amortizacao', moeda: 'BRL',
      quantidade: 1200, preco: 20, cambio: 1, taxas: 0, taxasMoeda: 'BRL' });
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return consolidar().lista.find(x => x.ticker === 'MXRF11');
  }, menosDias(50));
  ok('excedente ao custo vira ganho', perto(r2.custo, 0) && perto(r2.realizado, 24000 - 11200), [r2.custo, r2.realizado], [0, 12800]);

  // venda acima da posição pede confirmação
  await p.evaluate(() => { showPage('transacoes'); limparTx(); });
  await p.selectOption('#tx-tipo', 'venda');
  await p.selectOption('#tx-classe', 'fii');
  await p.fill('#tx-ticker', 'MXRF11'); await p.fill('#tx-qtd', '5000'); await p.fill('#tx-preco', '10');
  await p.click('button:has-text("Salvar lançamento")');
  ok('avisa ao vender mais do que tem', alertas.some(a => /está tentando vender/.test(a)),
    (alertas[alertas.length - 1] || '').slice(0, 60), 'aviso de venda');
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[4] Aportes recorrentes e resgates parciais na renda fixa');
{
  const dados = JSON.parse(JSON.stringify(vazio));
  dados.rendafixa = [{
    id: 1, nome: 'CDB com aportes', tipo: 'CDB', emissor: 'Banco A', indexador: 'CDI', taxa: 100,
    valorAplicado: 10000, dataAplicacao: menosDias(200), liquidez: 'diaria',
    aportes: [{ data: menosDias(100), valor: 5000 }],
    resgates: []
  }];
  const { p, erros } = await novaPagina(dados);
  await p.evaluate(() => atualizarSeries(true));
  const r = await p.evaluate(() => {
    const db = getDB();
    const t = db.rendafixa[0];
    return { c: calcRF(t, db), du200: fatorCDI(t.dataAplicacao, hojeISO(), 1), du100: fatorCDI(t.aportes[0].data, hojeISO(), 1) };
  });
  const esperado = 10000 * r.du200.fator + 5000 * r.du100.fator;
  ok('cada aporte rende do próprio dia', perto(r.c.valor, esperado, 0.5), r.c.valor, esperado);
  ok('principal soma os aportes', perto(r.c.aplicado, 15000), r.c.aplicado, 15000);
  ok('total de aportes reportado', perto(r.c.totalAportes, 5000), r.c.totalAportes, 5000);

  const r2 = await p.evaluate(d => {
    const db = getDB();
    db.rendafixa[0].resgates = [{ data: d, valor: 3000 }];
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    const antes = calcRF(Object.assign({}, db.rendafixa[0], { resgates: [] }), db, d).valor;
    return { c: calcRF(db.rendafixa[0], db), saldoAntes: antes };
  }, menosDias(50));
  const fracao = 3000 / r2.saldoAntes;
  ok('resgate parcial retira principal proporcionalmente',
    perto(r2.c.aplicado, 15000 * (1 - fracao), 1), r2.c.aplicado, 15000 * (1 - fracao));
  ok('saldo cai pelo valor resgatado', r2.c.valor < r.c.valor, [r2.c.valor, r.c.valor], 'menor');
  ok('resgates reportados', perto(r2.c.totalResgates, 3000), r2.c.totalResgates, 3000);

  const fluxo = await p.evaluate(() => {
    const f = fluxosPorData();
    return { aporte: f.fluxoRF[Object.keys(f.fluxoRF).sort()[1]], chaves: Object.keys(f.fluxoRF).length };
  });
  ok('aportes e resgates entram nos fluxos da TWR', fluxo.chaves === 3, fluxo.chaves, 3);

  // pela interface
  await p.evaluate(() => { showPage('rendafixa'); movimentacoesRF(1); });
  const linhas = await p.evaluate(() => document.querySelectorAll('#modal-content tbody tr').length);
  ok('modal lista as movimentações', linhas === 3, linhas, 3);
  await p.selectOption('#mv-tipo', 'aporte');
  await p.fill('#mv-data', menosDias(20)); await p.fill('#mv-valor', '1000');
  await p.click('button:has-text("Lançar")');
  const dep = await p.evaluate(() => getDB().rendafixa[0].aportes.length);
  ok('aporte lançado pela interface', dep === 2, dep, 2);
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[5] Apuração mensal do imposto de renda');
{
  const dados = JSON.parse(JSON.stringify(vazio));
  const mes = m => '2026-0' + m;
  dados.transacoes = [
    // ações: venda pequena isenta em janeiro
    { id: 1, data: mes(1) + '-05', ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 1000, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 2, data: mes(1) + '-20', ticker: 'PETR4', classe: 'acao', tipo: 'venda', moeda: 'BRL', quantidade: 500, preco: 12, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    // ações: venda grande tributável em fevereiro
    { id: 3, data: mes(2) + '-10', ticker: 'PETR4', classe: 'acao', tipo: 'venda', moeda: 'BRL', quantidade: 500, preco: 60, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    // FII com prejuízo em março e lucro em abril
    { id: 4, data: mes(1) + '-05', ticker: 'MXRF11', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 1000, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 5, data: mes(3) + '-10', ticker: 'MXRF11', classe: 'fii', tipo: 'venda', moeda: 'BRL', quantidade: 500, preco: 8, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 6, data: mes(4) + '-10', ticker: 'MXRF11', classe: 'fii', tipo: 'venda', moeda: 'BRL', quantidade: 500, preco: 20, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    // day trade em maio
    { id: 7, data: mes(5) + '-10', ticker: 'VALE3', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 60, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 8, data: mes(5) + '-10', ticker: 'VALE3', classe: 'acao', tipo: 'venda', moeda: 'BRL', quantidade: 100, preco: 70, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }
  ];
  const { p, erros } = await novaPagina(dados);
  const a = await p.evaluate(() => apuracaoIR());
  const porMes = m => a.linhas.find(l => l.mes === m);

  const jan = porMes('2026-01').categorias[0];
  ok('venda de ações até R$ 20 mil fica isenta', jan.isento === true && jan.ir === 0, [jan.volume, jan.isento], [6000, true]);
  const fev = porMes('2026-02').categorias.find(c => c.cat === 'acao');
  ok('venda acima do limite é tributada', fev.isento === false && perto(fev.ir, 25000 * 0.15), fev.ir, 3750);
  const mar = porMes('2026-03').categorias[0];
  ok('prejuízo em FII acumula', mar.resultado < 0 && perto(mar.prejuizoAcumulado, 1000), mar.prejuizoAcumulado, 1000);
  const abr = porMes('2026-04').categorias[0];
  ok('prejuízo compensa lucro da mesma categoria', perto(abr.compensado, 1000) && perto(abr.base, 4000), [abr.compensado, abr.base], [1000, 4000]);
  ok('FII paga 20%', perto(abr.ir, 4000 * 0.20), abr.ir, 800);
  const mai = porMes('2026-05').categorias[0];
  ok('day trade identificado e tributado a 20%', mai.cat === 'daytrade' && perto(mai.ir, 1000 * 0.20), [mai.cat, mai.ir], ['daytrade', 200]);
  ok('DARF do mês somado', porMes('2026-02').darf > 0, porMes('2026-02').darf, '>0');

  // DARF abaixo do piso acumula
  const pequeno = await p.evaluate(() => {
    const db = getDB();
    db.transacoes = [
      { id: 1, data: '2026-01-05', ticker: 'AAA3', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
      { id: 2, data: '2026-02-05', ticker: 'AAA3', classe: 'fii', tipo: 'venda', moeda: 'BRL', quantidade: 100, preco: 10.2, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }
    ];
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return apuracaoIR();
  });
  ok('imposto abaixo de R$ 10 não vira DARF', pequeno.linhas[0].darf === 0 && pequeno.darfPendente > 0,
    [pequeno.linhas[0].darf, pequeno.darfPendente], [0, '>0']);
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[6] Telas e capturas');
{
  const dados = JSON.parse(JSON.stringify(vazio));
  dados.transacoes = [
    { id: 1, data: menosDias(300), ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 1000, preco: 30, cambio: 1, taxas: 10, taxasMoeda: 'BRL' },
    { id: 2, data: menosDias(60), ticker: 'PETR4', classe: 'acao', tipo: 'venda', moeda: 'BRL', quantidade: 500, preco: 45, cambio: 1, taxas: 5, taxasMoeda: 'BRL' },
    { id: 3, data: menosDias(200), ticker: 'MXRF11', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 2000, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 4, data: menosDias(30), ticker: 'MXRF11', classe: 'fii', tipo: 'amortizacao', moeda: 'BRL', quantidade: 2000, preco: 0.4, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }
  ];
  dados.rendafixa = [{
    id: 1, nome: 'CDB com aportes mensais', tipo: 'CDB', emissor: 'Banco A', indexador: 'CDI', taxa: 105,
    valorAplicado: 10000, dataAplicacao: menosDias(300), liquidez: 'diaria',
    aportes: [{ data: menosDias(240), valor: 1000 }, { data: menosDias(180), valor: 1000 }, { data: menosDias(120), valor: 1000 }],
    resgates: [{ data: menosDias(60), valor: 2000 }]
  }];
  const { p, erros } = await novaPagina(dados);
  await p.evaluate(() => atualizarSeries(true));
  await p.evaluate(() => atualizarCotacoes(true));
  await p.setViewportSize({ width: 1280, height: 1500 });
  for (const [aba, arq] of [['rendafixa', 'v5-rendafixa.png'], ['desempenho', 'v5-ir.png']]) {
    await p.evaluate(id => showPage(id), aba);
    await p.waitForTimeout(150);
    await p.screenshot({ path: capturas(arq), fullPage: true });
  }
  ok('telas renderizam sem erro', erros.length === 0, erros, []);
  await p.close();
}

console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length ? 1 : 0);
