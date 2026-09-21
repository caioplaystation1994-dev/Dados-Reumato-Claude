import { abrirNavegador, APP, capturas } from './navegador.mjs';
const b = await abrirNavegador();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const erros = [];
p.on('pageerror', e => erros.push(e.message));
await p.addInitScript(() => localStorage.setItem('investimentos_db', JSON.stringify({
  versao: 2,
  transacoes: [{ id: 1, data: '2026-01-05', ticker: 'PETR4', classe: 'acao', tipo: 'compra', moeda: 'BRL', quantidade: 100, preco: 30, cambio: 1, taxas: 0, taxasMoeda: 'BRL' }],
  proventos: [], rendafixa: [], ativos: {}, cotacoes: { PETR4: { preco: 38, moeda: 'BRL', fonte: 'brapi', data: '2026-08-05' } },
  snapshots: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (30 - i));
    return { data: d.toISOString().slice(0, 10), patrimonio: 3000 + i * 25, custo: 3000, valorVar: 3000 + i * 25, custoVar: 3000, rfBruto: 0, rfAplicado: 0, proventosAcum: 0, realizadoAcum: 0, completo: true };
  }),
  series: {}, config: { token: '', cdi: 10.65, ipca: 4.5, usdbrl: 5.5, autoUpdate: false, intervaloMin: 15, ultimaAtualizacao: Date.now() }
})));
await p.goto(APP);
await p.evaluate(() => showPage('dashboard'));
await p.waitForTimeout(150);
await p.locator('#chart-patrimonio').scrollIntoViewIfNeeded();
await p.locator('#chart-patrimonio').screenshot({ path: capturas('v2-mobile-chart.png') });
const vb = await p.evaluate(() => document.getElementById('chart-patrimonio').getAttribute('viewBox'));
console.log('viewBox mobile:', vb, '| erros:', erros.length ? erros : 'nenhum');
await b.close();
