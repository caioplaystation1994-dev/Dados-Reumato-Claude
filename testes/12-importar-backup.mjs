// Importar um backup deve trazer as séries do Banco Central na hora, e não
// só na próxima abertura da página: até lá a renda fixa apareceria pelas
// taxas estimadas, sem nada na tela avisando.
import { abrirNavegador, APP, CABECALHO_JSON, criarContador } from './navegador.mjs';

const { ok, falhas } = criarContador();
const HOJE = new Date();
const iso = d => d.toISOString().slice(0, 10);

function serieCDI() {
  const o = [];
  const d = new Date(HOJE.getFullYear() - 2, 0, 1);
  while (d <= HOJE) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      o.push({ data: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.05' });
    }
    d.setDate(d.getDate() + 1);
  }
  return o;
}
function serieIPCA() {
  const o = [];
  for (let i = 26; i >= 2; i--) {
    const d = new Date(HOJE.getFullYear(), HOJE.getMonth() - i, 1);
    o.push({ data: `01/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, valor: '0.40' });
  }
  return o;
}

const menos = n => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return iso(d); };

// Backup como o de quem nunca baixou as séries, mas com cotações recém-atualizadas:
// é justamente o caso que o intervalo do autoAtualizar engoliria.
const BACKUP = {
  versao: 4, transacoes: [], proventos: [], cotacoes: {}, ativos: {}, snapshots: [], precosHist: {},
  metas: {}, series: { cdi: null, ipca: null, ibov: null, ifix: null },
  rendafixa: [{ id: 1, nome: 'CDB Teste', tipo: 'CDB', emissor: 'Banco Z', indexador: 'CDI',
    taxa: 110, valorAplicado: 10000, dataAplicacao: menos(400), vencimento: menos(-400),
    liquidez: 'vencimento', qtdTitulos: 0, puAtual: 0, resgatado: false }],
  config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.4, autoUpdate: true,
    intervaloMin: 15, ultimaAtualizacao: Date.now() }
};

const b = await abrirNavegador();
const p = await b.newPage();
const erros = [];
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
p.on('dialog', d => d.accept());
let pedidosBCB = 0;
await p.route('**api.bcb.gov.br**', r => {
  pedidosBCB++;
  r.fulfill({ status: 200, headers: CABECALHO_JSON,
    body: JSON.stringify(r.request().url().includes('sgs.12') ? serieCDI() : serieIPCA()) });
});
await p.route('**brapi.dev**', r => r.abort());

// Abre vazio, sem séries; só depois importa.
await p.goto(APP);
await p.waitForTimeout(1200);
const antes = pedidosBCB;

console.log('\n[1] A importação busca as séries na hora');
{
  await p.setInputFiles('input[type="file"][accept="application/json"]', {
    name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(BACKUP))
  });
  await p.waitForTimeout(2500);

  const r = await p.evaluate(() => {
    const db = getDB();
    // defensivo de propósito: quando a regressão volta, o título some e o
    // relatório precisa dizer isso em vez de estourar uma exceção
    const t = db.rendafixa[0];
    const c = t ? calcRF(t, db) : { metodo: '(nenhum título)', valor: 0 };
    return { titulos: db.rendafixa.length, temCDI: serieDados('cdi').length > 0, metodo: c.metodo, valor: c.valor };
  });
  ok('o título foi importado', r.titulos === 1, r.titulos, 1);
  ok('as séries chegaram sem recarregar a página', r.temCDI, r.temCDI, true);
  ok('o Banco Central foi consultado depois da importação', pedidosBCB > antes, pedidosBCB, '> ' + antes);
  ok('a renda fixa usa a série real, não a taxa estimada',
    /Banco Central/.test(r.metodo), r.metodo, 'menciona o Banco Central');
  ok('o valor foi calculado', r.valor > 10000, r.valor, '> 10000');
  ok('sem erros', erros.length === 0, erros, []);
}

console.log('\n[2] Importar no meio de um download não apaga a importação');
{
  // A busca das séries captura o banco antes dos awaits. Se ela gravar esse
  // snapshot no fim, uma importação feita no intervalo some sem aviso.
  const p2 = await b.newPage();
  const erros2 = [];
  p2.on('pageerror', e => erros2.push(e.message));
  p2.on('dialog', d => d.accept());
  let segurar = true;
  await p2.route('**api.bcb.gov.br**', async r => {
    while (segurar) await new Promise(res => setTimeout(res, 60));
    r.fulfill({ status: 200, headers: CABECALHO_JSON,
      body: JSON.stringify(r.request().url().includes('sgs.12') ? serieCDI() : serieIPCA()) });
  });
  await p2.route('**brapi.dev**', r => r.abort());
  await p2.goto(APP);
  await p2.waitForTimeout(600);

  // com o Banco Central travado, dispara a busca e importa por cima
  p2.evaluate(() => atualizarSeries(true)).catch(() => {});
  await p2.waitForTimeout(400);
  await p2.setInputFiles('input[type="file"][accept="application/json"]', {
    name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(BACKUP))
  });
  await p2.waitForTimeout(500);
  const durante = await p2.evaluate(() => getDB().rendafixa.length);
  ok('a importação entrou enquanto o download corria', durante === 1, durante, 1);

  segurar = false;           // solta o Banco Central
  // Espera a série de fato aterrissar em vez de cronometrar no escuro: é o
  // momento em que a gravação concorrente acontece, e é ele que interessa.
  let chegou = true;
  try {
    await p2.waitForFunction(() => serieDados('cdi').length > 0, null, { timeout: 20000 });
  } catch (e) { chegou = false; }
  await p2.waitForTimeout(500);
  const depois = await p2.evaluate(() => ({
    titulos: getDB().rendafixa.length,
    nome: (getDB().rendafixa[0] || {}).nome,
    temCDI: serieDados('cdi').length > 0
  }));
  ok('as séries foram gravadas', chegou && depois.temCDI, depois.temCDI, true);
  ok('a importação sobreviveu à gravação das séries', depois.titulos === 1, depois.titulos, 1);
  ok('é o título importado, não o estado anterior', depois.nome === 'CDB Teste', depois.nome, 'CDB Teste');
  ok('sem erros', erros2.length === 0, erros2, []);
  await p2.close();
}

await b.close();
console.log(falhas.length ? '\n❌ ' + falhas.length + ' falha(s)' : '\n✅ todas as verificações passaram');
process.exit(falhas.length ? 1 : 0);
