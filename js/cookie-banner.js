/**
 * Cookie Consent Banner for Moy Mebel (152-ФЗ РФ)
 * Сохраняет выбор пользователя в localStorage ('mm_cookie_consent_v1')
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mm_cookie_consent_v1';

  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      return;
    }
  } catch (e) {
    // If storage restricted, proceed
  }

  function createBanner() {
    if (document.querySelector('.mm-cookie-banner')) return;

    var banner = document.createElement('div');
    banner.className = 'mm-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Уведомление об использовании файлов cookie');

    banner.innerHTML = [
      '<div class="mm-cookie-banner__inner">',
      '  <div class="mm-cookie-banner__icon">🍪</div>',
      '  <div class="mm-cookie-banner__content">',
      '    <p class="mm-cookie-banner__text">',
      '      Мы используем файлы cookie для корректной работы сайта и аналитики. Оставаясь на сайте, вы соглашаетесь с <a href="privacy.html" class="mm-cookie-banner__link">Политикой конфиденциальности</a>.',
      '    </p>',
      '    <div class="mm-cookie-banner__actions">',
      '      <button type="button" class="mm-cookie-banner__btn" id="mmCookieAcceptBtn">Принять</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(banner);

    // Мягкое плавное появление через 500мс
    setTimeout(function () {
      banner.classList.add('is-visible');
    }, 500);

    var btn = document.getElementById('mmCookieAcceptBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        try {
          localStorage.setItem(STORAGE_KEY, '1');
        } catch (e) {}

        banner.classList.remove('is-visible');
        banner.classList.add('is-hiding');
        setTimeout(function () {
          if (banner.parentNode) {
            banner.parentNode.removeChild(banner);
          }
        }, 350);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBanner);
  } else {
    createBanner();
  }
})();
