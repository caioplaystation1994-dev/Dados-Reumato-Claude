// Sétima leva de "o número é real, mas o sujeito é outro". Três classes novas,
// todas da auditoria dos artigos de microangiopatia trombótica e SAF: o número
// que mede a AUSÊNCIA do achado, o número que é VALOR DE CORTE de exame, e o
// número que pertence ao próximo item de uma enumeração.
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => ({
    // "a trombocitopenia ... está AUSENTE à apresentação em 15 a 20%": exibir
    // "Trombocitopenia: 15 a 20%" diz o contrário do que a frase afirma.
    ausencia: FINDINGS_INDEX.filter(f => f.articleId === 85 && /Trombocitopenia/.test(f.finding) && f.frequencyText)
      .map(f => f.frequencyText),
    // "atividade de ADAMTS13 abaixo de 10%" é o limiar que DEFINE a doença,
    // não a prevalência. Exames marcados valueNotFrequency nunca levam número.
    limiarAdamts13: FINDINGS_INDEX.filter(f => /ADAMTS13 reduzida/.test(f.finding) && f.frequencyText)
      .map(f => f.articleId + '=' + f.frequencyText),
    // "reticulócitos acima de 2,5% ou haptoglobina indetectável": o 2,5% é
    // dos reticulócitos.
    haptoglobina: FINDINGS_INDEX.filter(f => /Haptoglobina/.test(f.finding) && f.frequencyText)
      .map(f => f.articleId + '=' + f.frequencyText),
    // "positivos para anticardiolipina E 1% é positivo para anticoagulante
    // lúpico": o 1% é do anticoagulante lúpico.
    anticardiolipina: FINDINGS_INDEX.filter(f => f.articleId === 87 && /Anticardiolipina/.test(f.finding) && f.frequencyText)
      .map(f => f.frequencyText),
    // "10% entre trombose venosa, 11% entre infarto, e 17% entre AVC": o 17%
    // é do acidente vascular cerebral, não do acometimento cardíaco.
    cardiaco17: FINDINGS_INDEX.some(f => f.articleId === 87 && /Acometimento cardíaco/.test(f.finding) && f.frequencyText === '17%'),
    // "1% dos doadores de sangue saudáveis": prevalência em população de
    // referência, não frequência na doença.
    doadoresSaudaveis: FINDINGS_INDEX.filter(f => f.articleId === 87 && /Anticoagulante lúpico/.test(f.finding) && f.frequencyText)
      .map(f => f.frequencyText),
    // "52% ... CONTRA 57% nas mulheres com a forma não relacionada": o 57% é
    // o braço de comparação.
    comparador57: FINDINGS_INDEX.some(f => f.articleId === 85 && f.frequencyText === '57%'),
    // ...e os guards não podem matar números corretos. Estes quatro são
    // legítimos e caíram em versões anteriores dos guards desta leva:
    preservados: [
      FINDINGS_INDEX.some(f => f.articleId === 84 && f.finding === 'Faringite' && f.frequencyText === '70 a 90%'),
      FINDINGS_INDEX.some(f => f.articleId === 86 && f.finding === 'Dor abdominal' && f.frequencyText === '35 a 39%'),
      FINDINGS_INDEX.some(f => f.articleId === 86 && f.finding === 'Febre' && f.frequencyText === '10 a 35%'),
      FINDINGS_INDEX.some(f => f.articleId === 86 && f.finding === 'Lesão renal aguda' && f.frequencyText === '48%'),
    ].filter(Boolean).length,
    // Semiologia das microangiopatias trombóticas catalogada.
    semiologiaMat: ['Esquizócitos', 'Anemia hemolítica microangiopática', 'Atividade de ADAMTS13 reduzida', 'Anticoagulante lúpico', 'Vasculopatia livedoide']
      .filter(n => FINDINGS_INDEX.some(f => f.finding === n && f.articleId >= 85)),
    // As quatro doenças novas presentes.
    doencasNovas: ['Síndrome Hemolítico-Urêmica', 'Púrpura Trombocitopênica Trombótica', 'Síndrome do Anticorpo Antifosfolípide', 'Síndrome Antifosfolípide Catastrófica']
      .filter(n => FINDINGS_INDEX.some(f => f.diseases.includes(n))),
  }));
  check('trombocitopenia nao herda o numero da sua ausencia', d.ausencia.length === 0, JSON.stringify(d.ausencia));
  check('ADAMTS13 sem numero (valor de exame, nao frequencia)', d.limiarAdamts13.length === 0, JSON.stringify(d.limiarAdamts13));
  check('haptoglobina nao herda o numero dos reticulocitos', d.haptoglobina.length === 0, JSON.stringify(d.haptoglobina));
  check('anticardiolipina nao herda o numero do anticoagulante lupico', d.anticardiolipina.length === 0, JSON.stringify(d.anticardiolipina));
  check('acometimento cardiaco nao herda o numero do AVC', !d.cardiaco17, d.cardiaco17);
  check('prevalencia em doadores saudaveis nao vira frequencia', d.doadoresSaudaveis.length === 0, JSON.stringify(d.doadoresSaudaveis));
  check('numero apos "contra" nao vira frequencia', !d.comparador57, d.comparador57);
  check('numeros legitimos preservados (4)', d.preservados === 4, d.preservados);
  check('semiologia das microangiopatias catalogada (5)', d.semiologiaMat.length === 5, JSON.stringify(d.semiologiaMat));
  check('quatro doencas novas presentes', d.doencasNovas.length === 4, JSON.stringify(d.doencasNovas));
  await browser.close();
})();
