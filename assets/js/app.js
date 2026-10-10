/* «Свой свет» — логика черновика: варианты дизайна, калькулятор, комплекты, схема, заявка.
   Ничего не отправляет в сеть и не сохраняет, кроме выбранного варианта дизайна в localStorage. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf1 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  var nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
  var fmt1 = function (x) { return nf1.format(x); };
  var rub = function (x) { return nf0.format(Math.round(x / 1000) * 1000) + " ₽"; };
  var num = function (x) { return x >= 1e6 ? nf1.format(Math.round(x / 1e5) / 10) : nf0.format(Math.round(x / 5e3) * 5); };
  var unit = function (x) { return x >= 1e6 ? "млн" : "тыс."; };
  var rubRange = function (lo, hi) {   // «215–380 тыс. ₽», «1,2–1,5 млн ₽», «850 тыс. – 1,2 млн ₽»
    if (unit(lo) === unit(hi)) return num(lo) + "–" + num(hi) + " " + unit(hi) + " ₽";
    return num(lo) + " " + unit(lo) + " – " + num(hi) + " " + unit(hi) + " ₽";
  };
  var plural = function (n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ===================================================== данные
     Мощности и цены — ориентиры (см. research/03_рынок_России.md). Олег заменит на свои. */
  // Мощности — по паспортам и справочникам (research/03_рынок_России.md, раздел 3).
  var APPL = [
    { id: "boiler",  name: "Газовый котёл",        icon: "i-flame",     w: 130,  surge: 450,  h: 22,   heavy: false, hint: "≈2,9 кВт·ч в сутки зимой" },
    { id: "pump",    name: "Насос скважины",       icon: "i-drop",      w: 700,  surge: 3500, h: 0.4,  heavy: false, hint: "0,7 кВт, пуск до 2–5 кВт" },
    { id: "fridge",  name: "Холодильник",          icon: "i-fridge",    w: 180,  surge: 1000, h: 5.2,  heavy: false, hint: "≈0,9 кВт·ч в сутки" },
    { id: "freezer", name: "Морозильник",          icon: "i-snow",      w: 150,  surge: 900,  h: 6.5,  heavy: false, hint: "≈1 кВт·ч в сутки" },
    { id: "light",   name: "Свет во всём доме",    icon: "i-bulb",      w: 150,  surge: 150,  h: 5,    heavy: false, hint: "≈15 ламп по 10 Вт" },
    { id: "net",     name: "Интернет и роутер",    icon: "i-wifi",      w: 15,   surge: 15,   h: 24,   heavy: false, hint: "круглосуточно" },
    { id: "septic",  name: "Септик (компрессор)",  icon: "i-wind",      w: 55,   surge: 150,  h: 24,   heavy: false, hint: "Топас, Астра: ≈1,3 кВт·ч" },
    { id: "security",name: "Камеры и ворота",      icon: "i-shield",    w: 40,   surge: 600,  h: 24,   heavy: false, hint: "регистратор, привод ворот" },
    { id: "tv",      name: "Телевизор",            icon: "i-tv",        w: 75,   surge: 75,   h: 4.5,  heavy: false, hint: "≈0,3 кВт·ч в сутки" },
    { id: "laptop",  name: "Ноутбуки и телефоны",  icon: "i-laptop",    w: 60,   surge: 60,   h: 5,    heavy: false, hint: "работа и связь" },
    { id: "micro",   name: "Микроволновка",        icon: "i-microwave", w: 1150, surge: 1400, h: 0.2,  heavy: true,  hint: "1,15 кВт, 10–15 минут" },
    { id: "kettle",  name: "Электрочайник",        icon: "i-kettle",    w: 2000, surge: 2000, h: 0.12, heavy: true,  hint: "2 кВт, по 3–5 минут" },
    { id: "washer",  name: "Стиральная машина",    icon: "i-washer",    w: 2000, surge: 2500, h: 0.45, heavy: true,  hint: "≈0,9 кВт·ч за стирку" },
    { id: "stove",   name: "Электроплита",         icon: "i-pot",       w: 2000, surge: 2000, h: 0.7,  heavy: true,  hint: "1–2 конфорки, не вся плита" }
  ];
  var DEFAULTS = {
    flat:  ["fridge", "light", "net", "tv", "laptop"],
    house: ["boiler", "pump", "fridge", "light", "net", "laptop"],
    dacha: ["pump", "fridge", "light", "net"]
  };
  var PLACE_RU = { flat: "Квартира", house: "Частный дом", dacha: "Дача" };
  var INV_SIZES = [3, 5, 6, 8, 10, 12, 15, 20];          // кВт
  var BAT_SIZES = [2.5, 5, 10, 15, 20, 25, 30, 40, 50];  // кВт·ч
  var PANEL_KW = 0.58;                                   // одна панель ~580 Вт
  var USABLE = 0.85;                                     // полезная доля ёмкости (глубина разряда LiFePO4 и потери)
  var INV_IDLE = 0.05;                                   // собственный расход гибридного инвертора, кВт (40–80 Вт)
  // Выработка 1 кВт панелей в Москве, кВт·ч в сутки (PVGIS 5.3, юг 41°): декабрь 0,64, июнь 4,33, март и сентябрь ≈2,8.
  var YIELD_WINTER = 0.64, YIELD_SUMMER = 4.33, YIELD_SHOULDER = 2.8;
  // Цены, ₽ «от–до» — рынок Москвы на 10.10.2026 (research/03, раздел 2). Заменить ценами Олега.
  var PRICE = {
    inv: { 3: [31e3, 114e3], 5: [31e3, 152e3], 6: [31e3, 152e3], 8: [76e3, 274e3], 10: [89e3, 274e3], 12: [93e3, 280e3], 15: [230e3, 420e3], 20: [300e3, 560e3] },
    batPerKwh: [19e3, 31e3],          // LiFePO4 48 В: бюджет 19–24 тыс., бренды 24,5–31 тыс. за кВт·ч
    panel: [13e3, 20e3],              // 580 Вт × 22–34 ₽/Вт
    install: { base: [25e3, 87e3], pvPerKw: [15e3, 20e3] }   // работа + материалы; монтаж панелей 15–20 тыс./кВт
  };
  var KITS = [
    { id: "start", name: "Старт", img: "kit_flat", inv: 6, bat: 5, pv: 0,
      for: "Квартира, дача или самое нужное в доме: котёл, холодильник, свет",
      loads: ["i-flame", "i-fridge", "i-bulb", "i-wifi", "i-laptop"], hours: "≈18 часов для самого нужного",
      equip: 130e3, turnkey: 170e3 },
    { id: "home", name: "Дом", img: "kit_house", inv: 6, bat: 10, pv: 0, hit: true,
      for: "Частный дом: котёл, насос, холодильник, свет, интернет, септик",
      loads: ["i-flame", "i-drop", "i-fridge", "i-bulb", "i-wifi", "i-wind", "i-shield"], hours: "сутки и больше: 23–35 часов",
      equip: 230e3, turnkey: 300e3 },
    { id: "homesun", name: "Дом + Солнце", img: "kit_solar", inv: 6, bat: 10, pv: 9,
      for: "Дом, который с весны до осени живёт на своей энергии, а зимой держит резерв",
      loads: ["i-flame", "i-drop", "i-fridge", "i-bulb", "i-wifi", "i-tv", "i-washer"], hours: "апрель–сентябрь — почти без ограничений; в декабре — 1,5–3 суток самого нужного",
      equip: 350e3, turnkey: 550e3 },
    { id: "auto", name: "Автономия", img: "kit_auto", inv: 12, bat: 20, pv: 16, gen: true,
      for: "Весь дом, кроме электроплиты и отопления. Плюс генератор с автозапуском",
      loads: ["i-flame", "i-drop", "i-fridge", "i-bulb", "i-wifi", "i-microwave", "i-washer", "i-shield"], hours: "26–43 часа от батарей; зимой генератор подзаряжает 2–3 часа в сутки",
      equip: 770e3, turnkey: 950e3 }
  ];

  /* ===================================================== варианты дизайна */
  var THEMES = ["night", "day", "pro"];
  function setTheme(t, push) {
    if (THEMES.indexOf(t) < 0) t = "night";
    document.documentElement.setAttribute("data-theme", t);
    $$("[data-set-theme]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-set-theme") === t)); });
    try { localStorage.setItem("svoysvet-theme", t); } catch (e) {}
    if (push) {
      try { var u = new URL(location.href); u.searchParams.set("v", t); history.replaceState(null, "", u); } catch (e) {}
    }
    var lazy = $(".hero__img.only-" + t);
    if (lazy) lazy.loading = "eager";
  }
  $$("[data-set-theme]").forEach(function (b) {
    b.addEventListener("click", function () { setTheme(b.getAttribute("data-set-theme"), true); placeHotspots(); });
  });
  setTheme(document.documentElement.getAttribute("data-theme"), false);

  // Панель вариантов сворачивается в маленькую кнопку (запоминается).
  var sw = $("#switcher");
  function fold(on) { sw && sw.classList.toggle("is-folded", on); try { localStorage.setItem("svoysvet-fold", on ? "1" : "0"); } catch (e) {} }
  if (sw) {
    $("#switcher-fold").addEventListener("click", function () { fold(true); });
    $("#switcher-open").addEventListener("click", function () { fold(false); });
    try { if (localStorage.getItem("svoysvet-fold") === "1") fold(true); } catch (e) {}
  }

  /* Выноски варианта «Мастер»: координаты заданы долями картинки, пересчитываем с учётом object-fit: cover. */
  function placeHotspots() {
    var hero = $(".hero"), img = $(".hero__img.only-pro");
    if (!hero || !img || document.documentElement.getAttribute("data-theme") !== "pro") return;
    var go = function () {
      var bw = hero.clientWidth, bh = hero.clientHeight, iw = img.naturalWidth || 2400, ih = img.naturalHeight || 1340;
      var s = Math.max(bw / iw, bh / ih), rw = iw * s, rh = ih * s;
      var ox = (bw - rw) * 0.60, oy = (bh - rh) * 0.5;   // как object-position: 60% 50%
      $$(".hotspot", hero).forEach(function (h) {
        h.style.left = (ox + (+h.getAttribute("data-x")) * rw) + "px";
        h.style.top = (oy + (+h.getAttribute("data-y")) * rh) + "px";
      });
    };
    if (img.complete && img.naturalWidth) go(); else img.addEventListener("load", go, { once: true });
  }
  window.addEventListener("resize", placeHotspots);
  placeHotspots();

  /* ===================================================== «что уточнить у Олега» */
  var tip = $("#tbc-tip");
  var tbcToggle = $("#tbc-toggle");
  function setTbc(on) {
    document.documentElement.classList.toggle("show-tbc", on);
    if (!on && tip) tip.hidden = true;
  }
  if (tbcToggle) {
    tbcToggle.addEventListener("change", function () { setTbc(tbcToggle.checked); });
    try { if (new URLSearchParams(location.search).get("tbc") === "1") { tbcToggle.checked = true; setTbc(true); } } catch (e) {}
  }
  document.addEventListener("mousemove", function (e) {
    if (!document.documentElement.classList.contains("show-tbc") || !tip) return;
    var el = e.target.closest && e.target.closest(".tbc");
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.getAttribute("data-tbc") || "Уточнить у Олега";
    tip.hidden = false;
    var x = Math.min(e.clientX + 16, window.innerWidth - 320), y = e.clientY + 18;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });

  /* ===================================================== шапка и меню */
  var header = $(".header");
  var navLinks = $$(".nav a");
  var onScroll = function () {
    header && header.classList.toggle("is-scrolled", window.scrollY > 10);
    if (window.scrollY < 300) navLinks.forEach(function (a) { a.classList.remove("is-active"); });   // наверху ничего не подсвечиваем
  };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  if ("IntersectionObserver" in window) {
    var secObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) { var s = $(a.getAttribute("href")); if (s) secObs.observe(s); });

    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); revObs.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    var revealAll = function () {
      $$(".reveal").forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + "ms"; revObs.observe(el); });
    };
    revealAll();
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ===================================================== «живая» карточка на первом экране */
  (function liveStatus() {
    var pct = 78, load = 0.42;
    var elPct = $("[data-live-pct]"), elBar = $("[data-live-bar]"), elLoad = $("[data-live-load]"), elLeft = $("[data-live-left]");
    if (!elPct) return;
    setInterval(function () {
      var t = document.documentElement.getAttribute("data-theme");
      load = Math.max(0.31, Math.min(0.58, load + (Math.random() - 0.5) * 0.06));
      if (t === "day") { pct = Math.min(100, pct + 0.4); } else { pct = Math.max(12, pct - 0.15); }
      var leftH = (10 * USABLE * pct / 100) / load;
      elPct.textContent = Math.round(pct) + "%";
      elBar.style.width = pct + "%";
      elLoad.textContent = fmt1(load) + " кВт";
      elLeft.textContent = t === "day" ? "заряжается" : "≈ " + Math.round(leftH) + " ч";
    }, 2200);
  })();

  /* ===================================================== комплекты */
  var kitsGrid = $("#kits-grid");
  function kitCard(k) {
    var loads = k.loads.map(function (i) { return '<span title=""><svg class="ic"><use href="#' + i + '"/></svg></span>'; }).join("");
    var pv = k.pv ? "<li><svg class=\"ic\"><use href=\"#i-panel\"/></svg>" + k.pv + " " + plural(k.pv, "панель", "панели", "панелей") + " · ≈" + fmt1(k.pv * PANEL_KW) + " кВт</li>" : "<li><svg class=\"ic\"><use href=\"#i-plug\"/></svg>Без панелей · заряд от сети</li>";
    return '<article class="kit reveal' + (k.hit ? " is-hit" : "") + '" id="kit-' + k.id + '">' +
      (k.hit ? '<span class="kit__badge"><svg class="ic"><use href="#i-star"/></svg>Чаще всего выбирают</span>' : "") +
      '<div class="kit__img"><img src="assets/img/' + k.img + '.webp" alt="Комплект «' + k.name + '»" loading="lazy"></div>' +
      '<div class="kit__body">' +
        '<h3 class="kit__name">' + k.name + "</h3>" +
        '<p class="kit__for">' + k.for + "</p>" +
        '<ul class="kit__spec">' +
          '<li><svg class="ic"><use href="#i-inverter"/></svg>Инвертор ' + k.inv + " кВт</li>" +
          '<li><svg class="ic"><use href="#i-battery"/></svg>Аккумулятор ' + k.bat + " кВт·ч</li>" + pv +
          (k.gen ? '<li><svg class="ic"><use href="#i-fuel"/></svg>Генератор 5–6 кВт с автозапуском</li>' : "") +
        "</ul>" +
        '<div class="kit__loads" aria-label="Что тянет">' + loads + "</div>" +
        '<p class="kit__hours"><svg class="ic"><use href="#i-clock"/></svg>' + k.hours + "</p>" +
        '<div class="kit__price"><small data-price-label>оборудование от</small><b data-price data-equip="' + k.equip + '" data-turnkey="' + k.turnkey + '">' + rub(k.equip) + "</b></div>" +
        '<a class="btn btn--ghost btn--block kit__btn" href="#contact" data-kit="' + k.name + '">Хочу этот комплект</a>' +
      "</div></article>";
  }
  if (kitsGrid) {
    kitsGrid.innerHTML = KITS.map(kitCard).join("");
    $$(".kit .reveal, .kit.reveal", kitsGrid).forEach(function (el) { el.classList.add("is-in"); });
  }
  function applyPriceMode() {
    var m = ($("input[name=pricemode]:checked") || {}).value || "equip";
    $$("[data-price]").forEach(function (b) { b.textContent = rub(+b.getAttribute(m === "turnkey" ? "data-turnkey" : "data-equip")); });
    $$("[data-price-label]").forEach(function (s) { s.textContent = m === "turnkey" ? "под ключ от" : "оборудование от"; });
  }
  $$("input[name=pricemode]").forEach(function (r) { r.addEventListener("change", applyPriceMode); });

  /* ===================================================== калькулятор */
  var applList = $("#appl-list");
  if (applList) {
    applList.innerHTML = APPL.map(function (a) {
      return '<label class="appl__item"><input type="checkbox" name="appl" value="' + a.id + '">' +
        '<span><svg class="ic"><use href="#' + a.icon + '"/></svg><b>' + a.name + "</b><small>" + a.hint + "</small></span></label>";
    }).join("");
  }
  function setDefaults(place) {
    var d = DEFAULTS[place] || [];
    $$("input[name=appl]").forEach(function (c) { c.checked = d.indexOf(c.value) >= 0; });
  }
  var pick = function (sizes, need) { for (var i = 0; i < sizes.length; i++) if (sizes[i] >= need) return sizes[i]; return null; };

  var lastCalc = null;
  function calc() {
    var place = ($("input[name=place]:checked") || {}).value || "house";
    var H = +(($("input[name=hours]:checked") || {}).value || 24);
    var solar = +(($("input[name=solar]:checked") || {}).value || 0);
    if (place === "flat" && solar > 0) solar = 0;
    var ids = $$("input[name=appl]:checked").map(function (c) { return c.value; });
    var sel = APPL.filter(function (a) { return ids.indexOf(a.id) >= 0; });

    var eDay = 0, runLight = 0, heavyMax = 0, surgeExtra = 0;
    sel.forEach(function (a) {
      eDay += a.w * a.h / 1000;
      if (a.heavy) heavyMax = Math.max(heavyMax, a.w); else runLight += a.w;
      surgeExtra = Math.max(surgeExtra, a.surge - a.w);
    });
    var peakRun = (runLight + heavyMax) / 1000;            // кВт: всё лёгкое + один мощный прибор
    var peakSurge = peakRun + surgeExtra / 1000;           // + самый тяжёлый пуск
    var pAvg = eDay / 24 + INV_IDLE;                       // кВт: приборы + собственный расход инвертора

    var invNeed = Math.max(peakRun * 1.25, peakSurge / 2, (place === "house" || ids.indexOf("pump") >= 0) ? 5 : 2.5);   // насос скважины — не меньше 5 кВт
    var inv = pick(INV_SIZES, invNeed);
    var pv = 0, pvKw = 0;
    if (solar === 1) pv = Math.max(4, Math.ceil(eDay / YIELD_SUMMER / PANEL_KW));
    if (solar === 2) pv = Math.max(6, Math.ceil(eDay / YIELD_SHOULDER / PANEL_KW));   // хватает с марта по сентябрь
    pv = Math.min(pv, 30); pvKw = pv * PANEL_KW;
    var eNeed = pAvg * H;                                  // аккумулятор считаем без надежды на солнце (зима)
    var bat = pick(BAT_SIZES, eNeed / USABLE) || BAT_SIZES[BAT_SIZES.length - 1];
    var custom = !inv || eNeed / USABLE > BAT_SIZES[BAT_SIZES.length - 1];
    inv = inv || INV_SIZES[INV_SIZES.length - 1];

    var runtime = bat * USABLE / pAvg;                     // часов без солнца
    var winterNet = eDay - pvKw * YIELD_WINTER, summerNet = eDay - pvKw * YIELD_SUMMER;

    // цена оборудования (диапазон)
    var pInv = PRICE.inv[inv] || PRICE.inv[20];
    var lo = pInv[0] + bat * PRICE.batPerKwh[0] + pv * PRICE.panel[0];
    var hi = pInv[1] + bat * PRICE.batPerKwh[1] + pv * PRICE.panel[1];
    var tlo = lo + PRICE.install.base[0] + pvKw * PRICE.install.pvPerKw[0];   // под ключ: + работа и материалы
    var thi = hi + PRICE.install.base[1] + pvKw * PRICE.install.pvPerKw[1];

    // генератор: бензин ≈ холостой расход + доля нагрузки (ориентир для 5–6 кВт)
    var fuel = H * (0.6 + 0.35 * pAvg);

    // подходящий комплект
    var kit = null;
    for (var i = 0; i < KITS.length; i++) {
      var k = KITS[i];
      if (k.inv >= inv && k.bat >= bat && (!solar || k.pv > 0)) { kit = k; break; }
    }
    if (!kit && H >= 72 && inv <= 12) {                    // многодневные аварии — комплект с генератором
      kit = KITS.filter(function (x) { return x.gen; })[0] || null;
      custom = false;
    }
    lastCalc = { place: place, H: H, solar: solar, sel: sel, inv: inv, bat: bat, pv: pv, pvKw: pvKw, runtime: runtime, pAvg: pAvg, kit: kit, custom: custom };

    if (!sel.length) {                                     // ничего не выбрано — пустое состояние
      lastCalc = null;
      $("#res-runtime").textContent = "—"; $("#res-runtime-unit").textContent = "";
      $("#res-gauge").style.setProperty("--p", "0");
      $("#res-runtime-text").textContent = "Отметьте приборы, которые должны работать без сети";
      $("#res-avg").textContent = "—";
      ["#res-inv", "#res-bat", "#res-pv", "#res-peak"].forEach(function (s) { $(s).textContent = "—"; });
      $("#res-solar").innerHTML = ""; $("#res-fuel").innerHTML = ""; $("#res-kit").innerHTML = ""; $("#res-surge").innerHTML = "";
      return;
    }

    // ---- вывод
    var hRound = runtime >= 10 ? Math.round(runtime) : Math.round(runtime * 10) / 10;
    var big = runtime >= 72 ? Math.round(runtime / 24 * 10) / 10 : hRound;
    $("#res-runtime").textContent = runtime >= 72 ? fmt1(big) : fmt1(hRound);
    $("#res-runtime-unit").textContent = runtime >= 72 ? plural(Math.round(big), "сутки", "суток", "суток") : plural(Math.round(hRound), "час", "часа", "часов");
    $("#res-gauge").style.setProperty("--p", Math.min(Math.log(1 + runtime) / Math.log(1 + 96), 1).toFixed(3));
    var txt = runtime >= 48 ? "Дом продержится без сети около " + fmt1(runtime / 24) + " суток"
            : runtime >= 20 ? "Дом продержится без сети примерно сутки"
            : "Дом продержится без сети около " + fmt1(hRound) + " " + plural(Math.round(hRound), "часа", "часов", "часов");
    if (!sel.length) txt = "Отметьте приборы, которые должны работать";
    $("#res-runtime-text").textContent = txt;
    $("#res-avg").textContent = nf2.format(pAvg) + " кВт";
    $("#res-inv").textContent = inv + " кВт";
    $("#res-bat").textContent = fmt1(bat) + " кВт·ч";
    $("#res-pv").textContent = pv ? pv + " × 580 Вт" : "не нужны";
    $("#res-peak").textContent = fmt1(peakSurge) + " кВт";

    // самый тяжёлый пуск — честно показываем, что он учтён
    var hardest = null;
    sel.forEach(function (a) { if (a.surge >= a.w * 1.5 && (!hardest || a.surge - a.w > hardest.surge - hardest.w)) hardest = a; });
    $("#res-surge").innerHTML = hardest
      ? '<svg class="ic"><use href="#i-check"/></svg><span>Пусковой ток учтён: ' + hardest.name.toLowerCase() + " при старте берёт до " + fmt1(hardest.surge / 1000) + " кВт, пик всего дома — до " + fmt1(peakSurge) + " кВт. Инвертор " + inv + " кВт выдержит: на несколько секунд он держит вдвое больше своей мощности.</span>"
      : "";

    var sol = $("#res-solar");
    if (pv) {
      var summerTxt = summerNet <= 0 ? "летом дом может жить от солнца" : "летом покроют ≈" + Math.round(pvKw * YIELD_SUMMER / eDay * 100) + "% потребления";
      var winterTxt = "в декабре — только ≈" + Math.max(1, Math.round(pvKw * YIELD_WINTER / eDay * 100)) + "%, зимой главный — аккумулятор";
      sol.innerHTML = '<svg class="ic"><use href="#i-sun"/></svg><span>Панели ≈' + fmt1(pvKw) + " кВт: " + summerTxt + "; " + winterTxt + ".</span>";
    } else { sol.innerHTML = ""; }
    $("#res-fuel").innerHTML = sel.length ? '<svg class="ic"><use href="#i-fuel"/></svg><span>Бензиновому генератору на ' + (H >= 24 ? fmt1(H / 24) + " " + plural(H / 24, "сутки", "суток", "суток") : H + " " + plural(H, "час", "часа", "часов")) + " понадобилось бы ≈" + Math.round(fuel) + " л бензина — и всё это время он бы шумел.</span>" : "";

    var kitBox = $("#res-kit");
    if (custom || !kit) {
      kitBox.innerHTML = "<small>Рекомендация</small><b>Индивидуальный проект</b><span>Оборудование ≈ " + rubRange(lo, hi) + "<br>Под ключ ≈ " + rubRange(tlo, thi) + "</span><a href=\"#contact\">Обсудить с инженером →</a>";
    } else {
      kitBox.innerHTML = "<small>Подходит комплект</small><b>«" + kit.name + "»</b><span>Ваш набор: оборудование ≈ " + rubRange(lo, hi) + "<br>Под ключ с монтажом ≈ " + rubRange(tlo, thi) + "</span><a href=\"#kit-" + kit.id + "\" data-goto-kit=\"" + kit.id + "\">Смотреть комплект →</a>";
    }
    var hint = $("#solar-hint");
    if (hint) hint.textContent = place === "flat"
      ? "В квартире панели обычно не ставят: система заряжается от сети и ждёт отключения."
      : "1 кВт панелей под Москвой даёт в июне около 4,3 кВт·ч в сутки, в декабре — около 0,6, а под снегом почти ничего. Поэтому зимой главный источник — аккумулятор, а с марта по сентябрь — солнце.";
    $$("input[name=solar]").forEach(function (r) { r.disabled = place === "flat" && r.value !== "0"; r.closest(".pill").style.opacity = r.disabled ? .45 : 1; });
  }

  var form = $("#calc-form");
  if (form) {
    setDefaults("house");
    form.addEventListener("change", function (e) {
      if (e.target.name === "place") {
        setDefaults(e.target.value);
        if (e.target.value === "flat") { var s0 = $("input[name=solar][value='0']"); if (s0) s0.checked = true; }
      }
      calc();
    });
    calc();
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-goto-kit]");
    if (!a) return;
    var id = "kit-" + a.getAttribute("data-goto-kit");
    $$(".kit").forEach(function (el) { el.classList.toggle("is-match", el.id === id); });
  });

  // «Получить точный расчёт» → заполнить заявку
  var msg = $("#f-msg"), placeSel = $("#f-place");
  function fillLead(extra) {
    if (!msg) return;
    var c = lastCalc;
    if (c) {
      var names = c.sel.map(function (a) { return a.name.toLowerCase(); }).join(", ");
      var hTxt = c.H >= 24 ? (c.H / 24) + " " + plural(c.H / 24, "сутки", "суток", "суток") : c.H + " " + plural(c.H, "час", "часа", "часов");
      msg.value = PLACE_RU[c.place] + ". Должно работать: " + (names || "—") + ". Продержаться без сети: " + hTxt + ". " +
        (c.pv ? "С солнечными панелями. " : "Без панелей. ") +
        "Предварительно: инвертор " + c.inv + " кВт, аккумулятор " + fmt1(c.bat) + " кВт·ч" + (c.pv ? ", " + c.pv + " " + plural(c.pv, "панель", "панели", "панелей") : "") + "." + (extra ? " " + extra : "");
      if (placeSel) placeSel.value = c.place;
    }
  }
  var cta = $("#calc-cta");
  if (cta) cta.addEventListener("click", function () { fillLead(); $("#contact").scrollIntoView({ behavior: "smooth" }); setTimeout(function () { var n = $("#f-name"); n && n.focus({ preventScroll: true }); }, 700); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-kit]");
    if (!b || !msg) return;
    msg.value = "Интересует комплект «" + b.getAttribute("data-kit") + "». " + (msg.value && msg.value.indexOf("Интересует") !== 0 ? msg.value : "");
  });

  /* ===================================================== заявка (демо) */
  var lead = $("#lead-form");
  if (lead) lead.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = true;
    ["f-name", "f-phone"].forEach(function (id) {
      var f = $("#" + id), wrap = f.closest(".field");
      var bad = !f.value.trim() || (id === "f-phone" && f.value.replace(/\D/g, "").length < 10);
      wrap.classList.toggle("is-error", bad); if (bad) ok = false;
    });
    if (!ok) return;
    $("#lead-ok").hidden = false;     // ничего не отправляем и не сохраняем
    setTimeout(function () { $("#lead-ok").hidden = true; lead.reset(); }, 6000);
  });

  /* ===================================================== схема потоков */
  var MODES = {
    grid: {
      title: "Сеть есть — аккумулятор ждёт",
      text: "Дом питается от сети как обычно. Инвертор держит аккумулятор заряженным на 100% и всё время следит за напряжением.",
      vals: { sun: "ночь", grid: "есть", bat: "100%", home: "1,2 кВт", homesrc: "питание от сети" },
      on: ["grid", "home", "bat"], off: []
    },
    outage: {
      title: "Сеть пропала — вы этого не заметили",
      text: "Инвертор за доли секунды переключил дом на аккумулятор. Котёл, насос, холодильник и интернет продолжают работать, свет не моргнул.",
      vals: { sun: "ночь", grid: "нет", bat: "разряд · 0,4 кВт", home: "0,4 кВт", homesrc: "от аккумулятора" },
      on: ["bat", "home"], off: ["grid"]
    },
    sun: {
      title: "Солнечный день — дом на своей энергии",
      text: "Панели питают дом напрямую, а излишки заряжают аккумулятор на вечер и ночь. Сеть нужна только как запас.",
      vals: { sun: "4,2 кВт", grid: "не нужна", bat: "заряд · 96%", home: "1,1 кВт", homesrc: "от солнца" },
      on: ["sun", "home", "bat"], off: []
    }
  };
  var stage = $("#flow-stage"), cap = $("#flow-caption"), auto = null, order = ["grid", "outage", "sun"];
  function setMode(m) {
    var d = MODES[m]; if (!d || !stage) return;
    stage.setAttribute("data-mode", m);
    $$(".flow__tabs .pill-btn").forEach(function (b) { var a = b.getAttribute("data-mode") === m; b.classList.toggle("is-active", a); b.setAttribute("aria-selected", String(a)); });
    Object.keys(d.vals).forEach(function (k) { var t = $('[data-flow-val="' + k + '"]', stage); if (t) t.textContent = d.vals[k]; });
    $$(".node", stage).forEach(function (n) { n.classList.remove("is-on", "is-off"); });
    d.on.forEach(function (k) { var n = $(".node--" + k, stage); n && n.classList.add("is-on"); });
    d.off.forEach(function (k) { var n = $(".node--" + k, stage); n && n.classList.add("is-off"); });
    $('[data-flow-cap="title"]', cap).textContent = d.title;
    $('[data-flow-cap="text"]', cap).textContent = d.text;
    cap.classList.remove("is-swap"); void cap.offsetWidth; cap.classList.add("is-swap");
  }
  $$(".flow__tabs .pill-btn").forEach(function (b) {
    b.addEventListener("click", function () { if (auto) { clearInterval(auto); auto = null; } setMode(b.getAttribute("data-mode")); });
  });
  if (stage) {
    setMode("grid");
    var idx = 0;
    var startAuto = function () { if (auto) return; auto = setInterval(function () { idx = (idx + 1) % order.length; setMode(order[idx]); }, 5200); };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { if (en[0].isIntersecting) startAuto(); }, { threshold: .4 }).observe(stage);
    } else startAuto();
  }
})();
