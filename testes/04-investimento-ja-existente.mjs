import { abrirNavegador, APP, capturas, CABECALHO_JSON } from './navegador.mjs';
const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };

const b = await abrirNavegador();
const p = await b.newPage();
const erros = [], alertas = [];
p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()); });
p.on('dialog', d => { alertas.push(d.message().split('\n')[0]); d.accept(); });
// nenhuma chamada externa deve escapar do teste
await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON, body: '[]' }));
await p.route('**brapi.dev**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON, body: JSON.stringify({ results: [] }) }));

const falhas = [];
const ok = (nome, cond, obtido, esperado) => {
  if (cond) console.log('  ✓ ' + nome);
  else { console.log('  ✗ ' + nome + ' → obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); falhas.push(nome); }
};
const perto = (a, e, tol) => Math.abs(a - e) <= (tol === undefined ? 0.01 : tol);

await p.addInitScript(() => localStorage.setItem('investimentos_db', JSON.stringify({
  versao: 2, transacoes: [], proventos: [], rendafixa: [], ativos: {}, cotacoes: {}, snapshots: [], series: {},
  config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
})));
await p.goto(APP);

console.log('\n[1] Cadastro pelo atalho "Já tenho esse investimento"');
await p.evaluate(() => showPage('rendafixa'));
await p.click('button:has-text("Já tenho esse investimento")');
const vis = await p.evaluate(() => ({
  indexador: document.getElementById('rf-indexador').value,
  taxaOculta: getComputedStyle(document.getElementById('rf-taxa-wrap')).display === 'none',
  informadoVisivel: getComputedStyle(document.querySelector('.informado-only')).display !== 'none',
  ajuda: document.getElementById('rf-ajuda-informado').classList.contains('show'),
  dataPreenchida: document.getElementById('rf-data-informado').value
}));
ok('atalho ativa o modo de saldo informado', vis.indexador === 'INFORMADO' && vis.taxaOculta && vis.informadoVisivel && vis.ajuda, vis, 'modo informado');
ok('data do saldo já vem preenchida com hoje', vis.dataPreenchida === iso(HOJE), vis.dataPreenchida, iso(HOJE));

console.log('\n[2] Saldo atual em reais');
await p.fill('#rf-nome', 'CDB antigo do banco');
await p.selectOption('#rf-tipo', 'CDB');
await p.fill('#rf-emissor', 'Banco Velho');
await p.fill('#rf-valor', '10000');
await p.fill('#rf-data', menosDias(800));
await p.fill('#rf-valor-informado', '13250.40');
const prev = await p.textContent('#rf-preview');
ok('prévia mostra o saldo informado', /13\.250,40/.test(prev) && /saldo informado por você/.test(prev), prev.slice(0, 90), 'saldo informado');
ok('prévia traz a taxa equivalente ao ano', /equivale a/.test(prev), prev.slice(0, 140), 'equivale a X% a.a.');
await p.click('button:has-text("Salvar título")');
let r = await p.evaluate(() => { const db = getDB(); const t = db.rendafixa[0]; return { t, c: calcRF(t, db) }; });
ok('valor bruto = saldo informado', perto(r.c.valor, 13250.40), r.c.valor, 13250.40);
ok('rendimento = saldo − aplicado', perto(r.c.rendimento, 3250.40), r.c.rendimento, 3250.40);
ok('IR de 15% acima de 720 dias', r.c.aliq === 15 && perto(r.c.ir, 3250.40 * 0.15), [r.c.aliq, r.c.ir], [15, 487.56]);
ok('líquido desconta o IR', perto(r.c.liquido, 13250.40 - 3250.40 * 0.15), r.c.liquido, 12762.84);
ok('sem IOF depois de 30 dias', r.c.iof === 0, r.c.iof, 0);
ok('marcado como informado', r.c.informado === true && !r.c.desatualizado, [r.c.informado, r.c.desatualizado], [true, false]);

console.log('\n[3] Rendimento em R$ e rentabilidade em %');
const conv = await p.evaluate(() => ({
  rend: saldoInformado('rendimento', 2500, 10000),
  perc: saldoInformado('percentual', 23.5, 10000),
  val: saldoInformado('valor', 12345, 10000)
}));
ok('modo rendimento soma ao aplicado', conv.rend === 12500, conv.rend, 12500);
ok('modo percentual aplica sobre o aplicado', conv.perc === 12350, conv.perc, 12350);
ok('modo valor usa o número direto', conv.val === 12345, conv.val, 12345);

await p.click('button:has-text("Já tenho esse investimento")');
await p.fill('#rf-nome', 'Previdência VGBL');
await p.selectOption('#rf-tipo', 'Previdência privada');
await p.fill('#rf-valor', '20000');
await p.fill('#rf-data', menosDias(1200));
await p.selectOption('#rf-modo-informado', 'percentual');
await p.fill('#rf-valor-informado', '35');
await p.click('button:has-text("Salvar título")');
r = await p.evaluate(() => { const db = getDB(); const t = db.rendafixa.find(x => x.nome === 'Previdência VGBL'); return calcRF(t, db); });
ok('rentabilidade % vira saldo bruto', perto(r.valor, 27000), r.valor, 27000);
ok('previdência entra no patrimônio', perto(r.rendimento, 7000), r.rendimento, 7000);

console.log('\n[4] Validações');
await p.click('button:has-text("Já tenho esse investimento")');
await p.fill('#rf-nome', 'Sem saldo');
await p.fill('#rf-valor', '5000');
await p.fill('#rf-data', menosDias(100));
await p.click('button:has-text("Salvar título")');
ok('exige o saldo informado', /Informe o saldo atual/.test(alertas[alertas.length - 1] || ''), alertas[alertas.length - 1], 'Informe o saldo...');
await p.fill('#rf-valor-informado', '5500');
await p.fill('#rf-data-informado', menosDias(200));
await p.click('button:has-text("Salvar título")');
ok('recusa saldo anterior à aplicação', /não pode ser anterior/.test(alertas[alertas.length - 1] || ''), alertas[alertas.length - 1], 'data inválida');

console.log('\n[5] Atualização do saldo pela lista');
const idCDB = await p.evaluate(() => getDB().rendafixa.find(x => x.nome === 'CDB antigo do banco').id);
// sem correção o saldo envelhece e precisa ser sinalizado
await p.evaluate(() => { const db = getDB(); const t = db.rendafixa.find(x => x.nome === 'CDB antigo do banco'); t.valorInformadoData = '2026-01-01'; t.correcao = 'nenhuma'; localStorage.setItem('investimentos_db', JSON.stringify(db)); });
await p.evaluate(() => { renderRF(); renderFGC(); });
const selo = await p.textContent('#rf-tabela');
ok('sinaliza saldo desatualizado quando não há correção', /saldo de \d+d atrás/.test(selo), (selo.match(/saldo de \d+d atrás/) || [''])[0], 'selo de desatualizado');
// com correção ativa o valor continua andando, então o selo não aparece
await p.evaluate(() => { const db = getDB(); const t = db.rendafixa.find(x => x.nome === 'CDB antigo do banco'); t.correcao = 'IMPLICITA'; localStorage.setItem('investimentos_db', JSON.stringify(db)); renderRF(); });
const selo2 = await p.textContent('#rf-tabela');
ok('sem selo quando o saldo está sendo corrigido', !/saldo de \d+d atrás/.test(selo2), (selo2.match(/saldo de \d+d atrás/) || ['(nenhum)'])[0], '(nenhum)');
await p.evaluate(() => { const db = getDB(); const t = db.rendafixa.find(x => x.nome === 'CDB antigo do banco'); t.correcao = 'nenhuma'; localStorage.setItem('investimentos_db', JSON.stringify(db)); renderRF(); });
await p.click(`button[onclick="atualizarSaldo(${idCDB})"]`);
await p.selectOption('#md-modo', 'rendimento');
await p.fill('#md-valor', '4000');
await p.click('button:has-text("Salvar saldo")');
r = await p.evaluate(() => { const db = getDB(); const t = db.rendafixa.find(x => x.nome === 'CDB antigo do banco'); return { t, c: calcRF(t, db) }; });
ok('saldo atualizado pelo modal', perto(r.c.valor, 14000), r.c.valor, 14000);
ok('data do saldo passa a ser hoje', r.t.valorInformadoData === iso(HOJE), r.t.valorInformadoData, iso(HOJE));

console.log('\n[6] Integração com carteira, FGC e patrimônio');
const tot = await p.evaluate(() => {
  showPage('dashboard');
  const rf = resumoRF();
  return { bruto: rf.bruto, aplicado: rf.aplicado, fgc: exposicaoEmissores(), snap: fotoAtual().patrimonio };
});
ok('renda fixa soma no patrimônio', perto(tot.bruto, 14000 + 27000, 1), tot.bruto, 41000);
ok('aplicado somado corretamente', perto(tot.aplicado, 30000, 1), tot.aplicado, 30000);
ok('patrimônio inclui os investimentos informados', perto(tot.snap, 41000, 1), tot.snap, 41000);
const bancoVelho = tot.fgc.find(e => e.emissor === 'Banco Velho');
ok('CDB informado entra na cobertura do FGC', perto(bancoVelho.coberto, 14000, 1), bancoVelho.coberto, 14000);
const prev2 = tot.fgc.find(e => e.emissor === '(sem emissor)');
ok('previdência fica fora do FGC', prev2 && perto(prev2.naoCoberto, 27000, 1), prev2 && prev2.naoCoberto, 27000);

console.log('\n[7] Edição preserva os campos');
await p.evaluate(() => showPage('rendafixa'));
await p.click(`button[onclick="editarRF(${idCDB})"]`);
const form = await p.evaluate(() => ({
  ix: document.getElementById('rf-indexador').value,
  modo: document.getElementById('rf-modo-informado').value,
  entrada: document.getElementById('rf-valor-informado').value,
  data: document.getElementById('rf-data-informado').value
}));
ok('edição recarrega o modo e o valor informados', form.ix === 'INFORMADO' && form.modo === 'rendimento' && form.entrada === '4000', form, 'rendimento 4000');

await p.setViewportSize({ width: 1280, height: 1500 });
await p.evaluate(() => { limparRF(); novoInvestimentoExistente(); });
await p.screenshot({ path: capturas('v3-informado.png'), fullPage: true });

console.log('\nERROS:', erros.length ? erros : 'nenhum');
console.log(falhas.length ? '❌ ' + falhas.length + ' falha(s)' : '✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length || erros.length ? 1 : 0);
