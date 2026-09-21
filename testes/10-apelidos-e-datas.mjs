// Casos encontrados numa carteira real: cripto cadastrada pelo nome por extenso
// e um título com o ano do vencimento trocado, que sumia do patrimônio sozinho.
import { abrirNavegador, APP, CABECALHO_JSON, criarContador, perto } from './navegador.mjs';

const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);
const menosDias = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };
const { ok, falhas } = criarContador();

const b = await abrirNavegador();
async function pagina(dados, opts) {
  const o = opts || {};
  const p = await b.newPage();
  const erros = [], alertas = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  p.on('dialog', d => { alertas.push(d.message()); d.accept(); });
  await p.route('**api.bcb.gov.br**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON, body: '[]' }));
  // no Playwright a rota registrada por último vence, então a genérica vem antes
  await p.route('**brapi.dev**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON, body: JSON.stringify({ results: [], currency: [{ bidPrice: '5.4' }] }) }));
  await p.route('**brapi.dev/api/v2/crypto**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON,
    body: JSON.stringify(o.brapiCripto === false ? { coins: [] }
      : { coins: [{ coin: 'BTC', regularMarketPrice: 330000, regularMarketPreviousClose: 328000, coinName: 'Bitcoin' }] }) }));
  await p.route('**api.coingecko.com**', r => r.fulfill({ status: 200, headers: CABECALHO_JSON,
    body: JSON.stringify({ bitcoin: { brl: 331500, brl_24h_change: 1.2 } }) }));
  await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), dados);
  await p.goto(APP);
  return { p, erros, alertas };
}

const base = tickerCripto => ({
  versao: 4, proventos: [], ativos: {}, cotacoes: {}, snapshots: [], precosHist: {}, series: {}, metas: {},
  transacoes: [{ id: 1, data: menosDias(30), ticker: tickerCripto, classe: 'cripto', tipo: 'compra',
    moeda: 'BRL', quantidade: 0.1, preco: 300000, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }],
  rendafixa: [],
  config: { token: 't', cdi: 10.65, ipca: 4.5, usdbrl: 5.4, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
});

console.log('\n[1] Cripto cadastrada pelo nome por extenso');
{
  const { p, erros } = await pagina(base('BITCOIN'));
  ok('apelido vira símbolo', await p.evaluate(() => simboloCripto('BITCOIN')) === 'BTC', 'BITCOIN', 'BTC');
  await p.evaluate(() => atualizarCotacoes(true));
  const c = await p.evaluate(() => getDB().cotacoes.BITCOIN);
  ok('cotação chega no ticker que a pessoa cadastrou', !!c && c.preco === 330000, c && c.preco, 330000);
  const pos = await p.evaluate(() => consolidar().lista[0]);
  ok('posição passa a ter valor de mercado', pos.temCot === true && perto(pos.valor, 33000), pos.valor, 33000);
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

console.log('\n[2] CoinGecko cobre o que a brapi não devolve');
{
  const { p, erros } = await pagina(base('BITCOIN'), { brapiCripto: false });
  await p.evaluate(() => atualizarCotacoes(true));
  const c = await p.evaluate(() => getDB().cotacoes.BITCOIN);
  ok('cai para a fonte alternativa', !!c && c.preco === 331500 && c.fonte === 'coingecko', c && [c.preco, c.fonte], [331500, 'coingecko']);
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

console.log('\n[3] Vencimento antes da aplicação não apaga o título');
{
  const dados = base('BTC');
  dados.rendafixa = [{ id: 9, nome: 'Tesouro IPCA+ 2040', tipo: 'Tesouro Direto', emissor: 'Tesouro',
    indexador: 'IPCA', taxa: 8, valorAplicado: 14984, dataAplicacao: menosDias(20),
    vencimento: '2024-08-15', liquidez: 'diaria' }];
  const { p, erros } = await pagina(dados);
  const r = await p.evaluate(() => {
    const db = getDB();
    return { resgatado: !!db.rendafixa[0].resgatado, rf: resumoRF().bruto, problemas: inconsistenciasRF() };
  });
  ok('data invertida não dispara baixa automática', r.resgatado === false, r.resgatado, false);
  ok('valor continua no patrimônio', r.rf > 14000, r.rf, '>14.000');
  ok('inconsistência é apontada', r.problemas.some(x => /antes da aplicação/.test(x.texto)),
    r.problemas.map(x => x.texto), 'aviso de data invertida');
  const aviso = await p.evaluate(() => { showPage('rendafixa'); return document.getElementById('rf-eventos').textContent; });
  ok('aviso aparece na tela', /Confira estes cadastros/.test(aviso), aviso.slice(0, 50), 'banner de conferência');
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

console.log('\n[4] Cadastro novo com data invertida é recusado');
{
  const { p, alertas, erros } = await pagina(base('BTC'));
  await p.evaluate(() => { showPage('rendafixa'); novoRF('CDB'); });
  await p.fill('#rf-nome', 'CDB com ano errado');
  await p.fill('#rf-taxa', '110');
  await p.fill('#rf-valor', '10000');
  await p.fill('#rf-data', menosDias(10));
  await p.fill('#rf-venc', '2024-01-01');
  await p.click('button:has-text("Salvar título")');
  ok('salvamento recusado com explicação', alertas.some(a => /antes da aplicação/.test(a)),
    (alertas[alertas.length - 1] || '').slice(0, 60), 'aviso de vencimento');
  ok('título não foi criado', await p.evaluate(() => getDB().rendafixa.length) === 0, 'criado', 0);
  ok('sem erros', erros.length === 0, erros, []);
  await p.close();
}

console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
await b.close();
process.exit(falhas.length ? 1 : 0);
