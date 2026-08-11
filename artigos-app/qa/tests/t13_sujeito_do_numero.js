// Terceira leva da mesma familia de erro (ver t11 e t12): o numero ou o
// adjetivo esta no texto, mas o SUJEITO dele e outro. Todos estes casos
// vieram da auditoria dos artigos de orbitopatia de Graves e de vasculite
// associada a ANCA.
const { openApp, check } = require('../helpers');
(async () => {
  const { browser, page } = await openApp();
  const d = await page.evaluate(() => ({
    // "a glomerulonefrite e RARA e apenas 30 a 40% dos pacientes tem ANCA
    // positivo": o percentual e da positividade de ANCA. A frase diz que a
    // glomerulonefrite e rara — exibir 30 a 40% afirma o oposto.
    gnComPercentual: FINDINGS_INDEX.filter(f => /^Glomerulonefrite$/.test(f.finding) &&
      /rar[ao]/i.test(f.snippet || '') && f.frequencyText && /\d/.test(f.frequencyText))
      .map(f => f.articleId + '=' + f.frequencyText),
    // O mesmo achado, agora com a frequencia CERTA (em palavra).
    gnRara: FINDINGS_INDEX.some(f => f.articleId === 77 && f.finding === 'Glomerulonefrite' &&
      /rar/i.test(f.frequencyText || '')),
    // Formas femininas e plurais precisam ser reconhecidas: antes de
    // corrigir o FREQ_WORD_RE, "e rara"/"sao comuns" nao casavam com nada.
    formasFlexionadas: FINDINGS_INDEX.filter(f => /^(rara|raras|comuns|frequentes|incomuns)$/i.test(f.frequencyText || '')).length,
    // "inibidores da catepsina C, avaliados PARA BRONQUIECTASIAS",
    // "fostamatinibe, licenciado PARA TROMBOCITOPENIA imune", "nintedanibe e
    // pirfenidona aprovados para FIBROSE PULMONAR idiopatica": os tres sao
    // indicacoes dos farmacos em OUTRAS doencas. A revisao de vasculite
    // associada a ANCA nunca os atribui a ela — nao podem aparecer na aba.
    indicacaoDeOutraDoenca: ['Bronquiectasias', 'Trombocitopenia', 'Fibrose pulmonar']
      .filter(n => FINDINGS_INDEX.some(f => f.articleId === 77 && f.finding === n)),
    // "prednisona ... 1 mg/kg por dia JUNTO AO rituximabe": a dose e da
    // prednisona. Rituximabe nao se dosa por kg em nenhum esquema da revisao.
    rituximabePorKg: MEDICATIONS_INDEX.filter(m => /Rituximabe/i.test(m.drug) && /\/kg/.test(m.dose || ''))
      .map(m => m.articleId + '=' + m.dose),
    // Numa enumeracao o mesmo percentual se repete ("arco aortico 7,1% ...
    // aorta descendente 7,1%"); os guards de termo interveniente nao podem
    // varrer a lista inteira e apagar numeros corretos.
    enumeracaoAorta: ['Acometimento de arco aórtico', 'Acometimento de aorta descendente', 'Aneurisma de artéria mesentérica']
      .filter(n => FINDINGS_INDEX.some(f => f.articleId === 43 && f.finding === n && f.frequencyText)),
    // Os dois artigos novos devem ter a semiologia que descrevem.
    semiologiaGraves: ['Proptose', 'Diplopia', 'Restrição da motilidade ocular', 'Escore de Atividade Clínica (CAS) elevado']
      .filter(n => FINDINGS_INDEX.some(f => f.articleId === 76 && f.finding === n)),
    toxicidadeVaa: ['Hipogamaglobulinemia', 'Neutropenia tardia', 'Cistite hemorrágica', 'Leucoencefalopatia multifocal progressiva (LMP)']
      .filter(n => FINDINGS_INDEX.some(f => f.articleId === 77 && f.finding === n)),
  }));
  check('glomerulonefrite descrita como rara nao ganha percentual alheio', d.gnComPercentual.length === 0, JSON.stringify(d.gnComPercentual));
  check('glomerulonefrite da EGPA registrada como rara', d.gnRara, d.gnRara);
  check('frequencias no feminino/plural sao reconhecidas', d.formasFlexionadas >= 5, d.formasFlexionadas);
  check('achado citado como indicacao de outra doenca nao entra', d.indicacaoDeOutraDoenca.length === 0, JSON.stringify(d.indicacaoDeOutraDoenca));
  check('rituximabe sem dose por kg', d.rituximabePorKg.length === 0, JSON.stringify(d.rituximabePorKg));
  check('percentuais repetidos de enumeracao preservados (3)', d.enumeracaoAorta.length === 3, JSON.stringify(d.enumeracaoAorta));
  check('semiologia da orbitopatia de Graves presente (4)', d.semiologiaGraves.length === 4, JSON.stringify(d.semiologiaGraves));
  check('toxicidades da VAA catalogadas (4)', d.toxicidadeVaa.length === 4, JSON.stringify(d.toxicidadeVaa));
  await browser.close();
})();
