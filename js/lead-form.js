/**
 * Отправка заявок с форм сайта на send.php (Telegram + почта).
 *
 * Подключается ко всем формам с атрибутом data-lead-form.
 * Ничего не рисует, пока пользователь не нажал «Отправить», —
 * внешний вид страницы в покое не меняется.
 */
(function () {
  'use strict';

  var ENDPOINT = 'send.php';

  function findStatusBox(form) {
    var box = form.querySelector('.lead-form-status');
    if (!box) {
      box = document.createElement('div');
      box.className = 'lead-form-status';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      form.appendChild(box);
    }
    return box;
  }

  function setStatus(form, kind, message) {
    var box = findStatusBox(form);
    box.textContent = message || '';
    box.className = 'lead-form-status' + (kind ? ' is-' + kind : '');
    box.style.display = message ? 'block' : 'none';
  }

  /** Собирает состав калькулятора распила в текст для заявки. */
  function collectCalcSummary() {
    var tbody = document.getElementById('calc-items-tbody');
    if (!tbody || !tbody.rows.length) { return ''; }
    var out = [];
    for (var i = 0; i < tbody.rows.length; i++) {
      var cells = tbody.rows[i].cells;
      var parts = [];
      for (var c = 0; c < cells.length - 1; c++) {
        var t = (cells[c].innerText || '').replace(/\s+/g, ' ').trim();
        if (t) { parts.push(t); }
      }
      out.push(parts.join(' | '));
    }
    var total = document.getElementById('calc-total-amount');
    if (total) { out.push('ИТОГО: ' + (total.innerText || '').trim()); }
    return out.join('\n');
  }

  function reachGoal(name) {
    // цель Яндекс.Метрики сработает, только когда счётчик будет подключён
    try {
      if (typeof window.ym === 'function' && window.__ymCounterId) {
        window.ym(window.__ymCounterId, 'reachGoal', name);
      }
    } catch (e) { /* аналитика не должна ломать отправку */ }
  }

  function submitForm(form) {
    var btn = form.querySelector('button[type="submit"]');
    var btnLabel = null;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var data = new FormData(form);
    data.set('page', location.pathname.split('/').pop() || 'index.html');

    if (form.getAttribute('data-lead-form') === 'calc') {
      var summary = collectCalcSummary();
      if (summary) { data.set('cart', summary); }
      data.set('service', 'Заказ распила из калькулятора');
    }

    if (btn) {
      btnLabel = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span>Отправляем…</span>';
    }
    setStatus(form, '', '');

    fetch(ENDPOINT, { method: 'POST', body: data })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Сервер ответил неожиданно' }; }); })
      .then(function (res) {
        if (res && res.ok) {
          setStatus(form, 'ok', 'Заявка принята. Мы свяжемся с вами в течение 15 минут.');
          reachGoal('lead_sent');
          form.reset();

          // калькулятор: очищаем корзину и закрываем модалку
          if (form.getAttribute('data-lead-form') === 'calc') {
            if (typeof window.clearCalcItems === 'function') { window.clearCalcItems(); }
            setTimeout(function () {
              if (typeof window.closeCalcModal === 'function') { window.closeCalcModal(); }
              setStatus(form, '', '');
            }, 2500);
          }
          // сбрасываем подпись прикреплённого файла
          var fileTitle = form.querySelector('.exact-file-title');
          if (fileTitle) { fileTitle.textContent = 'Прикрепить файл проекта'; }
          var calcFile = form.querySelector('#calc-file-status');
          if (calcFile) { calcFile.textContent = 'Прикрепить карту раскроя / файл проекта'; }
        } else {
          setStatus(form, 'err', (res && res.error) || 'Не получилось отправить. Позвоните: +7 (3812) 590-650');
        }
      })
      .catch(function () {
        setStatus(form, 'err', 'Нет связи с сервером. Позвоните, пожалуйста: +7 (3812) 590-650');
      })
      .then(function () {
        if (btn) {
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
          btn.innerHTML = btnLabel;
        }
      });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-lead-form]');
    Array.prototype.forEach.call(forms, function (form) {
      form.setAttribute('novalidate', 'novalidate');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitForm(form);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
