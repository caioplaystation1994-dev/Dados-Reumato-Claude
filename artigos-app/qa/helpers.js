const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

// Abre o HTML gerado e devolve a página já carregada, com coleta de erros.
// Qualquer erro de página ou de console vira marcador que o runner reconhece.
async function openApp(viewport) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: viewport || { width: 1100, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR: ' + m.text()); });
  await page.goto('file://' + path.resolve('organizador_artigos.html'), { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { browser, page };
}

// Asserção explícita: imprime marcador que o runner detecta.
function check(label, condition, detail) {
  console.log((condition ? '  ok   ' : '  ASSERT FAIL ') + label + (detail !== undefined ? ' → ' + detail : ''));
}

module.exports = { openApp, check };
