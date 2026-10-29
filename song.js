/* 树皮纹理生成 */
/* 程序化生成树皮纹理：竖脊 + 横向皮孔 */
(function () {
  var w = 1100, h = 1500;
  var cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  var g = cv.getContext('2d');

  g.fillStyle = '#120d08';
  g.fillRect(0, 0, w, h);

  // 竖脊：每条宽度、明度、相位都不同，沿 y 缓慢起伏
  var x = -40;
  while (x < w + 40) {
    var bw = 7 + Math.random() * 26;
    var tone = Math.random();
    var phase = Math.random() * 6.283;
    var amp = 4 + Math.random() * 11;
    var freq = 0.0016 + Math.random() * 0.0042;

    g.beginPath();
    for (var y = -12; y <= h + 12; y += 8) {
      var dx = Math.sin(y * freq + phase) * amp + Math.sin(y * freq * 3.3 + phase * 2) * 2.4;
      var X = x + dx;
      if (y === -12) g.moveTo(X, y); else g.lineTo(X, y);
    }
    g.lineWidth = bw;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(' +
      Math.round(57 + tone * 79) + ',' +
      Math.round(45 + tone * 58) + ',' +
      Math.round(30 + tone * 39) + ',' +
      (0.17 + tone * 0.40).toFixed(2) + ')';
    g.stroke();

    x += bw + 1 + Math.random() * 9;
  }

  // 横向皮孔与细裂
  for (var i = 0; i < 120; i++) {
    var px = Math.random() * w;
    var py = Math.random() * h;
    var len = 8 + Math.random() * 46;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + len, py + (Math.random() - 0.5) * 3);
    g.lineWidth = 0.8 + Math.random() * 2.2;
    g.strokeStyle = 'rgba(10,7,4,' + (0.25 + Math.random() * 0.45).toFixed(2) + ')';
    g.stroke();
  }

  /* 把右侧淡出烘焙进纹理本身，省掉整屏 mask-image（滚动时非常费） */
  g.globalCompositeOperation = 'destination-out';
  var fade = g.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.50, 'rgba(0,0,0,0)');
  fade.addColorStop(0.70, 'rgba(0,0,0,0.72)');
  fade.addColorStop(0.87, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  document.documentElement.style.setProperty('--bark-img', 'url("' + cv.toDataURL('image/jpeg', 0.78) + '")');
})();

/* 六朝松主逻辑 */
(function () {
  'use strict';

  /* ---------------- 数据 ---------------- */
  // 四个抉择节点：年份、悬停提问、进入后的一句话、树的记忆
  const NODES = [
    { year: 1921, q: '要不要办工科？',        label: '办了工科',   person: '郭秉文',
      memory: '1921 年，有人把家底押在了工科上。我记得。' },
    { year: 1935, q: '要不要提前准备？',      label: '提前准备',   person: '罗家伦',
      memory: '1935 年，有人选择提前准备。我记得。' },
    { year: 1937, q: '要带什么走？',          label: '带走了牲口', person: '王酉亭',
      memory: '1937 年，有人不肯丢下那些牲口。我记得。' },
    { year: 1952, q: '要不要留在原地？',      label: '留在原地',   person: '工学院',
      memory: '1952 年，有人留在了原地。我记得。' },
  ];

  // 制度性年轮：只读，不可进入
  const INSTITUTIONAL = [
    { year: 1902, label: '三江师范学堂创办' },
    { year: 1905, label: '更名两江师范学堂' },
    { year: 1915, label: '南京高等师范学校' },
    { year: 1924, label: '工科并入河海工科大学' },
    { year: 1927, label: '改组国立第四中山大学' },
    { year: 1928, label: '定名国立中央大学' },
    { year: 1949, label: '更名国立南京大学' },
    { year: 1950, label: '定名南京大学' },
    { year: 1988, label: '复名东南大学' },
    { year: 2000, label: '组建新的东南大学' },
    { year: 2017, label: '入选双一流' },
    { year: 2025, label: '成立八大书院' },
  ];

  const YEAR_MIN = 1902;
  const YEAR_MAX = 2025;

  /* ---------------- 状态 ---------------- */
  const state = {
    done: [],          // 已完成节点下标
    hover: null,       // {kind:'node'|'inst', index}
  };

  /* ---------------- 画布 ---------------- */
  const canvas = document.getElementById('disc');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  let cx = 0, cy = 0, R = 0, R0 = 0, R1 = 0;
  let nodeR = [];   // 抉择圈的实际半径（带最小间距）

  function resize() {
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth * 0.94, wrap.clientHeight * 0.94, 1080);
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = size; H = size;
    canvas.width = Math.round(size * DPR);
    canvas.height = Math.round(size * DPR);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2;
    R = W / 2 - 6;
    R0 = R * 0.13;
    R1 = R * 0.95;
    computeNodeRadii();
  }

  function rOf(year) {
    const t = (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
    // 幂次映射：让 1902–1950 这几十年占更多半径，
    // 否则四个抉择圈全挤在内三分之一，外圈空得像靶纸。
    return R0 + Math.pow(t, 0.62) * (R1 - R0);
  }

  // 1935 与 1937 在真实年份上只差 5px，两个抉择圈会叠成一条。
  // 给抉择圈加一个最小间距，让它们可分辨；制度圈仍严格按年份。
  function computeNodeRadii() {
    const MIN_GAP = Math.max(24, R * 0.062);
    nodeR = [];
    let prev = -Infinity;
    NODES.forEach(function (node) {
      const r = Math.max(rOf(node.year), prev + MIN_GAP);
      nodeR.push(r);
      prev = r;
    });
  }

  // 年轮不该是正圆：加一点有机的起伏
  // 真实的树心从不居中：年轮一边宽、一边窄。
  // 这一项让整盘年轮偏心，是"像树"而不是"像靶纸"的关键。
  const PITH_ECC = 0.062;
  const PITH_ANG = -2.15;

  function wobble(theta, seed) {
    const ecc = 1 + PITH_ECC * Math.cos(theta - PITH_ANG) + 0.018 * Math.cos(2 * (theta - PITH_ANG));
    const shared = 0.030 * Math.sin(2 * theta + 0.9) + 0.016 * Math.sin(5 * theta + 2.4);
    const own = 0.005 * Math.sin(3 * theta + seed * 0.35);
    return ecc + shared + own;
  }

  function ringPath(rBase, seed, steps) {
    const n = steps || 240;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      const r = rBase * wobble(th, seed);
      const x = cx + Math.cos(th) * r;
      const y = cy + Math.sin(th) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  /* ---------------- 绘制 ---------------- */
  let t0 = performance.now();
  let drawRaf = 0;
  let lastDraw = 0;
  let songVisible = false;

  function drawBase() {
    // 木质底色（左上略亮，像一束侧光照在截面上）
    const g = ctx.createRadialGradient(cx * 0.9, cy * 0.86, R0 * 0.25, cx, cy, R1 * 1.08);
    g.addColorStop(0, '#42321f');
    g.addColorStop(0.45, '#2c2115');
    g.addColorStop(0.82, '#1d150d');
    g.addColorStop(1, '#0e0a06');
    ctx.beginPath();
    ctx.arc(cx, cy, R1 * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // 年复一年的细密年轮
    for (let y = YEAR_MIN + 1; y < YEAR_MAX; y++) {
      const r = rOf(y);
      const seed = y * 0.37;
      const a = 0.045 + ((y * 7) % 5) * 0.012;
      ringPath(r, seed, 180);
      ctx.strokeStyle = 'rgba(201,163,110,' + a.toFixed(3) + ')';
      ctx.lineWidth = (y % 3 === 0) ? 1.05 : 0.7;
      ctx.stroke();
    }

    // 髓射线：从树心向外散开的细线
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const th = (i / 26) * Math.PI * 2 + (i % 4) * 0.05;
      const rIn = R0 * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * rIn, cy + Math.sin(th) * rIn);
      ctx.lineTo(cx + Math.cos(th) * R1, cy + Math.sin(th) * R1);
      ctx.strokeStyle = 'rgba(190,150,100,' + (0.010 + (i % 3) * 0.008) + ')';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();

    // 径向裂纹：真实截面都有几道
    [0.9, 2.35, 3.9, 5.15].forEach(function (th, k) {
      const rIn = R1 * (0.40 + k * 0.055);
      const w = 0.0045 + (k % 2) * 0.0032;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th - w) * rIn, cy + Math.sin(th - w) * rIn);
      ctx.lineTo(cx + Math.cos(th - w * 0.55) * R1 * 1.03, cy + Math.sin(th - w * 0.55) * R1 * 1.03);
      ctx.lineTo(cx + Math.cos(th + w * 0.55) * R1 * 1.03, cy + Math.sin(th + w * 0.55) * R1 * 1.03);
      ctx.lineTo(cx + Math.cos(th + w) * rIn, cy + Math.sin(th + w) * rIn);
      ctx.closePath();
      ctx.fillStyle = 'rgba(8,6,4,.55)';
      ctx.fill();
    });

    // 树皮外缘
    ctx.save();
    ringPath(R1 * 1.004, 0.6, 320);
    ctx.strokeStyle = 'rgba(52,39,25,.95)';
    ctx.lineWidth = 11;
    ctx.stroke();
    ctx.restore();

    // 形成层：树皮内侧的一道亮边
    ringPath(R1 * 0.985, 0.6, 320);
    ctx.strokeStyle = 'rgba(214,176,120,.20)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  function draw(ts) {
    const now = ts || performance.now();
    const breathe = 0.5 + 0.5 * Math.sin((now - t0) / 1400);

    ctx.clearRect(0, 0, W, H);
    drawBase();

    // ---- 制度圈：细、暗、只读 ----
    INSTITUTIONAL.forEach(function (item, i) {
      const r = rOf(item.year);
      const seed = item.year * 0.37;
      const hovered = state.hover && state.hover.kind === 'inst' && state.hover.index === i;

      ringPath(r, seed, 240);
      ctx.strokeStyle = hovered ? 'rgba(226,196,150,.72)' : 'rgba(186,148,100,.40)';
      ctx.lineWidth = hovered ? 1.8 : 1.1;
      ctx.stroke();

      if (hovered) {
        ctx.save();
        ctx.shadowColor = 'rgba(226,196,150,.5)';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      }
    });

    // ---- 抉择圈：粗、亮、呼吸 ----
    NODES.forEach(function (node, i) {
      const r = nodeR[i];
      const seed = node.year * 0.37;
      const hovered = state.hover && state.hover.kind === 'node' && state.hover.index === i;
      const done = state.done.indexOf(i) >= 0;

      // 外发光
      ctx.save();
      ringPath(r, seed, 260);
      ctx.strokeStyle = 'rgba(200,161,90,' + (hovered ? 0.30 : 0.10 + breathe * 0.06) + ')';
      ctx.lineWidth = hovered ? 22 : 14;
      ctx.stroke();
      ctx.restore();

      // 主环
      ringPath(r, seed, 260);
      ctx.strokeStyle = done
        ? 'rgba(200,161,90,.55)'
        : 'rgba(232,192,124,' + (0.72 + breathe * 0.22) + ')';
      ctx.lineWidth = hovered ? 5.5 : 3.2;
      ctx.stroke();

      // 已完成：加一圈更亮的内描边（是"你来过"的标记，不改变年轮形态）
      if (done) {
        ringPath(r - 3.5, seed, 260);
        ctx.strokeStyle = 'rgba(232,192,124,.32)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 年份刻度：在环上点一个小点
      const th = -Math.PI / 2 + i * 0.16;
      const rr = r * wobble(th, seed);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, hovered ? 4 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = hovered ? '#f0d7a4' : 'rgba(232,192,124,.75)';
      ctx.fill();
    });

    // 树心
    ctx.beginPath();
    ctx.arc(cx, cy, R0 * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2b1a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,161,90,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (songVisible && ringview.classList.contains('on')) {
      if (now - lastDraw >= 32) {
        lastDraw = now;
        drawRaf = requestAnimationFrame(draw);
      } else {
        drawRaf = requestAnimationFrame(draw);
      }
    } else {
      drawRaf = 0;
    }
  }

  /* ---------------- 命中测试 ---------------- */
  function hitTest(mx, my) {
    const dx = mx - cx, dy = my - cy;
    const d = Math.hypot(dx, dy);
    if (d > R1 * 1.05) return null;

    // 抉择圈优先
    let best = null, bestDelta = 18;
    NODES.forEach(function (node, i) {
      const delta = Math.abs(d - nodeR[i]);
      if (delta < bestDelta) { bestDelta = delta; best = { kind: 'node', index: i }; }
    });
    if (best) return best;

    // 制度圈
    bestDelta = 9;
    INSTITUTIONAL.forEach(function (item, i) {
      const delta = Math.abs(d - rOf(item.year));
      if (delta < bestDelta) { bestDelta = delta; best = { kind: 'inst', index: i }; }
    });
    return best;
  }

  /* ---------------- 悬停 / 点击 ---------------- */
  const caption = document.getElementById('caption');
  const capYear = document.getElementById('capYear');
  const capQ = document.getElementById('capQ');
  const capHint = document.getElementById('capHint');

  function updateHover(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);

    const changed = JSON.stringify(hit) !== JSON.stringify(state.hover);
    state.hover = hit;
    if (!changed) return;

    if (!hit) {
      caption.classList.remove('on', 'readonly');
      canvas.style.cursor = 'crosshair';
      return;
    }

    if (hit.kind === 'node') {
      const node = NODES[hit.index];
      caption.classList.remove('readonly');
      capYear.textContent = node.year;
      capQ.textContent = node.q;
      capHint.textContent = '点击进入这个抉择 →';
      canvas.style.cursor = 'pointer';
    } else {
      const item = INSTITUTIONAL[hit.index];
      caption.classList.add('readonly');
      capYear.textContent = item.year;
      capQ.textContent = item.label;
      capHint.textContent = '制度性年轮 · 仅记录';
      canvas.style.cursor = 'default';
    }
    caption.classList.add('on');
  }

  canvas.addEventListener('pointermove', updateHover);
  // 触摸屏：tap 不产生 pointermove，用 pointerdown 先把提示亮出来
  canvas.addEventListener('pointerdown', updateHover);

  canvas.addEventListener('pointerleave', function () {
    state.hover = null;
    caption.classList.remove('on', 'readonly');
  });

  // 点击直接用事件坐标重新命中 —— 不依赖上一次悬停，
  // 否则触摸设备点年轮会没反应。
  canvas.addEventListener('click', function (e) {
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit || hit.kind !== 'node') return;
    openDecision(hit.index);
  });

  /* ---------------- 进入 / 返回 ---------------- */
  const decision = document.getElementById('decision');
  const decYear = document.getElementById('decYear');
  const decQ = document.getElementById('decQ');
  let pending = null;

  function openDecision(i) {
    pending = i;
    const node = NODES[i];
    caption.classList.remove('on');
    if (STORIES[node.year]) { openStory(node.year); return; }
    decYear.textContent = node.year + ' · ' + node.person;
    decQ.textContent = node.q;
    decision.classList.add('on');
  }

  document.getElementById('back').addEventListener('click', function () {
    decision.classList.remove('on');
    if (pending === null) return;
    const i = pending;
    pending = null;
    setTimeout(function () { completeNode(i); }, 420);
  });

  /* ---------------- 完成：树说话 + 落叶 ---------------- */
  const ground = document.getElementById('ground');
  const toast = document.getElementById('toast');
  const doneEl = document.getElementById('done');
  const memCount = document.getElementById('memCount');
  const rememberBtn = document.getElementById('remember');
  const ringviewEl = document.getElementById('ringview');
  const yearmark = document.getElementById('yearmark');
  let closed = false;

  /* 四个抉择的落叶位置：手排，落在树下的光里 */
  const LEAF_SPOTS = [
    { x: 43, y: 20, r: -22 },
    { x: 53, y: 30, r: 12 },
    { x: 60, y: 17, r: -8 },
    { x: 47, y: 11, r: 26 }
  ];

  function completeNode(i) {
    if (state.done.indexOf(i) >= 0) return;
    state.done.push(i);
    doneEl.textContent = state.done.length;
    memCount.textContent = state.done.length;
    rememberBtn.disabled = false;
    rememberBtn.classList.add('ready');

    dropLeaf(NODES[i], i);
  }

  function dropLeaf(node, i) {
    const spot = LEAF_SPOTS[i] || { x: 50, y: 20, r: 6 };
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.style.left = spot.x + '%';
    leaf.style.bottom = spot.y + '%';
    leaf.innerHTML = '<span class="tag">' + node.year + ' · ' + node.label + '</span>';
    ground.appendChild(leaf);
    ground.classList.add('focus');

    // 从上方飘落
    const startY = -(window.innerHeight * 0.5);
    leaf.style.transform = 'translate(' + (Math.random() * 40 - 20) + 'px,' + startY + 'px) rotate(-40deg)';
    leaf.style.opacity = '0';
    requestAnimationFrame(function () {
      leaf.style.transition = 'transform 3.4s cubic-bezier(.35,.1,.4,1), opacity .6s ease';
      leaf.style.opacity = '1';
      leaf.style.transform = 'translate(0,0) rotate(' + spot.r + 'deg)';
    });

    setTimeout(function () {
      leaf.classList.add('landed');
      leaf.style.transform = 'translate(0,0) rotate(' + spot.r + 'deg)';
      leaf.style.transition = 'filter .3s ease, transform .3s ease';
      speak(node.memory);
      setTimeout(function () { ground.classList.remove('focus'); }, 1800);

      // 四个都做完：进入收尾
      if (state.done.length === NODES.length) {
        setTimeout(closeStory, 3400);
      }
    }, 3200);
  }

  let toastTimer = 0;
  function speak(text, isFinal) {
    toast.textContent = text;
    toast.classList.toggle('final', !!isFinal);
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('on');
    }, isFinal ? 9000 : 4600);
  }

  /* ---------------- 收尾：四个都做完 ---------------- */
  function closeStory() {
    if (closed) return;
    closed = true;

    // 年轮整体收一点，像退后一步看
    ringviewEl.classList.add('complete');
    // 四个年份落款
    yearmark.textContent = NODES.map(function (n) { return n.year; }).join('  ·  ');
    yearmark.classList.add('on');
    // 记忆键进入最终态
    rememberBtn.classList.add('final');
    // 树说最后一句
    speak('你们都走了。我还在这里。', true);
  }

  /* ---------------- 辅助年表 ---------------- */
  const ERAS = [
    { y: '1902', n: '三江师范学堂', t: '肇始' },
    { y: '1905', n: '两江师范学堂', t: '更名' },
    { y: '1915', n: '南京高等师范学校', t: '南高' },
    { y: '1921', n: '国立东南大学', t: '东大', key: true },
    { y: '1927', n: '国立第四中山大学', t: '合并' },
    { y: '1928', n: '国立中央大学', t: '鼎盛' },
    { y: '1935', n: '筹备西迁', t: '抉择', key: true },
    { y: '1937', n: '西迁重庆 · 松林坡复课', t: '流亡', key: true },
    { y: '1949', n: '国立南京大学 · 南京大学', t: '转折' },
    { y: '1952', n: '南京工学院', t: '新生', key: true },
    { y: '1988', n: '东南大学', t: '复名' },
    { y: '2000', n: '东南大学', t: '今朝' }
  ];

  const chrono = document.getElementById('chrono');
  const chronoList = document.getElementById('chronoList');

  function buildChrono() {
    if (chronoList.childElementCount) return;
    ERAS.forEach(function (e) {
      const row = document.createElement('div');
      row.className = 'chrono-row' + (e.key ? ' key' : '');
      row.innerHTML =
        '<span class="y">' + e.y + '</span>' +
        '<span class="n">' + e.n + '</span>' +
        '<span class="t">' + e.t + '</span>';
      chronoList.appendChild(row);
    });
  }

  function openChrono() {
    buildChrono();
    chrono.classList.add('on');
  }
  function closeChrono() {
    chrono.classList.remove('on');
  }

  document.getElementById('chronoBtn').addEventListener('click', openChrono);
  document.getElementById('chronoClose').addEventListener('click', closeChrono);
  chrono.addEventListener('click', function (e) {
    if (e.target === chrono) closeChrono();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && chrono.classList.contains('on')) closeChrono();
  });

  /* ---------------- 树的记忆清单 ---------------- */
  const memory = document.getElementById('memory');
  const memList = document.getElementById('memList');
  const memLast = document.getElementById('memLast');

  rememberBtn.addEventListener('click', function () {
    if (!rememberBtn.classList.contains('ready')) return;
    memList.innerHTML = '';
    const items = state.done.slice().sort(function (a, b) { return a - b; });
    items.forEach(function (i, k) {
      const li = document.createElement('li');
      li.textContent = NODES[i].memory;
      li.style.animationDelay = (k * 0.18) + 's';
      memList.appendChild(li);
    });
    // 四个都做完，树才说最后一句
    memLast.textContent = items.length >= NODES.length ? '你们都走了。我还在这里。' : '';
    memory.classList.add('on');
  });

  document.getElementById('memClose').addEventListener('click', function () {
    memory.classList.remove('on');
  });

  /* ---------------- C 段：1935 / 1937 ---------------- */
  const STORIES = {
    1921: {
      who: '国立东南大学 · 郭秉文',
      cases: [
        {
          tag: '经费方案 · 1921',
          body: '学校刚成立，经费只有那么多。办一科文科，钱够；办一科工科，要建实验室、买设备，顶得上三科文科。',
          note: '钱只够办一样。'
        },
        {
          tag: '长江下游 · 现状',
          body: '沿江的工厂、铁路、水利都在扩，到处缺工程师。可南京城里讲工科的学校，几乎没有。',
          note: '缺人的地方，不在这张牌桌上。'
        },
        {
          tag: '同行 · 做法',
          body: '国内几所以文理见长的名校，工科多设在上海、北平。工科在南京，没有根基，也没有现成的老师。',
          note: '办，就是从头开始。'
        }
      ],
      asks: [
        { q: '钱从哪来？', a: '只能从别处挪。办工科，就意味着有些学科要晚几年，有些先生要等着。' },
        { q: '有人教吗？', a: '有。茅以升这样的人愿意来，但实验室要一间一间建，设备要一件一件订。' },
        { q: '值得吗？', a: '工科见效慢，学生要四年才出来。等不及的人会说，这钱花得不值。' }
      ],
      picks: [
        {
          title: '办工科，先苦后甜',
          cost: '文科的摊子要收一收，头几年设备上不去。',
          risk: '四年后才见分晓。到那时候，你还在不在这所学校？'
        },
        {
          title: '先办文科，稳扎稳打',
          cost: '工科的机会窗口关上了，以后再办要从零开始。',
          risk: '南京的工厂，不会等一所大学。'
        },
        {
          title: '借别人的实验室',
          cost: '和别校合办，学生要用别人的设备，培养受制于人。',
          risk: '这样的合作，能维持几年？'
        }
      ],
      note: {
        kind: 'prose',
        meta: ['手记', '十年秋 · 南京'],
        text: '办这所大学，我最怕的不是没钱，是把钱花在看得见的地方。\n\n文科一年就能开课，工科要三年才像样。可这国家缺的不是会写字的人，是能把桥架起来的人。\n\n有人劝我，先把名声做起来，工科以后再说。以后——我怕是等不到以后。',
        sign: '—— 郭秉文'
      },
      reveal: {
        tag: '后来的事',
        main: '1921 年，国立东南大学成立，设工科，与商科、教育科等并列。此后三十余年，工科逐渐成为这所学校最重的一块。',
        echo: '三十一年后，正是这个工科，在四牌楼留了下来。',
        src: '史实框架参见国立东南大学设科相关公开记述；细节以校史馆资料为准。'
      }
    },


    1935: {
      who: '中央大学校长 · 罗家伦',
      cases: [
        {
          tag: '教育部训令 · 1935',
          body: '“华北局势日紧，各校应就图书、仪器预为筹划，以免临事仓皇。”',
          note: '训令只说了“筹划”。没有说搬，也没有拨一分钱。'
        },
        {
          tag: '校款账目 · 1934 年度',
          body: '经费常年欠发，设备费早已挪作日常开支。要做一批木箱，只能从教学经费里挤。',
          note: '做箱子，意味着这一年少买仪器、少开实验课。'
        },
        {
          tag: '时局 · 1935 年秋',
          body: '北平几所大学已把图书南运。但还没有一所大学整校搬迁过——那意味着几千师生、几万册书，以及一所学校还叫不叫原来的名字。',
          note: '没有人知道，仗到底会不会打起来。'
        }
      ],
      asks: [
        { q: '钱够吗？', a: '不够。校款欠发已是常态，设备费所剩无几。要装箱，就得停掉一部分实验课。' },
        { q: '上面怎么说？', a: '只让“筹划”，既没有命令，也没有拨款。真出了事，责任在校方；不出事，这些箱子就是白花钱。' },
        { q: '别人做了吗？', a: '北平已有学校把图书南运。但整校搬迁没有先例——跟着做算稳妥，不跟也不算失职。' }
      ],
      picks: [
        {
          title: '先装箱，宁可白做',
          cost: '停掉一部分实验课，这一年少买仪器。',
          risk: '仗若没打起来，这些箱子就是白花钱，账记在你头上。'
        },
        {
          title: '等命令，不抢跑',
          cost: '照常上课、照常买仪器，账面上最稳。',
          risk: '真打起来，你不会有准备时间，也不会有搬迁令。'
        },
        {
          title: '只运最要紧的',
          cost: '把有限的运费压在图书和精密仪器上。',
          risk: '剩下的留在南京，多半保不住；而最要紧的，未必是将来最要紧的。'
        }
      ],
      note: {
        kind: 'prose',
        meta: ['手记', '二十四年秋 · 南京'],
        text: '做校长这几年，我常觉得自己在替一所在打仗边缘的学校看家。\n\n有人劝我，仗未必打得起来，何必先花钱买一堆木头箱子。可我在欧洲看过战后的大学——校舍还在，书没了，就再也不是那所大学了。\n\n这个道理，我没法讲给所有人听。我只能自己扛着。',
        sign: '—— 罗家伦'
      },
      reveal: {
        tag: '后来的事',
        main: '1937 年秋，淞沪战事既起，中央大学仓促西迁。因为此前已经装箱，图书仪器得以在极短时间里装船运出——这是内迁高校中损失较小的一所。学校辗转迁到重庆沙坪坝，在松林坡复课。',
        echo: '那些木头箱子，在当时是账面上的一笔浪费。五年之后，它们是这所学校还能被认出来的理由。',
        src: '史实框架参见中央大学西迁相关公开记述；具体数字以校史馆资料为准。'
      }
    },

    1937: {
      who: '中央大学农学院牧场 · 王酉亭',
      cases: [
        {
          tag: '校产清册 · 农学院牧场',
          body: '牧场里有奶牛、役马、羊、猪和家禽，还有几批引进的良种。清册上它们是“校产”，却不写在装箱清单里。',
          note: '图书仪器有箱子，牲畜没有。'
        },
        {
          tag: '西迁 · 1937 年 11 月',
          body: '中央大学奉命西迁，师生分批乘船西上。船位要装人、装书、装仪器——没有谁的行李里能放得下一头牛。',
          note: '命令里没有一句话提到这些牲畜。'
        },
        {
          tag: '南京 · 十一月',
          body: '城即将失守。能走的人都在走。留下来的人，不知道明天会怎样。',
          note: '这些牲口留在这里，多半活不过这个冬天。'
        }
      ],
      asks: [
        { q: '能带走吗？', a: '没有船位，也没有运费。要走只能走陆路，一路自己找草料、找路。' },
        { q: '杀掉呢？', a: '可以。在当时的南京，这不算残忍，算务实。' },
        { q: '有人管吗？', a: '命令里没有这一条。做与不做，都不会有人追责，也不会有人嘉奖。' }
      ],
      picks: [
        {
          title: '赶着走，走陆路',
          cost: '没有经费、没有运输工具，一路要自己找草料、找路。',
          risk: '能不能活着走到，谁也不知道。'
        },
        {
          title: '就地处理，轻装西行',
          cost: '这些良种从此没有了，农学院的教学要重新开始。',
          risk: '别人会说这是务实，还是懦弱？'
        },
        {
          title: '托给留下的人',
          cost: '你走你的，把它们交给还留在城里的人。',
          risk: '城破之后，留下来的人自己都难保。'
        }
      ],
      note: {
        kind: 'ledger',
        meta: ['校产清册', '二十六年冬 · 南京'],
        rows: [
          { k: '牛', v: '十余头' },
          { k: '马', v: '数匹' },
          { k: '羊', v: '一群' },
          { k: '猪', v: '若干' },
          { k: '家禽', v: '数笼' },
          { k: '良种', v: '一并带走' },
          { total: true, k: '赶路人', v: '王酉亭' }
        ]
      },
      reveal: {
        tag: '后来的事',
        main: '1937 年 11 月，南京陷落前夕，中央大学农学院牧场的牲畜被赶出南京。没有车船，只能走陆路，经安徽、河南、湖北，一路向西。次年秋，这支队伍抵达重庆。',
        echo: '名单上没有他们。他们把自己写进了名单。',
        src: '史实框架参见中央大学西迁相关公开记述；数目与路线细节以校史馆资料为准。'
      }
    },
    1952: {
      who: '南京大学工学院 · 院系调整',
      cases: [
        {
          tag: '调整方案 · 1952 年',
          body: '全国院系调整，工学院要从南京大学分出来，单独成立一所工科院校。方案里只写了“以工学院为基础”，没有写校址。',
          note: '校址要自己争。'
        },
        {
          tag: '四牌楼 · 现状',
          body: '四牌楼是原中央大学的老校园。工科的实验室、厂房、重型设备都在这里，搬一次要好几年。六朝松和大礼堂，也在这里。',
          note: '机器搬不动，树更搬不动。'
        },
        {
          tag: '南京大学 · 另一头',
          body: '文理等院系也要办学，也在找地方。同一个校园，两所学校，谁也舒展不开。',
          note: '分开，还是挤在一起？'
        }
      ],
      asks: [
        { q: '能搬吗？', a: '工科的设备以吨计，拆一次装一次，教学要停摆好几年。' },
        { q: '有别的校区吗？', a: '有，但都要从头建。一所新学校，没有树、没有礼堂、没有记忆。' },
        { q: '谁说了算？', a: '上面定方案，校址要自己谈。谈得好，留在这里；谈不好，搬走。' }
      ],
      picks: [
        {
          title: '守住四牌楼',
          cost: '和老校争同一个校园，难免伤感情。',
          risk: '别人会说，工学院把老校园抢了。'
        },
        {
          title: '让出去，另建新校',
          cost: '实验室、厂房全部重建，六朝松和大礼堂不再属于自己。',
          risk: '一所没有记忆的新学校，能不能立得住？'
        },
        {
          title: '先分着用',
          cost: '两所学校挤在一个校园里，谁都不舒展。',
          risk: '要挤多少年，没有人知道。'
        }
      ],
      note: {
        kind: 'lines',
        meta: ['筹备会议 · 记录（摘）', '四十一年 · 南京'],
        lines: [
          '“四牌楼是老先生们一砖一瓦建起来的。”',
          '“可新学院总得有个地方。”',
          '“工科的机器搬不动。搬一次，三年缓不过来。”',
          '“那六朝松呢？大礼堂呢？”',
          { text: '（沉默）', quiet: true },
          { text: '散会时，没有人再提搬的事。', final: true }
        ]
      },
      reveal: {
        tag: '后来的事',
        main: '1952 年，南京大学工学院等院系合并组建南京工学院，校址定在四牌楼原中央大学校园；文理等院系迁出，另组南京大学。一所学校，从此分成两所。',
        echo: '机器留在原地，树也留在原地。三十六年之后，这所学校改回了那个名字。',
        src: '史实框架参见 1952 年院系调整相关公开记述；细节以校史馆资料为准。'
      }
    }
  };


  const story = document.getElementById('story');
  const storyYear = document.getElementById('storyYear');
  const storyWho = document.getElementById('storyWho');
  const storyStage = document.getElementById('storyStage');
  const stack = document.getElementById('stack');
  const storyStep = document.getElementById('storyStep');
  const storyBack = document.getElementById('storyBack');
  const storyNext = document.getElementById('storyNext');
  const stageCase = document.getElementById('stageCase');
  const stageAsk = document.getElementById('stageAsk');
  const stagePick = document.getElementById('stagePick');
  const stageNote = document.getElementById('stageNote');
  const stageReveal = document.getElementById('stageReveal');
  const askList = document.getElementById('askList');
  const pickList = document.getElementById('pickList');
  const noteBody = document.getElementById('noteBody');
  const noteLedger = document.getElementById('noteLedger');
  const noteLines = document.getElementById('noteLines');
  const noteSign = document.getElementById('noteSign');
  const noteMetaL = document.getElementById('noteMetaL');
  const noteMetaR = document.getElementById('noteMetaR');

  let current = null;
  let stage = 'case';
  let caseIdx = 0;
  let typeTimer = 0;
  let advanceTimer = 0;
  let flipTimer = 0;

  function openStory(year) {
    current = STORIES[year];
    if (!current) return;
    caseIdx = 0;
    askList.innerHTML = '';
    pickList.innerHTML = '';
    noteLedger.innerHTML = '';
    noteLines.innerHTML = '';
    noteBody.textContent = '';
    noteSign.textContent = '';
    clearInterval(typeTimer);
    clearTimeout(advanceTimer);
    clearTimeout(flipTimer);

    storyYear.textContent = year;
    storyWho.textContent = current.who;
    story.classList.add('on');
    renderStack();
    go('case');
  }

  /* ---------- 三张情景浮着，按前后顺序排开 ---------- */
  function renderStack() {
    stack.innerHTML = '';
    current.cases.forEach(function (item, i) {
      const card = document.createElement('div');
      card.className = 'st-card paper';
      card.dataset.i = String(i);
      card.style.opacity = '0';
      card.style.transform = 'translateY(26px) scale(.96)';
      card.innerHTML =
        '<p class="tag">' + item.tag + '</p>' +
        '<p class="body rule">' + item.body + '</p>' +
        '<p class="note">' + item.note + '</p>';
      stack.appendChild(card);
    });
    requestAnimationFrame(layoutStack);
  }

  function layoutStack() {
    const cards = stack.children;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const rel = i - caseIdx;
      let y, sc, op, br, z;
      if (rel === 0) {
        y = 0; sc = 1; op = 1; br = 'none'; z = 30;
      } else if (rel > 0) {
        /* 用亮度压暗而不是透明度 —— 透明度叠在深色底上会变成灰黑色块 */
        y = rel * 30; sc = 1 - rel * 0.048; op = 1;
        br = 'brightness(' + (rel === 1 ? 0.82 : 0.62) + ')';
        z = 30 - rel * 10;
      } else {
        y = -30; sc = 0.97; op = 0; br = 'none'; z = 4;
      }
      card.style.transform = 'translateY(' + y + 'px) scale(' + sc + ')';
      card.style.opacity = String(op);
      card.style.filter = br;
      card.style.zIndex = String(z);
      card.style.pointerEvents = rel === 0 ? 'auto' : 'none';
    }
    requestAnimationFrame(function () {
      const active = cards[caseIdx];
      if (active) stack.style.height = (active.offsetHeight + 96) + 'px';
    });
  }

  window.addEventListener('resize', function () {
    if (current) layoutStack();
  });

  /* ---------- 阶段切换 ---------- */
  function go(s) {
    stage = s;
    clearInterval(typeTimer);
    clearTimeout(advanceTimer);

    stageCase.hidden = s !== 'case';
    stageAsk.hidden = s !== 'ask';
    stagePick.hidden = s !== 'pick';
    stageNote.hidden = s !== 'note';
    stageReveal.hidden = s !== 'reveal';

    storyBack.disabled = (s === 'case' && caseIdx === 0);
    storyNext.hidden = (s === 'pick' || s === 'note');

    if (s === 'case') {
      storyStage.textContent = '情境';
      storyStep.textContent = '档案 ' + (caseIdx + 1) + ' / ' + current.cases.length;
      storyNext.textContent = caseIdx < current.cases.length - 1 ? '翻下一张' : '去打听';
    } else if (s === 'ask') {
      storyStage.textContent = '调查';
      storyStep.textContent = '调查';
      storyNext.textContent = '进入选择';
      buildAsks();
    } else if (s === 'pick') {
      storyStage.textContent = '选择';
      storyStep.textContent = '选一个';
      buildPicks();
    } else if (s === 'note') {
      storyStage.textContent = current.note.kind === 'ledger' ? '清单'
        : current.note.kind === 'lines' ? '记录' : '手记';
      storyStep.textContent = '';
      startNote();
    } else if (s === 'reveal') {
      storyStage.textContent = '结果';
      storyStep.textContent = storyYear.textContent;
      storyNext.textContent = '回到年轮';
      fillReveal();
    }
  }

  storyNext.addEventListener('click', function () {
    if (stage === 'case') {
      if (caseIdx < current.cases.length - 1) {
        caseIdx++;
        layoutStack();
        go('case');
      } else {
        go('ask');
      }
    } else if (stage === 'ask') {
      go('pick');
    } else if (stage === 'reveal') {
      finishStory();
    }
  });

  storyBack.addEventListener('click', function () {
    if (stage === 'reveal' || stage === 'note') { go('pick'); return; }
    if (stage === 'pick') { go('ask'); return; }
    if (stage === 'ask') { caseIdx = current.cases.length - 1; layoutStack(); go('case'); return; }
    if (stage === 'case' && caseIdx > 0) { caseIdx--; layoutStack(); go('case'); }
  });

  function buildAsks() {
    if (askList.childElementCount) return;
    current.asks.forEach(function (item) {
      const wrap = document.createElement('div');
      wrap.className = 'ask-item';
      const btn = document.createElement('button');
      btn.className = 'ask-q';
      btn.textContent = item.q;
      const ans = document.createElement('p');
      ans.className = 'ask-a';
      ans.textContent = item.a;
      btn.addEventListener('click', function () {
        btn.disabled = true;
        ans.classList.add('on');
      });
      wrap.appendChild(btn);
      wrap.appendChild(ans);
      askList.appendChild(wrap);
    });
  }

  function buildPicks() {
    if (pickList.childElementCount) return;
    current.picks.forEach(function (item) {
      const btn = document.createElement('button');
      btn.className = 'pick-card paper';
      btn.innerHTML =
        '<p class="p-title">' + item.title + '</p>' +
        '<p class="p-row"><span class="p-k">代价</span><span>' + item.cost + '</span></p>' +
        '<p class="p-row"><span class="p-k">不确定</span><span>' + item.risk + '</span></p>';
      btn.addEventListener('click', function () { go('note'); });
      pickList.appendChild(btn);
    });
  }

  function startNote() {
    const n = current.note;
    noteSign.textContent = '';
    noteMetaL.textContent = n.meta[0];
    noteMetaR.textContent = n.meta[1];
    noteBody.hidden = true;
    noteLedger.hidden = true;
    noteLines.hidden = true;
    clearInterval(typeTimer);
    clearTimeout(advanceTimer);

    if (n.kind === 'ledger') {
      noteLedger.hidden = false;
      noteLedger.innerHTML = '';
      renderLedger();
    } else if (n.kind === 'lines') {
      noteLines.hidden = false;
      noteLines.innerHTML = '';
      renderLines();
    } else {
      noteBody.hidden = false;
      typeNote(n.text);
    }
  }

  function typeNote(text) {
    noteBody.textContent = '';
    let i = 0;
    const caret = document.createElement('span');
    caret.className = 'caret';
    noteBody.appendChild(caret);

    advanceTimer = setTimeout(function () {
      typeTimer = setInterval(function () {
        i++;
        noteBody.textContent = text.slice(0, i);
        noteBody.appendChild(caret);
        if (i >= text.length) {
          clearInterval(typeTimer);
          caret.remove();
          noteSign.textContent = current.note.sign;
          advanceTimer = setTimeout(function () { go('reveal'); }, 2000);
        }
      }, 38);
    }, 1300);
  }

  function renderLedger() {
    const rows = current.note.rows;
    let i = 0;
    advanceTimer = setTimeout(function tick() {
      if (i >= rows.length) {
        advanceTimer = setTimeout(function () { go('reveal'); }, 2200);
        return;
      }
      const r = rows[i];
      const row = document.createElement('div');
      row.className = 'ledger-row' + (r.total ? ' total' : '');
      row.innerHTML = r.total
        ? '<span class="k">' + r.k + '</span><span class="v">' + r.v + '</span>'
        : '<span class="k">' + r.k + '</span><span class="dots"></span><span class="v">' + r.v + '</span>';
      noteLedger.appendChild(row);
      requestAnimationFrame(function () { row.classList.add('in'); });
      i++;
      advanceTimer = setTimeout(tick, r.total ? 900 : 420);
    }, 1200);
  }

  function renderLines() {
    const lines = current.note.lines;
    let i = 0;
    advanceTimer = setTimeout(function tick() {
      if (i >= lines.length) {
        advanceTimer = setTimeout(function () { go('reveal'); }, 2200);
        return;
      }
      const raw = lines[i];
      const item = typeof raw === 'string' ? { text: raw } : raw;
      const row = document.createElement('div');
      row.className = 'line' + (item.quiet ? ' quiet' : '') + (item.final ? ' final' : '');
      row.textContent = item.text;
      noteLines.appendChild(row);
      requestAnimationFrame(function () { row.classList.add('in'); });
      i++;
      advanceTimer = setTimeout(tick, item.quiet ? 900 : 700);
    }, 1200);
  }

  function fillReveal() {
    const r = current.reveal;
    document.getElementById('rvTag').textContent = r.tag;
    document.getElementById('rvMain').textContent = r.main;
    document.getElementById('rvEcho').textContent = r.echo;
    document.getElementById('rvSrc').textContent = r.src;
  }

  function finishStory() {
    clearInterval(typeTimer);
    clearTimeout(advanceTimer);
    clearTimeout(flipTimer);
    story.classList.remove('on');
    const i = pending;
    pending = null;
    if (i === null) return;
    setTimeout(function () { completeNode(i); }, 420);
  }

/* ---------------- 入口 ---------------- */
  const intro = document.getElementById('intro');
  const ringview = document.getElementById('ringview');

  /* ---------------- 首屏图版：入场 + 视差 ---------------- */
  const panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  panels.forEach(function (p, i) {
    setTimeout(function () { p.classList.add('in'); }, 240 + i * 120);
  });

  let mx = 0, my = 0, paraRaf = 0;
  window.addEventListener('mousemove', function (e) {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function parallax() {
    if (!songVisible || intro.classList.contains('gone')) { paraRaf = 0; return; }
    panels.forEach(function (p, i) {
      const d = (i + 1) * 7;
      p.style.setProperty('--px', (mx * d).toFixed(2) + 'px');
      p.style.setProperty('--py', (my * d * 0.6).toFixed(2) + 'px');
    });
    paraRaf = requestAnimationFrame(parallax);
  }
  function startParallax() {
    if (!paraRaf && songVisible && !intro.classList.contains('gone')) {
      paraRaf = requestAnimationFrame(parallax);
    }
  }

  function startDraw() {
    if (!drawRaf && songVisible) drawRaf = requestAnimationFrame(draw);
  }
  /* 只有六朝松这一屏在视野里时，才让动画跑起来 */
  (function () {
    const section = document.getElementById('song') || intro.parentElement;
    if ('IntersectionObserver' in window && section) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          songVisible = e.isIntersecting;
          if (songVisible) {
            startParallax();
            if (ringview.classList.contains('on')) startDraw();
          }
        });
      }, { threshold: 0 }).observe(section);
    } else {
      songVisible = true;
      startParallax();
    }
  })();

  function enter() {
    intro.classList.add('gone');
    setTimeout(function () {
      ringview.classList.add('on');
      resize();
      startDraw();
    }, 380);
  }

  /* 回到首屏：重放一次屏风入场，进度与落叶保留 */
  function backToIntro() {
    ringview.classList.remove('on');
    intro.classList.remove('gone');
    panels.forEach(function (p) { p.classList.remove('in'); });
    panels.forEach(function (p, i) {
      setTimeout(function () { p.classList.add('in'); }, 140 + i * 110);
    });
    startParallax();
  }

  document.getElementById('backIntro').addEventListener('click', backToIntro);

  document.getElementById('enter').addEventListener('click', enter);
  document.getElementById('skip').addEventListener('click', function (e) {
    e.preventDefault();
    enter();
    // 名字说的是"看年表"，那就真的把年表打开
    setTimeout(openChrono, 1700);
  });

  window.addEventListener('resize', function () {
    if (!ringview.classList.contains('on')) return;
    resize();
  });

  // 预热画布尺寸（首屏期间先算好，避免进入时闪一下）
  window.addEventListener('load', function () {
    resize();
  });
})();
