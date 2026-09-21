// Regressão do erro de cálculo relatado: um CDB IPCA+ mostrava 2% de rendimento
// em 14 meses porque a série do CDI guardada não alcançava a data da aplicação,
// e o expoente de tempo (dias úteis) saía do tamanho da série.
import { abrirNavegador, APP, CABECALHO_JSON, criarContador, perto } from './navegador.mjs';

const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };
const { ok, falhas } = criarContador();

function serieCDI(diasParaTras) {
  const out = [];
  for (let i = diasParaTras; i >= 0; i--) {
    const d = new Date(HOJE); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    out.push({ data: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.05' });
  }
  return out;
}
function serieIPCA(meses) {
  const out = [];
  for (let i = meses; i >= 2; i--) {
    const d = new Date(HOJE.getFullYear(), HOJE.getMonth() - i, 1);
    out.push({ data: `01/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.45' });
  }
  return out;
}

const b = await abrirNavegador();
async function pagina(diasCDI, titulos) {
  const p = await b.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON,
    body: JSON.stringify(r.request().url().includes('sgs.12') ? serieCDI(diasCDI) : serieIPCA(20)) }));
  await p.route('**brapi.dev**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON, body: JSON.stringify({ results: [] }) }));
  await p.addInitScript(t => localStorage.setItem('investimentos_db', JSON.stringify({
    versao: 4, transacoes: [], proventos: [], ativos: {}, cotacoes: {}, snapshots: [], precosHist: {}, series: {}, metas: {},
    rendafixa: t,
    config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
  })), titulos);
  await p.goto(APP);
  return { p, erros };
}

const cdbIPCA = [{ id: 1, nome: 'CDB IPCA+', tipo: 'CDB', emissor: 'PINE', indexador: 'IPCA', taxa: 8.90,
  valorAplicado: 10000, dataAplicacao: menosDias(431), vencimento: menosDias(-600), liquidez: 'vencimento' }];

console.log('\n[1] Série curta não pode encolher o tempo decorrido');
{
  const curta = await pagina(90, cdbIPCA);
  await curta.p.evaluate(() => atualizarSeries(true));
  const rc = await curta.p.evaluate(() => calcRF(getDB().rendafixa[0], getDB()));

  const longa = await pagina(900, cdbIPCA);
  await longa.p.evaluate(() => atualizarSeries(true));
  const rl = await longa.p.evaluate(() => calcRF(getDB().rendafixa[0], getDB()));

  const duEsperado = 431 * 252 / 365;
  ok('dias úteis vêm do período, não do tamanho da série', perto(rc.du, duEsperado, 12), rc.du, duEsperado);
  ok('série curta e série completa dão quase o mesmo valor',
    Math.abs(rc.valor - rl.valor) / rl.valor < 0.01, [rc.valor, rl.valor], 'diferença < 1%');
  ok('rendimento coerente com IPCA + 8,90% em 14 meses', rc.rentPct > 15 && rc.rentPct < 22, rc.rentPct, 'entre 15% e 22%');
  ok('método diz até onde o dado oficial alcança', /IPCA do IBGE até|estimativa/.test(rc.metodo), rc.metodo, 'menciona a estimativa');
  ok('defasagem normal do IPCA não vira alerta permanente', rc.parcial === false, rc.parcial, false);

  // já num título de CDI a série curta precisa aparecer como trecho estimado
  const cdb = await pagina(90, [{ id: 1, nome: 'CDB CDI', tipo: 'CDB', indexador: 'CDI', taxa: 110,
    valorAplicado: 10000, dataAplicacao: menosDias(431), liquidez: 'diaria' }]);
  await cdb.p.evaluate(() => atualizarSeries(true));
  const rcdi = await cdb.p.evaluate(() => calcRF(getDB().rendafixa[0], getDB()));
  ok('trecho sem série no CDI é sinalizado', rcdi.parcial === true, rcdi.parcial, true);
  ok('método aponta desde quando o dado é oficial', /desde .*, estimado antes disso/.test(rcdi.metodo),
    rcdi.metodo, 'CDI do BCB desde dd/mm');
  ok('valor do CDB continua coerente com 110% do CDI', rcdi.rentPct > 12 && rcdi.rentPct < 22, rcdi.rentPct, 'entre 12% e 22%');
  await cdb.p.close();
  ok('sem erros', curta.erros.length === 0 && longa.erros.length === 0, [curta.erros, longa.erros], []);
  await curta.p.close(); await longa.p.close();
}

console.log('\n[2] Séries são rebaixadas quando não cobrem a aplicação');
{
  const { p, erros } = await pagina(900, cdbIPCA);
  await p.evaluate(() => atualizarSeries(true));
  const antes = await p.evaluate(() => ({ cobre: seriesCobrem(), precisa: seriesPrecisamAtualizar() }));
  ok('série baixada cobre o período', antes.cobre === true && antes.precisa === false, antes, { cobre: true, precisa: false });
  const depois = await p.evaluate(d => {
    const db = getDB();
    db.rendafixa.push({ id: 2, nome: 'CDB bem antigo', tipo: 'CDB', indexador: 'CDI', taxa: 100,
      valorAplicado: 5000, dataAplicacao: d, liquidez: 'diaria' });
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return { cobre: seriesCobrem(), precisa: seriesPrecisamAtualizar() };
  }, menosDias(2000));
  ok('título mais antigo marca a série como insuficiente',
    depois.cobre === false && depois.precisa === true, depois, { cobre: false, precisa: true });
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

console.log('\n[3] Conferência do saldo mantendo a taxa contratada');
{
  const { p, erros } = await pagina(900, cdbIPCA);
  await p.evaluate(() => atualizarSeries(true));
  const antes = await p.evaluate(() => calcRF(getDB().rendafixa[0], getDB()));

  // o banco mostra 11.912,49 hoje: vira o novo ponto de partida
  await p.evaluate(() => { showPage('rendafixa'); atualizarSaldo(1); });
  await p.fill('#md-valor', '11912.49');
  await p.click('button:has-text("Salvar saldo")');
  const dep = await p.evaluate(() => {
    const db = getDB();
    return { r: db.rendafixa[0], c: calcRF(db.rendafixa[0], db) };
  });
  ok('indexador contratado é preservado', dep.r.indexador === 'IPCA' && dep.r.taxa === 8.9,
    [dep.r.indexador, dep.r.taxa], ['IPCA', 8.9]);
  ok('valor de hoje passa a ser o conferido', perto(dep.c.valor, 11912.49, 0.5), dep.c.valor, 11912.49);
  ok('principal aplicado não muda', perto(dep.c.aplicado, 10000), dep.c.aplicado, 10000);
  ok('divergência contra a curva é medida', perto(dep.c.divergencia, 11912.49 - antes.valor, 1),
    dep.c.divergencia, 11912.49 - antes.valor);
  ok('método explica a conferência', /saldo conferido em .* seguindo por/.test(dep.c.metodo), dep.c.metodo, 'saldo conferido + índice');

  // a partir da conferência o título volta a render pelo indexador
  const futuro = await p.evaluate(d => {
    const db = getDB();
    db.rendafixa[0].saldoConferido = { data: d, valor: 11912.49 };
    localStorage.setItem('investimentos_db', JSON.stringify(db));
    return calcRF(db.rendafixa[0], db);
  }, menosDias(60));
  ok('rende pelo índice depois do ponto conferido', futuro.valor > 11912.49, futuro.valor, '> 11912,49');
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length ? 1 : 0);
