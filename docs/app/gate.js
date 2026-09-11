/* ============================================================================
   Tela de senha das ferramentas clínicas
   ============================================================================

   COMO TROCAR A SENHA
   -------------------
   1. Abra https://caiowandenkolk.com.br/app/ e entre com a senha atual.
   2. No rodapé do portal, use "Gerar hash de uma nova senha".
   3. Cole o hash gerado na constante HASH_SENHA logo abaixo e publique.

   A senha em si nunca é guardada em lugar nenhum — só o hash SHA-256 dela,
   que não permite descobrir a senha original.

   ATÉ ONDE ESTA PROTEÇÃO VAI
   --------------------------
   Isto é uma PORTA, não um COFRE. O GitHub Pages serve arquivos estáticos:
   o navegador baixa a página inteira antes de pedir a senha, então quem
   souber abrir o código-fonte consegue ver o conteúdo sem digitá-la. Serve
   para impedir que alguém que esbarre no endereço use as ferramentas — não
   para proteger segredo de verdade.

   Na prática o risco é pequeno: nenhum dado de paciente é publicado aqui. Os
   dados que você preenche ficam apenas no seu navegador (localStorage) e
   nunca são enviados para o servidor. O que está publicado são os
   formulários em branco.

   Se algum dia for preciso proteção real, o caminho é trocar a hospedagem
   (Cloudflare Access ou Netlify com senha), não reforçar este arquivo.
   ============================================================================ */

(function () {
  'use strict';

  var HASH_SENHA = '56c0877611f56435041716890d5fbd6d0b60cc829a75897fa90a316afc9f6557';
  var CHAVE = 'app-acesso';
  var VALIDADE_HORAS = 12; // depois disso pede a senha de novo

  // Esconde a página antes de qualquer pintura, para o conteúdo não "piscar"
  // na tela antes da senha. O <style> é removido assim que o acesso é
  // liberado (ou substituído pela tela de senha).
  var estiloOculta = document.createElement('style');
  estiloOculta.textContent = 'body{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(estiloOculta);

  function liberar() {
    if (estiloOculta.parentNode) estiloOculta.parentNode.removeChild(estiloOculta);
    var tela = document.getElementById('gate-tela');
    if (tela && tela.parentNode) tela.parentNode.removeChild(tela);
  }

  function acessoValido() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (!bruto) return false;
      var dados = JSON.parse(bruto);
      if (dados.hash !== HASH_SENHA) return false; // senha trocada desde então
      return Date.now() < dados.expira;
    } catch (e) { return false; }
  }

  function registrarAcesso() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({
        hash: HASH_SENHA,
        expira: Date.now() + VALIDADE_HORAS * 3600 * 1000
      }));
    } catch (e) { /* navegação privada: vale só para esta aba */ }
  }

  async function sha256(texto) {
    var bytes = new TextEncoder().encode(texto);
    var buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function montarTela() {
    var tela = document.createElement('div');
    tela.id = 'gate-tela';
    tela.innerHTML = [
      '<style>',
      '#gate-tela{position:fixed;inset:0;z-index:2147483647;visibility:visible;',
      'display:flex;align-items:center;justify-content:center;padding:24px;',
      'background:#f7f3f1;font-family:Jost,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}',
      '#gate-tela .cx{width:100%;max-width:380px;background:#fffdfc;border:1px solid #e4ddd8;',
      'border-radius:14px;padding:34px 30px;box-shadow:0 18px 48px rgba(31,29,27,.11);text-align:center}',
      '#gate-tela .mrc{width:54px;height:54px;margin:0 auto 18px;border:1px solid #96702a;',
      'display:flex;align-items:center;justify-content:center;position:relative}',
      '#gate-tela .mrc:after{content:"";position:absolute;inset:4px;border:1px solid #efc98e}',
      '#gate-tela .mrc span{font-family:"Cormorant Garamond",Garamond,Georgia,serif;font-size:26px;color:#1f1d1b}',
      '#gate-tela h1{font-family:"Cormorant Garamond",Garamond,Georgia,serif;font-size:23px;',
      'font-weight:500;color:#1f1d1b;margin:0 0 6px}',
      '#gate-tela p{font-size:13px;color:#6e6862;margin:0 0 20px;line-height:1.5}',
      '#gate-tela input{width:100%;padding:11px 14px;border:1px solid #d5ccc5;border-radius:8px;',
      'font-size:15px;font-family:inherit;background:#fff;color:#1f1d1b;box-sizing:border-box}',
      '#gate-tela input:focus{outline:none;border-color:#96702a;box-shadow:0 0 0 3px rgba(150,112,42,.12)}',
      '#gate-tela button{width:100%;margin-top:12px;padding:11px;border:none;border-radius:8px;',
      'background:#96702a;color:#fffdfc;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer}',
      '#gate-tela button:hover{background:#7d5d23}',
      '#gate-tela .err{min-height:18px;margin-top:10px;font-size:12.5px;color:#a8321f}',
      '</style>',
      '<div class="cx">',
      '<div class="mrc"><span>W</span></div>',
      '<h1>Ferramentas clínicas</h1>',
      '<p>Uso restrito. Informe a senha para continuar.</p>',
      '<input type="password" id="gate-senha" placeholder="Senha" autocomplete="current-password" autofocus>',
      '<button type="button" id="gate-ok">Entrar</button>',
      '<div class="err" id="gate-erro"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(tela);

    var campo = tela.querySelector('#gate-senha');
    var erro = tela.querySelector('#gate-erro');

    async function tentar() {
      var valor = campo.value;
      if (!valor) return;
      erro.textContent = '';
      var hash;
      try {
        hash = await sha256(valor);
      } catch (e) {
        erro.textContent = 'Não foi possível verificar a senha neste navegador.';
        return;
      }
      if (hash === HASH_SENHA) {
        registrarAcesso();
        liberar();
      } else {
        erro.textContent = 'Senha incorreta.';
        campo.value = '';
        campo.focus();
      }
    }

    tela.querySelector('#gate-ok').addEventListener('click', tentar);
    campo.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tentar(); });
    campo.focus();
  }

  function iniciar() {
    if (acessoValido()) { liberar(); return; }
    montarTela();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
