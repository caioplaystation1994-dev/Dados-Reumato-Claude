/* Interações do site: menu mobile, sombra do cabeçalho, revelação ao rolar e ano do rodapé. */
(function () {
  'use strict';

  // Menu mobile
  var botao = document.querySelector('.menu-botao');
  var nav = document.querySelector('.nav');

  if (botao && nav) {
    botao.addEventListener('click', function () {
      var aberto = nav.classList.toggle('aberto');
      botao.setAttribute('aria-expanded', String(aberto));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('aberto');
        botao.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('aberto')) {
        nav.classList.remove('aberto');
        botao.setAttribute('aria-expanded', 'false');
        botao.focus();
      }
    });
  }

  // Sombra do cabeçalho ao rolar
  var cabecalho = document.querySelector('.cabecalho');
  if (cabecalho) {
    var aoRolar = function () {
      cabecalho.classList.toggle('rolado', window.scrollY > 8);
    };
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
  }

  // Revelação suave dos blocos ao entrar na tela
  var alvos = document.querySelectorAll('.revelar');
  if (alvos.length) {
    if ('IntersectionObserver' in window) {
      var observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('visivel');
            observador.unobserve(entrada.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

      alvos.forEach(function (alvo) { observador.observe(alvo); });
    } else {
      alvos.forEach(function (alvo) { alvo.classList.add('visivel'); });
    }
  }

  // Ano corrente no rodapé
  var ano = document.querySelector('[data-ano]');
  if (ano) { ano.textContent = String(new Date().getFullYear()); }
})();
