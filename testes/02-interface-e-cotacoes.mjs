import { abrirNavegador, APP, capturas } from './navegador.mjs';
const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };
const cabec = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

const cdiSerie = [];
for (let i = 400; i >= 0; i--) {
  const d = new Date(HOJE); d.setDate(d.getDate() - i);
  if (d.getDay() === 0 || d.getDay() === 6) continue;
  cdiSerie.push({ data: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.04' });
}
const ipcaSerie = [];
for (let i = 12; i >= 1; i--) {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() - i, 1);
  ipcaSerie.push({ data: `01/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.40' });
}
const hist = base => { const o = []; for (let i = 60; i >= 0; i--) { const d = new Date(HOJE); d.setDate(d.getDate() - i); o.push({ date: Math.floor(d/1000), close: base * (1 + (60 - i) * 0.0008) }); } return o; };

const snaps = [];
for (let i = 45; i >= 1; i--) {
  const v = 60000 * Math.pow(1.0009, 45 - i) + (i % 5) * 40;
  snaps.push({ data: menosDias(i), patrimonio: v, custo: 55000, valorVar: v - 12000, custoVar: 43000,
    rfBruto: 12000, rfAplicado: 12000, proventosAcum: 300, realizadoAcum: 248, completo: true });
}

const dados = {
  versao: 2,
  transacoes: [
    { id: 1, data: menosDias(300), ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 30, cambio: 1, taxas: 5, taxasMoeda: 'BRL' },
    { id: 2, data: menosDias(200), ticker: 'PETR4', classe: 'acao', tipo: 'desdobramento', moeda: 'BRL', fator: 2 },
    { id: 3, data: menosDias(100), ticker: 'PETR4', classe: 'acao', tipo: 'venda', moeda: 'BRL', quantidade: 50, preco: 20, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 4, data: menosDias(280), ticker: 'HGLG11', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 60, preco: 160, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 5, data: menosDias(150), ticker: 'AAPL', classe: 'stock', tipo: 'compra', moeda: 'USD', quantidade: 10, preco: 200, cambio: 5, taxas: 10, taxasMoeda: 'USD' },
    { id: 6, data: menosDias(120), ticker: 'BTC', classe: 'cripto', tipo: 'compra', moeda: 'BRL', quantidade: 0.05, preco: 400000, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 7, data: menosDias(90), ticker: 'MXRF11', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 500, preco: 10, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 8, data: menosDias(30), ticker: 'MXRF11', classe: 'fii', tipo: 'venda', moeda: 'BRL', quantidade: 200, preco: 11, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }
  ],
  proventos: [
    { id: 20, data: menosDias(300), ticker: 'HGLG11', tipo: 'Rendimento (FII)', valor: 72 },
    { id: 21, data: menosDias(200), ticker: 'HGLG11', tipo: 'Rendimento (FII)', valor: 72 },
    { id: 22, data: menosDias(100), ticker: 'HGLG11', tipo: 'Rendimento (FII)', valor: 74 },
    { id: 23, data: menosDias(40), ticker: 'MXRF11', tipo: 'Rendimento (FII)', valor: 55 },
    { id: 24, data: menosDias(10), ticker: 'PETR4', tipo: 'Dividendo', valor: 210 }
  ],
  rendafixa: [
    { id: 30, nome: 'CDB Banco A', tipo: 'CDB', emissor: 'Banco A', indexador: 'CDI', taxa: 110, valorAplicado: 8000, dataAplicacao: menosDias(250), vencimento: menosDias(-400), liquidez: 'diaria' },
    { id: 31, nome: 'LCI Banco B', tipo: 'LCI', emissor: 'Banco B', indexador: 'CDI', taxa: 95, valorAplicado: 245000, dataAplicacao: menosDias(120), liquidez: 'carencia', carenciaAte: menosDias(-45) },
    { id: 32, nome: 'Tesouro Selic 2029', tipo: 'Tesouro Direto', emissor: 'Tesouro Nacional', indexador: 'SELIC', taxa: 0.1, valorAplicado: 14000, dataAplicacao: menosDias(150), qtdTitulos: 10, puAtual: 1500, liquidez: 'diaria' }
  ],
  ativos: { PETR4: { setor: 'Petróleo e Gás' }, HGLG11: { setor: 'FII de tijolo' }, AAPL: { setor: 'Tecnologia' } },
  cotacoes: {
    PETR4: { preco: 38, moeda: 'BRL', variacao: 2.7, fechamentoAnterior: 37, fonte: 'brapi', data: iso(HOJE), hora: '17:30' },
    HGLG11: { preco: 170, moeda: 'BRL', variacao: -0.5, fechamentoAnterior: 170.85, fonte: 'brapi', data: iso(HOJE), hora: '17:30' },
    AAPL: { preco: 220, moeda: 'USD', variacao: 0.9, fechamentoAnterior: 218, fonte: 'brapi', data: iso(HOJE), hora: '17:30' },
    BTC: { preco: 500000, moeda: 'BRL', variacao: 1.2, fechamentoAnterior: 494000, fonte: 'brapi', data: iso(HOJE), hora: '17:30' },
    MXRF11: { preco: 10.2, moeda: 'BRL', variacao: 0.2, fechamentoAnterior: 10.18, fonte: 'manual', data: iso(HOJE) }
  },
  snapshots: snaps, series: {},
  config: { token: 'tok', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() - 3600000 }
};

const b = await abrirNavegador();
const p = await b.newPage();
const erros = [];
p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
p.on('dialog', d => d.accept());

await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: cabec,
  body: JSON.stringify(r.request().url().includes('sgs.12') ? cdiSerie : ipcaSerie) }));
await p.route('**brapi.dev/api/quote/**', r => {
  const url = decodeURIComponent(r.request().url());
  if (url.includes('BVSP')) return r.fulfill({ status: 200, headers: cabec, body: JSON.stringify({ results: [{ symbol: '^BVSP', historicalDataPrice: hist(130000) }] }) });
  if (url.includes('XFIX11')) return r.fulfill({ status: 200, headers: cabec, body: JSON.stringify({ results: [{ symbol: 'XFIX11', historicalDataPrice: hist(9.5) }] }) });
  const alvo = url.split('/quote/')[1].split('?')[0].split(',');
  const pr = { PETR4: [38.4, 38, 'Petróleo e Gás'], HGLG11: [171, 170, 'FII de tijolo'], AAPL: [222, 220, 'Technology'], MXRF11: [10.25, 10.2, 'FII de papel'] };
  r.fulfill({ status: 200, headers: cabec, body: JSON.stringify({ results: alvo.filter(t => pr[t]).map(t => ({
    symbol: t, regularMarketPrice: pr[t][0], regularMarketPreviousClose: pr[t][1],
    regularMarketChangePercent: (pr[t][0] / pr[t][1] - 1) * 100, currency: t === 'AAPL' ? 'USD' : 'BRL', sector: pr[t][2] })) }) });
});
await p.route('**brapi.dev/api/v2/crypto**', r => r.fulfill({ status: 200, headers: cabec,
  body: JSON.stringify({ coins: [{ coin: 'BTC', regularMarketPrice: 505000, regularMarketPreviousClose: 500000 }] }) }));
await p.route('**brapi.dev/api/v2/currency**', r => r.fulfill({ status: 200, headers: cabec,
  body: JSON.stringify({ currency: [{ bidPrice: '5.5200' }] }) }));
await p.route('**tesourodireto.com.br**', r => r.fulfill({ status: 200, headers: cabec,
  body: JSON.stringify({ response: { TrsrBdTradgList: [{ TrsrBd: { nm: 'Tesouro Selic 2029', untrRedVal: 1512.34 } }] } }) }));

await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), dados);
await p.goto(APP);
await p.evaluate(() => atualizarSeries(true));

// --- percorre todas as abas
for (const t of ['carteira', 'desempenho', 'transacoes', 'rendafixa', 'proventos', 'config', 'dashboard']) {
  await p.evaluate(id => showPage(id), t);
  await p.waitForTimeout(60);
}
console.log('abas renderizadas sem erro:', erros.length === 0);

// --- consistência das tabelas
const cols = await p.evaluate(() => {
  showPage('carteira');
  const conta = sel => Array.from(document.querySelectorAll(sel)).reduce((s, t) => s + (t.colSpan || 1), 0);
  return { th: conta('#carteira-tabela thead th'), td: conta('#carteira-tabela tbody tr:first-child td'), tf: conta('#carteira-tabela tfoot td') };
});
console.log('colunas da carteira:', JSON.stringify(cols), cols.th === cols.td && cols.td === cols.tf ? 'OK' : 'DIVERGENTE');

// --- cadastro de desdobramento pelo formulário
await p.evaluate(() => showPage('transacoes'));
await p.selectOption('#tx-tipo', 'desdobramento');
const visivel = await p.evaluate(() => ({
  fator: getComputedStyle(document.getElementById('tx-fator-wrap')).display !== 'none',
  qtd: getComputedStyle(document.getElementById('tx-qtd-wrap')).display !== 'none',
  preco: getComputedStyle(document.getElementById('tx-preco-wrap')).display !== 'none'
}));
console.log('formulário troca campos no split:', JSON.stringify(visivel));
await p.fill('#tx-ticker', 'HGLG11'); await p.fill('#tx-fator', '5'); await p.fill('#tx-data', menosDias(5));
await p.click('button:has-text("Salvar lançamento")');
const posSplit = await p.evaluate(() => consolidar().lista.find(x => x.ticker === 'HGLG11'));
console.log('HGLG11 após split 1:5 →', posSplit.qtd, 'cotas, PM', posSplit.pm.toFixed(4), '(esperado 300 e 32,00)');

// --- bonificação
await p.selectOption('#tx-tipo', 'bonificacao');
await p.fill('#tx-ticker', 'PETR4'); await p.fill('#tx-qtd', '15'); await p.fill('#tx-preco', '0');
await p.click('button:has-text("Salvar lançamento")');
const posBon = await p.evaluate(() => consolidar().lista.find(x => x.ticker === 'PETR4'));
console.log('PETR4 após bonificação de 15 →', posBon.qtd, 'ações, custo', posBon.custo.toFixed(2), '(esperado 165 e 2253,75)');

// --- renda fixa: carência no formulário + PU do Tesouro
await p.evaluate(() => showPage('rendafixa'));
await p.selectOption('#rf-liquidez', 'carencia');
const carVis = await p.evaluate(() => getComputedStyle(document.getElementById('rf-carencia-wrap')).display !== 'none');
await p.selectOption('#rf-tipo', 'Tesouro Direto');
const tesVis = await p.evaluate(() => getComputedStyle(document.querySelector('.tesouro-only')).display !== 'none');
console.log('campos condicionais de RF (carência/tesouro):', carVis, tesVis);
await p.click('button:has-text("Buscar PU do Tesouro")');
await p.waitForTimeout(300);
const pu = await p.evaluate(() => getDB().rendafixa.find(r => r.id === 32).puAtual);
console.log('PU do Tesouro atualizado pela API:', pu, '(esperado 1512.34)');

// --- atualização de cotações
await p.evaluate(() => showPage('carteira'));
await p.click('button:has-text("Atualizar cotações")');
await p.waitForTimeout(400);
const cot = await p.evaluate(() => { const d = getDB(); return { petr: d.cotacoes.PETR4.preco, btc: d.cotacoes.BTC.preco, usd: d.config.usdbrl, setorBtc: (d.ativos.BTC || {}).setor }; });
console.log('cotações atualizadas:', JSON.stringify(cot));
console.log('banner:', (await p.textContent('#banner-cot')).trim().slice(0, 60));

// --- capturas
await p.setViewportSize({ width: 1280, height: 1600 });
for (const [aba, arq] of [['dashboard', 'v2-painel.png'], ['carteira', 'v2-carteira.png'], ['desempenho', 'v2-desempenho.png'], ['rendafixa', 'v2-rendafixa.png'], ['proventos', 'v2-proventos.png']]) {
  await p.evaluate(id => showPage(id), aba);
  await p.waitForTimeout(120);
  await p.screenshot({ path: capturas(arq), fullPage: true });
}
await p.setViewportSize({ width: 390, height: 844 });
await p.evaluate(() => showPage('dashboard'));
await p.screenshot({ path: capturas('v2-mobile.png'), fullPage: true });

console.log('\nERROS:', erros.length ? erros : 'nenhum');
await b.close();
