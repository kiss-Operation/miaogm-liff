'use strict';
(function () {
  var params = new URLSearchParams(location.search);
  var page = params.get('page') || 'account';
  var dealerId = params.get('dealer') || 'HQ';
  var idToken = null;
  var app = document.getElementById('app');

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }

  function clear() { while (app.firstChild) app.removeChild(app.firstChild); }

  function showLoading(text) {
    clear();
    app.appendChild(el('div', { class: 'center' }, [el('div', { class: 'spinner' }), el('div', { class: 'muted', text: text || '載入中…' })]));
  }

  function showError(text) {
    clear();
    app.appendChild(el('div', { class: 'center' }, [el('div', { class: 'msg err', text: text })]));
  }

  function topbar(title) {
    var close = el('button', { class: 'close', type: 'button', 'aria-label': '關閉', text: '✕' });
    close.addEventListener('click', function () {
      if (window.liff && liff.isInClient()) liff.closeWindow(); else window.close();
    });
    return el('div', { class: 'topbar' }, [el('h1', { text: title }), close]);
  }

  function api(action, data) {
    var body = JSON.stringify(Object.assign({ action: action, dealerId: dealerId, idToken: idToken }, data || {}));
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    }).then(function (res) { return res.json(); }).then(function (json) {
      if (!json.ok) {
        if (json.expired) { liff.logout(); liff.login({ redirectUri: location.href }); }
        throw new Error(json.error || '發生錯誤');
      }
      return json.data;
    });
  }

  function statCard(label, num, unit) {
    return el('div', { class: 'stat' }, [
      el('div', { class: 'label', text: label }),
      el('div', { class: 'num', text: String(num) }),
      el('div', { class: 'unit', text: unit })
    ]);
  }

  function renderAccount(acct) {
    clear();
    app.appendChild(topbar('我的帳戶'));
    if (acct.status === '待補資料') return renderProfileForm(acct);
    app.appendChild(el('div', { class: 'hello', text: (acct.name || '顧客') + '，您好' }));
    app.appendChild(el('div', { class: 'cards' }, [
      statCard('寄倉庫存', acct.stock, '包'),
      statCard('點數餘額', acct.points, '點')
    ]));
  }

  function renderProfileForm(acct) {
    app.appendChild(el('div', { class: 'hello', text: '首次使用，請先填寫基本資料' }));
    var name = el('input', { type: 'text', id: 'f-name', maxlength: '30', autocomplete: 'name' });
    var phone = el('input', { type: 'tel', id: 'f-phone', maxlength: '10', inputmode: 'numeric', placeholder: '09xxxxxxxx', autocomplete: 'tel' });
    name.value = acct.name || '';
    var btn = el('button', { class: 'btn', type: 'button', text: '送出' });
    var msg = el('div', { class: 'msg' });
    btn.addEventListener('click', function () {
      var n = name.value.trim();
      var p = phone.value.trim();
      msg.className = 'msg';
      msg.textContent = '';
      if (!n) { msg.className = 'msg err'; msg.textContent = '請輸入姓名'; return; }
      if (!/^09\d{8}$/.test(p)) { msg.className = 'msg err'; msg.textContent = '手機需為 09 開頭共 10 碼'; return; }
      btn.disabled = true;
      btn.textContent = '送出中…';
      api('updateProfile', { name: n, phone: p }).then(function (data) {
        renderAccount(data);
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = '送出';
        msg.className = 'msg err';
        msg.textContent = err.message;
      });
    });
    app.appendChild(el('div', { class: 'card' }, [
      el('label', { for: 'f-name', text: '姓名' }), name,
      el('label', { for: 'f-phone', text: '手機' }), phone,
      btn, msg
    ]));
  }

  function renderComingSoon(title) {
    clear();
    app.appendChild(topbar(title));
    app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', text: '此功能即將開放。' })]));
  }

  function route() {
    if (page === 'account') {
      showLoading();
      return api('getAccount').then(renderAccount);
    }
    var titles = { redeem: '兌換寄倉', pickup: '申請取貨', topup: '儲值' };
    renderComingSoon(titles[page] || '喵硅蜜寄倉');
  }

  function start() {
    var cfg = DEALERS[dealerId];
    if (!cfg) return showError('找不到經銷商設定');
    liff.init({ liffId: cfg.liffId }).then(function () {
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
      idToken = liff.getIDToken();
      if (!idToken) { liff.logout(); liff.login({ redirectUri: location.href }); return; }
      return route();
    }).catch(function (err) {
      showError(err && err.message ? err.message : '載入失敗，請稍後再試');
    });
  }

  start();
})();
