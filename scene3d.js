/* ==========================================================================
 * scene3d.js —— 四牌楼大礼堂 + 八角喷泉 + 梧桐道（Three.js / 全局 THREE）
 * --------------------------------------------------------------------------
 * 参照素材：
 *   · 大礼堂：绿铜穹顶 + 顶部红色八角灯笼亭 + 六根爱奥尼柱 + 三角山花 + 两侧翼楼
 *   · 喷泉：八角水池，中央四腿托起的圆盘，水柱自盘沿抛物线下落
 *   · 梧桐：两列行道树，秋季黄绿树冠
 *
 * 对外只暴露一个函数：
 *   window.initHallScene(canvas, { compact }) -> { replay(), setActive(bool), dispose() }
 *
 * 想换成 Spline 模型：把 createModel() 里的建筑替换为 GLTFLoader 载入你的 .glb，
 * 其余（灯光 / 相机 / 生成动画 / 喷泉 / 树）都能直接复用。
 * ========================================================================== */
(function () {
  'use strict';

  const T = window.THREE;
  if (!T) return;

  /* ------------------------------------------------------------- 调色板 */
  const PAL = {
    wall: 0xe9dfc9,
    wallDark: 0xded1b4,
    trim: 0xe8dcc2,
    base: 0xa89a7c,
    stone: 0xb6a88b,
    dome: 0x86b7a4,
    domeRib: 0x6da190,
    red: 0xa8493d,
    roof: 0x8fb9a6,
    win: 0x27343a,
    ground: 0x36442c,
    paving: 0x33312b,
    pool: 0x8b8375,
    poolDark: 0x7c7466,
    pavingDark: 0x35332c,
    trunk: 0xd3c7b2,
    leaf: [0xb2c268, 0xd2c65e, 0x96a95c, 0xc9bd58],
    water: 0x2f9c8c,
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  /* --------------------------------------------------------- 材质工厂 */
  function std(color, o) {
    return new T.MeshStandardMaterial(
      Object.assign(
        { color: color, roughness: 0.86, metalness: 0.03, flatShading: false },
        o || {}
      )
    );
  }

  function box(w, h, d, material, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  function cyl(rt, rb, h, seg, material, x, y, z) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  /* ================================================================ 场景 */
  function createScene(canvas, opts) {
    // r149：打开正确的色彩管理，材质色才会"所见即所写"，不会被 gamma 整体提亮
    if (T.ColorManagement) T.ColorManagement.legacyMode = false;

    const renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    if ('outputEncoding' in renderer) renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    const scene = new T.Scene();
    scene.fog = new T.Fog(0x0a1a2b, 150, 400);

    const camera = new T.PerspectiveCamera(36, 1, 0.5, 1000);
    const root = new T.Group();
    scene.add(root);

    /* ---------------------------------------------------------- 灯光 */
    const hemi = new T.HemisphereLight(0xc9d8f2, 0x2a3020, 0.42);
    scene.add(hemi);

    const sun = new T.DirectionalLight(0xffe9c4, 1.28);
    sun.position.set(78, 104, 86);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95;
    sc.near = 30; sc.far = 340;
    sun.shadow.bias = -0.0011;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    // 背面冷光做轮廓
    const fill = new T.DirectionalLight(0x8fb8ff, 0.62);
    fill.position.set(-64, 52, -78);
    scene.add(fill);

    const bounce = new T.DirectionalLight(0xffd7a0, 0.1);
    bounce.position.set(10, -20, 60);
    scene.add(bounce);

    /* --------------------------------------------------------- 部件表 */
    const parts = [];
    function part(delay, name) {
      const g = new T.Group();
      g.userData.delay = delay;
      g.userData.name = name || '';
      root.add(g);
      parts.push(g);
      return g;
    }
    function add(parent, mesh, cast, receive) {
      mesh.castShadow = cast !== false;
      mesh.receiveShadow = receive !== false;
      parent.add(mesh);
      return mesh;
    }

    /* ================================================================
     * 地面
     * ============================================================== */
    const gGround = part(0.0, 'ground');

    /* 一张径向渐隐贴图：让地面在远处淡出，直接露出 CSS 天空，
       这样就不会出现"三维地平线 与 天空"两种颜色对不齐的硬边 */
    function makeGroundAlpha() {
      const s = 512;
      const cv = document.createElement('canvas');
      cv.width = s;
      cv.height = s;
      const g2 = cv.getContext('2d');
      g2.clearRect(0, 0, s, s);
      const grd = g2.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.41);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.55, '#ffffff');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g2.fillStyle = grd;
      g2.fillRect(0, 0, s, s);
      const t = new T.CanvasTexture(cv);
      t.needsUpdate = true;
      return t;
    }

    const groundMat = std(PAL.ground, { roughness: 0.98 });
    groundMat.alphaMap = makeGroundAlpha();
    groundMat.transparent = true;
    groundMat.depthWrite = false;

    const ground = new T.Mesh(new T.PlaneGeometry(920, 920), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    gGround.add(ground);

    const avenue = new T.Mesh(
      new T.PlaneGeometry(58, 260),
      std(PAL.paving, { roughness: 0.94 })
    );
    avenue.rotation.x = -Math.PI / 2;
    avenue.position.set(0, 0.06, 46);
    avenue.receiveShadow = true;
    gGround.add(avenue);

    // 楼前广场
    const plaza = new T.Mesh(
      new T.PlaneGeometry(150, 120),
      std(PAL.pavingDark, { roughness: 0.95 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.04, -6);
    plaza.receiveShadow = true;
    gGround.add(plaza);

    /* ================================================================
     * 大礼堂
     * ============================================================== */
    const matWall = std(PAL.wall);
    const matWallDark = std(PAL.wallDark);
    const matTrim = std(PAL.trim);
    const matBase = std(PAL.base);
    const matStone = std(PAL.stone);
    const matWin = std(PAL.win, { roughness: 0.42, metalness: 0.25 });
    const matWinFrame = std(PAL.trim, { roughness: 0.88 });

    /* 一扇窗 = 白窗框 + 深色玻璃 + 窗台；face 传 'x' 表示开在侧墙上 */
    function addWindow(parent, x, y, z, w, h, face) {
      const isX = face === 'x';
      const dir = isX ? (x >= 0 ? 1 : -1) : 1;
      const f = isX
        ? box(0.26, h + 1.0, w + 1.0, matWinFrame, x + dir * 0.06, y, z)
        : box(w + 1.0, h + 1.0, 0.26, matWinFrame, x, y, z + dir * 0.06);
      add(parent, f, false, false);
      const pane = isX
        ? box(0.26, h, w, matWin, x + dir * 0.12, y, z)
        : box(w, h, 0.26, matWin, x, y, z + dir * 0.12);
      add(parent, pane, false, false);
      const sill = isX
        ? box(0.5, 0.26, w + 1.4, matWinFrame, x + dir * 0.16, y - h / 2 - 0.45, z)
        : box(w + 1.4, 0.26, 0.5, matWinFrame, x, y - h / 2 - 0.45, z + dir * 0.16);
      add(parent, sill, false, false);
    }

    const BUILD_W = 44;   // 主楼宽
    const BUILD_D = 24;   // 主楼进深
    const PODIUM_H = 1.9;

    /* ---- 台基 + 台阶 ---- */
    const gPodium = part(0.08, 'podium');
    add(gPodium, box(60, PODIUM_H, 38, matBase, 0, PODIUM_H / 2, 2));
    add(gPodium, box(60.6, 0.34, 38.6, matTrim, 0, PODIUM_H + 0.17, 2));
    for (let i = 0; i < 3; i++) {
      add(gPodium, box(34 - i * 3, 0.42, 2.2, matBase, 0, PODIUM_H - 0.21 - i * 0.42, 22 + i * 2.2));
    }

    /* ---- 两侧翼楼 ---- */
    const gWings = part(0.26, 'wings');
    [-1, 1].forEach(function (s) {
      add(gWings, box(17, 13.5, 27, matWall, s * 30.5, PODIUM_H + 6.75, -0.5));
      add(gWings, box(18, 0.9, 28, matTrim, s * 30.5, PODIUM_H + 13.9, -0.5));
      add(gWings, box(17.4, 2.4, 27.4, matWallDark, s * 30.5, PODIUM_H + 1.2, -0.5));
      // 翼楼窗（正面 3 列 × 2 层）
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          addWindow(gWings, s * (25.2 + c * 5.5), PODIUM_H + 4.9 + r * 5.4, 13.02, 2.6, 3.6);
        }
      }
      // 翼楼端头窗
      for (let r = 0; r < 2; r++) {
        addWindow(gWings, s * (39.02), PODIUM_H + 4.9 + r * 5.4, -0.5, 2.4, 3.4, 'x');
      }
    });

    /* ---- 主楼 ---- */
    const gBody = part(0.44, 'body');
    add(gBody, box(BUILD_W, 17, BUILD_D, matWall, 0, PODIUM_H + 8.5, 0));
    add(gBody, box(BUILD_W + 0.6, 3.2, BUILD_D + 0.6, matWallDark, 0, PODIUM_H + 1.6, 0));
    add(gBody, box(BUILD_W + 2.2, 1.0, BUILD_D + 2.2, matTrim, 0, PODIUM_H + 17.4, 0));
    // 正门
    add(gBody, box(6.2, 9.2, 0.6, matWin, 0, PODIUM_H + 4.6, BUILD_D / 2 + 0.05), false);
    add(gBody, box(7.4, 0.7, 0.9, matTrim, 0, PODIUM_H + 9.5, BUILD_D / 2 + 0.3));
    // 主楼正面窗：门廊两侧各两扇，两层
    for (let r = 0; r < 2; r++) {
      [-19.6, -16.4, 16.4, 19.6].forEach(function (x) {
        addWindow(gBody, x, PODIUM_H + 5.0 + r * 5.0, BUILD_D / 2 + 0.02, 2.3, 3.4);
      });
    }
    // 主楼两端侧窗
    for (let r = 0; r < 2; r++) {
      addWindow(gBody, BUILD_W / 2 + 0.02, PODIUM_H + 5.0 + r * 5.0, -3.5, 2.3, 3.4, 'x');
      addWindow(gBody, -(BUILD_W / 2 + 0.02), PODIUM_H + 5.0 + r * 5.0, -3.5, 2.3, 3.4, 'x');
    }

    /* ---- 门廊：六根爱奥尼柱 ---- */
    const COL_H = 12.2;
    const COL_Z = 13.6;
    const colX = [-11.6, -3.9, 3.9, 11.6];
    colX.forEach(function (x, i) {
      const g = part(0.62 + i * 0.05, 'column');
      add(g, box(2.9, 0.55, 2.9, matTrim, x, PODIUM_H + 0.28, COL_Z));
      const shaft = cyl(0.78, 0.88, COL_H, 14, std(PAL.wall, { roughness: 0.9 }));
      add(g, shaft, true, true).position.set(x, PODIUM_H + 0.55 + COL_H / 2, COL_Z);
      add(g, box(2.7, 0.62, 2.7, matTrim, x, PODIUM_H + 0.55 + COL_H + 0.31, COL_Z));
      // 爱奥尼涡卷
      [-0.95, 0.95].forEach(function (dx) {
        const v = new T.Mesh(new T.TorusGeometry(0.4, 0.15, 6, 12), matTrim);
        v.position.set(x + dx, PODIUM_H + 0.55 + COL_H + 0.05, COL_Z + 1.25);
        add(g, v, false);
      });
    });

    /* ---- 檐部 + 山花 + 屋面 ---- */
    const gRoof = part(1.02, 'roof');
    add(gRoof, box(30, 2.4, 3.6, matTrim, 0, PODIUM_H + COL_H + 1.75, COL_Z));
    add(gRoof, box(30.8, 0.5, 4.1, matTrim, 0, PODIUM_H + COL_H + 3.2, COL_Z));

    const pedShape = new T.Shape();
    pedShape.moveTo(-15, 0);
    pedShape.lineTo(15, 0);
    pedShape.lineTo(0, 6.2);
    pedShape.lineTo(-15, 0);
    const pedGeo = new T.ExtrudeGeometry(pedShape, { depth: 3.2, bevelEnabled: false });
    pedGeo.translate(0, 0, -1.6);
    add(gRoof, new T.Mesh(pedGeo, matWall), true, true).position.set(0, PODIUM_H + COL_H + 3.45, COL_Z);
    // 山花浮雕
    const relief = new T.Mesh(new T.TorusGeometry(2.0, 0.34, 8, 20), matTrim);
    relief.position.set(0, PODIUM_H + COL_H + 5.6, COL_Z + 1.62);
    add(gRoof, relief, false);

    // 主楼屋面（穹顶底座）
    add(gRoof, box(BUILD_W + 1.4, 2.6, BUILD_D + 1.4, matWallDark, 0, PODIUM_H + 19.2, 0));

    /* ---- 穹顶 ---- */
    const gDome = part(1.22, 'dome');
    const DRUM_TOP = PODIUM_H + 20.5 + 4.6;
    add(gDome, cyl(13.6, 13.9, 4.6, 24, matWall, 0, PODIUM_H + 20.5 + 2.3, 0));
    add(gDome, cyl(14.4, 14.4, 0.6, 24, matTrim, 0, DRUM_TOP, 0));

    const domeGeo = new T.SphereGeometry(13.6, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = std(PAL.dome, { flatShading: true, roughness: 0.62, metalness: 0.12 });
    const dome = new T.Mesh(domeGeo, domeMat);
    dome.scale.set(1, 0.56, 1);
    dome.position.set(0, DRUM_TOP + 0.28, 0);
    add(gDome, dome, true, false);



    const DOME_TOP = DRUM_TOP + 13.6 * 0.56 + 0.28;

    /* ---- 红色八角灯笼亭 + 尖顶 ---- */
    const gLantern = part(1.42, 'lantern');
    add(gLantern, cyl(4.0, 4.3, 0.5, 8, matTrim, 0, DOME_TOP - 0.1, 0));
    const drumRed = new T.Mesh(
      new T.CylinderGeometry(3.5, 3.5, 3.2, 8, 1, true),
      std(PAL.red, { side: T.DoubleSide, roughness: 0.78 })
    );
    drumRed.position.set(0, DOME_TOP + 1.7, 0);
    add(gLantern, drumRed, true, false);
    // 灯笼亭窗洞
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const w = new T.Mesh(new T.BoxGeometry(1.15, 1.9, 0.16), std(0x2b3336, { roughness: 0.5 }));
      w.position.set(Math.cos(a) * 3.46, DOME_TOP + 1.75, Math.sin(a) * 3.46);
      w.rotation.y = -a + Math.PI / 2;
      add(gLantern, w, false, false);
    }
    add(gLantern, cyl(4.3, 2.6, 1.1, 8, std(PAL.roof, { flatShading: true }), 0, DOME_TOP + 3.85, 0));
    add(gLantern, cyl(0.55, 0.9, 0.9, 8, matTrim, 0, DOME_TOP + 4.7, 0));
    add(gLantern, cyl(0.09, 0.09, 3.0, 6, matTrim, 0, DOME_TOP + 6.6, 0));
    const finial = new T.Mesh(new T.SphereGeometry(0.34, 10, 8), std(0xc8a15a, { metalness: 0.6, roughness: 0.35 }));
    add(gLantern, finial, false, false).position.set(0, DOME_TOP + 8.2, 0);

    /* ================================================================
     * 礼堂两侧的竖幅：以科學名世 / 以人才報國（布面会飘）
     * ============================================================== */
    const bannerMats = [];
    const bannerGroups = [];

    /* 书法字体栈：行楷优先，其次新魏 / 楷体 */
    const BRUSH_FONT = '"华文行楷","STXingkai","华文新魏","STXinwei","楷体","KaiTi",serif';

    /* 固定种子随机，保证每次生成的布面一致 */
    let _seed = 20251027;
    function BRUSH_RND() {
      _seed = (_seed * 1664525 + 1013904223) % 4294967296;
      return _seed / 4294967296;
    }

    /* 把一个字画成"毛笔写的"：先渲染，再做像素扰动做出毛边，最后带角度贴上 */
    function drawBrushChar(dst, ch, cx, cy, size, angle, seed) {
      const pad = 26;
      const S = Math.ceil(size + pad * 2);
      const tmp = document.createElement('canvas');
      tmp.width = S;
      tmp.height = S;
      const t2 = tmp.getContext('2d');
      t2.fillStyle = '#FFFFFF';
      t2.textAlign = 'center';
      t2.textBaseline = 'middle';
      t2.font = '400 ' + size + 'px ' + BRUSH_FONT;
      t2.fillText(ch, S / 2, S / 2 + size * 0.05);
      // 描一圈，让笔画更浓，像蘸饱了墨
      t2.lineWidth = Math.max(1.2, size * 0.024);
      t2.strokeStyle = '#FFFFFF';
      t2.lineJoin = 'round';
      t2.strokeText(ch, S / 2, S / 2 + size * 0.05);

      const img = t2.getImageData(0, 0, S, S);
      const src = img.data;
      const out = t2.createImageData(S, S);
      const od = out.data;
      let sd = seed >>> 0;
      const rnd = function () {
        sd = (sd * 1664525 + 1013904223) >>> 0;
        return sd / 4294967296;
      };
      const amp = size * 0.026;
      const f = 0.085;
      const p1 = rnd() * 6.283;
      const p2 = rnd() * 6.283;

      for (let y = 0; y < S; y++) {
        const dy = Math.cos(y * f * 1.7 + p2) * amp * 0.9;
        for (let x = 0; x < S; x++) {
          const dx = Math.sin(y * f + p1) * amp + Math.sin(y * f * 2.9 + p2) * amp * 0.55;
          const sx = (x + dx) | 0;
          const sy = (y + dy) | 0;
          const j = (y * S + x) * 4;
          if (sx >= 0 && sx < S && sy >= 0 && sy < S) {
            const i = (sy * S + sx) * 4;
            od[j] = src[i];
            od[j + 1] = src[i + 1];
            od[j + 2] = src[i + 2];
            od[j + 3] = src[i + 3];
          } else {
            od[j + 3] = 0;
          }
        }
      }
      t2.putImageData(out, 0, 0);

      dst.save();
      dst.translate(cx, cy);
      dst.rotate(angle);
      dst.drawImage(tmp, -S / 2, -S / 2);
      dst.restore();
    }

    /* 用 canvas 现画布面：白底 + 墨绿主面 + 顶部浅绿斜带 + 底部橄榄斜带 + 竖排白字 */
    function makeBannerTexture(text) {
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 1024;
      const g2 = cv.getContext('2d');
      const SK = 42; // 斜切量

      g2.fillStyle = '#FFFFFF';
      g2.fillRect(0, 0, 256, 1024);

      // 顶部浅绿斜带
      g2.fillStyle = '#8CAF5F';
      g2.beginPath();
      g2.moveTo(0, 60); g2.lineTo(256, 60 - SK);
      g2.lineTo(256, 112 - SK); g2.lineTo(0, 112);
      g2.closePath(); g2.fill();

      // 墨绿主面
      g2.fillStyle = '#2F5B39';
      g2.beginPath();
      g2.moveTo(0, 112); g2.lineTo(256, 112 - SK);
      g2.lineTo(256, 872 - SK); g2.lineTo(0, 872);
      g2.closePath(); g2.fill();

      // 底部橄榄色斜带
      g2.fillStyle = '#B9B03C';
      g2.beginPath();
      g2.moveTo(0, 872); g2.lineTo(256, 872 - SK);
      g2.lineTo(256, 918 - SK); g2.lineTo(0, 918);
      g2.closePath(); g2.fill();

      // 布面斑驳肌理
      for (let i = 0; i < 260; i++) {
        const x = Math.random() * 256;
        const y = 120 + Math.random() * 740;
        const r = 4 + Math.random() * 26;
        g2.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
        g2.beginPath();
        g2.arc(x, y, r, 0, Math.PI * 2);
        g2.fill();
      }

      // 竖排书法字：行楷 + 逐字手写抖动 + 笔锋毛边
      const chars = text.split('');
      const top = 268;
      const step = 136;
      chars.forEach(function (ch, i) {
        const r1 = BRUSH_RND();
        const r2 = BRUSH_RND();
        const size = 136 * (0.95 + r1 * 0.12);
        const angle = (r2 - 0.5) * 0.13;
        const cx = 128 + (r1 - 0.5) * 12;
        const cy = top + i * step + (r2 - 0.5) * 10;
        drawBrushChar(g2, ch, cx, cy, size, angle, 1337 + i * 311);
      });

      // 淡淡的飞白
      g2.globalAlpha = 0.06;
      g2.fillStyle = '#FFFFFF';
      g2.fillRect(0, 120, 256, 760);
      g2.globalAlpha = 1;

      const tex = new T.CanvasTexture(cv);
      if ('encoding' in tex) tex.encoding = T.sRGBEncoding;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      return tex;
    }

    const bannerVert = [
      'uniform float uTime;',
      'varying vec2 vUv;',
      'varying float vShade;',
      'void main(){',
      '  vUv = uv;',
      '  vec3 p = position;',
      '  float hang = pow(1.0 - uv.y, 1.35);',
      '  float s = sin(uv.y * 6.2 + uTime * 1.45) * 0.5',
      '          + sin(uv.y * 11.5 - uTime * 2.15 + uv.x * 2.4) * 0.2;',
      '  p.z += s * hang;',
      '  p.x += cos(uv.y * 5.0 + uTime * 1.05) * 0.11 * hang;',
      '  vShade = 0.84 + 0.16 * (0.5 + 0.5 * cos(uv.y * 6.2 + uTime * 1.45));',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
      '}',
    ].join('\n');

    const bannerFrag = [
      'uniform sampler2D uMap;',
      'varying vec2 vUv;',
      'varying float vShade;',
      'void main(){',
      '  vec3 c = texture2D(uMap, vUv).rgb * vShade;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n');

    function buildBanners() {
      const g = part(1.52, 'banners');
      [
        { text: '以科學名世', x: 25.4 },
        { text: '以人才報國', x: -25.4 },
      ].forEach(function (cfg) {
        const grp = new T.Group();
        grp.position.set(cfg.x, 0, 19.5);

        // 横杆
        const rod = new T.Mesh(
          new T.CylinderGeometry(0.085, 0.085, 5.2, 8),
          std(0x6b5a3a, { metalness: 0.55, roughness: 0.45 })
        );
        rod.rotation.z = Math.PI / 2;
        rod.position.y = 18.9;
        rod.castShadow = true;
        grp.add(rod);

        // 杆头小圆球
        [-2.6, 2.6].forEach(function (dx) {
          const cap = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), std(0xc8a15a, { metalness: 0.7, roughness: 0.3 }));
          cap.position.set(dx, 18.9, 0);
          grp.add(cap);
        });

        // 布面
        const tex = makeBannerTexture(cfg.text);
        const mat = new T.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uMap: { value: tex } },
          side: T.DoubleSide,
          vertexShader: bannerVert,
          fragmentShader: bannerFrag,
        });
        const mesh = new T.Mesh(new T.PlaneGeometry(5.1, 17.4, 6, 40), mat);
        mesh.position.set(0, 18.7 - 8.7, 0);
        grp.add(mesh);
        bannerMats.push(mat);

        g.add(grp);
        bannerGroups.push(grp);
      });
    }
    buildBanners();
    /* ================================================================
     * 八角喷泉
     * ============================================================== */
    const FZ = 42;
    const gBasin = part(0.16, 'basin');
    const oct = Math.PI / 8;
    // 外圈台基
    add(gBasin, cyl(14.6, 15.1, 0.55, 8, std(PAL.pool, { roughness: 0.95 }), 0, 0.28, FZ)).rotation.y = oct;
    // 水池池壁
    add(gBasin, cyl(11.7, 11.7, 2.2, 8, std(PAL.poolDark, { roughness: 0.9 }), 0, 1.6, FZ)).rotation.y = oct;
    // 八角池沿
    const rim = new T.Mesh(new T.TorusGeometry(11.55, 0.22, 6, 8), matTrim);
    rim.rotation.x = -Math.PI / 2;
    rim.rotation.z = oct;
    rim.position.set(0, 2.74, FZ);
    add(gBasin, rim, true, true);

    // 水面（自定义波纹）
    const waterUniforms = {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
    };
    const waterMat = new T.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform float uAlpha;',
        'const vec3 uDeep = vec3(0.043, 0.353, 0.278);',
        'const vec3 uShallow = vec3(0.286, 0.878, 0.612);',
        'varying vec2 vUv;',
        'void main(){',
        '  vec2 p = vUv - 0.5; float r = length(p) * 2.0;',
        '  float w1 = sin(r * 13.0 - uTime * 2.0) * 0.5 + 0.5;',
        '  float w2 = sin(r * 6.5 - uTime * 1.05 + 1.7) * 0.5 + 0.5;',
        '  float h = mix(w1, w2, 0.45);',
        '  vec3 col = mix(uDeep, uShallow, 0.40 + h * 0.36);',
        '  float spec = pow(max(0.0, 1.0 - r), 3.5) * (0.25 + 0.45 * h);',
        '  col += spec * 0.9;',
        '  col *= 1.0 - smoothstep(0.70, 1.0, r) * 0.34;',
        '  gl_FragColor = vec4(col, uAlpha * 0.94);',
        '}',
      ].join('\n'),
    });
    const water = new T.Mesh(new T.CircleGeometry(11.4, 64), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 2.72, FZ);
    gBasin.add(water);

    /* 池面上漂着的梧桐叶：形状是两段二次曲线拼出的叶形 */
    const leafMeshes = [];
    (function () {
      const shape = new T.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.52, 0.5, 0, 1.02);
      shape.quadraticCurveTo(-0.52, 0.5, 0, 0);
      const leafGeo = new T.ShapeGeometry(shape);
      leafGeo.center();
      const tones = [0xcabb56, 0xb8a948, 0xd8c76e, 0xa6a24e, 0xc0b04f];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.random() * 0.6;
        const r = 3.4 + Math.random() * 7.4;
        const m = new T.Mesh(
          leafGeo,
          std(tones[i % tones.length], { side: T.DoubleSide, roughness: 0.88 })
        );
        m.scale.setScalar(0.75 + Math.random() * 0.55);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = Math.random() * Math.PI * 2;
        m.position.set(Math.cos(a) * r, 2.76, FZ + Math.sin(a) * r);
        m.userData.ang = a;
        m.userData.rad = r;
        m.userData.rot = m.rotation.z;
        m.userData.spin = (Math.random() - 0.5) * 0.22;
        m.userData.phase = Math.random() * 6.28;
        gBasin.add(m);
        leafMeshes.push(m);
      }
    })();

    // 中央盘
    const gPedestal = part(0.95, 'pedestal');
    const bronze = std(0x8a5a3c, { roughness: 0.55, metalness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      add(gPedestal, cyl(0.5, 0.62, 1.45, 8, bronze, Math.cos(a) * 2.8, 3.45, FZ + Math.sin(a) * 2.8));
    }
    add(gPedestal, cyl(6.4, 3.2, 1.4, 20, bronze, 0, 4.7, FZ));
    add(gPedestal, cyl(5.9, 5.9, 0.16, 20, std(0x2f7f70, { roughness: 0.25 }), 0, 5.44, FZ));
    add(gPedestal, cyl(0.55, 0.8, 0.9, 12, bronze, 0, 5.9, FZ));

    /* ---- 水柱粒子（抛物线下落） ---- */
    const JETS = 900;
    const jetsGeo = new T.BufferGeometry();
    const pos = new Float32Array(JETS * 3);
    const aPhase = new Float32Array(JETS);
    const aAngle = new Float32Array(JETS);
    const aSpeed = new Float32Array(JETS);
    for (let i = 0; i < JETS; i++) {
      aPhase[i] = Math.random();
      aAngle[i] = Math.random() * Math.PI * 2;
      aSpeed[i] = 0.85 + Math.random() * 0.35;
    }
    jetsGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    jetsGeo.setAttribute('aPhase', new T.BufferAttribute(aPhase, 1));
    jetsGeo.setAttribute('aAngle', new T.BufferAttribute(aAngle, 1));
    jetsGeo.setAttribute('aSpeed', new T.BufferAttribute(aSpeed, 1));

    const jetsUniforms = { uTime: { value: 0 }, uProgress: { value: 0 } };
    const jetsMat = new T.ShaderMaterial({
      uniforms: jetsUniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: [
        'attribute float aPhase; attribute float aAngle; attribute float aSpeed;',
        'uniform float uTime; uniform float uProgress;',
        'varying float vA;',
        'void main(){',
        '  float t = fract(uTime * 0.42 * aSpeed + aPhase);',
        '  float rr = 5.3 + t * 5.0;',
        '  float yy = 5.45 + t * 2.5 - t * t * 5.1;',
        '  vec3 p = vec3(cos(aAngle) * rr, yy, sin(aAngle) * rr);',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_PointSize = (58.0 / max(1.0, -mv.z)) * 2.2;',
        '  gl_Position = projectionMatrix * mv;',
        '  vA = smoothstep(0.0,0.06,t) * (1.0 - smoothstep(0.82,1.0,t)) * uProgress;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying float vA;',
        'void main(){',
        '  float d = length(gl_PointCoord - 0.5);',
        '  float a = smoothstep(0.5, 0.06, d);',
        '  gl_FragColor = vec4(vec3(0.82, 0.95, 0.98), a * vA * 0.85);',
        '}',
      ].join('\n'),
    });
    const jets = new T.Points(jetsGeo, jetsMat);
    jets.position.set(0, 0, FZ);
    gPedestal.add(jets);

    // 中央竖直水柱
    const CJETS = 400;
    const cGeo = new T.BufferGeometry();
    const cPos = new Float32Array(CJETS * 3);
    const cPhase = new Float32Array(CJETS);
    const cAng = new Float32Array(CJETS);
    const cSpd = new Float32Array(CJETS);
    for (let i = 0; i < CJETS; i++) {
      cPhase[i] = Math.random();
      cAng[i] = Math.random() * Math.PI * 2;
      cSpd[i] = 0.9 + Math.random() * 0.4;
    }
    cGeo.setAttribute('position', new T.BufferAttribute(cPos, 3));
    cGeo.setAttribute('aPhase', new T.BufferAttribute(cPhase, 1));
    cGeo.setAttribute('aAngle', new T.BufferAttribute(cAng, 1));
    cGeo.setAttribute('aSpeed', new T.BufferAttribute(cSpd, 1));
    const cMat = jetsMat.clone();
    cMat.uniforms = { uTime: jetsUniforms.uTime, uProgress: jetsUniforms.uProgress };
    cMat.vertexShader = [
      'attribute float aPhase; attribute float aAngle; attribute float aSpeed;',
      'uniform float uTime; uniform float uProgress;',
      'varying float vA;',
      'void main(){',
      '  float t = fract(uTime * 0.55 * aSpeed + aPhase);',
      '  float rr = 0.5 + t * 1.6 + sin(aAngle*3.0) * 0.15;',
      '  float yy = 6.6 + t * 7.4 - t * t * 9.6;',
      '  vec3 p = vec3(cos(aAngle) * rr, yy, sin(aAngle) * rr);',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = (54.0 / max(1.0, -mv.z)) * 2.2;',
      '  gl_Position = projectionMatrix * mv;',
      '  vA = smoothstep(0.0,0.05,t) * (1.0 - smoothstep(0.80,1.0,t)) * uProgress;',
      '}',
    ].join('\n');
    const cJets = new T.Points(cGeo, cMat);
    cJets.position.set(0, 0, FZ);
    gPedestal.add(cJets);

    // 把喷泉整体放大并前移：让它在前景里更有存在感
    // 尺寸已按实物比例给好，不再整体放大

    /* ================================================================
     * 梧桐
     * ============================================================== */
    function makeTree(seed, tall) {
      const g = new T.Group();
      const h = tall ? 15.0 + (seed % 4) * 1.3 : 8.2 + (seed % 5) * 0.5;
      const k = tall ? 1.55 : 1.0;
      const trunkMat = std(PAL.trunk, { roughness: 0.95, flatShading: true });
      const trunk = new T.Mesh(new T.CylinderGeometry(0.38 * k, 0.72 * k, h, 7), trunkMat);
      trunk.position.y = h / 2;
      trunk.rotation.z = ((seed % 7) - 3) * 0.022;
      g.add(trunk);

      const blobs = tall ? 6 + (seed % 2) : 4 + (seed % 3);
      for (let i = 0; i < blobs; i++) {
        const a = (i / blobs) * Math.PI * 2 + seed;
        const r = (1.7 + ((seed * (i + 3)) % 5) * 0.42) * k;
        const leafMat = std(PAL.leaf[(seed + i) % PAL.leaf.length], {
          roughness: 0.92,
          flatShading: true,
        });
        const b = new T.Mesh(new T.IcosahedronGeometry((2.3 + ((seed + i) % 4) * 0.32) * k, 0), leafMat);
        b.position.set(Math.cos(a) * r, h - 0.6 + Math.sin(a * 1.7) * 1.5 * k + i * 0.34 * k, Math.sin(a) * r);
        b.scale.set(1, 0.82, 1);
        b.rotation.set(seed * 0.4, a, seed * 0.2);
        g.add(b);
      }
      g.userData.seed = seed;
      return g;
    }

    const gTrees = part(1.62, 'trees');
    const treeSlots = [];
    // 两侧梧桐林：离镜头远、不会挡住主体，但给足纵深
    for (let z = -34; z <= 74; z += 12) {
      treeSlots.push([-56 - (z % 5) * 1.6, z, 1]);
      treeSlots.push([56 + (z % 4) * 1.8, z + 6, 2]);
      treeSlots.push([-74 - (z % 3) * 2.2, z + 3, 3]);
      treeSlots.push([74 + (z % 6) * 1.4, z + 9, 4]);
    }
    // 楼后再补一排，让天际线不空
    for (let x = -84; x <= 84; x += 15) {
      treeSlots.push([x, -46 - Math.abs(x) * 0.08, 5]);
    }
    // 礼堂两侧的高大梧桐
    [-1, 1].forEach(function (side) {
      [-16, 10, 36].forEach(function (z, k) {
        treeSlots.push([side * (45.5 + k * 3.4), z, 1, true]);
      });
    });
    treeSlots.forEach(function (s, i) {
      const tall = !!s[3];
      const tree = makeTree(i + 1, tall);
      tree.position.set(s[0], 0, s[1]);
      const sc = 1.0 + ((i * 7) % 5) * 0.08;
      tree.scale.setScalar(sc);
      tree.rotation.y = (i % 9) * 0.7;
      tree.userData.baseScale = sc;
      gTrees.add(tree);
      tree.traverse(function (o) {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
    });

    /* ================================================================
     * 生成动画
     * ============================================================== */
    let buildStart = 0;
    const PART_SPAN = 1.1;

    function startBuild() {
      buildStart = clock.getElapsedTime();
      parts.forEach(function (g) {
        g.userData.baseY = 0;
      });
      waterUniforms.uAlpha.value = 0;
      jetsUniforms.uProgress.value = 0;
    }

    function updateBuild(t) {
      const dt = t - buildStart;
      parts.forEach(function (g) {
        const d = g.userData.delay;
        const k = clamp((dt - d) / PART_SPAN, 0, 1);
        const e = easeOutCubic(k);
        const name = g.userData.name;
        g.position.y = name === 'ground' ? 0 : (e - 1) * 9;
        g.visible = k > 0.001;
        if (name === 'trees') {
          g.children.forEach(function (tree) {
            const grow = clamp((dt - d - 0.35) / 1.4, 0.001, 1);
            tree.scale.setScalar(tree.userData.baseScale * easeOutBack(grow));
            tree.visible = grow > 0.002;
          });
        }
      });
      waterUniforms.uAlpha.value = clamp((dt - 1.5) / 1.0, 0, 1);
      jetsUniforms.uProgress.value = clamp((dt - 1.9) / 1.1, 0, 1);
    }

    /* ================================================================
     * 相机
     * ============================================================== */
    const clock = new T.Clock();
    const cam = {
      r: 132,
      baseR: 132,
      rNow: 300,
      theta: 0,
      thetaNow: 0.5,
      phi: 0.255,
      phiNow: 0.32,
      mx: 0,
      my: 0,
      mxNow: 0,
      myNow: 0,
      drag: false,
    };
    const LOOK = new T.Vector3(0, 14, 10);

    let W = 1;
    let H = 1;
    let wide = true;

    let lastW = 0, lastH = 0, rsTimer = 0;
    function resize() {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      // 尺寸没变就直接退出：手机地址栏收缩时 resize 会连续触发，
      // 每触发一次就重建 WebGL 画布，画面会闪
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      W = w;
      H = h;
      wide = w / h > 1.05;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;

      // 按可视范围反算机位距离：竖屏时自动退远，别让建筑顶满屏幕
      const vFov = (camera.fov * Math.PI) / 180;
      const tanH = Math.tan(vFov / 2);
      const needW = 76 / (2 * tanH * Math.max(0.3, camera.aspect));
      const needH = 46 / (2 * tanH);
      const fit = Math.max(needW * 1.3, needH * 1.3);
      cam.baseR = wide ? Math.max(132, fit) : fit;
      LOOK.y = wide ? 14 : 8;

      // 雾跟着机位走：近处清晰，远处融进夜色，避免出现生硬的地平线
      scene.fog.near = cam.baseR * 1.15;
      scene.fog.far = cam.baseR * 2.4;

      // 桌面端把画面整体右移，给左侧文案留位置
      if (wide) camera.setViewOffset(w, h, -w * 0.17, h * 0.012, w, h);
      else camera.setViewOffset(w, h, 0, h * 0.07, w, h);
      camera.updateProjectionMatrix();
    }

    function updateCamera(t) {
      // 平滑趋近
      const k = 0.06;
      cam.rNow += (cam.baseR - cam.rNow) * k;
      cam.mxNow += (cam.mx - cam.mxNow) * 0.05;
      cam.myNow += (cam.my - cam.myNow) * 0.05;

      const theta = cam.theta + cam.mxNow * 0.1 + Math.sin(t * 0.24) * 0.014;
      const phi = cam.phi + cam.myNow * 0.05 + Math.sin(t * 0.31 + 1) * 0.006;

      const cp = Math.cos(phi);
      camera.position.set(
        cam.rNow * Math.sin(theta) * cp,
        cam.rNow * Math.sin(phi) + 7,
        cam.rNow * Math.cos(theta) * cp
      );
      camera.lookAt(LOOK);
    }

    /* ================================================================
     * 交互
     * ============================================================== */
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        cam.theta = clamp(cam.theta - dx * 0.0045, -0.62, 0.62);
        cam.phi = clamp(cam.phi + dy * 0.0016, 0.045, 0.44);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });
    function endDrag() {
      dragging = false;
      canvas.style.cursor = 'grab';
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'pan-y';

    if (window.matchMedia) {
      window.addEventListener(
        'pointermove',
        function (e) {
          if (dragging) return;
          cam.mx = (e.clientX / window.innerWidth) * 2 - 1;
          cam.my = (e.clientY / window.innerHeight) * 2 - 1;
        },
        { passive: true }
      );
    }

    /* ================================================================
     * 渲染循环
     * ============================================================== */
    let raf = 0;
    let active = true;
    let started = false;

    function frame() {
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();
      if (!started) {
        started = true;
        startBuild();
      }
      updateBuild(t);
      waterUniforms.uTime.value = t;
      jetsUniforms.uTime.value = t;
      if (leafMeshes.length) {
        for (let i = 0; i < leafMeshes.length; i++) {
          const L = leafMeshes[i];
          const ang = L.userData.ang + t * 0.032;
          L.position.x = Math.cos(ang) * L.userData.rad;
          L.position.z = FZ + Math.sin(ang) * L.userData.rad;
          L.position.y = 2.76 + Math.sin(t * 0.85 + L.userData.phase) * 0.016;
          L.rotation.z = L.userData.rot + t * L.userData.spin;
        }
      }
      if (bannerMats.length) {
        for (let i = 0; i < bannerMats.length; i++) {
          bannerMats[i].uniforms.uTime.value = t;
          bannerGroups[i].rotation.z = Math.sin(t * 0.62 + i * 1.7) * 0.022;
        }
      }
      updateCamera(t);
      renderer.render(scene, camera);
    }

    function setActive(v) {
      active = v;
      if (v) {
        if (!raf) frame();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    resize();
    function scheduleResize() {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(resize, 120);
    }
    window.addEventListener('resize', scheduleResize);
    if (window.ResizeObserver) new ResizeObserver(scheduleResize).observe(canvas);

    frame();

    /* 与首页天空联动的光照预设：切换昼夜 / 天气时一起变 */
    const MOOD_LIGHT = {
      dawn: { fog: 0xf0d6c6, sun: 0xffd7b2, sunI: 1.05, hemiI: 0.74, hemiSky: 0xf6e2d4, exp: 1.02 },
      noon: { fog: 0xcadff0, sun: 0xfffdf4, sunI: 1.30, hemiI: 0.96, hemiSky: 0xd8ecfb, exp: 1.00 },
      dusk: { fog: 0xe6a483, sun: 0xffbe86, sunI: 1.05, hemiI: 0.70, hemiSky: 0xf3c6a8, exp: 1.00 },
      night: { fog: 0x0a1a2b, sun: 0xa8c2e6, sunI: 0.42, hemiI: 0.30, hemiSky: 0xc9d8f2, exp: 0.88 },
      rain: { fog: 0x8fa2b0, sun: 0xccd8e2, sunI: 0.52, hemiI: 0.54, hemiSky: 0xa6b7c4, exp: 0.90 },
      snow: { fog: 0xc9d6e0, sun: 0xeef5fb, sunI: 0.88, hemiI: 0.86, hemiSky: 0xdfeaf3, exp: 1.00 },
    };

    function setMood(name) {
      const m = MOOD_LIGHT[name] || MOOD_LIGHT.night;
      if (scene.fog) scene.fog.color.setHex(m.fog);
      sun.color.setHex(m.sun);
      sun.intensity = m.sunI;
      hemi.color.setHex(m.hemiSky);
      hemi.intensity = m.hemiI;
      renderer.toneMappingExposure = m.exp;
    }

    return {
      setMood: setMood,
      replay: function () {
        startBuild();
        cam.theta = 0.5;
        cam.phi = 0.34;
      },
      setActive: setActive,
      dispose: function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        renderer.dispose();
      },
    };
  }

  /* ------------------------------------------------------------ 对外 */
  window.initHallScene = function (canvas, opts) {
    try {
      if (!canvas) return null;
      // WebGL 可用性探测
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return null;
      return createScene(canvas, opts || {});
    } catch (err) {
      console.warn('[scene3d] 初始化失败，回退到 SVG 版本', err);
      return null;
    }
  };
})();
