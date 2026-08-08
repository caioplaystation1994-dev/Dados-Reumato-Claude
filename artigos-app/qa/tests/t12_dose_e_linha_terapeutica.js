// Mesma familia de erro do t11, mas no indice de MEDICACOES: a dose ou a
// linha terapeutica mais proxima no texto pertencendo a OUTRO farmaco.
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => ({
    // "colchicina diaria associada a FEBUXOSTATE 40 mg/dia": a dose e do
    // febuxostate. Colchicina na gota nunca passa de ~2 mg/dia.
    colchicinaAbsurda: MEDICATIONS_INDEX.filter(m => /Colchicina/i.test(m.drug) && m.dose &&
      parseFloat((m.dose.match(/(\d+(?:[.,]\d+)?)\s*mg/) || [0, 0])[1].toString().replace(',', '.')) > 5)
      .map(m => m.articleId + ':' + m.dose),
    // Nenhuma dose pode vir de um trecho que cite outro farmaco entre o nome
    // e o numero — checagem generica sobre o proprio snippet.
    doseComOutroFarmaco: MEDICATIONS_INDEX.filter((m) => {
      if (!m.dose || !m.snippet) return false;
      const i = m.snippet.indexOf(m.dose);
      const j = m.snippet.toLowerCase().indexOf(m.drug.toLowerCase().split(' ')[0]);
      if (i === -1 || j === -1) return false;
      const entre = m.snippet.slice(Math.min(i, j), Math.max(i, j)).toLowerCase();
      return /(febuxostate|alopurinol|ciclosporina|metotrexato|prednisolona|triancinolona)/.test(entre) &&
        !m.drug.toLowerCase().includes(entre.match(/(febuxostate|alopurinol|ciclosporina|metotrexato|prednisolona|triancinolona)/)[1]);
    }).map(m => m.articleId + ':' + m.drug + '=' + m.dose),
    // Inibidor de IL-1 na gota e reservado para quem nao tolera as opcoes
    // orais — rotula-lo de primeira linha inverte a recomendacao.
    il1PrimeiraLinha: MEDICATIONS_INDEX.filter(m => /Anacinra|Canaquinumabe|Rilonacepte/i.test(m.drug) &&
      m.line === 'primeira-linha' && m.diseases.includes('Gota')).map(m => m.articleId + ':' + m.drug),
    // ...mas os antimetabolitos da esclerite SAO primeira linha: o guard nao
    // pode ter apagado rotulos corretos junto.
    csdmardEsclerite: MEDICATIONS_INDEX.filter(m => /Metotrexato|Micofenolato|Azatioprina/i.test(m.drug) &&
      m.line === 'primeira-linha').length,
    // Os esquemas de gota que os dois artigos documentam devem estar la.
    esquemasGota: ['Alopurinol', 'Febuxostate', 'Pegloticase', 'Benzbromarona', 'Probenecida', 'Colchicina']
      .filter(f => MEDICATIONS_INDEX.some(m => m.drug.includes(f) && m.diseases.includes('Gota'))),
  }));
  check('colchicina sem dose implausivel', d.colchicinaAbsurda.length === 0, JSON.stringify(d.colchicinaAbsurda));
  check('nenhuma dose atravessando outro farmaco', d.doseComOutroFarmaco.length === 0, JSON.stringify(d.doseComOutroFarmaco));
  check('inibidor de IL-1 nao rotulado primeira linha na gota', d.il1PrimeiraLinha.length === 0, JSON.stringify(d.il1PrimeiraLinha));
  check('rotulos corretos de primeira linha preservados', d.csdmardEsclerite > 0, d.csdmardEsclerite);
  check('esquemas hipouricemiantes catalogados (6)', d.esquemasGota.length === 6, JSON.stringify(d.esquemasGota));
  await browser.close();
})();
