import { abrirNavegador, APP } from './navegador.mjs';
const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };
const cabec = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

const CDI_DIA = 0.04;
const cdiSerie = [];
for (let i = 1500; i >= 0; i--) {
  const d = new Date(HOJE); d.setDate(d.getDate() - i);
  if (d.getDay() === 0 || d.getDay() === 6) continue;
  cdiSerie.push({ data: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: String(CDI_DIA) });
}

const falhas = [];
const ok = (n, c, o, e) => { if (c) console.log('  ✓ ' + n); else { console.log('  ✗ ' + n + ' → obtido ' + JSON.stringify(o) + ', esperado ' + JSON.stringify(e)); falhas.push(n); } };
const perto = (a, e, tol) => Math.abs(a - e) <= (tol === undefined ? 0.01 : tol);

const b = await abrirNavegador();
const p = await b.newPage();
const erros = [], alertas = [];
p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
p.on('dialog', d => { alertas.push(d.message().split('\n')[0]); d.accept(); });
await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: cabec,
  body: JSON.stringify(r.request().url().includes('sgs.12') ? cdiSerie : []) }));
await p.route('**brapi.dev**', r => r.fulfill({ status: 200, headers: cabec, body: JSON.stringify({ results: [] }) }));

await p.addInitScript(() => localStorage.setItem('investimentos_db', JSON.stringify({
  versao: 3, transacoes: [], proventos: [], rendafixa: [], ativos: {}, cotacoes: {}, snapshots: [], series: {},
  config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
})));
await p.goto(APP);
await p.evaluate(() => atualizarSeries(true));

console.log('\n[1] Correção pela rentabilidade média observada');
{
  // aplicou 10.000 há 730 dias; saldo de 12.100 informado há 100 dias
  const r = await p.evaluate(d => {
    const db = getDB();
    const t = { id: 1, nome: 'CDB média', tipo: 'CDB', emissor: 'Banco A', indexador: 'INFORMADO',
      valorAplicado: 10000, dataAplicacao: d.ini, liquidez: 'diaria',
      valorInformadoBruto: 12100, valorInformadoData: d.base, modoInformado: 'valor', correcao: 'IMPLICITA' };
    db.rendafixa.push(t); localStorage.setItem('investimentos_db', JSON.stringify(db));
    return calcRF(t, getDB());
  }, { ini: menosDias(730), base: menosDias(100) });
  const implicita = Math.pow(1.21, 365 / 630) - 1;          // 630 dias entre aplicação e saldo
  const esperado = 12100 * Math.pow(1 + implicita, 100 / 365);
  ok('taxa implícita medida até a data do saldo', perto(r.taxaCorrecao, implicita * 100, 0.02), r.taxaCorrecao, implicita * 100);
  ok('valor corrigido pelos 100 dias seguintes', perto(r.valor, esperado, 0.5), r.valor, esperado);
  ok('corrigido acima do saldo informado', r.valor > 12100, r.valor, '>12100');
  ok('marcado como em correção', r.corrigindo === true && r.diasCorrigidos === 100, [r.corrigindo, r.diasCorrigidos], [true, 100]);
  ok('sem selo de desatualizado enquanto corrige', r.desatualizado === false, r.desatualizado, false);
  ok('método explica a correção', /corrigido por .* a.a., a média observada/.test(r.metodo), r.metodo, 'texto da correção');
}

console.log('\n[2] Correção por índice real (CDI diário do BCB)');
{
  const r = await p.evaluate(d => {
    const t = { id: 2, nome: 'CDB CDI', tipo: 'CDB', indexador: 'INFORMADO', valorAplicado: 10000,
      dataAplicacao: d.ini, liquidez: 'diaria', valorInformadoBruto: 12000, valorInformadoData: d.base,
      modoInformado: 'valor', correcao: 'CDI', correcaoTaxa: 110 };
    const db = getDB(); db.rendafixa.push(t); localStorage.setItem('investimentos_db', JSON.stringify(db));
    return calcRF(t, getDB());
  }, { ini: menosDias(730), base: menosDias(100) });
  const esperado = 12000 * Math.pow(1 + CDI_DIA / 100 * 1.1, r.du);
  ok('usa o CDI diário sobre o saldo informado', perto(r.valor, esperado, 1), r.valor, esperado);
  ok('conta apenas os dias úteis após o saldo', r.du > 60 && r.du < 75, r.du, '~70 dias úteis');
  ok('método cita o Banco Central', /Banco Central/.test(r.metodo), r.metodo, 'CDI diário do Banco Central');
}

console.log('\n[3] "Não corrigir" mantém o comportamento anterior');
{
  const r = await p.evaluate(d => {
    const t = { id: 3, nome: 'Parado', tipo: 'CDB', indexador: 'INFORMADO', valorAplicado: 10000,
      dataAplicacao: d.ini, liquidez: 'diaria', valorInformadoBruto: 12100, valorInformadoData: d.base,
      modoInformado: 'valor', correcao: 'nenhuma' };
    const db = getDB(); db.rendafixa.push(t); localStorage.setItem('investimentos_db', JSON.stringify(db));
    return calcRF(t, getDB());
  }, { ini: menosDias(730), base: menosDias(100) });
  ok('valor congelado no saldo informado', perto(r.valor, 12100), r.valor, 12100);
  ok('volta a sinalizar desatualizado', r.desatualizado === true, r.desatualizado, true);
}

console.log('\n[4] Casos de borda');
{
  const r = await p.evaluate(d => {
    // aplicou há 20 dias e informou o saldo há 10: histórico curto demais para estimar a média
    const semHistorico = { id: 4, nome: 'Recente', tipo: 'CDB', indexador: 'INFORMADO', valorAplicado: 10000,
      dataAplicacao: d.vinte, liquidez: 'diaria', valorInformadoBruto: 10001, valorInformadoData: d.dez,
      modoInformado: 'valor', correcao: 'IMPLICITA' };
    const hojeMesmo = { id: 5, nome: 'Saldo de hoje', tipo: 'CDB', indexador: 'INFORMADO', valorAplicado: 10000,
      dataAplicacao: d.antigo, liquidez: 'diaria', valorInformadoBruto: 12000, valorInformadoData: d.hoje,
      modoInformado: 'valor', correcao: 'IMPLICITA' };
    const vencido = { id: 6, nome: 'Vencido', tipo: 'CDB', indexador: 'INFORMADO', valorAplicado: 10000,
      dataAplicacao: d.antigo, liquidez: 'vencimento', vencimento: d.vencido, valorInformadoBruto: 12000,
      valorInformadoData: d.base, modoInformado: 'valor', correcao: 'CDI', correcaoTaxa: 100 };
    const db = getDB();
    return { sem: calcRF(semHistorico, db), hoje: calcRF(hojeMesmo, db), venc: calcRF(vencido, db) };
  }, { vinte: menosDias(20), dez: menosDias(10), hoje: iso(HOJE), antigo: menosDias(730), base: menosDias(100), vencido: menosDias(50) });
  ok('sem histórico não inventa correção', perto(r.sem.valor, 10001) && /sem histórico suficiente/.test(r.sem.metodo), r.sem.valor, 10001);
  ok('saldo de hoje não é corrigido', perto(r.hoje.valor, 12000) && r.hoje.diasCorrigidos === 0, [r.hoje.valor, r.hoje.diasCorrigidos], [12000, 0]);
  ok('correção para no vencimento', r.venc.diasCorrigidos === 50, r.venc.diasCorrigidos, 50);
}

console.log('\n[5] Formulário e migração');
{
  await p.evaluate(() => { showPage('rendafixa'); novoInvestimentoExistente(); });
  const v = await p.evaluate(() => ({
    padrao: document.getElementById('rf-correcao').value,
    taxaOculta: getComputedStyle(document.getElementById('rf-correcao-taxa-wrap')).display === 'none'
  }));
  ok('padrão do formulário é a média observada', v.padrao === 'IMPLICITA' && v.taxaOculta, v, 'IMPLICITA sem taxa');
  await p.selectOption('#rf-correcao', 'CDI');
  const v2 = await p.evaluate(() => ({
    taxaVisivel: getComputedStyle(document.getElementById('rf-correcao-taxa-wrap')).display !== 'none',
    rot: document.getElementById('rf-correcao-taxa-label').textContent
  }));
  ok('escolher índice pede a taxa', v2.taxaVisivel && /% do CDI/.test(v2.rot), v2, 'campo de taxa');
  await p.fill('#rf-nome', 'CDB com índice'); await p.fill('#rf-valor', '10000');
  await p.fill('#rf-data', menosDias(400)); await p.fill('#rf-valor-informado', '11500');
  await p.click('button:has-text("Salvar título")');
  ok('exige a taxa da correção', /Informe a taxa que corrigirá/.test(alertas[alertas.length - 1] || ''), alertas[alertas.length - 1], 'taxa obrigatória');
  await p.fill('#rf-correcao-taxa', '110');
  await p.click('button:has-text("Salvar título")');
  const salvo = await p.evaluate(() => getDB().rendafixa.find(x => x.nome === 'CDB com índice'));
  ok('grava a correção escolhida', salvo.correcao === 'CDI' && salvo.correcaoTaxa === 110, [salvo.correcao, salvo.correcaoTaxa], ['CDI', 110]);
  const rot = await p.evaluate(() => rotuloIndexador(getDB().rendafixa.find(x => x.nome === 'CDB com índice')));
  ok('coluna mostra a base da correção', rot === 'saldo + 110% do CDI', rot, 'saldo + 110% do CDI');
}

console.log('\n[6] Migração v2 → v3 preserva valores já vistos');
{
  const p2 = await b.newPage();
  await p2.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify({
    versao: 2, transacoes: [], proventos: [], ativos: {}, cotacoes: {}, snapshots: [], series: {},
    rendafixa: [{ id: 9, nome: 'Antigo informado', tipo: 'CDB', indexador: 'INFORMADO', valorAplicado: 10000,
      dataAplicacao: d.ini, liquidez: 'diaria', valorInformadoBruto: 12100, valorInformadoData: d.base, modoInformado: 'valor' }],
    config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15 }
  })), { ini: menosDias(730), base: menosDias(100) });
  await p2.goto(APP);
  const r = await p2.evaluate(() => { const db = getDB(); return { v: db.versao, c: db.rendafixa[0].correcao, valor: calcRF(db.rendafixa[0], db).valor }; });
  ok('schema migrado para a versão atual', r.v >= 3, r.v, '>=3');
  ok('registro antigo continua sem correção', r.c === 'nenhuma' && perto(r.valor, 12100), [r.c, r.valor], ['nenhuma', 12100]);
  await p2.close();
}

console.log('\nERROS:', erros.length ? erros : 'nenhum');
console.log(falhas.length ? '❌ ' + falhas.length + ' falha(s)' : '✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length || erros.length ? 1 : 0);
