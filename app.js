/* ==========================================================================
 * app.js —— 渲染 + 动效 + 交互
 * --------------------------------------------------------------------------
 *   1. 渲染（把 data.js 的数据变成 DOM）
 *   2. 首屏三维场景（Three.js；无 WebGL 时回退到 SVG 版本）
 *   3. 八大书院：旋转画廊（拖动 / 方向键 / 按钮 / 点击展开）
 *   4. 吉祥物对话（本地知识库 → 可一键换成真实大模型）
 * ========================================================================== */
(function () {
  'use strict';

  const D = window.SEU_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MASCOT_NAME = (D.mascot && D.mascot.name) || '东大鼠鼠';

  /* 名字统一写进 DOM：想改名只改 data.js 的 mascot.name */
  function applyMascotName() {
    $$('.mascot-label').forEach(function (el) {
      el.textContent = MASCOT_NAME;
    });
    const head = $('.chat-head strong');
    if (head) head.textContent = MASCOT_NAME;
    const en = $('.chat-head small');
    if (en && D.mascot && D.mascot.en) en.textContent = D.mascot.en;
    const btn = $('#mascotBtn');
    if (btn) btn.setAttribute('aria-label', '和' + MASCOT_NAME + '聊聊');
  }

  /* ======================================================================
   * 0. 名句：首页副标题与尾声各随机取一句
   * ==================================================================== */
  function renderQuote(el, q) {
    if (!el || !q) return;
    el.textContent = '';
    const span = document.createElement('span');
    span.className = 'q-text';
    span.textContent = q.text;
    el.appendChild(span);
    if (q.source) {
      const cite = document.createElement('cite');
      cite.className = 'q-src';
      cite.textContent = '—— ' + q.source;
      el.appendChild(cite);
    }
  }

  function initQuotes() {
    const list = (D.quotes || []).filter(function (q) {
      return q && q.text;
    });
    if (!list.length) return;
    const pick = function () {
      return list[Math.floor(Math.random() * list.length)];
    };
    renderQuote($('#heroQuote'), pick());
    renderQuote($('#outroQuote'), pick());
  }
  /* ======================================================================
   * 1. 渲染
   * ==================================================================== */

  /* ------------------------------------------- 1.1 校史：左时间轴 / 右详情 */
  const ERA_ICONS = {
    bg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3.1 1.9"/></svg>',
    events:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.2v17.6"/><path d="M6 4.6h11.4l-2.3 4 2.3 4H6z"/></svg>',
    subject:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.6C10 5 7.6 4.6 4.6 5.4v12.1c3-.8 5.4-.4 7.4 1.1 2-1.5 4.4-1.9 7.4-1.1V5.4c-3-.8-5.4-.4-7.4 1.2z"/><path d="M12 6.6v12.1"/></svg>',
    people:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.2" cy="8.4" r="3"/><path d="M3.6 19.2c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2"/><circle cx="17.2" cy="9.6" r="2.4"/><path d="M16.2 14.3c2.6.2 4.4 2.2 4.4 4.9"/></svg>',
    outcome:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.2"/><path d="M8.7 13.5 7.1 21l4.9-2.6L16.9 21l-1.6-7.5"/></svg>',
  };

  /* 印章：有真实校徽图片就用图片，没有就用生成的校名章 */
  function eraSeal(e) {
    if (e.emblem) {
      return `<img class="era-seal" src="${e.emblem}" alt="${e.name}时期校徽" />`;
    }
    return `
      <svg class="era-seal" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="#FFFDF4" stroke="#C9992E" stroke-width="2" />
        <circle cx="50" cy="50" r="38.5" fill="none" stroke="#C9992E" stroke-width="1" opacity=".5" />
        <text x="50" y="47" text-anchor="middle" font-size="27" fill="#7A5A14"
              font-family="'Songti SC','STSong',serif" letter-spacing="1.5">${e.seal}</text>
        <text x="50" y="70" text-anchor="middle" font-size="9.5" fill="#A9832F"
              letter-spacing="2">${e.year}</text>
      </svg>`;
  }

  function eraHTML(e) {
    return `
      <div class="era-banner">
        <div class="era-head">
          <p class="era-kicker">${e.tag} · ${e.range}</p>
          <h3>${e.name}${e.emblem2 ? `<img class="era-seal-mini" src="${e.emblem2}" alt="" aria-hidden="true" />` : ""}</h3>
          <span class="era-chip">${e.year} 年</span>
        </div>
        ${eraSeal(e)}
      </div>
      <div class="era-body">
        <section class="era-block">
          <h4><span class="ico">${ERA_ICONS.bg}</span>历史背景</h4>
          <p>${e.bg}</p>
        </section>
        <section class="era-block">
          <h4><span class="ico">${ERA_ICONS.events}</span>关键沿革事件</h4>
          <ul class="era-events">${e.events.map((t) => `<li>${t}</li>`).join('')}</ul>
        </section>
        <section class="era-block">
          <h4><span class="ico">${ERA_ICONS.subject}</span>学科建设</h4>
          <p>${e.subject}</p>
        </section>
        <section class="era-block">
          <h4><span class="ico">${ERA_ICONS.people}</span>代表名师与校友</h4>
          <div class="era-people">${e.people.map((n) => `<span>${n}</span>`).join('')}</div>
          ${e.peopleNote ? `<p class="era-note">${e.peopleNote}</p>` : ''}
        </section>
        <section class="era-block">
          <h4><span class="ico">${ERA_ICONS.outcome}</span>时代办学成果</h4>
          <p>${e.outcome}</p>
        </section>
      </div>`;
  }

  function renderEras() {
    const list = $('#eraList');
    const panel = $('#eraPanel');
    if (!list || !panel || !D.eras || !D.eras.length) return;

    list.innerHTML =
      '<span class="era-cursor" id="eraCursor" aria-hidden="true"></span>' +
      D.eras
        .map(
          (e, i) => `
        <button class="era-item${i === 0 ? ' is-active' : ''}" type="button" role="tab"
                data-i="${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
          <span class="era-item-year">${e.year}</span>
          <span class="era-item-name">${e.name}</span>
          <span class="era-item-tag">${e.tag}</span>
        </button>`
        )
        .join('');

    panel.innerHTML = eraHTML(D.eras[0]);

    const items = $$('.era-item', list);
    const cursor = $('#eraCursor');
    let cur = 0;

    function moveCursor() {
      const item = items[cur];
      if (!item || !cursor) return;
      cursor.style.height = item.offsetHeight + 'px';
      cursor.style.transform = 'translateY(' + item.offsetTop + 'px)';
    }

    function keepVisible(item) {
      const smooth = prefersReduced ? 'auto' : 'smooth';
      // 竖屏时列表是横向滚动，横竖两个方向都照顾到
      if (list.scrollHeight > list.clientHeight + 4) {
        const top = item.offsetTop;
        const bottom = top + item.offsetHeight;
        const view = list.clientHeight;
        if (top < list.scrollTop) {
          list.scrollTo({ top: Math.max(0, top - 10), behavior: smooth });
        } else if (bottom > list.scrollTop + view) {
          list.scrollTo({ top: bottom - view + 10, behavior: smooth });
        }
      }
      if (list.scrollWidth > list.clientWidth + 4) {
        const left = item.offsetLeft;
        const right = left + item.offsetWidth;
        const view = list.clientWidth;
        if (left < list.scrollLeft) {
          list.scrollTo({ left: Math.max(0, left - 12), behavior: smooth });
        } else if (right > list.scrollLeft + view) {
          list.scrollTo({ left: right - view + 12, behavior: smooth });
        }
      }
    }

    function select(i) {
      if (i < 0 || i >= items.length || i === cur) return;
      const dir = i > cur ? 1 : -1;
      cur = i;

      items.forEach(function (el, k) {
        el.classList.toggle('is-active', k === i);
        el.setAttribute('aria-selected', String(k === i));
        el.tabIndex = k === i ? 0 : -1;
      });
      moveCursor();
      keepVisible(items[i]);

      panel.innerHTML = eraHTML(D.eras[i]);

      if (!prefersReduced) {
        panel.animate(
          [
            { opacity: 0, transform: 'translateY(' + dir * 16 + 'px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 430, easing: 'cubic-bezier(.2,.9,.2,1)' }
        );
        $$('.era-block', panel).forEach(function (b, k) {
          b.animate(
            [
              { opacity: 0, transform: 'translateX(' + dir * 14 + 'px)' },
              { opacity: 1, transform: 'translateX(0)' },
            ],
            {
              duration: 380,
              delay: 55 + k * 55,
              easing: 'cubic-bezier(.2,.9,.2,1)',
              fill: 'backwards',
            }
          );
        });
      }
    }

    items.forEach(function (el, i) {
      el.addEventListener('click', function () {
        select(i);
      });
      el.addEventListener('keydown', function (ev) {
        let next = -1;
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') next = Math.min(items.length - 1, i + 1);
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') next = Math.max(0, i - 1);
        if (next < 0) return;
        ev.preventDefault();
        select(next);
        items[next].focus();
      });
    });

    requestAnimationFrame(moveCursor);
    window.addEventListener('resize', moveCursor);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(moveCursor).catch(function () {});
    }
  }

  function renderRed() {
    const box = $('#redGrid');
    if (!box) return;
    box.innerHTML = D.red
      .map(
        (it) => `
      <article class="rcard reveal">
        <div class="rkey">${it.key}</div>
        <h3>${it.title}</h3>
        <p class="rsub">${it.sub}</p>
        <p>${it.text}</p>
      </article>`
      )
      .join('');
  }

  function collegeCardHTML(c, i) {
    return `
      <button class="college" data-index="${i}" style="--hue:${c.hue}" aria-label="展开 ${c.name}">
        <p class="c-year">${c.year}</p>
        <h3>${c.name}</h3>
        <p class="c-en">${c.en}</p>
        <p class="c-from">${c.from}</p>
        <div class="c-tags">${c.tags.slice(0, 3).map((t) => `<span>${t}</span>`).join('')}</div>
        <p class="c-more">展开书院 <i>→</i></p>
      </button>`;
  }

  function renderColleges() {
    const ring = $('#ring');
    if (!ring) return;
    ring.innerHTML = D.colleges
      .map(
        (c, i) => `
      <div class="slot" style="--i:${i}">
        <div class="bob" style="--dur:${(6.4 + (i % 5) * 0.62).toFixed(2)}s;--delay:${(-(
          i * 1.13 + 0.4
        )).toFixed(2)}s">
          ${collegeCardHTML(c, i)}
        </div>
      </div>`
      )
      .join('');
  }

  /* ======================================================================
   * 2. 首屏三维场景
   * ==================================================================== */
  let hallScene = null;

  /* ---- 2a. 回退版：SVG 分部件生成（无 WebGL 时用） ---- */
  const hall = () => $('#hall');

  function buildHallSVG() {
    const el = hall();
    if (!el) return;
    el.classList.remove('built');
    void el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.classList.add('built');
      const stage = $('#hallFallback');
      stage?.classList.remove('building');
      void stage?.offsetWidth;
      stage?.classList.add('building');
      window.setTimeout(() => stage?.classList.remove('building'), 2400);
    });
  }

  function watchHallSVG() {
    const el = hall();
    if (!el) return;
    if (prefersReduced) {
      el.classList.add('built');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            buildHallSVG();
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
  }

  function hallParallaxSVG() {
    if (prefersReduced) return;
    const stage = $('#hallFallback');
    const tilt = $('#hallTilt');
    if (!stage || !tilt) return;
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg');
      tilt.style.setProperty('--rx', (-py * 6).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', () => {
      tilt.style.setProperty('--ry', '0deg');
      tilt.style.setProperty('--rx', '0deg');
    });
  }

  function makeDust() {
    const box = $('#dust');
    if (!box || prefersReduced) return;
    let html = '';
    for (let i = 0; i < 16; i++) {
      html += `<i style="left:${(8 + Math.random() * 84).toFixed(1)}%;bottom:${(
        Math.random() * 45
      ).toFixed(1)}%;animation-duration:${(6 + Math.random() * 7).toFixed(
        1
      )}s;animation-delay:${(Math.random() * 9).toFixed(1)}s"></i>`;
    }
    box.innerHTML = html;
  }

  /* ---- 2b. 优先走 Three.js ---- */
  function initHero() {
    const canvas = $('#sceneCanvas');
    const fallback = $('#hallFallback');
    const btn = $('#rebuildBtn');

    if (canvas && typeof window.initHallScene === 'function') {
      hallScene = window.initHallScene(canvas);
    }

    if (hallScene) {
      if (fallback) fallback.hidden = true;
      canvas.style.display = 'block';
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(
          (es) => es.forEach((e) => hallScene.setActive(e.isIntersecting)),
          { threshold: 0.02 }
        ).observe(canvas);
      }
      btn?.addEventListener('click', () => hallScene.replay());
      return;
    }

    /* ---- 回退 ---- */
    if (canvas) canvas.style.display = 'none';
    if (fallback) fallback.hidden = false;
    makeDust();
    hallParallaxSVG();
    watchHallSVG();
    btn?.addEventListener('click', () => buildHallSVG());
  }

  /* ======================================================================
   * 3. 八大书院：旋转画廊
   * ==================================================================== */
  function initCarousel() {
    const carousel = $('#carousel');
    const ring = $('#ring');
    if (!carousel || !ring) return;

    const N = D.colleges.length;
    const STEP = 360 / N;
    const slots = $$('.slot', ring);
    const label = $('#rotLabel');

    let rot = 0;
    let target = -STEP * 0.0;
    let velocity = 0;
    let autoSpeed = prefersReduced ? 0 : 3.4; // 度/秒
    let dragging = false;
    let captured = false;
    let dragId = null;
    let hovering = false;
    let startX = 0;
    let startTarget = 0;
    let moved = 0;
    let lastX = 0;
    let lastT = performance.now();
    let frontIdx = -1;

    /* ---- 拖动 ---- */
    /* 注意：不能在 pointerdown 时就 setPointerCapture ——
       捕获会把随后的 click 改派到容器身上，卡片自己的点击就永远收不到。
       改成「真的拖起来（位移超过阈值）才开始捕获」，单击就能正常落到卡片上。 */
    carousel.addEventListener('pointerdown', (e) => {
      dragging = true;
      captured = false;
      dragId = e.pointerId;
      moved = 0;
      startX = e.clientX;
      lastX = e.clientX;
      startTarget = target;
      velocity = 0;
      carousel.classList.add('dragging');
    });

    carousel.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const travelled = Math.abs(e.clientX - startX);
      if (travelled > Math.max(moved, 0)) moved = travelled;
      if (!captured && travelled > 6) {
        captured = true;
        if (carousel.setPointerCapture) {
          try {
            carousel.setPointerCapture(dragId);
          } catch (err) {
            /* 某些浏览器在指针已释放时会抛错，忽略即可 */
          }
        }
      }
      target = startTarget + (e.clientX - startX) * 0.34;
      velocity = dx * 0.34 * 0.6;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      captured = false;
      carousel.classList.remove('dragging');
      // 惯性
      velocity = Math.max(-14, Math.min(14, velocity));
    }
    carousel.addEventListener('pointerup', endDrag);
    carousel.addEventListener('pointercancel', endDrag);
    carousel.addEventListener('mouseleave', endDrag);

    carousel.addEventListener('mouseenter', () => (hovering = true));
    carousel.addEventListener('mouseleave', () => (hovering = false));

    /* ---- 按钮 / 键盘 ---- */
    $('#rotPrev')?.addEventListener('click', () => {
      target += STEP;
      velocity = 0;
    });
    $('#rotNext')?.addEventListener('click', () => {
      target -= STEP;
      velocity = 0;
    });

    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        target += STEP;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        target -= STEP;
        e.preventDefault();
      }
    });

    /* ---- 点击卡片 ---- */
    $$('.college', ring).forEach((card) => {
      card.addEventListener('click', (e) => {
        // 拖动后松手的那一下不算点击
        if (moved > 8) {
          e.preventDefault();
          return;
        }
        const i = Number(card.dataset.index);
        // 先把这张卡转到正面，再展开
        target = -i * STEP;
        window.setTimeout(() => openCollege(i, card), prefersReduced ? 0 : 240);
      });
    });

    /* ---- 每帧更新 ---- */
    function loop(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      if (!dragging) {
        if (autoSpeed && !hovering) target -= autoSpeed * dt;
        target += velocity;
        velocity *= 0.93;
        if (Math.abs(velocity) < 0.02) velocity = 0;
      }

      rot += (target - rot) * (dragging ? 0.3 : 0.085);

      ring.style.setProperty('--rot', rot.toFixed(2) + 'deg');

      // 按角度算前后景深浅
      let best = -2;
      let bestI = 0;
      for (let i = 0; i < slots.length; i++) {
        const world = i * STEP + rot;
        const a = ((((world + 540) % 360) + 360) % 360) - 180; // -180..180
        const rad = (a * Math.PI) / 180;
        const c = Math.cos(rad); // 1 = 正对镜头
        const t = (1 - c) / 2; // 0 前，1 后
        const el = slots[i];
        el.style.opacity = (1 - t * 0.7).toFixed(3);
        el.style.filter = `brightness(${(1 - t * 0.36).toFixed(3)}) saturate(${(
          1 - t * 0.34
        ).toFixed(2)})`;
        if (c > best) {
          best = c;
          bestI = i;
        }
      }

      if (label && bestI !== frontIdx && best > 0.55) {
        frontIdx = bestI;
        label.textContent =
          String(bestI + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0') + ' · ' +
          D.colleges[bestI].name;
      }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ======================================================================
   * 4. 书院详情弹层
   * ==================================================================== */
  const modal = () => $('#modal');
  const modalCard = () => $('#modalCard');
  let currentIndex = 0;
  let lastTrigger = null;

  function fillModal(i) {
    const c = D.colleges[i];
    if (!c) return;
    const card = modalCard();
    card.style.setProperty('--hue', c.hue);
    $('#mTitle').textContent = c.name;
    $('#mEn').textContent = c.en;
    $('#mFrom').textContent = c.from;
    $('#mYear').textContent = c.year;

    const focusEl = $('#mFocus');
    if (c.focus) {
      focusEl.textContent = c.focus;
      focusEl.classList.remove('m-empty');
    } else {
      focusEl.textContent = '该书院培养方向请以学校官方发布为准（此处留给你补充素材）。';
      focusEl.classList.add('m-empty');
    }
    $('#mTags').innerHTML = c.tags.map((t) => `<span>${t}</span>`).join('');
    $('#mIdx').textContent = `${i + 1} / ${D.colleges.length}`;
  }

  function openCollege(i, trigger) {
    const m = modal();
    const card = modalCard();
    if (!m || !card) return;
    currentIndex = i;
    lastTrigger = trigger || null;
    fillModal(i);

    m.hidden = false;
    const from = trigger ? trigger.getBoundingClientRect() : null;
    m.classList.add('open');

    if (from && !prefersReduced) {
      const to = card.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const sx = Math.max(0.3, Math.min(1.1, from.width / to.width));
      const sy = Math.max(0.3, Math.min(1.1, from.height / to.height));
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.35 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 560, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
    }
    $('#mClose')?.focus({ preventScroll: true });
  }

  function closeCollege() {
    const m = modal();
    const card = modalCard();
    if (!m || m.hidden) return;
    m.classList.remove('open');
    const done = () => {
      m.hidden = true;
      lastTrigger?.focus({ preventScroll: true });
    };
    if (!prefersReduced) {
      const anim = card.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: 'translateY(10px) scale(.96)', opacity: 0 },
        ],
        { duration: 240, easing: 'ease-in' }
      );
      anim.onfinish = done;
    } else {
      done();
    }
  }

  function stepCollege(dir) {
    const n = D.colleges.length;
    currentIndex = (currentIndex + dir + n) % n;
    fillModal(currentIndex);
    if (!prefersReduced) {
      modalCard().animate(
        [
          { opacity: 0.2, transform: `translateX(${dir * 26}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 380, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
    }
  }

  function modalEvents() {
    const m = modal();
    if (!m) return;
    $('#mClose')?.addEventListener('click', closeCollege);
    $('#mBackdrop')?.addEventListener('click', closeCollege);
    $('#mPrev')?.addEventListener('click', () => stepCollege(-1));
    $('#mNext')?.addEventListener('click', () => stepCollege(1));
    document.addEventListener('keydown', (e) => {
      if (m.hidden) return;
      if (e.key === 'Escape') closeCollege();
      if (e.key === 'ArrowLeft') stepCollege(-1);
      if (e.key === 'ArrowRight') stepCollege(1);
    });
  }

  /* ======================================================================
   * 5. 吉祥物对话
   * ==================================================================== */
  /* ------------------------------------------------------------------
   * 👉 想接真实大模型，只改这一行：
   *    指向你自己的后端接口（Vercel / Cloudflare Worker / 腾讯云函数…）
   *    千万不要把 API Key 写进前端！
   * ------------------------------------------------------------------ */
  const AI_ENDPOINT = null; // 例如 'https://your-worker.workers.dev/api/chat'

  function localAnswer(text) {
    const q = text.toLowerCase();
    let best = null;
    let score = 0;
    for (const item of D.qa) {
      let s = 0;
      for (const k of item.k) {
        if (q.includes(k.toLowerCase())) s += k.length;
      }
      if (s > score) {
        score = s;
        best = item;
      }
    }
    return best ? best.a : D.fallback;
  }

  async function askAI(text) {
    if (!AI_ENDPOINT) {
      await new Promise((r) => setTimeout(r, 420 + Math.random() * 320));
      return localAnswer(text);
    }
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              '你是东南大学校史小狮子，只回答与东南大学校史、红色文化、八大书院、校园相关的问题，' +
              '语气亲切、简洁，每次回答不超过 120 字；不确定的内容明确说"建议以校史馆官方资料为准"。',
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    return data.reply || data.text || '我暂时没想好怎么回答。';
  }

  const log = () => $('#chatLog');
  let greeted = false;
  let busy = false;

  function bubble(who, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + who;
    el.textContent = text;
    log().appendChild(el);
    log().scrollTop = log().scrollHeight;
    return el;
  }

  function typingIndicator() {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    log().appendChild(el);
    log().scrollTop = log().scrollHeight;
    return el;
  }

  function typeOut(el, text) {
    return new Promise((resolve) => {
      if (prefersReduced) {
        el.textContent = text;
        resolve();
        return;
      }
      let i = 0;
      el.textContent = '';
      const timer = setInterval(() => {
        i += 2;
        el.textContent = text.slice(0, i);
        log().scrollTop = log().scrollHeight;
        if (i >= text.length) {
          clearInterval(timer);
          resolve();
        }
      }, 22);
    });
  }

  async function send(text) {
    if (busy || !text.trim()) return;
    busy = true;
    bubble('me', text);
    const input = $('#chatInput');
    input.value = '';
    const ph = typingIndicator();
    try {
      const answer = await askAI(text);
      ph.remove();
      await typeOut(bubble('bot', ''), answer);
    } catch (err) {
      ph.remove();
      bubble('bot', '连接失败了（' + err.message + '）。先用本地知识库回答你：' + localAnswer(text));
    } finally {
      busy = false;
      input.focus();
    }
  }

  function chatEvents() {
    const chat = $('#chat');
    if (!chat) return;
    const openBtn = $('#mascotBtn');
    const input = $('#chatInput');

    openBtn?.addEventListener('click', () => {
      const isOpen = chat.classList.toggle('open');
      openBtn.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        if (!greeted) {
          greeted = true;
          typeOut(
            bubble('bot', ''),
            '你好，我是' + MASCOT_NAME + '。大礼堂、梅庵、八大书院、校训……想问什么都可以。'
          );
        }
        setTimeout(() => input?.focus(), 220);
      }
    });

    $('#chatClose')?.addEventListener('click', () => {
      chat.classList.remove('open');
      openBtn?.setAttribute('aria-expanded', 'false');
      openBtn?.focus();
    });

    $('#chatForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      send(input.value);
    });

    $$('.chat-chips button').forEach((b) => {
      b.addEventListener('click', () => send(b.textContent.trim()));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chat.classList.contains('open')) {
        chat.classList.remove('open');
        openBtn?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ======================================================================
   * 5.5 东大鼠鼠的随机小动作
   * ----------------------------------------------------------------------
   * 六个动作轮流随机触发：摇尾巴 / 挥手 / 眨眼 / 歪头 / 跳一下 / 转个圈。
   * 动效写在 theme-3d.css 的 .mascot-svg.act-* 里。
   * ==================================================================== */
  const MASCOT_ACTS = {
    'act-wag': 1300,
    'act-wave': 1300,
    'act-tilt': 980,
    'act-hop': 720,
    'act-spin': 920,
    'act-blink': 400,
  };

  function mascotActions() {
    const btn = $('#mascotBtn');
    const svg = $('#mascotSvg');
    if (!btn || !svg) return;

    const names = Object.keys(MASCOT_ACTS);
    const targets = [svg].concat([$('.mascot-body', btn)]).filter(Boolean);
    let timers = [];

    function clearAll() {
      timers.forEach(clearTimeout);
      timers = [];
      targets.forEach(function (el) {
        el.classList.remove.apply(el.classList, names);
      });
    }

    function play(name) {
      const ms = MASCOT_ACTS[name];
      if (!ms) return;
      clearAll();
      const el = name === 'act-hop' || name === 'act-spin' ? $('.mascot-body', btn) : svg;
      void el.offsetWidth; // 强制重排，保证同名动作能重播
      el.classList.add(name);
      timers.push(
        setTimeout(function () {
          el.classList.remove(name);
        }, ms)
      );
    }

    if (prefersReduced) return;

    // 眨眼单独走一条更勤快的时钟
    const blink = setInterval(function () {
      if (!document.hidden) play('act-blink');
    }, 4600);

    // 其余动作随机间隔 3.2 ~ 7 秒
    let loopTimer = 0;
    const pool = ['act-wag', 'act-wave', 'act-tilt', 'act-hop', 'act-spin'];
    (function schedule() {
      loopTimer = setTimeout(function () {
        if (!document.hidden) {
          play(pool[Math.floor(Math.random() * pool.length)]);
        }
        schedule();
      }, 3200 + Math.random() * 3800);
    })();

    // 点它的时候开心地跳一下
    btn.addEventListener('click', function () {
      play('act-hop');
    });

    // 页面隐藏时收工，别在后台空转
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearAll();
      } else {
        void 0;
      }
    });

    return function dispose() {
      clearAll();
      clearInterval(blink);
      clearTimeout(loopTimer);
    };
  }

  /* ======================================================================
   * 5.6 首页天空：按系统时间自动切换昼夜，天气手动切换
   * ==================================================================== */
  function initSky() {
    const hero = $('#top');
    if (!hero) return;
    const sw = $('#moodSwitch');
    const stars = $('#skyStars');
    const rain = $('#skyRain');
    const snow = $('#skySnow');

    if (stars) {
      let html = '';
      for (let i = 0; i < 62; i++) {
        const s = (1.2 + Math.random() * 2).toFixed(1);
        html +=
          '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' +
          (Math.random() * 58).toFixed(1) + '%;width:' + s + 'px;height:' + s +
          'px;opacity:' + (0.35 + Math.random() * 0.65).toFixed(2) +
          ';animation-delay:' + (Math.random() * 4).toFixed(2) +
          's;animation-duration:' + (3 + Math.random() * 3).toFixed(1) + 's"></i>';
      }
      stars.innerHTML = html;
    }

    if (rain) {
      let html = '';
      for (let i = 0; i < 78; i++) {
        html +=
          '<i style="left:' + (Math.random() * 106 - 3).toFixed(1) + '%;height:' +
          (40 + Math.random() * 85).toFixed(0) +
          'px;opacity:' + (0.38 + Math.random() * 0.42).toFixed(2) +
          ';animation-duration:' + (0.5 + Math.random() * 0.45).toFixed(2) +
          's;animation-delay:-' + (Math.random() * 2).toFixed(2) + 's"></i>';
      }
      rain.innerHTML = html;
    }

    if (snow) {
      let html = '';
      for (let i = 0; i < 92; i++) {
        const s = (4 + Math.random() * 6).toFixed(1);
        html +=
          '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;width:' + s +
          'px;height:' + s +
          'px;--drift:' + (Math.random() * 90 - 45).toFixed(0) +
          'px;opacity:' + (0.5 + Math.random() * 0.5).toFixed(2) +
          ';animation-duration:' + (9 + Math.random() * 10).toFixed(1) +
          's;animation-delay:-' + (Math.random() * 16).toFixed(1) + 's"></i>';
      }
      snow.innerHTML = html;
    }

    function moodByHour(h) {
      if (h >= 5 && h < 8) return 'dawn';
      if (h >= 8 && h < 16) return 'noon';
      if (h >= 16 && h < 19) return 'dusk';
      return 'night';
    }

    let manual = null;

    const LIGHT_MOODS = ['dawn', 'noon', 'dusk', 'rain', 'snow'];
    const nav = $('.nav');
    let currentMood = 'night';

    function syncNav() {
      if (!nav) return;
      const atTop = window.scrollY < 100;
      const light = LIGHT_MOODS.indexOf(currentMood) >= 0;
      nav.classList.toggle('is-top', atTop);
      nav.classList.toggle('is-light', atTop && light);
    }

    function apply(mood) {
      currentMood = mood;
      hero.setAttribute('data-mood', mood);
      document.body.setAttribute('data-mood', mood);
      if (rain) rain.classList.toggle('on', mood === 'rain');
      if (snow) snow.classList.toggle('on', mood === 'snow');
      if (hallScene && hallScene.setMood) hallScene.setMood(mood);
      if (sw) {
        $$('button', sw).forEach(function (b) {
          const m = b.dataset.mood;
          b.classList.toggle('is-active', manual ? m === manual : m === 'auto');
        });
      }
      syncNav();
    }

    window.addEventListener('scroll', syncNav, { passive: true });

    function tick() {
      if (manual) return;
      apply(moodByHour(new Date().getHours()));
    }

    if (sw) {
      sw.addEventListener('click', function (e) {
        const b = e.target.closest ? e.target.closest('button') : null;
        if (!b || !b.dataset.mood) return;
        const m = b.dataset.mood;
        manual = m === 'auto' ? null : m;
        if (manual) apply(manual);
        else tick();
      });
    }

    tick();
    window.setInterval(tick, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
  }
  /* ======================================================================
   * 6. 滚动进度 / 入场显现 / 尾声
   * ==================================================================== */
  function scrollProgress() {
    const bar = $('#progress');
    if (!bar) return;
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function revealOnScroll() {
    const targets = $$('.reveal');
    const items = $$('.titem');
    if (prefersReduced || !('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('in'));
      items.forEach((t) => t.classList.add('in'));
      $('#outro')?.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const idx = el.parentElement
            ? Array.from(el.parentElement.children).indexOf(el)
            : 0;
          el.style.transitionDelay = Math.min(idx, 6) * 90 + 'ms';
          el.classList.add('in');
          io.unobserve(el);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );
    targets.forEach((t) => io.observe(t));
    items.forEach((t) => io.observe(t));

    const outro = $('#outro');
    if (outro) {
      const io2 = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              outro.classList.add('in');
              io2.disconnect();
            }
          });
        },
        { threshold: 0.22 }
      );
      io2.observe(outro);
    }
  }

  /* ======================================================================
   * 启动
   * ==================================================================== */
  function boot() {
    applyMascotName();
    initQuotes();
    renderEras();
    renderRed();
    renderColleges();

    initHero();
    initSky();
    initCarousel();
    modalEvents();
    chatEvents();
    mascotActions();
    scrollProgress();
    revealOnScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
