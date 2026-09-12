/* ============================================================
   Мисс Ванилька — интерактив лендинга. Без библиотек.
   ============================================================ */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const absTop = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };

  /* ── 0. Плавный скролл: инерция колеса ───────────────────── */
  /* Ведём реальный scrollTop лерпом к целевой позиции — sticky,
     параллакс и полоса прогресса читают scrollY как и раньше.
     scrollTo зовём с behavior:'auto', иначе CSS scroll-behavior:smooth
     начал бы сглаживать поверх нашего лерпа. */
  let sm = null;
  function smoothScroll() {
    if (reduced || matchMedia('(pointer: coarse)').matches) return;
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    sm = { target: scrollY, current: scrollY, ease: 0.11, active: false };
    document.documentElement.style.scrollBehavior = 'auto';  // сглаживаем сами

    addEventListener('wheel', e => {
      if (e.ctrlKey) return;                       // зум страницы не трогаем
      if (document.body.classList.contains('nav-fixed')) return;  // меню открыто/закрывается
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      sm.target = clamp(sm.target + e.deltaY * unit, 0, maxY());
      sm.active = true;
    }, { passive: false });

    /* внешний скролл (полоса, клавиши) — синхронизируем состояние */
    addEventListener('scroll', () => {
      if (!sm.active || Math.abs(scrollY - sm.current) > 2) sm.target = sm.current = scrollY;
    }, { passive: true });

    /* якоря ведём через target, чтобы не драться с нативным smooth */
    $$('a[href^="#"]').filter(a => !a.closest('.navmenu')).forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      sm.target = clamp(absTop(el), 0, maxY());
      sm.active = true;
    }));

    addEventListener('resize', () => { sm.target = clamp(sm.target, 0, maxY()); });
  }


  /* ── Полноэкранное меню: сайт «отъезжает», список выезжает ── */
  /* На открытии «замораживаем» сайт как position:fixed во весь экран
     (inner сдвинут на текущий скролл) — тогда scale идёт от центра
     вьюпорта, а не от середины 11000-пиксельной страницы. */
  function navMenu() {
    const toggle = $('#navToggle'), overlay = $('#navmenu'), close = $('#navClose'),
          scrim = $('#shellScrim'), shell = $('#shell'), inner = $('#shellInner');
    if (!toggle || !overlay || !shell || !inner) return;
    let open = false, y = 0;

    const openMenu = () => {
      if (open) return; open = true;
      y = scrollY;
      inner.style.transform = 'translateY(' + (-y) + 'px)';
      document.body.classList.add('nav-fixed');
      requestAnimationFrame(() => document.body.classList.add('nav-open'));
      toggle.setAttribute('aria-expanded', 'true');
      overlay.setAttribute('aria-hidden', 'false');
      close?.focus({ preventScroll: true });
    };

    const closeMenu = (restoreY = y) => {
      if (!open) return; open = false;
      document.body.classList.remove('nav-open');
      overlay.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        shell.removeEventListener('transitionend', onEnd);
        document.body.classList.remove('nav-fixed');
        inner.style.transform = '';
        scrollTo(0, restoreY);                    // сайт был fixed → возвращаем скролл
        toggle.focus({ preventScroll: true });
      };
      const onEnd = e => { if (e.target === shell && e.propertyName === 'transform') finish(); };
      shell.addEventListener('transitionend', onEnd);
      setTimeout(finish, 900);                     // фолбэк, если transitionend не придёт
    };

    toggle.addEventListener('click', () => open ? closeMenu() : openMenu());
    close?.addEventListener('click', () => closeMenu());
    scrim?.addEventListener('click', () => closeMenu());
    addEventListener('keydown', e => { if (e.key === 'Escape' && open) closeMenu(); });

    // пункт списка: закрываем и доезжаем к нужной секции
    $$('.navmenu__list a').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.getAttribute('href');
      const el = id && id.length > 1 && $(id);
      closeMenu(el ? absTop(el) : y);          // absTop корректен и в «замороженном» состоянии
    }));
    // контакты в меню — просто закрыть
    $$('.navmenu__foot a').forEach(a => a.addEventListener('click', () => closeMenu()));
  }

  function smoothStep() {
    if (!sm || !sm.active) return;
    if (document.body.classList.contains('is-locked') || document.body.classList.contains('nav-fixed')) {
      sm.target = sm.current = scrollY; sm.active = false; return;
    }
    sm.current = lerp(sm.current, sm.target, sm.ease);
    if (Math.abs(sm.target - sm.current) < 0.4) { sm.current = sm.target; sm.active = false; }
    scrollTo(0, sm.current);
  }

  /* ── 1. Разбивка текста на буквы / слова ─────────────────── */
  function splitText() {
    $$('[data-split]').forEach(el => {
      const mode = el.dataset.split;
      const step = parseFloat(el.dataset.stagger || 0.03);
      const src  = el.textContent.trim();
      el.textContent = '';

      if (mode === 'chars') {
        [...src].forEach((c, i) => {
          const s = document.createElement('span');
          s.className = 'ch';
          s.textContent = c === ' ' ? ' ' : c;
          s.style.setProperty('--d', (i * step) + 's');
          el.appendChild(s);
        });
      } else {
        src.split(' ').forEach((w, i) => {
          const s = document.createElement('span');
          s.className = 'wd';
          s.textContent = w;
          s.style.setProperty('--wi', i);
          el.appendChild(s);
          el.appendChild(document.createTextNode(' '));
        });
      }
    });

    // цитата — пословный проявляющийся текст
    const q = $('[data-words]');
    if (q) {
      const src = q.textContent.trim();
      q.textContent = '';
      src.split(' ').forEach(w => {
        const s = document.createElement('span');
        s.className = 'wd';
        s.textContent = w;
        q.appendChild(s);
        q.appendChild(document.createTextNode(' '));
      });
    }
  }

  /* ── 2. Прелоадер ────────────────────────────────────────── */
  function boot() {
    const boot = $('#boot'), num = $('#bootNum');
    if (!boot) return;
    document.body.classList.add('is-locked');

    let v = 0;
    const dur = reduced ? 200 : 1100;
    const t0 = performance.now();

    const tick = now => {
      const p = clamp((now - t0) / dur);
      v = Math.round(p * 100);
      num.textContent = String(v).padStart(2, '0');
      if (p < 1) return requestAnimationFrame(tick);
      boot.classList.add('is-done');
      document.body.classList.remove('is-locked');
      document.documentElement.classList.add('is-booted');
      setTimeout(() => boot.remove(), 1400);
    };
    requestAnimationFrame(tick);
  }

  /* ── 3. Курсор ───────────────────────────────────────────── */
  function cursor() {
    const c = $('#cursor');
    if (!c || matchMedia('(pointer: coarse)').matches) return;
    const label = $('.cursor__label', c);
    let x = -100, y = -100, tx = x, ty = y;

    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });

    (function loop() {
      x = lerp(x, tx, .18); y = lerp(y, ty, .18);
      c.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor]');
      if (t) { c.classList.add('is-active'); label.textContent = t.dataset.cursor; }
    });
    document.addEventListener('pointerout', e => {
      if (e.target.closest('[data-cursor]') && !e.relatedTarget?.closest('[data-cursor]')) {
        c.classList.remove('is-active');
      }
    });
  }

  /* ── 4. Магнитные кнопки ─────────────────────────────────── */
  function magnets() {
    if (reduced) return;
    $$('[data-magnet]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const mx = (e.clientX - r.left - r.width / 2) * .3;
        const my = (e.clientY - r.top - r.height / 2) * .4;
        el.style.transform = `translate(${mx}px, ${my}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ── 5. Появления по скроллу ─────────────────────────────── */
  /* Считаем сами в общем rAF-цикле: IntersectionObserver молчит
     в неактивных вкладках и превью-панелях. */
  let revealItems = [];
  function reveals() {
    revealItems = $$('[data-reveal], .foot__big').map((el, i) => {
      if (el.hasAttribute('data-reveal')) el.style.transitionDelay = (i % 4) * .07 + 's';
      return el;
    });
  }
  function revealTick() {
    if (!revealItems.length) return;
    const line = innerHeight * .88;
    revealItems = revealItems.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.top < line && r.bottom > 0) { el.classList.add('is-in'); return false; }
      return true;
    });
  }

  /* ── 6. Наклон стакана за курсором ───────────────────────── */
  function cupTilt() {
    const cup = $('#cupstage .cup');
    if (!cup || reduced) return;
    addEventListener('pointermove', e => {
      const nx = (e.clientX / innerWidth - .5) * 2;
      cup.style.setProperty('--tiltx', (nx * 6).toFixed(2) + 'deg');
    }, { passive: true });
  }

  /* ── 6b. Параллакс зёрен, выпечки и стакана ──────────────── */
  /* Пишем только --py/--pr, а transform целиком живёт в CSS —
     так базовый поворот и центрирование не затираются. */
  let paraItems = [];
  function parallax() {
    paraItems = $$('.float, #cupstage, .stage').map((el, i) => {
      el.style.setProperty('--i', i);
      return {
        el,
        speed: parseFloat(el.dataset.speed || 0),
        spin:  parseFloat(el.dataset.spin  || 0)
      };
    });
  }
  function parallaxTick(y) {
    if (reduced) return;
    for (const it of paraItems) {
      it.el.style.setProperty('--py', (y * it.speed).toFixed(1) + 'px');
      if (it.spin) it.el.style.setProperty('--pr', (y * it.spin / 900).toFixed(2) + 'deg');
    }
  }

  /* ── 7. Обжарка ──────────────────────────────────────────── */
  function roast() {
    const range = $('#roastRange');
    if (!range) return;

    const stops = [
      { at: 0,   name: 'СВЕТЛАЯ', notes: 'Жасмин, спелый персик, чёрный чай. Кислотность звенит как ложка о стакан.', fill: [201, 143, 82],  temp: 196, time: '09:10', acid: 6 },
      { at: 50,  name: 'СРЕДНЯЯ', notes: 'Молочный шоколад, лесной орех, чёрная смородина на самом излёте.',        fill: [138,  83, 48],  temp: 205, time: '11:40', acid: 4 },
      { at: 100, name: 'ТЁМНАЯ',  notes: 'Какао-бобы, чернослив, дым и карамельная горчинка в послевкусии.',        fill: [ 59,  34, 16],  temp: 228, time: '14:20', acid: 1 }
    ];

    const section = $('#roast');
    const level = $('#roastLevel'), notes = $('#roastNotes');
    const temp = $('#roastTemp'), time = $('#roastTime'), acid = $('#roastAcid');

    const apply = v => {
      const i  = v < 50 ? 0 : 1;
      const a  = stops[i], b = stops[i + 1];
      const t  = (v - a.at) / (b.at - a.at);
      const near = t < .5 ? a : b;

      const rgb = a.fill.map((c, k) => Math.round(lerp(c, b.fill[k], t)));
      const dark = rgb.map(c => Math.round(c * .42));
      section.style.setProperty('--bean-fill', `rgb(${rgb.join(',')})`);
      section.style.setProperty('--bean-line', `rgb(${dark.join(',')})`);
      // фото нельзя перекрасить как SVG — сдвигаем яркость/контраст/насыщенность
      const tt = v / 100;
      section.style.setProperty('--bean-filter',
        `brightness(${lerp(1.32, .58, tt).toFixed(3)}) `
        + `contrast(${lerp(.9, 1.16, tt).toFixed(3)}) `
        + `saturate(${lerp(1.06, .88, tt).toFixed(3)})`);

      if (level.textContent !== near.name) {
        level.textContent = near.name;
        notes.textContent = near.notes;
        level.animate(
          [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
          { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
      }
      temp.textContent = Math.round(lerp(a.temp, b.temp, t)) + ' °C';
      time.textContent = t < .5 ? a.time : b.time;
      const n = Math.round(lerp(a.acid, b.acid, t));
      acid.textContent = '●'.repeat(n) + '○'.repeat(7 - n);
    };

    range.addEventListener('input', () => apply(+range.value));
    apply(+range.value);
  }

  /* ── 8. Часы работы: сегодня и «открыто сейчас» ──────────── */
  // здесь есть логика: 
  //    вычисляется день недели, на его основе меняется надпись "открыто до ##:##"
  //    смотри словарь table, где ключ - день недели, значение - массив[с какого времени открыто: когда закрытие]
  function hours() {
    const table = { 1: [8, 21], 2: [8, 21], 3: [8, 21], 4: [8, 21], 5: [8, 21], 6: [9, 21], 0: [9, 21] };
    const now = new Date(), d = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
    const row = $(`#hoursBody tr[data-day="${d}"]`);
    if (row) row.classList.add('is-today');

    const [o, c] = table[d];
    const open = h >= o && h < c;
    const box = $('#status'), txt = $('#statusTxt');
    if (!box) return;
    box.classList.toggle('is-open', open);
    txt.textContent = open
      ? `открыто сейчас · до ${String(c).padStart(2, '0')}:00`
      : `закрыто · откроемся в ${String(table[(d + (h >= c ? 1 : 0)) % 7][0]).padStart(2, '0')}:00`;
  }

  /* ── 9. Скролл-сцены: тикер, горизонталь, цитата, полоса ── */
  function scenes() {
    const track   = $('#tickerTrack');
    const row     = $('.ticker__row');
    const rTrack  = $('#ritualTrack');
    const rSect   = $('#ritual');
    const rBar    = $('#ritualBar');
    const bar     = $('#scrollbarFill');
    const qWords  = $$('.quote__text .wd');
    const qSect   = $('#quote');

    let off = 0, last = scrollY, vel = 0, rx = 0, rxTarget = 0;
    const desktop = () => innerWidth > 900;

    /* ширину «Ритуала» меряем по правому краю последней панели:
       scrollWidth флекс-контейнера не учитывает правый padding */
    let ritualDist = 0;
    const measure = () => {
      if (!rTrack || !rTrack.lastElementChild) return;
      const prev = rTrack.style.transform;
      rTrack.style.transform = 'none';
      const pad = parseFloat(getComputedStyle(rTrack).paddingLeft) || 0;
      const contentW = rTrack.lastElementChild.getBoundingClientRect().right
                     - rTrack.getBoundingClientRect().left;
      ritualDist = Math.max(0, contentW + pad - innerWidth);
      rTrack.style.transform = prev;
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);

    const frame = () => {
      smoothStep();
      const y = scrollY;
      revealTick();
      parallaxTick(y);
      vel = lerp(vel, (y - last) * .6, .12);
      last = y;

      /* полоса прогресса */
      if (bar) {
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      }

      /* бегущая строка + скос от скорости скролла */
      if (track && row) {
        const w = row.offsetWidth;
        off -= 1.1 + Math.abs(vel) * .35;
        if (off <= -w) off += w;
        const skew = clamp(vel * .12, -9, 9);
        track.style.transform = `translate3d(${off}px,0,0) skewX(${skew}deg)`;
      }

      /* горизонтальная сцена «Ритуал» */
      if (rTrack && rSect && desktop()) {
        const r = rSect.getBoundingClientRect();
        const span = rSect.offsetHeight - innerHeight;
        const p = clamp(-r.top / span);
        rxTarget = -ritualDist * p;
        rx = lerp(rx, rxTarget, .1);
        rTrack.style.transform = `translate3d(${rx}px,0,0)`;
        if (rBar) rBar.style.width = (p * 100) + '%';
      }

      /* цитата — слова проявляются по мере прохода секции */
      if (qWords.length && qSect) {
        const r = qSect.getBoundingClientRect();
        const p = clamp((innerHeight * .85 - r.top) / (innerHeight * .7));
        const n = Math.round(p * qWords.length);
        qWords.forEach((w, i) => w.classList.toggle('on', i < n));
      }

      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ── старт ───────────────────────────────────────────────── */
  splitText();
  smoothScroll();
  if (reduced) $$('.wavelead svg').forEach(s => s.pauseAnimations && s.pauseAnimations());
  navMenu();
  cursor();
  magnets();
  reveals();
  cupTilt();
  parallax();
  roast();
  hours();
  scenes();
  boot();
})();
