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
    var area = document.getElementById('calc-total-m2-val');
    var totalLine = total ? ('ИТОГО: ' + (total.innerText || '').trim()) : '';
    if (area && area.innerText && area.innerText.trim() !== '0 м²') {
      totalLine += ' · Квадратура: ' + area.innerText.trim();
    }
    if (totalLine) { out.push(totalLine); }
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

  /** Показывает красивую фирменную рамку «Спасибо за заявку!» */
  function showSuccessFrame(form) {
    var isCalcModal = form.getAttribute('data-lead-form') === 'calc';
    var parent = form.parentElement;
    var frame = parent ? parent.querySelector('.lead-success-frame') : null;

    if (!frame) {
      frame = document.createElement('div');
      frame.className = 'lead-success-frame';
      frame.innerHTML = [
        '<div class="lead-success-icon-box">',
        '  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">',
        '    <polyline points="20 6 9 17 4 12"></polyline>',
        '  </svg>',
        '</div>',
        '<div class="lead-success-eyebrow">Заявка успешно принята</div>',
        '<h3 class="lead-success-heading">Спасибо за заявку!</h3>',
        '<p class="lead-success-text">',
        '  Мы получили ваши данные и свяжемся с вами для уточнения деталей.',
        '</p>',
        '<div class="lead-success-footer-note">',
        '  Срочный вопрос? Звоните напрямую: <a href="tel:+73812590650">+7 (3812) 590-650</a>',
        '</div>',
        '<div>',
        '  <button type="button" class="lead-success-btn-again">' + (isCalcModal ? 'Закрыть окно' : 'Отправить ещё заявку') + '</button>',
        '</div>'
      ].join('\n');

      if (form.nextSibling) {
        form.parentNode.insertBefore(frame, form.nextSibling);
      } else {
        form.parentNode.appendChild(frame);
      }
    }

    form.style.display = 'none';
    frame.style.display = 'block';

    var btnAgain = frame.querySelector('.lead-success-btn-again');
    if (btnAgain) {
      btnAgain.onclick = function () {
        if (isCalcModal && typeof window.closeCalcModal === 'function') {
          window.closeCalcModal();
        }
        frame.style.display = 'none';
        form.reset();
        form.style.display = '';
        var fileTitle = form.querySelector('.exact-file-title');
        if (fileTitle) { fileTitle.textContent = 'Прикрепить файл проекта'; }
        var calcFile = form.querySelector('#calc-file-status');
        if (calcFile) { calcFile.textContent = 'Прикрепить карту раскроя / файл проекта'; }
      };
    }

    if (isCalcModal && typeof window.clearCalcItems === 'function') {
      window.clearCalcItems();
    }
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

    // в заявку кладём название услуги, а не служебный код опции
    var serviceSelect = form.querySelector('select[name="service"]');
    if (serviceSelect && serviceSelect.selectedIndex >= 0) {
      data.set('service', serviceSelect.options[serviceSelect.selectedIndex].text);
    }

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

    var isLocalOrStatic = location.hostname === 'localhost' ||
                          location.hostname === '127.0.0.1' ||
                          location.hostname.slice(-9) === 'github.io';

    fetch(ENDPOINT, { method: 'POST', body: data })
      .then(function (r) {
        if (!r.ok && isLocalOrStatic) {
          return { ok: true, isDemo: true };
        }
        return r.json().catch(function () {
          if (isLocalOrStatic) { return { ok: true, isDemo: true }; }
          return { ok: false, error: 'Заявка не ушла. Позвоните, пожалуйста: +7 (3812) 590-650' };
        });
      })
      .then(function (res) {
        if (res && res.ok) {
          reachGoal('lead_sent');
          showSuccessFrame(form);
        } else {
          setStatus(form, 'err', (res && res.error) || 'Не получилось отправить. Позвоните: +7 (3812) 590-650');
        }
      })
      .catch(function () {
        if (isLocalOrStatic) {
          reachGoal('lead_sent');
          showSuccessFrame(form);
        } else {
          setStatus(form, 'err', 'Нет связи с сервером. Позвоните, пожалуйста: +7 (3812) 590-650');
        }
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
