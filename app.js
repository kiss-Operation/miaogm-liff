'use strict';
(function () {
  var params = new URLSearchParams(location.search);
  var page = (params.get('page') || '').split('?')[0];
  if (!page) page = /[?&](orderId|transactionId)=/.test(location.href) ? 'payresult' : 'account';
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

  function newRequestId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function statCard(label, num, unit) {
    var n = el('div', { class: 'num', text: String(num) });
    return el('div', { class: 'stat' }, [el('div', { class: 'label', text: label }), n, el('div', { class: 'unit', text: unit })]);
  }

  function signed(n) { return (n > 0 ? '+' : '') + n; }

  function renderHistory(list) {
    var box = el('div', { class: 'card' }, [el('div', { class: 'card-title', text: '最近紀錄' })]);
    if (!list || !list.length) {
      box.appendChild(el('div', { class: 'muted', text: '目前沒有紀錄' }));
      return box;
    }
    list.forEach(function (h) {
      var parts = [];
      if (h.bags) parts.push(signed(h.bags) + ' 包');
      if (h.points) parts.push(signed(h.points) + ' 點');
      box.appendChild(el('div', { class: 'row' }, [
        el('div', { class: 'row-main' }, [
          el('div', { class: 'row-title', text: h.type }),
          el('div', { class: 'muted small', text: h.time })
        ]),
        el('div', { class: 'row-side', text: parts.join('／') })
      ]));
    });
    return box;
  }

  function renderAccount(acct, history) {
    clear();
    app.appendChild(topbar('我的帳戶'));
    if (acct.status === '待補資料') return renderProfileForm(acct, false);
    app.appendChild(el('div', { class: 'hello', text: (acct.name || '顧客') + '，您好' }));
    app.appendChild(el('div', { class: 'cards' }, [
      statCard('寄倉庫存', acct.stock, '包'),
      statCard('點數餘額', acct.points, '點')
    ]));
    app.appendChild(renderHistory(history));
    var edit = el('button', { class: 'link', type: 'button', text: '編輯資料' });
    edit.addEventListener('click', function () {
      clear();
      app.appendChild(topbar('編輯資料'));
      renderProfileForm(acct, true, history);
    });
    app.appendChild(el('div', { class: 'center-link' }, [edit]));
  }

  function renderProfileForm(acct, isEdit, history) {
    if (!isEdit) app.appendChild(el('div', { class: 'hello', text: '首次使用，請先填寫基本資料' }));
    var name = el('input', { type: 'text', id: 'f-name', maxlength: '30', autocomplete: 'name' });
    var phone = el('input', { type: 'tel', id: 'f-phone', maxlength: '10', inputmode: 'numeric', placeholder: '09xxxxxxxx', autocomplete: 'tel' });
    name.value = acct.name || '';
    if (isEdit) phone.value = acct.phone || '';
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
        return api('getHistory').catch(function () { return []; }).then(function (h) { renderAccount(data, h); });
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = '送出';
        msg.className = 'msg err';
        msg.textContent = err.message;
      });
    });
    var children = [
      el('label', { for: 'f-name', text: '姓名' }), name,
      el('label', { for: 'f-phone', text: '手機' }), phone,
      btn, msg
    ];
    if (isEdit) {
      var cancel = el('button', { class: 'link', type: 'button', text: '取消' });
      cancel.addEventListener('click', function () { renderAccount(acct, history); });
      children.push(el('div', { class: 'center-link' }, [cancel]));
    }
    app.appendChild(el('div', { class: 'card' }, children));
  }

  function renderRedeem(acct, plans) {
    clear();
    app.appendChild(topbar('兌換寄倉'));
    if (acct.status === '待補資料') {
      app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', text: '請先到「我的帳戶」完成基本資料，才能兌換。' })]));
      return;
    }
    var pointsNum = el('div', { class: 'num', text: String(acct.points) });
    var stockNum = el('div', { class: 'num', text: String(acct.stock) });
    app.appendChild(el('div', { class: 'banner' }, [
      el('div', { class: 'banner-item' }, [el('div', { class: 'label', text: '點數餘額' }), pointsNum]),
      el('div', { class: 'banner-item' }, [el('div', { class: 'label', text: '寄倉庫存（包）' }), stockNum])
    ]));
    var msg = el('div', { class: 'msg' });
    var busy = false;
    var buttons = [];

    function refreshButtons() {
      buttons.forEach(function (b) {
        var enough = acct.points >= b.plan.points;
        b.btn.disabled = busy || !enough;
        b.btn.textContent = enough ? '兌換' : '點數不足';
      });
    }

    if (!plans.length) {
      app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', text: '目前沒有可兌換的方案。' })]));
    }
    plans.forEach(function (p) {
      var btn = el('button', { class: 'btn small-btn', type: 'button', text: '兌換' });
      buttons.push({ plan: p, btn: btn });
      btn.addEventListener('click', function () {
        if (busy) return;
        if (!window.confirm('確定用 ' + p.points + ' 點兌換 ' + p.bags + ' 包？')) return;
        busy = true;
        refreshButtons();
        msg.className = 'msg';
        msg.textContent = '處理中…';
        api('redeemPlan', { planId: p.id, requestId: newRequestId() }).then(function (data) {
          acct = data.account;
          pointsNum.textContent = String(acct.points);
          stockNum.textContent = String(acct.stock);
          msg.className = 'msg ok';
          msg.textContent = data.duplicate ? '此筆兌換已完成' : '兌換成功！入庫 ' + data.bags + ' 包，目前庫存 ' + acct.stock + ' 包';
        }).catch(function (err) {
          msg.className = 'msg err';
          msg.textContent = err.message;
        }).then(function () {
          busy = false;
          refreshButtons();
        });
      });
      app.appendChild(el('div', { class: 'card plan' }, [
        el('div', { class: 'plan-main' }, [
          el('div', { class: 'row-title', text: p.name }),
          el('div', { class: 'muted', text: p.points + ' 點 → 入庫 ' + p.bags + ' 包' })
        ]),
        btn
      ]));
    });
    app.appendChild(msg);
    refreshButtons();
  }

  function renderPickup(acct, info) {
  clear();
  app.appendChild(topbar('申請取貨'));
  if (acct.status === '待補資料') {
    app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', text: '請先到「我的帳戶」完成基本資料，才能申請取貨。' })]));
    return;
  }
  var stockNum = el('div', { class: 'num', text: String(info.stock) });
  var availNum = el('div', { class: 'num', text: String(info.available) });
  app.appendChild(el('div', { class: 'banner' }, [
    el('div', { class: 'banner-item' }, [el('div', { class: 'label', text: '寄倉庫存（包）' }), stockNum]),
    el('div', { class: 'banner-item' }, [el('div', { class: 'label', text: '可申請包數' }), availNum])
  ]));
  var qty = 1, method = '自取', busy = false;
  var qtyNum = el('div', { class: 'num', text: '1' });
  var minus = el('button', { class: 'btn small-btn', type: 'button', text: '－' });
  var plus = el('button', { class: 'btn small-btn', type: 'button', text: '＋' });
  var selfBtn = el('button', { type: 'button', text: '自取' });
  var shipBtn = el('button', { type: 'button', text: '宅配' });
  var addrLabel = el('label', { for: 'f-addr', text: '收件地址' });
  var address = el('input', { type: 'text', id: 'f-addr', maxlength: '200', placeholder: '請填寫完整收件地址' });
  var note = el('input', { type: 'text', id: 'f-note', maxlength: '100', placeholder: '選填' });
  var submit = el('button', { class: 'btn', type: 'button', text: '送出申請' });
  var msg = el('div', { class: 'msg' });
  var listBox = el('div');

  function sync() {
    if (qty > info.available) qty = Math.max(1, info.available);
    qtyNum.textContent = String(qty);
    stockNum.textContent = String(info.stock);
    availNum.textContent = String(info.available);
    minus.disabled = busy || qty <= 1;
    plus.disabled = busy || qty >= info.available;
    selfBtn.className = method === '自取' ? 'btn small-btn' : 'link';
    shipBtn.className = method === '宅配' ? 'btn small-btn' : 'link';
    addrLabel.style.display = method === '宅配' ? '' : 'none';
    address.style.display = method === '宅配' ? '' : 'none';
    submit.disabled = busy || info.available < 1;
    submit.textContent = info.available < 1 ? '目前沒有可申請的包數' : (busy ? '送出中…' : '送出申請');
  }

  function renderList() {
    while (listBox.firstChild) listBox.removeChild(listBox.firstChild);
    var box = el('div', { class: 'card' }, [el('div', { class: 'card-title', text: '最近申請' })]);
    if (!info.list.length) box.appendChild(el('div', { class: 'muted', text: '目前沒有申請紀錄' }));
    info.list.forEach(function (r) {
      var side = [el('div', { class: 'row-side', text: r.status })];
      if (r.canCancel) {
        var cancel = el('button', { class: 'link', type: 'button', text: '取消申請' });
        cancel.addEventListener('click', function () {
          if (busy) return;
          if (!window.confirm('確定取消這筆申請？')) return;
          busy = true; sync();
          api('cancelPickup', { reqId: r.id }).then(function (data) {
            info = data.info;
            msg.className = 'msg ok';
            msg.textContent = '已取消申請';
          }).catch(function (err) {
            msg.className = 'msg err';
            msg.textContent = err.message;
          }).then(function () { busy = false; sync(); renderList(); });
        });
        side.push(cancel);
      }
      box.appendChild(el('div', { class: 'row' }, [
        el('div', { class: 'row-main' }, [
          el('div', { class: 'row-title', text: r.qty + ' 包｜' + r.method }),
          el('div', { class: 'muted small', text: r.time })
        ]),
        el('div', {}, side)
      ]));
    });
    listBox.appendChild(box);
  }

  minus.addEventListener('click', function () { if (qty > 1) { qty--; sync(); } });
  plus.addEventListener('click', function () { if (qty < info.available) { qty++; sync(); } });
  selfBtn.addEventListener('click', function () { method = '自取'; sync(); });
  shipBtn.addEventListener('click', function () { method = '宅配'; sync(); });
  submit.addEventListener('click', function () {
    if (busy) return;
    msg.className = 'msg';
    msg.textContent = '';
    var addr = address.value.trim();
    if (method === '宅配' && !addr) { msg.className = 'msg err'; msg.textContent = '宅配請填寫收件地址'; return; }
    if (!window.confirm('確定申請取貨 ' + qty + ' 包（' + method + '）？')) return;
    busy = true; sync();
    api('createPickup', { qty: qty, method: method, address: addr, note: note.value.trim(), requestId: newRequestId() }).then(function (data) {
      info = data.info;
      msg.className = 'msg ok';
      msg.textContent = data.duplicate ? '此筆申請已送出' : '申請已送出，店家會盡快處理';
      qty = 1;
      note.value = '';
    }).catch(function (err) {
      msg.className = 'msg err';
      msg.textContent = err.message;
    }).then(function () { busy = false; sync(); renderList(); });
  });

  app.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'card-title', text: '申請包數' }),
    el('div', { class: 'row' }, [minus, qtyNum, plus]),
    el('div', { class: 'card-title', text: '取貨方式' }),
    el('div', { class: 'row' }, [selfBtn, shipBtn]),
    addrLabel, address,
    el('label', { for: 'f-note', text: '備註' }), note,
    submit, msg
  ]));
  app.appendChild(listBox);
  sync();
  renderList();
}

function renderTopup(acct, info) {
    clear();
    app.appendChild(topbar('儲值'));
    if (acct.status === '待補資料') {
      app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', text: '請先到「我的帳戶」完成基本資料，才能儲值。' })]));
      return;
    }
    app.appendChild(el('div', { class: 'banner' }, [
      el('div', { class: 'banner-item' }, [el('div', { class: 'label', text: '點數餘額' }), el('div', { class: 'num', text: String(acct.points) })])
    ]));
    var msg = el('div', { class: 'msg' });
    var busy = false;
    var buttons = [];
    function setBusy() { buttons.forEach(function (b) { b.disabled = busy; }); }
    app.appendChild(el('div', { class: 'muted', text: '選擇金額，以 LINE Pay 付款（1 元 = ' + info.ratio + ' 點）' }));
    if (!info.options.length) app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', text: '目前沒有可選的儲值金額。' })]));
    info.options.forEach(function (o) {
      var btn = el('button', { class: 'btn small-btn', type: 'button', text: '儲值' });
      buttons.push(btn);
      btn.addEventListener('click', function () {
        if (busy) return;
        if (!window.confirm('確定以 LINE Pay 儲值 NT$' + o.amount + '（獲得 ' + o.points + ' 點）？')) return;
        busy = true; setBusy();
        msg.className = 'msg';
        msg.textContent = '前往 LINE Pay…';
        api('createTopup', { amount: o.amount }).then(function (data) {
          if (!data.paymentUrl) throw new Error('無法取得付款網址');
          window.location.href = data.paymentUrl;
        }).catch(function (err) {
          msg.className = 'msg err';
          msg.textContent = err.message;
          busy = false; setBusy();
        });
      });
      app.appendChild(el('div', { class: 'card plan' }, [
        el('div', { class: 'plan-main' }, [
          el('div', { class: 'row-title', text: 'NT$ ' + o.amount }),
          el('div', { class: 'muted', text: '獲得 ' + o.points + ' 點' })
        ]),
        btn
      ]));
    });
    app.appendChild(msg);
    var box = el('div', { class: 'card' }, [el('div', { class: 'card-title', text: '最近儲值' })]);
    if (!info.list.length) box.appendChild(el('div', { class: 'muted', text: '目前沒有儲值紀錄' }));
    info.list.forEach(function (r) {
      box.appendChild(el('div', { class: 'row' }, [
        el('div', { class: 'row-main' }, [
          el('div', { class: 'row-title', text: 'NT$ ' + r.amount + '｜' + r.points + ' 點' }),
          el('div', { class: 'muted small', text: r.time })
        ]),
        el('div', { class: 'row-side', text: r.status })
      ]));
    });
    app.appendChild(box);
  }

  function renderPayResult(data) {
    clear();
    app.appendChild(topbar('付款結果'));
    var ok = data.status === '成功';
    var pending = data.status === '待付款';
    var text = ok ? '儲值成功！NT$' + data.amount + '，獲得 ' + data.points + ' 點，目前點數 ' + data.account.points + ' 點'
      : pending ? '付款確認中，請稍候再按「重新確認」'
      : '付款未完成（' + data.status + '），沒有扣款，點數也沒有增加';
    var children = [el('div', { class: ok ? 'msg ok' : (pending ? 'msg' : 'msg err'), text: text })];
    var again = el('button', { class: 'btn', type: 'button', text: pending ? '重新確認' : '回到儲值頁' });
    again.addEventListener('click', function () {
      if (pending) { route(); return; }
      window.location.href = location.pathname + '?page=topup';
    });
    children.push(again);
    app.appendChild(el('div', { class: 'card' }, children));
  }

  function renderComingSoon(title) {
    clear();
    app.appendChild(topbar(title));
    app.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', text: '此功能即將開放。' })]));
  }

  function route() {
    showLoading();
    if (page === 'account') {
      return Promise.all([api('getAccount'), api('getHistory').catch(function () { return []; })]).then(function (r) {
        renderAccount(r[0], r[1]);
      });
    }
    if (page === 'redeem') {
      return Promise.all([api('getAccount'), api('getPlans')]).then(function (r) {
        renderRedeem(r[0], r[1]);
      });
    }
    if (page === 'pickup') {
    return Promise.all([api('getAccount'), api('getPickups')]).then(function (r) {
      renderPickup(r[0], r[1]);
    });
  }
  if (page === 'topup') {
      return Promise.all([api('getAccount'), api('getTopupInfo')]).then(function (r) {
        renderTopup(r[0], r[1]);
      });
    }
    if (page === 'payresult') {
      var oid = '';
      try { oid = decodeURIComponent((location.href.match(/[?&]orderId=([^&#]+)/) || [])[1] || ''); } catch (e) { oid = ''; }
      return api('confirmTopup', { orderId: oid }).then(renderPayResult);
    }
    var titles = { topup: '儲值' };
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
