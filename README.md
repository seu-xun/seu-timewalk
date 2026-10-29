# 东南大学校史文化长廊 · 交互原型

一个**零构建、开箱即跑**的交互式校园文化页面：首屏是 Three.js 实时三维的
四牌楼大礼堂 + 八角喷泉 + 梧桐道，中段是校史轴线与红色文化，末段是八大书院的
3D 旋转画廊，收尾是一面「止於至善」书法墙，角落里还蹲着一只会答校史问题的小松鼠「东大鼠鼠」。

| 版块 | 做法 | 代码位置 |
| --- | --- | --- |
| 随机名句 | 首页副标题与尾声各从 `data.js` 的 `quotes` 里随机抽一句（每次刷新都不同，两处独立抽）；`source` 有值才显示出处 | `data.js` `quotes`、`app.js` `initQuotes()` |
| 首页天空 | 纯 CSS 扁平插画的六种天气：清晨 / 正午 / 黄昏 / 夜晚 / 下雨 / 下雪。**按系统时间自动切换昼夜**（5–8 清晨、8–16 正午、16–19 黄昏、其余夜晚），雨雪可手动切换；每种氛围换一组 CSS 变量，同时改文字色与压暗层，保证任何背景下都读得清；三维场景的光照、雾色、曝光也跟着一起变 | `sky.css`、`app.js` `initSky()`、`scene3d.js` `setMood()` |
| 首屏三维场景 | Three.js 程序化建模：大礼堂（绿铜穹顶 + 红色八角灯笼亭 + 六根爱奥尼柱 + 两侧翼楼）、礼堂两侧**会飘动的「以科學名世 / 以人才報國」竖幅**（canvas 现画布面：行楷 + 逐字手写抖动 + 像素毛边，顶点着色器做布料波动）、八角喷泉（自定义水面波纹着色器 + 900 颗粒子水柱）、梧桐林。**逐部件从地面升起**的生成动画 + 鼠标视差 + 拖拽环视 | `scene3d.js` |
| 校史 | 左侧可滚动时间轴（10 个时期，金色游标滑动跟随）+ 右侧详情卡：金渐变标题条、时期印章、五个子栏目（历史背景 / 关键沿革事件 / 学科建设 / 代表名师与校友 / 时代办学成果），切时期时整卡滑入、各段错峰入场 | `app.js` `renderEras()`、`theme-3d.css` `.era-*` |
| 红色文化 | 暗红剧场式版块，金色大数字 + 悬浮卡 | `styles.css` `.red-section` |
| 八大书院 | **3D 旋转画廊**：8 块展板围成一圈，自动旋转、可拖拽、可按键，背向的自动隐藏，点开展开详情弹层（FLIP 过渡） | `app.js` `initCarousel()` + `theme-3d.css` `.carousel` |
| 吉祥物对话 | 悬浮小松鼠「东大鼠鼠」+ 6 种随机小动作 + 打字机输出 + 关键词知识库；预留一行 `AI_ENDPOINT` 接真大模型 | `app.js` `askAI()` / `mascotActions()` |
| 尾声书法墙 | 楷体「止於至善」浮雕字逐个浮出，配《礼记·大学》原文 | `theme-3d.css` `.outro` |

---

## 一、怎么运行

**双击 `index.html` 就能看**（Three.js 已下载到 `vendor/`，不联网也能跑）。

要接真实大模型接口（`fetch` 需要 http 协议）再起个本地服务：

```bash
npx serve .
# 或
python -m http.server 8000
```

---

## 二、文件结构

```
seu-showcase/
├── index.html            结构
├── styles.css            基础视觉系统（色板 / 版式 / 时间轴 / 弹层 / 对话）
├── theme-3d.css          后加载的覆盖层：三维首屏 / 旋转画廊 / 书法墙
├── scene3d.js            ★ Three.js 场景（建筑 / 喷泉 / 树 / 生成动画）
├── app.js                渲染、画廊控制、弹层、对话
├── data.js               ★ 所有文案都在这里
├── vendor/three.min.js   Three.js r149（本地化，离线可用）
└── screenshots/          各版块截图
```

`data.js` 里有四个数组：`timeline`（校史）、`red`（红色文化）、
`colleges`（八大书院）、`qa`（吉祥物问答库）。

---

## 三、项目要经历哪些阶段

| 阶段 | 你要产出什么 | 最容易踩的坑 |
| --- | --- | --- |
| **0. 定题与素材盘点** | 一句话主题 + 素材清单（图片、史料、授权） | 图片直接百度来用，被问版权答不上 |
| **1. 内容重构**（最被低估） | 每个板块 5–9 条，每条 ≤ 80 字；一条主线故事 | 把校史馆展板整段抄上网页 |
| **2. 信息架构与线框** | 三屏线框图（纸质手绘就够）+ 导航结构 | 先做动效再想内容，最后好看但没故事 |
| **3. 视觉设计** | 色板（东大蓝 / 米白石材 / 铜绿 / 金）、字阶、间距规范 | 每屏一个风格，拼起来像三个网站 |
| **4. 技术选型与脚手架** | 跑通"能打开的一个空壳页面" | 一上来上 Next.js，三天没出第一屏 |
| **5. 动效开发（逐个攻破）** | 一次只做一个，做完就 commit | 五个动效同时开工，最后一个都没调顺 |
| **6. 内容填充与联调** | 真数据替掉占位；手机（375px）与投影（1920px）各走一遍 | 忘做移动端 |
| **7. 性能 / 无障碍 / 演示** | Lighthouse 截图、3 分钟演示脚本、**离线录屏兜底** | 现场断网，AI 对话转圈直接扣分 |

> 顺序别跳：**内容 → 线框 → 空壳 → 动效**。

---

## 四、想换成 Spline 建模？

Spline 是拖拽式建模工具（<https://spline.design>），需要人工操作，AI 无法代劳。
如果你更想要 Spline 那种"材质更精致"的观感，两条路：

**A. 留在本项目的 Three.js 场景里换模型（推荐，改动最小）**

1. 在 Blender 里按同样的部件拆分建低模 → 导出 `.glb`（面数控制在 5 万以内）。
2. 用 `GLTFLoader` 载入，替换 `scene3d.js` 里 `gBody / gRoof / gDome / gLantern`
   这几组几何；灯光、相机、喷泉、生成动画、拖拽环视都能直接复用。
3. 生成动画的关键就是：**每个部件一个 `delay`**，统一在 `updateBuild()` 里
   按 `delay` 插值 `position.y`。

**B. 直接用 Spline 导出**

Spline 里做好场景 → Export → Web / Code → 得到一段 `<script type="module">` 或
React 组件，替换掉 `#sceneCanvas` 与 `initHero()` 里的 Three.js 初始化即可。
注意 Spline 导出是 ES module，`file://` 直接双击会报 CORS，**必须起本地服务器**。

---

## 五、把吉祥物换成真 AI

三步走，第 1、2 步一天就能通：

1. **整理知识库**：把校史、红色文化、八大书院的资料写成 `data.js` 的 `qa`
   （条目越多命中越准）。这层既是断网兜底，也是后面 RAG 的语料。
2. **接大模型**：在 Vercel / Cloudflare Workers 写一个 20 行转发接口，
   把 API Key 放服务端，前端只调你的接口：

   ```js
   // 前端 app.js：只改这一行
   const AI_ENDPOINT = 'https://your-worker.workers.dev/api/chat';
   ```

   ```js
   // 后端（Cloudflare Worker 示例）
   export default {
     async fetch(req, env) {
       const { messages } = await req.json();
       const r = await fetch('https://api.deepseek.com/chat/completions', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
         },
         body: JSON.stringify({
           model: 'deepseek-chat',
           messages: [
             { role: 'system', content: SYSTEM_PROMPT + '\n\n【校史资料】\n' + KNOWLEDGE },
             ...messages,
           ],
           temperature: 0.3,
         }),
       });
       const j = await r.json();
       return Response.json({ reply: j.choices[0].message.content });
     },
   };
   ```

3. **RAG（加分项）**：资料多了塞不进 prompt，就先检索最相关 3 段再拼进 prompt。

> ⚠️ **绝对不要**把 API Key 写进前端 JS——F12 一看就没了，评委会问这个。

---

## 六、内容核对清单（提交前必做）

- [ ] 八大书院名称与培养方向 → 对照学校官方发布（本页已按 2025 年 6 月公开报道整理，
      **南工 / 南雍 / 日新** 三所书院的培养方向原文未提及，页面上留了空位，请补）
- [ ] 大礼堂的落成年份、柱式、穹顶表述
- [ ] 成贻宾烈士的生平细节（牺牲日期、年龄）
- [ ] 团二大召开的时间与地点表述
- [ ] 所有图片的版权与使用授权
- [ ] 手机（375px）和投影（1920px）两种尺寸各走一遍

---

## 七、参考资料

- [东南大学成立八个书院重塑本科新生教育（现代快报）](https://www.seu.edu.cn/2025/0626/c124a534497/page.htm)
- [东南大学八大书院上线（交汇点新闻）](https://www.seu.edu.cn/2025/0626/c124a534493/page.htm)
- [破壁垒、强整合！东南大学成立八大书院（江苏新闻广播）](http://www.vojs.cn/jsnews/175091577237.shtml)
- [东南大学大礼堂（东南大学官网）](https://zcc.seu.edu.cn/2009/1031/c4631a43224/page.psp)
- [四牌楼校区介绍（东南大学校友总会）](https://seuaa.seu.edu.cn/2023/1228/c51495a477423/page.psp)
- [徜徉红色梅庵的历史长河（教育部作品征集）](https://dxs.moe.gov.cn/zx/a/hd_qwxywlwmy_wlwmsj_sjzs_zpzj/260701/2056002.shtml)

---

## 八、技术小抄

| 想做什么 | 关键代码 |
| --- | --- |
| 建筑逐层生成 | 每部件一个 `delay`，`position.y` 从 -9 插值到 0（`scene3d.js` `updateBuild`） |
| 水面波纹 | `ShaderMaterial` + `sin(r*30 - t*2.4)` 同心环 |
| 水柱 | `Points` + 顶点着色器算抛物线 `y = 6.6 + 7.4t - 9.6t²` |
| 壁画式画廊 | `.ring { transform: rotateY(var(--rot)) }` + `.slot { rotateY(i*45deg) translateZ(r) }` |
| 左时间轴游标 | 绝对定位的 `.era-cursor`，`translateY(item.offsetTop)` + `height` 过渡 |
| 时期切换动效 | 换完 innerHTML 后 `panel.animate()`，五个 `.era-block` 用 `delay: 55 + k*55` 错峰 |
| 背向卡片消失 | `.slot { backface-visibility: hidden }` |
| 从卡片长成弹层 | `element.animate()` + 两次 `getBoundingClientRect()` 求位移与缩放 |
| 竖屏自动退远镜头 | 按 `aspect` 反算 `baseR`，同时把雾的远近一起挪 |
| 打字机效果 | `setInterval` 每次 `slice(0, i+=2)` |
| 尊重减少动效设置 | `@media (prefers-reduced-motion: reduce)` |

浏览器要求：Chrome / Edge / Safari 最新版（需 WebGL）。
无 WebGL 时会自动降级成 SVG 版大礼堂，页面不会开天窗。
