// Quinta leva de "o número é real, mas o sujeito é outro" (ver t11 a t14).
// Aqui são duas formas de condicionamento: a frequência que vale só para um
// SUBGRUPO, e o número da CATEGORIA herdado pelo componente que a detalha.
// Casos vindos da auditoria dos dois artigos de febre familiar do Mediterrâneo.
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => ({
    // "a amiloidose ... é complicação relativamente RARA ENTRE HETEROZIGOTOS":
    // ler sem o qualificador inverte a mensagem central da doença — a
    // amiloidose é a complicação que o tratamento existe para prevenir.
    amiloidoseRara: FINDINGS_INDEX.filter(f => /Amiloidose/i.test(f.finding) && /rar/i.test(f.frequencyText || ''))
      .map(f => f.articleId + '=' + f.frequencyText),
    // "ENTRE PACIENTES JAPONESES, ... cefaleia são muito mais comuns": a
    // frequência é do subgrupo japonês, não da doença.
    cefaleiaSubgrupo: FINDINGS_INDEX.filter(f => f.articleId === 82 && /Cefaleia/.test(f.finding) && f.frequencyText)
      .map(f => f.frequencyText),
    // "Envolvimento cardíaco em 6-30% dos pacientes: PERICARDITE, efusão
    // pericárdica, pancardite": o número é da categoria antes dos dois pontos.
    pericarditeCategoria: FINDINGS_INDEX.filter(f => f.articleId === 69 && /Pericardite/.test(f.finding) && f.frequencyText)
      .map(f => f.frequencyText),
    // "Estatinas causam miopatia em 10-29% dos pacientes (MIALGIA e dor à
    // palpação...)": mesma inversão, com o detalhamento em parênteses.
    mialgiaCategoria: FINDINGS_INDEX.filter(f => f.articleId === 24 && /Mialgia/.test(f.finding) && f.frequencyText)
      .map(f => f.frequencyText),
    // ...mas "Achados mais comuns (40-70% dos pacientes): nódulos e massas
    // pulmonares" tem a mesma pontuação e ali o número É do achado. O guard
    // não pode matar este.
    nodulosPreservado: FINDINGS_INDEX.some(f => f.articleId === 69 && /Nódulos\/massas/.test(f.finding) && f.frequencyText === '40–70%'),
    // Frequências legítimas de outros artigos que os guards não podem tocar.
    legitimas: [
      FINDINGS_INDEX.some(f => f.articleId === 58 && /Dor abdominal/.test(f.finding) && f.frequencyText === '50-75%'),
      FINDINGS_INDEX.some(f => f.articleId === 66 && /Mialgia/.test(f.finding) && f.frequencyText === '61%'),
      FINDINGS_INDEX.some(f => f.articleId === 28 && /Meningismo/.test(f.finding) && f.frequencyText === '55%'),
    ].filter(Boolean).length,
    // A semiologia da febre familiar do Mediterrâneo precisa estar catalogada.
    semiologiaFmf: ['Peritonite', 'Pleurite', 'Pericardite', 'Eritema erisipeloide', 'Amiloidose', 'Aftose oral']
      .filter(n => FINDINGS_INDEX.some(f => f.finding === n && f.articleId >= 82)),
    // E a doença nova precisa aparecer na aba de doenças.
    fmfPresente: FINDINGS_INDEX.some(f => f.diseases.includes('Febre Familiar do Mediterrâneo')),
  }));
  check('amiloidose nao rotulada como rara', d.amiloidoseRara.length === 0, JSON.stringify(d.amiloidoseRara));
  check('cefaleia sem frequencia de subgrupo geografico', d.cefaleiaSubgrupo.length === 0, JSON.stringify(d.cefaleiaSubgrupo));
  check('pericardite nao herda numero da categoria', d.pericarditeCategoria.length === 0, JSON.stringify(d.pericarditeCategoria));
  check('mialgia nao herda numero da miopatia', d.mialgiaCategoria.length === 0, JSON.stringify(d.mialgiaCategoria));
  check('nodulos pulmonares mantem o proprio numero', d.nodulosPreservado, d.nodulosPreservado);
  check('frequencias legitimas preservadas (3)', d.legitimas === 3, d.legitimas);
  check('semiologia da FMF catalogada (6)', d.semiologiaFmf.length === 6, JSON.stringify(d.semiologiaFmf));
  check('febre familiar do Mediterraneo presente na aba de doencas', d.fmfPresente, d.fmfPresente);
  await browser.close();
})();
