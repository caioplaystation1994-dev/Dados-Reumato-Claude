// Importar só cotações: atualiza preços sem encostar na carteira. É o caminho
// para receber preços de fora periodicamente sem que cada arquivo apague os
// lançamentos feitos desde o anterior.
import { abrirNavegador, APP, CABECALHO_JSON, criarContador, perto } from './navegador.mjs';

const { ok, falhas } = criarContador();

const CARTEIRA = {
  versao: 4,
  transacoes: [
    { id: 1, data: '2026-01-05', ticker: 'VALE3', classe: 'acao', tipo: 'compra',
      moeda: 'BRL', quantidade: 100, preco: 57.22, cambio: 1, taxas: 0, taxasMoeda: 'BRL' },
    { id: 2, data: '2026-02-05', ticker: 'SPY', classe: 'stock', tipo: 'compra',
      moeda: 'USD', quantidade: 10, preco: 600, cambio: 5, taxas: 0, taxasMoeda: 'USD' }
  ],
  proventos: [{ id: 9, data: '2026-03-01', ticker: 'VALE3', valor: 120, tipo: 'dividendo', status: 'recebido' }],
  rendafixa: [{ id: 1, nome: 'CDB Guardado', tipo: 'CDB', emissor: 'Banco W', indexador: 'CDI',
    taxa: 110, valorAplicado: 5000, dataAplicacao: '2026-01-02', vencimento: '2028-01-02',
    liquidez: 'vencimento', qtdTitulos: 0, puAtual: 0, resgatado: false }],
  cotacoes: { VALE3: { preco: 60, moeda: 'BRL', fonte: 'manual', data: '2026-09-01', hora: '10:00' } },
  ativos: {}, snapshots: [], precosHist: {}, metas: {}, series: {},
  config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.0, autoUpdate: false, intervaloMin: 15 }
};

const PACOTE = {
  tipo: 'cotacoes', data: '2026-09-21', usdbrl: 5.1427,
  cotacoes: {
    VALE3: { preco: 72.82, moeda: 'BRL', fonte: 'manual', data: '2026-09-21', hora: '15:30' },
    SPY:   { preco: 773.38, moeda: 'USD', fonte: 'manual', data: '2026-09-21', hora: '15:30' },
    XPTO9: { preco: 10, moeda: 'BRL', fonte: 'manual', data: '2026-09-21', hora: '15:30' }
  }
};

const b = await abrirNavegador();
const p = await b.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
p.on('dialog', d => d.accept());
await p.route('**brapi.dev**', r => r.abort());
await p.route('**api.bcb.gov.br**', r => r.abort());
await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), CARTEIRA);
await p.goto(APP);
await p.waitForTimeout(900);

const antes = await p.evaluate(() => {
  const db = getDB();
  return { tx: db.transacoes.length, rf: db.rendafixa.length, pv: db.proventos.length, usd: db.config.usdbrl };
});

console.log('\n[1] As cotações entram e a carteira fica intacta');
{
  await p.setInputFiles('input[type="file"][accept="application/json"] >> nth=1', {
    name: 'cotacoes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(PACOTE))
  });
  await p.waitForTimeout(1200);

  const d = await p.evaluate(() => {
    const db = getDB();
    const l = consolidar().lista;
    const acha = t => l.find(x => x.ticker === t) || {};
    return {
      tx: db.transacoes.length, rf: db.rendafixa.length, pv: db.proventos.length,
      usd: db.config.usdbrl,
      vale: acha('VALE3').valor, spy: acha('SPY').valor,
      guardado: (db.rendafixa[0] || {}).nome,
      xpto: !!db.cotacoes.XPTO9
    };
  });

  ok('transações intactas', d.tx === antes.tx, d.tx, antes.tx);
  ok('renda fixa intacta', d.rf === antes.rf, d.rf, antes.rf);
  ok('o título continua sendo o mesmo', d.guardado === 'CDB Guardado', d.guardado, 'CDB Guardado');
  ok('proventos intactos', d.pv === antes.pv, d.pv, antes.pv);
  ok('o dólar foi atualizado', perto(d.usd, 5.1427, 0.0001), d.usd, 5.1427);
  ok('VALE3 passou a valer pelo preço novo', perto(d.vale, 100 * 72.82, 0.01), d.vale, 7282);
  ok('SPY converte pelo dólar novo', perto(d.spy, 10 * 773.38 * 5.1427, 0.5), d.spy, 10 * 773.38 * 5.1427);
  ok('ticker sem posição é guardado, não descartado', d.xpto, d.xpto, true);
  ok('sem erros', erros.length === 0, erros, []);
}

console.log('\n[2] Arquivo sem bloco de cotações é recusado');
{
  const ruim = { transacoes: [], rendafixa: [] };
  await p.setInputFiles('input[type="file"][accept="application/json"] >> nth=1', {
    name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ruim))
  });
  await p.waitForTimeout(700);
  const d = await p.evaluate(() => ({ tx: getDB().transacoes.length, vale: getDB().cotacoes.VALE3.preco }));
  ok('a carteira sobreviveu ao arquivo ruim', d.tx === antes.tx, d.tx, antes.tx);
  ok('as cotações boas continuam valendo', d.vale === 72.82, d.vale, 72.82);
  ok('sem erros', erros.length === 0, erros, []);
}

await b.close();
console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
process.exit(falhas.length ? 1 : 0);
