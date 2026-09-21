// Primeiros passos: com a carteira vazia o painel dá lugar ao roteiro de
// abertura, e volta ao normal assim que existe qualquer lançamento.
import { abrirNavegador, APP, criarContador } from './navegador.mjs';

const { ok, falhas } = criarContador();
const b = await abrirNavegador();

const BASE = {
  versao: 4, transacoes: [], proventos: [], rendafixa: [], cotacoes: {}, ativos: {},
  snapshots: [], precosHist: {}, metas: {}, series: {},
  config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.4, autoUpdate: false, intervaloMin: 15 }
};

// Sem rede: é o estado real de quem abre o app pela primeira vez, sem token.
async function abrir(db) {
  const p = await b.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await p.route('**brapi.dev**', r => r.abort());
  await p.route('**api.bcb.gov.br**', r => r.abort());
  if (db) await p.addInitScript(d => localStorage.setItem('investimentos_db', JSON.stringify(d)), db);
  await p.goto(APP);
  await p.waitForTimeout(900);
  const visto = await p.evaluate(() => ({
    passos: getComputedStyle(document.getElementById('primeiros-passos')).display,
    painel: getComputedStyle(document.getElementById('dash-conteudo')).display,
    selo: (document.querySelector('#primeiros-passos .tag') || {}).textContent || null,
    texto: document.getElementById('primeiros-passos').innerText,
    banner: getComputedStyle(document.getElementById('banner-dash')).display
  }));
  await p.close();
  return { ...visto, erros };
}

console.log('\n[1] Carteira vazia mostra o roteiro no lugar dos zeros');
{
  const v = await abrir(null);
  ok('primeiros passos aparecem', v.passos === 'block', v.passos, 'block');
  ok('painel zerado fica escondido', v.painel === 'none', v.painel, 'none');
  ok('a tarja não repete o recado', v.banner === 'none', v.banner, 'none');
  ok('o passo do token avisa que falta', v.selo === 'falta configurar', v.selo, 'falta configurar');
  ok('explica onde os dados ficam', /só neste navegador/.test(v.texto), v.texto.slice(0, 60), 'menciona o navegador');
  ok('sem erros', v.erros.length === 0, v.erros, []);
}

console.log('\n[2] Com o token salvo, o passo 2 aparece resolvido');
{
  const v = await abrir({ ...BASE, config: { ...BASE.config, token: 'abc123' } });
  ok('selo confirma o token', v.selo === 'token configurado', v.selo, 'token configurado');
  ok('roteiro continua, ainda não há lançamento', v.passos === 'block', v.passos, 'block');
  ok('sem erros', v.erros.length === 0, v.erros, []);
}

console.log('\n[3] Um único lançamento devolve o painel');
{
  const acao = { ...BASE, transacoes: [{ id: 1, data: '2026-01-05', ticker: 'PETR4', classe: 'acao',
    tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 35, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }] };
  const v = await abrir(acao);
  ok('roteiro some com uma ação', v.passos === 'none', v.passos, 'none');
  ok('painel volta', v.painel === 'block', v.painel, 'block');
  ok('sem erros', v.erros.length === 0, v.erros, []);

  const rf = { ...BASE, rendafixa: [{ id: 1, nome: 'CDB X', tipo: 'CDB', emissor: 'Banco Y',
    indexador: 'CDI', taxa: 110, valorAplicado: 5000, dataAplicacao: '2026-01-05',
    vencimento: '2027-01-05', liquidez: 'diaria' }] };
  const w = await abrir(rf);
  ok('roteiro some também só com renda fixa', w.passos === 'none', w.passos, 'none');
  ok('renda fixa não pede cotação, nenhuma tarja', w.banner === 'none', w.banner, 'none');
  ok('sem erros', w.erros.length === 0, w.erros, []);
}

await b.close();
console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
process.exit(falhas.length ? 1 : 0);
