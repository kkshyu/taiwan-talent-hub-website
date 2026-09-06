/**
 * 空間頁等角樓層目錄：依平面圖繪製三層樓＋附屬設施，點擊展開詳情（1F 含菜單）。
 * 依賴頁面提供 #space-dir-root、#floor-detail，以及 window.SpaceDirContent 注入。
 */
(function (global) {
  'use strict';

  var I18N = {
    zh: {
      intro: '今天要做什麼？選一層開始',
      close: '收合',
      nos: { 1: '1F', 2: '2F', 3: '3F', 4: '頂樓' },
      menuTitle: '餐飲菜單 Menu',
      areas: {
        1: '在咖啡／三點水 · 約 25.2 坪',
        2: '等等空間 · 約 29.5 坪',
        3: '等等空間 · 約 29.9 坪',
        4: '頂樓 · 洗衣／戶外吸菸區',
      },
      names: {
        1: '在咖啡（at cafe）／三點水（3AM）',
        2: '等等空間 · 會員休息與淋浴',
        3: '等等空間 · 工作與活動',
        4: '頂樓附屬設施',
      },
      kickers: {
        1: '用餐 · 咖啡 · 會客',
        2: '會員休息 · 淋浴',
        3: '工作 · 社群／企業活動',
        4: '會員附屬設施',
      },
      hints: {
        1: '早餐與咖啡、晚餐與深夜熱食',
        2: '看書休息、膠囊席、娛樂室與淋浴',
        3: '個人工作、社群活動與企業包場',
        4: '洗衣與戶外吸菸區',
      },
      factLabels: { use: '用途', hours: '時段', eligibility: '使用資格', price: '費用' },
      facts: {
        1: { use: '用餐、外帶與深夜熱食', hours: '在咖啡 08:00–17:30；三點水 18:00–翌日 03:00', eligibility: '所有訪客，不需會員', price: '依菜單；分一般價與會員價', href: '/space#menu', cta: '查看一樓菜單' },
        2: { use: '看書休憩、膠囊席、娛樂室與淋浴', hours: '24 小時（條件式啟用）', eligibility: '會員；付費設施須持有效會籍', price: '淋浴 70 點／次；膠囊席、娛樂室各 100 點／小時', href: '/system', cta: '比較會員方案' },
        3: { use: '共享辦公、社群活動與企業包場', hours: '約 08:00–翌日 03:00；包場時段另議', eligibility: '會員可日常使用；社群活動可填申請；企業、團隊或客戶包場請來信', price: '會員使用或包場方案', href: '/event-application', cta: '申請三樓社群活動', secondaryHref: 'mailto:us@emoji.tw?subject=3F%20business%20venue%20enquiry', secondaryCta: '洽詢企業／團隊包場' },
        4: { use: '洗衣與戶外吸菸區', hours: '使用時段尚未公告', eligibility: '會員；非會員採臨時通行', price: '費用尚未公告', href: 'mailto:us@emoji.tw?subject=附屬設施使用詢問', cta: '詢問使用方式' },
      },
      imageLabel: '空間影像',
      conceptCaptions: { 1: '一樓用餐區規劃示意', 2: '二樓膠囊休憩席規劃示意', 3: '三樓共享辦公與活動空間規劃示意' },
    },
    en: {
      intro: 'What do you need today? Start with a floor',
      close: 'Close',
      nos: { 1: '1F', 2: '2F', 3: '3F', 4: 'ROOF' },
      menuTitle: 'Menu',
      areas: {
        1: 'at cafe / 3AM · ~25.2 ping',
        2: 'Stay Square · ~29.5 ping',
        3: 'Stay Square · ~29.9 ping',
        4: 'Rooftop · laundry / outdoor smoking area',
      },
      names: {
        1: '在咖啡 (at cafe) / 三點水 (3AM)',
        2: 'Stay Square · member rest & showers',
        3: 'Stay Square · work & events',
        4: 'Rooftop facilities',
      },
      kickers: {
        1: 'Dining · coffee · client meetings',
        2: 'Member rest · showers',
        3: 'Work · community / business events',
        4: 'Member facilities',
      },
      hints: {
        1: 'Breakfast and coffee, dinner and late-night food',
        2: 'Reading, rest seats, game room and showers',
        3: 'Solo work, community events and business private hire',
        4: 'Laundry and outdoor smoking area',
      },
      factLabels: { use: 'Use', hours: 'Hours', eligibility: 'Access', price: 'Price' },
      facts: {
        1: { use: 'Dining, takeaway and late-night food', hours: '在咖啡 08:00–17:30; 三點水 18:00–03:00 next day', eligibility: 'Open to everyone; no membership required', price: 'See menu; standard and member prices', href: '/en/space#menu', cta: 'View the 1F menu' },
        2: { use: 'Reading, rest, capsule seats, game room and showers', hours: '24 hours (conditional)', eligibility: 'Members; paid facilities require a valid membership', price: 'A shower costs 70 points per use. Capsule seats and the game room each cost 100 points per hour.', href: '/en/system', cta: 'Compare memberships' },
        3: { use: 'Coworking, community events and business private hire', hours: 'About 08:00–03:00 next day; private events by arrangement', eligibility: 'Members use it day to day. Community events may use the application form; companies, teams and client-event organizers should email us.', price: 'Membership or private venue plan', href: '/en/event-application', cta: 'Apply for a 3F community event', secondaryHref: 'mailto:us@emoji.tw?subject=3F%20business%20venue%20enquiry', secondaryCta: 'Email about business or team hire' },
        4: { use: 'Laundry and outdoor smoking area', hours: 'Hours to be announced', eligibility: 'Members; temporary access for non-members', price: 'Price to be announced', href: 'mailto:us@emoji.tw?subject=Rooftop%20facilities', cta: 'Ask about access' },
      },
      imageLabel: 'Space image',
      conceptCaptions: { 1: '1F dining area · concept rendering', 2: '2F capsule rest seats · concept rendering', 3: '3F coworking and event space · concept rendering' },
    },
    ja: {
      intro: '今日の目的に合うフロアを選ぶ',
      close: '閉じる',
      nos: { 1: '1F', 2: '2F', 3: '3F', 4: '屋上' },
      menuTitle: 'メニュー Menu',
      areas: {
        1: '在咖啡／三點水 · 約25.2坪',
        2: '等等空間 · 約29.5坪',
        3: '等等空間 · 約29.9坪',
        4: '屋上 · ランドリー／屋外喫煙エリア',
      },
      names: {
        1: '在咖啡（at cafe）／三點水（3AM）',
        2: '等等空間 · 会員の休憩・シャワー',
        3: '等等空間 · 仕事・イベント',
        4: '屋上附属施設',
      },
      kickers: {
        1: '食事 · コーヒー · 打ち合わせ',
        2: '会員の休憩 · シャワー',
        3: '仕事 · コミュニティ／企業イベント',
        4: '会員向け附属施設',
      },
      hints: {
        1: '朝食とコーヒー、夕食と深夜の食事',
        2: '読書、休憩席、ゲームルーム、シャワー',
        3: '個人作業、コミュニティイベント、企業貸切',
        4: 'ランドリーと屋外喫煙エリア',
      },
      factLabels: { use: '用途', hours: '利用時間', eligibility: '利用条件', price: '料金' },
      facts: {
        1: { use: '飲食、テイクアウト、深夜の食事', hours: '在咖啡 08:00–17:30／三點水 18:00–翌03:00', eligibility: 'どなたでも利用可。会員登録不要', price: 'メニュー参照。通常価格と会員価格', href: '/ja/space#menu', cta: '1Fメニューを見る' },
        2: { use: '読書、休憩、カプセル席、ゲームルーム、シャワー', hours: '24時間（条件付き）', eligibility: '会員。ポイント施設は有効な会員資格が必要', price: 'シャワーは1回70ポイント、カプセル席・ゲームルームは各1時間100ポイント', href: '/ja/system', cta: '会員プランを比較' },
        3: { use: 'コワーキング、コミュニティイベント、企業貸切', hours: '約08:00–翌03:00。貸切は個別調整', eligibility: '日常利用は会員向け。コミュニティ活動は会場利用申請、企業・チーム・顧客向けイベントの貸切はメールでお問い合わせください。', price: '会員プランでの利用または貸切プラン', href: '/ja/event-application', cta: '3Fコミュニティ活動を申請', secondaryHref: 'mailto:us@emoji.tw?subject=3F%20business%20venue%20enquiry', secondaryCta: '企業・チーム貸切を問い合わせる' },
        4: { use: 'ランドリーと屋外喫煙エリア', hours: '利用時間は後日案内', eligibility: '会員。非会員は一時通行', price: '料金は後日案内', href: 'mailto:us@emoji.tw?subject=附属施設について', cta: '利用方法を問い合わせる' },
      },
      imageLabel: 'スペース画像',
      conceptCaptions: { 1: '1F飲食エリア · 完成イメージ', 2: '2Fカプセル休憩席 · 完成イメージ', 3: '3Fコワーキング・イベントスペース · 完成イメージ' },
    },
  };

  var DEFAULT_IMAGES = {
    1: { src: '/assets/space/1f-concept.jpg', width: 1200, height: 746 },
    2: { src: '/assets/space/2f-concept.jpg', width: 1200, height: 743 },
    3: { src: '/assets/space/3f-concept.jpg', width: 1400, height: 845 },
  };

  function normalizePublicCopy(raw, lang) {
    if (lang === 'zh') return raw.replace('24 小時看書休憩席', '24 小時（條件式啟用）看書休憩席');
    if (lang === 'en') return raw.replace('24-hour reading and rest seats', 'Reading and rest seats with 24-hour access (conditional)');
    return raw.replace('24時間の読書・休憩席', '読書・休憩席（24時間利用は条件付き）');
  }

  function renderFacts(t, floor) {
    var f = t.facts[floor];
    if (!f) return '';
    return '<dl>' + ['use', 'hours', 'eligibility', 'price'].map(function (key) {
      return '<div><dt>' + t.factLabels[key] + '</dt><dd>' + f[key] + '</dd></div>';
    }).join('') + '</dl><a class="space-panel__next" href="' + f.href + '">' + f.cta + ' →</a>' +
      (f.secondaryHref ? '<br><a class="space-panel__next" href="' + f.secondaryHref + '">' + f.secondaryCta + ' →</a>' : '');
  }

  /** 等角：長屋進深沿 y，面寬沿 x */
  function iso(x, y, z) {
    var cos = 0.866;
    var sin = 0.5;
    return {
      x: (x - y) * cos,
      y: (x + y) * sin - z,
    };
  }

  function poly(pts) {
    return pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  }

  function slabGroup(ox, oy, oz, W, D, H, furnSvg, floorId) {
    var a = iso(ox, oy, oz);
    var b = iso(ox + W, oy, oz);
    var c = iso(ox + W, oy + D, oz);
    var d = iso(ox, oy + D, oz);
    var a2 = iso(ox, oy, oz + H);
    var b2 = iso(ox + W, oy, oz + H);
    var c2 = iso(ox + W, oy + D, oz + H);
    var d2 = iso(ox, oy + D, oz + H);

    var top = poly([a2, b2, c2, d2]);
    var left = poly([d, d2, c2, c]);
    var right = poly([b, b2, c2, c]);

    // accent plant near front (yellow once when active)
    var plant = iso(ox + W * 0.12, oy + D * 0.18, oz + H + 2);

    return (
      '<g class="space-dir__floor" data-floor="' + floorId + '" tabindex="0" role="button" aria-pressed="false">' +
        '<polygon class="slab-side" points="' + left + '"/>' +
        '<polygon class="slab-face" points="' + right + '"/>' +
        '<polygon class="slab-top" points="' + top + '"/>' +
        furnSvg +
        '<circle class="accent-dot" cx="' + plant.x.toFixed(1) + '" cy="' + plant.y.toFixed(1) + '" r="3.2"/>' +
      '</g>'
    );
  }

  /** 家具座標相對樓板局部 (0..W, 0..D)，抬到 oz+H */
  function localIso(ox, oy, oz, W, D, H, lx, ly, lz) {
    return iso(ox + lx * W, oy + ly * D, oz + H + (lz || 0));
  }

  function furn1(ox, oy, oz, W, D, H) {
    var p = function (lx, ly, lz) { return localIso(ox, oy, oz, W, D, H, lx, ly, lz); };
    var takeout = [p(0.08, 0.02), p(0.42, 0.02), p(0.42, 0.1), p(0.08, 0.1)];
    var kitchen = [p(0.08, 0.12), p(0.92, 0.12), p(0.92, 0.28), p(0.08, 0.28)];
    var bar = [p(0.12, 0.34), p(0.82, 0.34), p(0.82, 0.42), p(0.12, 0.42)];
    var seats = '';
    for (var i = 0; i < 3; i++) {
      var y0 = 0.48 + i * 0.1;
      var desk = [p(0.18, y0), p(0.72, y0), p(0.72, y0 + 0.06), p(0.18, y0 + 0.06)];
      seats += '<polygon class="furn" points="' + poly(desk) + '"/>';
    }
    var stage = [p(0.2, 0.82), p(0.8, 0.82), p(0.8, 0.94), p(0.2, 0.94)];
    var stools = [0.22, 0.38, 0.54, 0.7].map(function (x) {
      var c = p(x, 0.46);
      return '<circle class="furn" cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="2"/>';
    }).join('');
    return (
      '<polygon class="furn-fill" points="' + poly(takeout) + '"/>' +
      '<polygon class="furn-fill" points="' + poly(kitchen) + '"/>' +
      '<polygon class="furn" points="' + poly(bar) + '"/>' +
      stools + seats +
      '<polygon class="furn" points="' + poly(stage) + '"/>'
    );
  }

  function furn2(ox, oy, oz, W, D, H) {
    var p = function (lx, ly, lz) { return localIso(ox, oy, oz, W, D, H, lx, ly, lz); };
    var tatami = [p(0.08, 0.04), p(0.92, 0.04), p(0.92, 0.28), p(0.08, 0.28)];
    var sofa = [p(0.1, 0.34), p(0.55, 0.34), p(0.55, 0.72), p(0.1, 0.72)];
    var cells = '';
    for (var i = 0; i < 6; i++) {
      var y0 = 0.34 + i * 0.07;
      var cell = [p(0.62, y0), p(0.92, y0), p(0.92, y0 + 0.055), p(0.62, y0 + 0.055)];
      cells += '<polygon class="furn" points="' + poly(cell) + '"/>';
    }
    var wet = [p(0.55, 0.8), p(0.94, 0.8), p(0.94, 0.96), p(0.55, 0.96)];
    return (
      '<polygon class="furn-fill" points="' + poly(tatami) + '"/>' +
      '<polygon class="furn" points="' + poly(sofa) + '"/>' +
      cells +
      '<polygon class="furn-fill" points="' + poly(wet) + '"/>'
    );
  }

  function furn3(ox, oy, oz, W, D, H) {
    var p = function (lx, ly, lz) { return localIso(ox, oy, oz, W, D, H, lx, ly, lz); };
    var screen = [p(0.08, 0.04), p(0.92, 0.04), p(0.92, 0.08), p(0.08, 0.08)];
    var desks = '';
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 2; col++) {
        var x0 = 0.12 + col * 0.4;
        var y0 = 0.14 + row * 0.14;
        var desk = [p(x0, y0), p(x0 + 0.3, y0), p(x0 + 0.3, y0 + 0.08), p(x0, y0 + 0.08)];
        desks += '<polygon class="furn" points="' + poly(desk) + '"/>';
      }
    }
    var snack = [p(0.12, 0.74), p(0.55, 0.74), p(0.55, 0.88), p(0.12, 0.88)];
    var toilet = [p(0.62, 0.78), p(0.94, 0.78), p(0.94, 0.96), p(0.62, 0.96)];
    return (
      '<polygon class="furn-fill" points="' + poly(screen) + '"/>' +
      desks +
      '<polygon class="furn-fill" points="' + poly(snack) + '"/>' +
      '<polygon class="furn" points="' + poly(toilet) + '"/>'
    );
  }

  function furn4(ox, oy, oz, W, D, H) {
    var p = function (lx, ly, lz) { return localIso(ox, oy, oz, W, D, H, lx, ly, lz); };
    var indoor = [p(0.08, 0.08), p(0.7, 0.08), p(0.7, 0.92), p(0.08, 0.92)];
    var balcony = [p(0.72, 0.08), p(0.96, 0.08), p(0.96, 0.92), p(0.72, 0.92)];
    var t1 = p(0.84, 0.35);
    var t2 = p(0.84, 0.65);
    return (
      '<polygon class="furn-fill" points="' + poly(indoor) + '"/>' +
      '<polygon class="furn" points="' + poly(balcony) + '"/>' +
      '<circle class="furn" cx="' + t1.x.toFixed(1) + '" cy="' + t1.y.toFixed(1) + '" r="4"/>' +
      '<circle class="furn" cx="' + t2.x.toFixed(1) + '" cy="' + t2.y.toFixed(1) + '" r="4"/>'
    );
  }

  function buildSvg() {
    var W = 45;
    var D = 200;
    var H = 30;
    var seam = 3;
    var step = H + seam;
    var baseZ = 0;
    var ox = 0;
    var oy = 0;
    var d4 = Math.round(D * 0.35);
    var floors = [
      { id: 1, z: baseZ, W: W, D: D, furn: furn1 },
      { id: 2, z: baseZ + step, W: W, D: D, furn: furn2 },
      { id: 3, z: baseZ + step * 2, W: W, D: D, furn: furn3 },
      { id: 4, z: baseZ + step * 3, W: W, D: d4, furn: furn4 },
    ];

    var parts = floors.map(function (f) {
      return slabGroup(ox, oy, f.z, f.W, f.D, H, f.furn(ox, oy, f.z, f.W, f.D, H), f.id);
    });

    // 細長塔：x 約 -173…39，y 約頂層到 1F 底；實作後若裁切再微調
    return (
      '<svg class="space-dir__svg" viewBox="-200 -160 280 420" role="img" aria-hidden="true">' +
        parts.join('') +
      '</svg>'
    );
  }

  function buildList(t) {
    return [4, 3, 2, 1].map(function (id) {
      return (
        '<li class="space-dir__item" data-floor-item="' + id + '">' +
          '<button type="button" class="space-dir__btn" data-floor="' + id + '" aria-pressed="false" aria-expanded="false">' +
            '<span class="space-dir__no">' + ((t.nos && t.nos[id]) || (id + 'F')) + '</span>' +
            '<span class="space-dir__meta">' +
              '<span class="space-dir__kicker">' + t.kickers[id] + '</span>' +
              '<span class="space-dir__name">' + t.names[id] + '</span>' +
              '<span class="space-dir__hint">' + t.hints[id] + '</span>' +
            '</span>' +
            '<span class="space-dir__chev" aria-hidden="true"></span>' +
          '</button>' +
        '</li>'
      );
    }).join('');
  }

  function mountShell(root, lang) {
    var t = I18N[lang] || I18N.zh;
    root.innerHTML =
      '<div class="wrap space-dir__wrap">' +
        '<p class="space-dir__cue">' + t.intro + '</p>' +
        '<div class="space-dir__grid">' +
          '<div class="space-dir__viz">' + buildSvg() + '</div>' +
          '<div class="space-dir__side">' +
            '<ol class="space-dir__list" aria-label="Floors">' + buildList(t) + '</ol>' +
          '</div>' +
        '</div>' +
      '</div>';
    return t;
  }

  function SpaceDir(opts) {
    this.lang = opts.lang || 'zh';
    this.root = opts.root;
    this.panel = opts.panel;
    this.t = mountShell(this.root, this.lang);
    this.active = null;
    this.content = {};
    this.menuHtml = '';
    if (this.panel) {
      this.panel.classList.remove('wrap');
      this.panel.classList.add('space-panel--accordion');
      // 收合時寄放在目錄根節點，展開時再插入對應樓層 <li>
      this.root.appendChild(this.panel);
    }
    this._bind();
  }

  SpaceDir.prototype._bind = function () {
    var self = this;
    function onPick(floor) {
      self.select(Number(floor));
    }

    this.root.querySelectorAll('.space-dir__floor').forEach(function (el) {
      el.addEventListener('click', function () { onPick(el.getAttribute('data-floor')); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(el.getAttribute('data-floor'));
        }
      });
    });

    this.root.querySelectorAll('.space-dir__btn').forEach(function (btn) {
      btn.addEventListener('click', function () { onPick(btn.getAttribute('data-floor')); });
    });

    var close = this.panel.querySelector('[data-space-close]');
    if (close) {
      close.addEventListener('click', function () { self.select(null); });
    }
  };

  SpaceDir.prototype.setData = function (content, menuHtml) {
    this.content = content || {};
    this.menuHtml = menuHtml || '';
    if (this.active) this._paintPanel(this.active);
  };

  SpaceDir.prototype.select = function (floor) {
    if (floor === this.active) {
      // toggle close
      floor = null;
    }
    this.active = floor;

    this.root.querySelectorAll('.space-dir__floor').forEach(function (el) {
      var id = Number(el.getAttribute('data-floor'));
      el.classList.toggle('is-active', floor != null && id === floor);
      el.classList.toggle('is-dim', floor != null && id !== floor);
      el.setAttribute('aria-pressed', floor != null && id === floor ? 'true' : 'false');
    });

    this.root.querySelectorAll('.space-dir__btn').forEach(function (btn) {
      var id = Number(btn.getAttribute('data-floor'));
      var on = floor != null && id === floor;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    });

    this.root.querySelectorAll('.space-dir__item').forEach(function (item) {
      var id = Number(item.getAttribute('data-floor-item'));
      item.classList.toggle('is-open', floor != null && id === floor);
    });

    if (floor == null) {
      this.panel.hidden = true;
      this.root.appendChild(this.panel);
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }

    this._paintPanel(floor);
    var item = this.root.querySelector('.space-dir__item[data-floor-item="' + floor + '"]');
    if (item) item.appendChild(this.panel);
    this.panel.hidden = false;
    // hash for deep link: #f1 #menu — 用手風琴展開，不滾動頁面
    var hash = floor === 1 ? '#menu' : ('#f' + floor);
    if (location.hash !== hash) history.replaceState(null, '', hash);
  };

  SpaceDir.prototype._paintPanel = function (floor) {
    var t = this.t;
    var no = this.panel.querySelector('[data-panel-no]');
    var title = this.panel.querySelector('[data-panel-title]');
    var md = this.panel.querySelector('[data-panel-md]');
    var facts = this.panel.querySelector('[data-panel-facts]');
    var media = this.panel.querySelector('[data-panel-media]');
    var menuWrap = this.panel.querySelector('[data-panel-menu]');
    var menuBody = this.panel.querySelector('[data-panel-menu-body]');
    var menuTitle = this.panel.querySelector('[data-panel-menu-title]');

    if (no) no.textContent = (t.nos && t.nos[floor]) || (floor + 'F');
    if (title) title.textContent = t.names[floor];

    var key = 'space_' + floor + 'f_' + this.lang;
    var raw = String(this.content[key] || '').trim();
    if (!raw && this.lang === 'zh') raw = String(this.content['space_' + floor + 'f'] || '').trim();
    raw = normalizePublicCopy(raw, this.lang);
    if (facts) facts.innerHTML = renderFacts(t, floor);
    if (md) {
      if (raw && global.marked && global.DOMPurify) {
        md.innerHTML = global.DOMPurify.sanitize(global.marked.parse(raw), { USE_PROFILES: { html: true } });
      }
      else if (raw) md.textContent = raw;
      else md.innerHTML = '<p class="menu-empty">…</p>';
    }

    var customImgUrl = String(this.content['space_' + floor + 'f_image'] || '').trim();
    var fallbackImage = DEFAULT_IMAGES[floor];
    var imgUrl = customImgUrl || (fallbackImage && fallbackImage.src) || '';
    if (media) {
      if (imgUrl) {
        media.hidden = false;
        var img = media.querySelector('img');
        var caption = media.querySelector('figcaption');
        if (img) {
          img.src = imgUrl;
          img.alt = customImgUrl ? t.imageLabel : t.conceptCaptions[floor];
          img.loading = 'lazy';
          img.decoding = 'async';
          if (!customImgUrl && fallbackImage) {
            img.width = fallbackImage.width;
            img.height = fallbackImage.height;
          }
        }
        if (caption) caption.textContent = customImgUrl ? t.imageLabel : t.conceptCaptions[floor];
      } else {
        media.hidden = true;
      }
    }

    if (menuWrap && menuBody) {
      if (floor === 1) {
        menuWrap.hidden = false;
        menuWrap.id = 'menu';
        if (menuTitle) menuTitle.textContent = t.menuTitle;
        menuBody.innerHTML = this.menuHtml || '<p class="menu-empty">…</p>';
      } else {
        menuWrap.hidden = true;
        menuWrap.removeAttribute('id');
        menuBody.innerHTML = '';
      }
    }
    this.panel.setAttribute('data-active-floor', String(floor));
  };

  SpaceDir.prototype.openFromHash = function () {
    var h = (location.hash || '').replace(/^#/, '');
    var floor = h === 'menu' || h === 'f1' ? 1 : (/^f[2-4]$/.test(h) ? Number(h.slice(1)) : null);
    if (floor !== this.active) this.select(floor);
  };

  global.SpaceDir = SpaceDir;
})(typeof window !== 'undefined' ? window : global);
