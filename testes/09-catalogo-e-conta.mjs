// Cada tipo de investimento precisa ter um caminho óbvio de cadastro, e a conta
// remunerada precisa render todo dia com o dinheiro disponível.
import { abrirNavegador, APP, CABECALHO_JSON, criarContador, perto, capturas } from './navegador.mjs';

const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };
const { ok, falhas } = criarContador();

const cdiSerie = [];
for (let i = 800; i >= 0; i--) {
  const d = new Date(HOJE); d.setDate(d.getDate() - i);
  if (d.getDay() === 0 || d.getDay() === 6) continue;
  cdiSerie.push({ data: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.05' });
}

const b = await abrirNavegador();
const p = await b.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
p.on('dialog', d => d.accept());
await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON,
  body: JSON.stringify(r.request().url().includes('sgs.12') ? cdiSerie : []) }));
await p.route('**brapi.dev**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON, body: JSON.stringify({ results: [] }) }));
await p.addInitScript(() => localStorage.setItem('investimentos_db', JSON.stringify({
  versao: 4, transacoes: [], proventos: [], rendafixa: [], ativos: {}, cotacoes: {}, snapshots: [],
  precosHist: {}, series: {}, metas: {},
  config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
})));
await p.goto(APP);
await p.evaluate(() => atualizarSeries(true));

console.log('\n[1] Catálogo cobre tudo o que o app aceita');
{
  await p.click('button:has-text("Novo investimento")');
  const opcoes = await p.evaluate(() =>
    Array.from(document.querySelectorAll('#modal-content .escolha .nm')).map(e => e.textContent));
  const esperados = ['Ações brasileiras', 'Ações e ETFs americanos', 'Fundos imobiliários', 'ETFs brasileiros',
    'BDRs', 'Criptomoedas', 'Conta remunerada', 'CDB, RDB, LCI ou LCA', 'Tesouro Direto',
    'Fundo de investimento', 'Previdência privada', 'Poupança'];
  const faltando = esperados.filter(e => !opcoes.some(o => o.indexOf(e) >= 0));
  ok('todas as categorias aparecem no seletor', faltando.length === 0, faltando, 'nenhuma faltando');
  ok('cada opção tem exemplo', await p.evaluate(() => document.querySelectorAll('#modal-content .escolha .ex').length) === opcoes.length,
    'exemplos', 'um por opção');
}

console.log('\n[2] Cada opção abre o formulário certo');
{
  await p.evaluate(() => { fecharModal(); novoAtivo('stock'); });
  const rv = await p.evaluate(() => ({
    aba: document.querySelector('.page.active').id,
    classe: document.getElementById('tx-classe').value,
    cambio: getComputedStyle(document.getElementById('tx-cambio-wrap')).display !== 'none',
    dica: document.getElementById('tx-ticker-hint').textContent
  }));
  ok('ações americanas abrem Transações em dólar', rv.aba === 'page-transacoes' && rv.classe === 'stock' && rv.cambio,
    rv, 'stock com câmbio');
  ok('a dica mostra exemplos de ticker americano', /AAPL/.test(rv.dica), rv.dica, 'AAPL, VOO, MSFT...');

  await p.evaluate(() => novoAtivo('cripto'));
  const cr = await p.evaluate(() => document.getElementById('tx-ticker-hint').textContent);
  ok('cripto abre com exemplos de moeda', /BTC/.test(cr), cr, 'BTC, ETH, SOL...');

  await p.evaluate(() => novoRF('Previdência privada', { informado: true }));
  const prev = await p.evaluate(() => ({
    aba: document.querySelector('.page.active').id,
    tipo: document.getElementById('rf-tipo').value,
    indexador: document.getElementById('rf-indexador').value,
    vencVisivel: getComputedStyle(document.getElementById('rf-venc').parentElement).display !== 'none',
    informadoVisivel: getComputedStyle(document.querySelector('.informado-only')).display !== 'none'
  }));
  ok('previdência abre pedindo o saldo, não uma taxa',
    prev.tipo === 'Previdência privada' && prev.indexador === 'INFORMADO' && prev.informadoVisivel, prev, 'saldo informado');
  ok('vencimento some em aplicação sem prazo', prev.vencVisivel === false, prev.vencVisivel, false);

  await p.evaluate(() => novoRF('Fundo de investimento', { informado: true }));
  const fundo = await p.evaluate(() => document.getElementById('rf-indexador').value);
  ok('fundo também entra pelo saldo', fundo === 'INFORMADO', fundo, 'INFORMADO');
}

console.log('\n[3] Conta remunerada: rende todo dia e continua disponível');
{
  await p.evaluate(() => novaContaRemunerada());
  const form = await p.evaluate(() => ({
    tipo: document.getElementById('rf-tipo').value,
    indexador: document.getElementById('rf-indexador').value,
    taxa: document.getElementById('rf-taxa').value,
    liquidez: document.getElementById('rf-liquidez').value,
    dica: document.getElementById('rf-preview').textContent
  }));
  ok('abre como 100% do CDI com liquidez diária',
    form.tipo === 'Conta remunerada' && form.indexador === 'CDI' && form.taxa === '100' && form.liquidez === 'diaria',
    form, '100% do CDI, diária');
  ok('explica como lançar depósitos e saques', /aportes/.test(form.dica), form.dica.slice(0, 60), 'menciona aportes');

  await p.fill('#rf-nome', 'Conta do Banco X');
  await p.fill('#rf-emissor', 'Banco X');
  await p.fill('#rf-valor', '5000');
  await p.fill('#rf-data', menosDias(120));
  await p.click('button:has-text("Salvar título")');

  const conta = await p.evaluate(() => {
    const db = getDB();
    const r = db.rendafixa[0];
    return { r, c: calcRF(r, db) };
  });
  ok('conta salva sem vencimento', !conta.r.vencimento, conta.r.vencimento, 'vazio');
  ok('rende pelo CDI desde a aplicação', conta.c.valor > 5000 && conta.c.rentPct > 1, conta.c.rentPct, '>1%');
  ok('dinheiro fica disponível', conta.c.resgatavel === true && !conta.c.emCarencia, conta.c.resgatavel, true);
  ok('entra na cobertura do FGC', conta.c.fgc === true, conta.c.fgc, true);

  // depósito e saque pela tela de movimentações
  const id = conta.r.id;
  await p.evaluate(i => movimentacoesRF(i), id);
  await p.selectOption('#mv-tipo', 'aporte');
  await p.fill('#mv-data', menosDias(60));
  await p.fill('#mv-valor', '2000');
  await p.click('button:has-text("Lançar")');
  await p.selectOption('#mv-tipo', 'resgate');
  await p.fill('#mv-data', menosDias(20));
  await p.fill('#mv-valor', '1000');
  await p.click('button:has-text("Lançar")');
  await p.evaluate(() => fecharModal());

  const dep = await p.evaluate(() => { const db = getDB(); return calcRF(db.rendafixa[0], db); });
  ok('depósito e saque registrados', perto(dep.totalAportes, 2000) && perto(dep.totalResgates, 1000),
    [dep.totalAportes, dep.totalResgates], [2000, 1000]);
  ok('principal reflete entradas e saídas', dep.aplicado > 5900 && dep.aplicado < 6100, dep.aplicado, '≈6.000');
  ok('saldo maior que o principal, pelo rendimento', dep.valor > dep.aplicado, [dep.valor, dep.aplicado], 'valor > aplicado');
  ok('IR regressivo continua valendo', dep.aliq > 0, dep.aliq, '>0');
}

console.log('\n[4] Uma carteira com tudo dentro');
{
  await p.evaluate(d => {
    const db = getDB();
    db.transacoes = [
      { id: 1, data: d.a, ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 200, preco: 30, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
      { id: 2, data: d.b, ticker: 'AAPL', classe: 'stock', tipo: 'compra', moeda: 'USD', quantidade: 10, preco: 200, cambio: 5.2, taxas: 0, taxasMoeda: 'USD' },
      { id: 3, data: d.c, ticker: 'BTC', classe: 'cripto', tipo: 'compra', moeda: 'BRL', quantidade: 0.05, preco: 400000, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }
    ];
    db.rendafixa.push(
      { id: 90, nome: 'Fundo Multimercado', tipo: 'Fundo de investimento', emissor: 'Gestora Y', indexador: 'INFORMADO',
        valorAplicado: 20000, dataAplicacao: d.a, valorInformadoBruto: 23400, valorInformadoData: d.hoje,
        modoInformado: 'valor', correcao: 'IMPLICITA', liquidez: 'diaria' },
      { id: 91, nome: 'VGBL', tipo: 'Previdência privada', emissor: 'Seguradora Z', indexador: 'INFORMADO',
        valorAplicado: 30000, dataAplicacao: d.velho, valorInformadoBruto: 41000, valorInformadoData: d.hoje,
        modoInformado: 'valor', correcao: 'IMPLICITA', liquidez: 'diaria' });
    db.cotacoes = { PETR4: { preco: 38, moeda: 'BRL', fonte: 'manual', data: d.hoje },
      AAPL: { preco: 220, moeda: 'USD', fonte: 'manual', data: d.hoje },
      BTC: { preco: 520000, moeda: 'BRL', fonte: 'manual', data: d.hoje } };
    localStorage.setItem('investimentos_db', JSON.stringify(db));
  }, { a: menosDias(400), b: menosDias(300), c: menosDias(200), velho: menosDias(1500), hoje: iso(HOJE) });

  const r = await p.evaluate(() => {
    showPage('dashboard');
    const { lista } = consolidar();
    const rf = resumoRF();
    const classes = {};
    lista.filter(x => x.qtd > 0).forEach(x => { classes[x.classe] = x.valor; });
    return { classes, rfBruto: rf.bruto, titulos: rf.itens.length, patrimonio: fotoAtual().patrimonio };
  });
  ok('ação, ação americana e cripto convivem na carteira',
    !!(r.classes.acao && r.classes.stock && r.classes.cripto), Object.keys(r.classes), ['acao', 'stock', 'cripto']);
  ok('conta, fundo e previdência somam na renda fixa', r.titulos === 3 && r.rfBruto > 70000, [r.titulos, r.rfBruto], '3 títulos');
  ok('patrimônio junta os dois lados', r.patrimonio > 100000, r.patrimonio, '>100 mil');

  await p.setViewportSize({ width: 1280, height: 1100 });
  await p.evaluate(() => escolherInvestimento());
  await p.waitForTimeout(150);
  await p.screenshot({ path: capturas('v6-catalogo.png') });
  await p.evaluate(() => fecharModal());
  await p.evaluate(() => showPage('rendafixa'));
  await p.waitForTimeout(150);
  await p.screenshot({ path: capturas('v6-rendafixa.png'), fullPage: true });
}

console.log('\nERROS:', erros.length ? erros : 'nenhum');
console.log(falhas.length ? '❌ ' + falhas.length + ' falha(s)' : '✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length || erros.length ? 1 : 0);
