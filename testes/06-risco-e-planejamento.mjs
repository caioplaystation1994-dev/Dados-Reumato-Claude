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
const ipcaSerie = [];
for (let i = 18; i >= 1; i--) {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() - i, 1);
  ipcaSerie.push({ data: `01/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.40' });
}
// histórico de preços: sobe 0,05% ao dia
const histPreco = (base, dias) => {
  const o = [];
  for (let i = dias; i >= 0; i--) {
    const d = new Date(HOJE); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    o.push({ date: Math.floor(d.getTime() / 1000), close: base * Math.pow(1.0005, dias - i) });
  }
  return o;
};

const falhas = [];
const ok = (n, c, o, e) => { if (c) console.log('  ✓ ' + n); else { console.log('  ✗ ' + n + ' → obtido ' + JSON.stringify(o) + ', esperado ' + JSON.stringify(e)); falhas.push(n); } };
const perto = (a, e, tol) => Math.abs(a - e) <= (tol === undefined ? 0.01 : tol);

const b = await abrirNavegador();
async function novaPagina(dados) {
  const p = await b.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return;   // logos externos, tratados por onerror
    erros.push('CONSOLE: ' + m.text());
  });
  p.on('dialog', d => d.accept());
  await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: cabec,
    body: JSON.stringify(r.request().url().includes('sgs.12') ? cdiSerie : ipcaSerie) }));
  await p.route('**brapi.dev/api/quote/**', r => {
    const url = decodeURIComponent(r.request().url());
    const alvo = url.split('/quote/')[1].split('?')[0].split(',');
    const base = { PETR4: 30, HGLG11: 160, AAPL: 200, '^BVSP': 130000, XFIX11: 9.5 };
    r.fulfill({ status: 200, headers: cabec, body: JSON.stringify({
      results: alvo.filter(t => base[t]).map(t => ({
        symbol: t, regularMarketPrice: base[t] * 1.2, regularMarketPreviousClose: base[t] * 1.19,
        regularMarketChangePercent: 0.8, currency: t === 'AAPL' ? 'USD' : 'BRL',
        sector: 'Setor teste', longName: 'Empresa ' + t, logourl: 'https://exemplo.com/' + t + '.png',
        historicalDataPrice: histPreco(base[t], 400)
      })) }) });
  });
  await p.route('**brapi.dev/api/v2/**', r => r.fulfill({ status: 200, headers: cabec,
    body: JSON.stringify({ coins: [], currency: [{ bidPrice: '5.5' }] }) }));
  if (dados) await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), dados);
  await p.goto(APP);
  return { p, erros };
}

const baseDados = {
  versao: 4,
  transacoes: [
    { id: 1, data: menosDias(365), ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 200, preco: 30, cambio: 1, taxas: 12, taxasMoeda: 'BRL' },
    { id: 2, data: menosDias(200), ticker: 'HGLG11', classe: 'fii', tipo: 'compra', moeda: 'BRL', quantidade: 50, preco: 160, cambio: 1, taxas: 8, taxasMoeda: 'BRL' },
    { id: 3, data: menosDias(120), ticker: 'AAPL', classe: 'stock', tipo: 'compra', moeda: 'USD', quantidade: 10, preco: 200, cambio: 5, taxas: 5, taxasMoeda: 'USD' }
  ],
  proventos: [
    { id: 10, data: menosDias(90), ticker: 'HGLG11', tipo: 'Rendimento (FII)', valor: 60, status: 'recebido' },
    { id: 11, data: menosDias(-15), ticker: 'PETR4', tipo: 'Dividendo', valor: 180, status: 'previsto', dataCom: menosDias(-2) }
  ],
  rendafixa: [
    { id: 20, nome: 'CDB Banco A', tipo: 'CDB', emissor: 'Banco A', indexador: 'CDI', taxa: 110, valorAplicado: 20000, dataAplicacao: menosDias(300), vencimento: menosDias(-20), liquidez: 'diaria' },
    { id: 21, nome: 'CDB vencido', tipo: 'CDB', emissor: 'Banco B', indexador: 'CDI', taxa: 100, valorAplicado: 5000, dataAplicacao: menosDias(400), vencimento: menosDias(10), liquidez: 'vencimento' },
    { id: 22, nome: 'VGBL', tipo: 'Previdência privada', emissor: 'Seguradora', indexador: 'INFORMADO', valorAplicado: 30000, dataAplicacao: menosDias(800), valorInformadoBruto: 39000, valorInformadoData: menosDias(30), modoInformado: 'valor', correcao: 'nenhuma', liquidez: 'diaria' }
  ],
  ativos: {}, cotacoes: {}, snapshots: [], precosHist: {}, series: {},
  metas: { alocacao: { acao: 40, fii: 20, stock: 10, rf: 30 }, banda: 5, patrimonioMeta: 500000, dataMeta: menosDias(-1825), aporteMensal: 2000 },
  config: { token: 'tok', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, intradayMin: 0, ultimaAtualizacao: Date.now() }
};

// ======================================================================
console.log('\n[1] Baixa automática no vencimento e agenda da renda fixa');
{
  const { p, erros } = await novaPagina(baseDados);
  const r = await p.evaluate(() => {
    const db = getDB();
    const vencido = db.rendafixa.find(x => x.id === 21);
    const ativo = db.rendafixa.find(x => x.id === 20);
    return { vencido, ativo, eventos: proximosEventosRF(90) };
  });
  ok('título vencido é baixado sozinho', r.vencido.resgatado === true && r.vencido.baixaAutomatica === true, r.vencido.resgatado, true);
  ok('baixa usa a data do vencimento', r.vencido.dataResgate === menosDias(10), r.vencido.dataResgate, menosDias(10));
  ok('valor do resgate é o líquido daquele dia', r.vencido.valorResgate > 5000, r.vencido.valorResgate, '>5000');
  ok('título a vencer não é tocado', r.ativo.resgatado === false || r.ativo.resgatado === undefined, r.ativo.resgatado, false);
  ok('agenda mostra o vencimento próximo', r.eventos.some(e => e.tipo === 'Vencimento' && e.dias === 20), r.eventos.map(e => e.dias), [20]);
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[2] Previdência com tabela regressiva própria');
{
  const { p, erros } = await novaPagina(baseDados);
  const r = await p.evaluate(() => {
    const db = getDB();
    const vgbl = db.rendafixa.find(x => x.id === 22);
    const curto = Object.assign({}, vgbl, { dataAplicacao: hojeISO().slice(0, 4) + '-01-01' });
    return { longo: calcRF(vgbl, db), aliqs: [aliquotaPrevidencia(300), aliquotaPrevidencia(1000), aliquotaPrevidencia(2000), aliquotaPrevidencia(4000), aliquotaPrevidencia(300, 'progressiva')] };
  });
  ok('previdência com 800 dias usa 30%', r.longo.aliq === 30, r.longo.aliq, 30);
  ok('faixas da tabela regressiva', JSON.stringify(r.aliqs) === JSON.stringify([35, 30, 25, 10, 15]), r.aliqs, [35, 30, 25, 10, 15]);
  ok('IR aplicado sobre o rendimento', perto(r.longo.ir, 9000 * 0.30, 1), r.longo.ir, 2700);
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[3] Reconstrução do histórico com preços passados');
{
  const { p, erros } = await novaPagina(baseDados);
  await p.evaluate(() => atualizarSeries(true));
  await p.evaluate(() => showPage('desempenho'));
  await p.evaluate(() => reconstruirHistorico());
  const r = await p.evaluate(() => {
    const db = getDB();
    const s = db.snapshots;
    return {
      total: s.length, recon: s.filter(x => x.reconstruido).length,
      primeiro: s[0], ultimo: s[s.length - 1],
      precos: Object.keys(db.precosHist),
      temPorAtivo: !!(s[s.length - 1].porAtivo && s[s.length - 1].porAtivo.PETR4),
      twr: twrPeriodo(null), risco: metricasRisco()
    };
  });
  ok('gerou centenas de dias úteis', r.total > 200, r.total, '>200');
  ok('só dias úteis no histórico', r.recon > 200 && new Date(r.ultimo.data + 'T12:00').getDay() % 6 !== 0, r.recon, '>200');
  ok('primeiro dia começa na primeira compra', r.primeiro.data >= menosDias(366), r.primeiro.data, menosDias(365));
  ok('preços históricos guardados por ativo', r.precos.length === 3, r.precos, ['PETR4', 'HGLG11', 'AAPL']);
  ok('valor por ativo dentro do snapshot', r.temPorAtivo, r.temPorAtivo, true);
  ok('TWR passa a existir imediatamente', r.twr && r.twr.pontos > 200, r.twr && r.twr.pontos, '>200');
  ok('métricas de risco calculadas', r.risco && r.risco.vol > 0, r.risco && r.risco.vol, '>0');
  ok('drawdown não é positivo', r.risco.maxDD <= 0, r.risco.maxDD, '<=0');
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[4] Modified Dietz, XIRR e retornos mensais');
{
  const { p, erros } = await novaPagina(baseDados);
  const r = await p.evaluate(d => {
    const db = getDB();
    // 10 dias úteis: patrimônio sobe 1% ao dia, com aporte de 10.000 no 5º dia
    const dias = [];
    let cur = new Date(); cur.setDate(cur.getDate() - 20);
    while (dias.length < 11) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) dias.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    db.transacoes = [{ id: 1, data: dias[0], ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 100, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
      { id: 2, data: dias[5], ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 100, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }];
    db.rendafixa = []; db.proventos = [];
    db.cotacoes = { PETR4: { preco: 120, moeda: 'BRL', fonte: 'manual', data: hojeISO() } };
    let v = 10000;
    db.snapshots = dias.map((dt, i) => {
      if (i === 5) v += 10000;
      const s = { data: dt, patrimonio: v, custo: i < 5 ? 10000 : 20000, valorVar: v, custoVar: i < 5 ? 10000 : 20000,
        rfBruto: 0, rfAplicado: 0, proventosAcum: 0, realizadoAcum: 0, completo: true, util: true };
      v *= 1.01;
      return s;
    });
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return { twr: twrPeriodo(null), xirr: xirr(), mensal: retornosMensais(), serie: serieTWR().length };
  });
  const esperado = (Math.pow(1.01, 10) - 1) * 100;
  ok('TWR isola o aporte do meio do período', perto(r.twr.retorno, esperado, 0.15), r.twr.retorno, esperado);
  ok('série com um retorno por dia útil', r.serie === 10, r.serie, 10);
  ok('XIRR encontra a taxa mesmo em janela curta', r.xirr && r.xirr.taxa > 0, r.xirr && r.xirr.taxa, '>0');
  ok('XIRR marca janela curta como pouco informativa', r.xirr && r.xirr.curto === true, r.xirr && r.xirr.curto, true);
  ok('retornos mensais agregados', r.mensal.length >= 1 && isFinite(r.mensal[0].total), r.mensal.length, '>=1');
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[5] Editor do histórico, dias úteis e descartes');
{
  const { p, erros } = await novaPagina(baseDados);
  const r = await p.evaluate(() => {
    const db = getDB();
    const uteis = ['2026-08-03', '2026-08-04', '2026-08-05'];
    const valores = [1000, 100000, 101000];
    db.snapshots = uteis.map((d, i) => ({ data: d, patrimonio: valores[i], custo: 1000, valorVar: valores[i],
      custoVar: 1000, rfBruto: 0, rfAplicado: 0, proventosAcum: 0, realizadoAcum: 0, completo: true, util: true }));
    db.snapshots.push({ data: '2026-08-02', patrimonio: 999999, custo: 1000, valorVar: 999999, custoVar: 1000,
      rfBruto: 0, rfAplicado: 0, proventosAcum: 0, realizadoAcum: 0, completo: true, util: false });
    db.transacoes = []; db.rendafixa = []; db.proventos = [];
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return { uteis: snapshotsUteis().length, descartados: retornosDescartados().length, serie: serieTWR().length };
  });
  ok('domingo fica fora do cálculo', r.uteis === 3, r.uteis, 3);
  ok('salto de 100% é descartado e sinalizado', r.descartados === 1, r.descartados, 1);
  await p.evaluate(() => { showPage('desempenho'); editarHistorico(); });
  const linhas = await p.evaluate(() => document.querySelectorAll('#modal-content tbody tr').length);
  ok('editor lista os registros', linhas === 4, linhas, 4);
  await p.evaluate(() => { salvarSnapshot('2026-08-04', '2100'); excluirSnapshot('2026-08-02'); });
  const dep = await p.evaluate(() => { const db = getDB(); return { n: db.snapshots.length, v: db.snapshots.find(x => x.data === '2026-08-04').patrimonio }; });
  ok('editar e excluir registros funciona', dep.n === 3 && dep.v === 2100, dep, { n: 3, v: 2100 });
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[6] Planejamento: alvos, bandas, aporte e rebalanceamento');
{
  const { p, erros } = await novaPagina(baseDados);
  await p.evaluate(() => showPage('planejamento'));
  const r = await p.evaluate(() => {
    const a = analiseAlocacao();
    return { a, aporte: sugerirAporte(10000), meta: analiseMeta(), proj: projecaoPatrimonio(10) };
  });
  ok('alvos somam 100%', perto(r.a.somaAlvo, 100), r.a.somaAlvo, 100);
  ok('classifica dentro e fora da banda', r.a.linhas.every(l => typeof l.fora === 'boolean'), true, true);
  ok('ajuste aponta compra e venda', r.a.linhas.some(l => l.ajuste > 0) && r.a.linhas.some(l => l.ajuste < 0), true, true);
  const somaAporte = r.aporte.itens.reduce((s, i) => s + i.valor, 0) + r.aporte.sobra;
  ok('aporte distribuído sem estourar o valor', perto(somaAporte, 10000, 0.05), somaAporte, 10000);
  ok('aporte só sugere compras', r.aporte.itens.every(i => i.valor > 0), true, true);
  ok('meta calcula progresso e prazo', r.meta && r.meta.progresso > 0 && r.meta.meses > 0, r.meta && r.meta.progresso, '>0');
  ok('aporte necessário para a data-alvo', r.meta.aporteNecessario != null && r.meta.aporteNecessario >= 0, r.meta.aporteNecessario, '>=0');
  ok('projeção com três cenários', r.proj.cenarios.length === 3 && r.proj.cenarios[2].final > r.proj.cenarios[0].final, r.proj.cenarios.map(c => Math.round(c.final)), 'pess < otim');
  ok('projeção parte do patrimônio atual', perto(r.proj.cenarios[1].pontos[0].v, r.proj.inicial, 1), r.proj.cenarios[1].pontos[0].v, r.proj.inicial);
  const html = await p.evaluate(() => ({
    alvos: document.querySelectorAll('#tabela-alvos tbody tr').length,
    cards: document.querySelectorAll('#plan-cards .stat-card').length
  }));
  ok('tela de planejamento renderiza', html.alvos === 7 && html.cards === 4, html, { alvos: 7, cards: 4 });
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[7] Proventos previstos, exposição cambial, taxas e memoização');
{
  const { p, erros } = await novaPagina(baseDados);
  await p.evaluate(() => atualizarCotacoes(true));
  const r = await p.evaluate(() => {
    const { lista } = consolidar();
    const petr = lista.find(x => x.ticker === 'PETR4');
    return {
      dyPetr: petr.proventos12, taxas: custoTaxas(), fx: exposicaoCambial(),
      nome: getDB().ativos.PETR4.nome, logo: getDB().ativos.PETR4.logo
    };
  });
  ok('provento previsto não entra no recebido', r.dyPetr === 0, r.dyPetr, 0);
  ok('total de taxas somado', perto(r.taxas.total, 12 + 8 + 5 * 5), r.taxas.total, 45);
  ok('exposição cambial identificada', r.fx.direta > 0 && r.fx.pct > 0, r.fx.pct, '>0');
  ok('nome e logo guardados', /Empresa PETR4/.test(r.nome) && /exemplo\.com/.test(r.logo), [r.nome, r.logo], 'nome e logo');

  const perf = await p.evaluate(() => {
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) consolidar();
    const comCache = performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < 60; i++) consolidarAgora();
    const semCache = performance.now() - t1;
    return { comCache, semCache };
  });
  ok('memoização acelera a consolidação', perf.comCache < perf.semCache / 3,
    { com: +perf.comCache.toFixed(1), sem: +perf.semCache.toFixed(1) }, 'cache 3x+ mais rápido');

  const inval = await p.evaluate(() => {
    const antes = consolidar().lista.length;
    const db = getDB();
    db.transacoes.push({ id: 99, data: '2026-01-01', ticker: 'VALE3', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 1, preco: 60, cambio: 1, taxas: 0, taxasMoeda: 'BRL' });
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return { antes, depois: consolidar().lista.length };
  });
  ok('cache invalida quando os dados mudam', inval.depois === inval.antes + 1, inval, 'antes+1');
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

// ======================================================================
console.log('\n[8] Telas completas e capturas');
{
  const { p, erros } = await novaPagina(baseDados);
  await p.evaluate(() => atualizarSeries(true));
  await p.evaluate(() => atualizarCotacoes(true));
  await p.evaluate(() => showPage('desempenho'));
  await p.evaluate(() => reconstruirHistorico());
  for (const t of ['dashboard', 'carteira', 'desempenho', 'planejamento', 'transacoes', 'rendafixa', 'proventos', 'config']) {
    await p.evaluate(id => showPage(id), t);
    await p.waitForTimeout(80);
  }
  const corr = await p.evaluate(() => { showPage('desempenho'); return correlacoes(); });
  ok('matriz de correlação montada', corr && corr.tickers.length === 3 && perto(corr.matriz[0][0], 1), corr && corr.tickers, ['3 ativos']);
  await p.setViewportSize({ width: 1280, height: 1600 });
  for (const [aba, arq] of [['desempenho', 'v4-desempenho.png'], ['planejamento', 'v4-planejamento.png'], ['rendafixa', 'v4-rendafixa.png'], ['proventos', 'v4-proventos.png']]) {
    await p.evaluate(id => showPage(id), aba);
    await p.waitForTimeout(150);
    await p.screenshot({ path: capturas(arq), fullPage: true });
  }
  ok('todas as abas sem erro', erros.length === 0, erros, []);
  await p.close();
}

console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length ? 1 : 0);
