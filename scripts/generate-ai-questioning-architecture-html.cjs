const fs = require('node:fs');
const path = require('node:path');

function loadMarked() {
  try {
    return require('marked');
  } catch (error) {
    const candidateModuleRoots = [
      process.env.CODEX_WORKSPACE_NODE_MODULES,
      process.env.USERPROFILE
        ? path.join(process.env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
        : null
    ].filter(Boolean);
    for (const moduleRoot of candidateModuleRoots) {
      try {
        return require(require.resolve('marked', { paths: [moduleRoot] }));
      } catch {}
    }
    throw error;
  }
}

const { marked } = loadMarked();
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'docs', 'ai-questioning-complete-current-and-target-architecture-2026-08-10.md');
const outputPath = path.join(root, 'docs', 'ai-questioning-complete-current-and-target-architecture-2026-08-10.html');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const renderer = {
  code({ text, lang }) {
    const language = String(lang || '').trim().toLowerCase();
    if (language === 'mermaid') {
      return `
        <figure class="diagram-shell" data-diagram>
          <figcaption>
            <span>Architecture diagram</span>
            <span class="diagram-state" data-diagram-state>Rendering</span>
          </figcaption>
          <div class="diagram-viewport">
            <pre class="mermaid">${escapeHtml(text)}</pre>
          </div>
        </figure>
      `;
    }
    const className = language ? ` class="language-${escapeHtml(language)}"` : '';
    return `<pre><code${className}>${escapeHtml(text)}</code></pre>`;
  }
};

marked.use({
  gfm: true,
  breaks: false,
  renderer
});

const markdown = fs.readFileSync(sourcePath, 'utf8');
const body = marked.parse(markdown);
const generatedAt = new Date().toISOString();

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="description" content="CSCAlite AI 出题完整现状与目标架构，包括现有实现、近期计划与未来 QuestionOps 产品化方向。">
  <title>CSCAlite AI 出题完整现状与目标架构</title>
  <style>
    :root {
      --bg: #f4f7f5;
      --surface: #ffffff;
      --surface-soft: #f8faf9;
      --ink: #17211c;
      --muted: #617068;
      --line: #d8e0dc;
      --green: #26734d;
      --green-soft: #dff3e4;
      --amber: #8b6200;
      --amber-soft: #fff2cc;
      --blue: #2f6ea3;
      --blue-soft: #dcecff;
      --gray: #607d8b;
      --gray-soft: #eceff1;
      --red: #a93737;
      --red-soft: #fde2e2;
      --code: #eef3f0;
      --shadow: 0 8px 24px rgba(26, 48, 37, 0.08);
      --sidebar: 292px;
      --content: 1240px;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.72;
      letter-spacing: 0;
    }

    .progress {
      position: fixed;
      inset: 0 auto auto 0;
      z-index: 20;
      width: 0;
      height: 3px;
      background: var(--green);
    }

    .page-header {
      border-bottom: 1px solid var(--line);
      background: var(--surface);
    }
    .page-header-inner {
      width: min(100% - 40px, 1540px);
      margin: 0 auto;
      padding: 26px 0 22px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
    }
    .brand {
      min-width: 0;
    }
    .brand-kicker {
      margin: 0 0 4px;
      color: var(--green);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .brand h1 {
      margin: 0;
      font-size: clamp(24px, 3vw, 38px);
      line-height: 1.2;
      font-weight: 760;
    }
    .brand p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 14px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    button {
      min-width: 40px;
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-weight: 650;
      cursor: pointer;
    }
    button:hover { border-color: var(--green); color: var(--green); }
    button:focus-visible { outline: 3px solid rgba(47, 110, 163, 0.25); outline-offset: 2px; }
    .print-button { padding: 0 14px; }

    .legend-strip {
      border-bottom: 1px solid var(--line);
      background: var(--surface-soft);
    }
    .legend-inner {
      width: min(100% - 40px, 1540px);
      margin: 0 auto;
      min-height: 46px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 0;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 2px 9px;
      border: 1px solid;
      border-radius: 999px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
      font-weight: 750;
      line-height: 1;
    }
    .status-live { background: var(--green-soft); border-color: #85b89a; color: #195b3b; }
    .status-partial { background: var(--amber-soft); border-color: #d1ad50; color: #6f4e00; }
    .status-planned { background: var(--blue-soft); border-color: #8eb6d5; color: #20577f; }
    .status-future { background: var(--gray-soft); border-color: #aebcc3; color: #465f6b; }
    .status-boundary { background: var(--red-soft); border-color: #d89a9a; color: #8b2929; }
    .legend-note { color: var(--muted); font-size: 13px; margin-left: 4px; }

    .layout {
      width: min(100% - 40px, 1540px);
      margin: 0 auto;
      display: grid;
      grid-template-columns: var(--sidebar) minmax(0, 1fr);
      gap: 28px;
      align-items: start;
      padding: 28px 0 64px;
    }
    .toc {
      position: sticky;
      top: 18px;
      max-height: calc(100vh - 36px);
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .toc-header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      border-bottom: 1px solid var(--line);
      background: var(--surface);
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
      list-style: none;
    }
    .toc-header::-webkit-details-marker { display: none; }
    .toc-header::after { content: '+'; font-size: 17px; font-weight: 500; color: var(--muted); }
    .toc[open] .toc-header::after { content: '-'; }
    .toc nav { padding: 8px; }
    .toc a {
      display: block;
      padding: 7px 9px;
      border-left: 3px solid transparent;
      color: #4d5e55;
      text-decoration: none;
      font-size: 13px;
      line-height: 1.35;
    }
    .toc a:hover { color: var(--green); background: #f1f7f3; }
    .toc a.active { border-left-color: var(--green); background: #eaf4ed; color: #154f33; font-weight: 700; }
    .toc a.level-3 { padding-left: 22px; color: #66776e; }

    main {
      min-width: 0;
      width: 100%;
      max-width: var(--content);
      padding: 28px 38px 56px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    main > h1:first-child { display: none; }
    h2, h3 { scroll-margin-top: 18px; }
    h2 {
      margin: 54px 0 18px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      font-size: 25px;
      line-height: 1.3;
    }
    h2:first-of-type { margin-top: 0; padding-top: 0; border-top: 0; }
    h3 {
      margin: 34px 0 12px;
      font-size: 19px;
      line-height: 1.4;
    }
    h4 { margin: 26px 0 10px; font-size: 16px; }
    p { margin: 10px 0 16px; }
    ul, ol { padding-left: 24px; }
    li { margin: 5px 0; }
    strong { color: #101a15; }
    a { color: var(--blue); }
    blockquote {
      margin: 18px 0;
      padding: 12px 18px;
      border-left: 4px solid var(--green);
      background: #f1f7f3;
      color: #34483d;
    }
    hr { border: 0; border-top: 1px solid var(--line); margin: 32px 0; }

    code {
      padding: 2px 5px;
      border-radius: 4px;
      background: var(--code);
      color: #244837;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.9em;
      overflow-wrap: anywhere;
    }
    pre {
      margin: 16px 0;
      padding: 16px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #f5f8f6;
      color: #25342c;
      line-height: 1.55;
    }
    pre code { padding: 0; background: transparent; color: inherit; overflow-wrap: normal; }

    .table-wrap {
      width: 100%;
      margin: 16px 0 22px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      font-size: 14px;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th:last-child, td:last-child { border-right: 0; }
    tr:last-child td { border-bottom: 0; }
    th { background: #edf3ef; color: #263c30; font-weight: 750; white-space: nowrap; }
    tbody tr:nth-child(even) { background: #fafcfb; }

    .diagram-shell {
      margin: 20px 0 30px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fbfdfc;
      overflow: hidden;
    }
    .diagram-shell figcaption {
      min-height: 42px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--line);
      background: #edf3ef;
      color: #31463a;
      font-size: 12px;
      font-weight: 700;
    }
    .diagram-state { color: var(--muted); font-weight: 600; }
    .diagram-toolbar { display: flex; gap: 6px; margin-left: auto; }
    .diagram-toolbar button { min-width: 32px; min-height: 30px; padding: 0 8px; background: var(--surface); }
    .diagram-viewport {
      height: clamp(360px, 62vh, 680px);
      overflow: auto;
      padding: 18px;
      background: #fbfdfc;
      cursor: grab;
      user-select: none;
      touch-action: none;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    .diagram-viewport.is-dragging { cursor: grabbing; }
    .diagram-viewport:focus-visible { outline: 3px solid rgba(38, 115, 77, 0.28); outline-offset: -3px; }
    .diagram-viewport .mermaid {
      width: max-content;
      min-width: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .diagram-viewport svg {
      display: block;
      width: auto;
      max-width: none !important;
      height: auto;
      margin: auto;
      transform-origin: top left;
    }
    .diagram-shell.error .diagram-state { color: var(--red); }
    .diagram-shell.error .diagram-viewport { background: #fff8f8; }

    .footer {
      width: min(100% - 40px, 1540px);
      margin: 0 auto 36px;
      padding: 16px 0;
      color: var(--muted);
      font-size: 12px;
      text-align: right;
    }

    @media (max-width: 980px) {
      .page-header-inner { align-items: flex-start; }
      .layout { grid-template-columns: 1fr; }
      .toc { position: relative; top: auto; max-height: none; overflow: hidden; }
      .toc[open] nav { max-height: 320px; overflow: auto; }
      main { max-width: none; padding: 24px 22px 44px; }
    }
    @media (max-width: 620px) {
      body { font-size: 15px; }
      .page-header-inner, .legend-inner, .layout, .footer { width: min(100% - 24px, 1540px); }
      .page-header-inner { padding: 20px 0 18px; flex-direction: column; }
      .layout { padding-top: 16px; gap: 16px; }
      main { padding: 20px 16px 36px; }
      h2 { font-size: 21px; }
      h3 { font-size: 17px; }
      .legend-note { width: 100%; margin-left: 0; }
      .diagram-viewport { height: min(58vh, 520px); min-height: 320px; padding: 10px; }
    }

    @media print {
      :root { --bg: #fff; }
      .progress, .toc, .header-actions, .diagram-toolbar { display: none !important; }
      .page-header-inner, .legend-inner, .layout, .footer { width: 100%; }
      .layout { display: block; padding: 0; }
      main { max-width: none; padding: 18px 0; border: 0; box-shadow: none; }
      .page-header, .legend-strip { break-after: avoid; }
      .diagram-shell { break-inside: avoid; }
      .diagram-viewport { height: auto; min-height: 0; overflow: visible; }
      .diagram-viewport svg { max-width: 100% !important; width: 100% !important; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="progress" data-progress></div>
  <header class="page-header">
    <div class="page-header-inner">
      <div class="brand">
        <p class="brand-kicker">CSCAlite / QuestionOps Architecture</p>
        <h1>AI 出题完整现状与目标架构</h1>
        <p>事实代码、部分能力、近期计划与未来产品化的统一架构视图 · 2026-08-10</p>
      </div>
      <div class="header-actions">
        <button class="print-button" type="button" data-print title="打印或导出 PDF">打印</button>
      </div>
    </div>
  </header>

  <section class="legend-strip" aria-label="架构状态图例">
    <div class="legend-inner">
      <span class="status-pill status-live">LIVE</span>
      <span class="status-pill status-partial">PARTIAL</span>
      <span class="status-pill status-planned">PLANNED</span>
      <span class="status-pill status-future">FUTURE</span>
      <span class="status-pill status-boundary">BOUNDARY</span>
      <span class="legend-note">所有节点明确区分现状、灰度、计划、远期与永久边界</span>
    </div>
  </section>

  <div class="layout">
    <details class="toc" data-toc-shell open>
      <summary class="toc-header">目录</summary>
      <nav data-toc></nav>
    </details>
    <main data-content>
      ${body}
    </main>
  </div>

  <footer class="footer">
    Generated from ${escapeHtml(path.basename(sourcePath))} at ${escapeHtml(generatedAt)}
  </footer>

  <script>
    (function () {
      const main = document.querySelector('[data-content]');
      const toc = document.querySelector('[data-toc]');
      const tocShell = document.querySelector('[data-toc-shell]');
      const compactToc = window.matchMedia('(max-width: 980px)');
      const slugCounts = new Map();

      function syncTocForViewport(event) {
        if (event.matches) tocShell.removeAttribute('open');
        else tocShell.setAttribute('open', '');
      }
      syncTocForViewport(compactToc);
      compactToc.addEventListener('change', syncTocForViewport);
      const headings = Array.from(main.querySelectorAll('h2, h3'));

      function slugify(value) {
        const base = value.trim().toLowerCase()
          .replace(/[\\s/]+/g, '-')
          .replace(/[^a-z0-9\\u4e00-\\u9fff-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'section';
        const count = (slugCounts.get(base) || 0) + 1;
        slugCounts.set(base, count);
        return count === 1 ? base : base + '-' + count;
      }

      headings.forEach((heading) => {
        heading.id = slugify(heading.textContent);
        const link = document.createElement('a');
        link.href = '#' + heading.id;
        link.textContent = heading.textContent;
        link.className = heading.tagName === 'H3' ? 'level-3' : 'level-2';
        toc.appendChild(link);
      });

      main.querySelectorAll('table').forEach((table) => {
        if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      });

      const statusClasses = {
        LIVE: 'status-live',
        PARTIAL: 'status-partial',
        PLANNED: 'status-planned',
        FUTURE: 'status-future',
        BOUNDARY: 'status-boundary'
      };
      main.querySelectorAll('code:not(pre code)').forEach((code) => {
        const value = code.textContent.trim();
        if (!statusClasses[value]) return;
        code.className = 'status-pill ' + statusClasses[value];
      });

      const links = Array.from(toc.querySelectorAll('a'));
      toc.addEventListener('click', (event) => {
        if (compactToc.matches && event.target.closest('a')) tocShell.removeAttribute('open');
      });
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        links.forEach((link) => link.classList.toggle('active', link.hash === '#' + visible[0].target.id));
      }, { rootMargin: '-8% 0px -78% 0px', threshold: [0, 1] });
      headings.forEach((heading) => observer.observe(heading));

      const progress = document.querySelector('[data-progress]');
      function updateProgress() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        progress.style.width = (ratio * 100).toFixed(2) + '%';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
      document.querySelector('[data-print]').addEventListener('click', () => window.print());
    })();
  </script>

  <script type="module">
    const states = document.querySelectorAll('[data-diagram-state]');
    try {
      const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        flowchart: { htmlLabels: true, curve: 'basis', nodeSpacing: 28, rankSpacing: 38, useMaxWidth: false },
        themeVariables: {
          fontFamily: 'Inter, Segoe UI, Microsoft YaHei, Arial, sans-serif',
          fontSize: '14px',
          primaryColor: '#dff3e4',
          primaryTextColor: '#17211c',
          primaryBorderColor: '#26734d',
          lineColor: '#607068',
          secondaryColor: '#dcecff',
          tertiaryColor: '#fff2cc',
          clusterBkg: '#f8faf9',
          clusterBorder: '#b9c7c0'
        }
      });
      await mermaid.run({ querySelector: '.mermaid' });

      document.querySelectorAll('[data-diagram]').forEach((shell, index) => {
        const state = shell.querySelector('[data-diagram-state]');
        const caption = shell.querySelector('figcaption');
        const viewport = shell.querySelector('.diagram-viewport');
        const svg = shell.querySelector('svg');
        if (!svg) return;
        const viewBox = svg.viewBox && svg.viewBox.baseVal;
        const naturalWidth = viewBox && viewBox.width ? viewBox.width : Math.max(900, svg.getBoundingClientRect().width);
        const naturalHeight = viewBox && viewBox.height ? viewBox.height : Math.max(360, svg.getBoundingClientRect().height);
        let zoom = 1;
        let viewMode = 'fit';
        let drag = null;

        viewport.tabIndex = 0;
        viewport.setAttribute('role', 'region');
        viewport.setAttribute('aria-label', '可拖动和缩放的架构图');

        const toolbar = document.createElement('span');
        toolbar.className = 'diagram-toolbar';
        const controls = [
          { label: '-', title: '缩小架构图', action: () => setZoom(zoom / 1.2) },
          { label: '适应', title: '显示完整架构图', action: fitToViewport },
          { label: '1:1', title: '恢复架构图原始大小', action: () => setZoom(1, viewport.clientWidth / 2, viewport.clientHeight / 2, true) },
          { label: '+', title: '放大架构图', action: () => setZoom(zoom * 1.2) }
        ];

        function renderZoom() {
          svg.style.width = Math.round(naturalWidth * zoom) + 'px';
          svg.style.height = 'auto';
          state.textContent = Math.round(zoom * 100) + '%';
        }

        function setZoom(next, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2, center = false) {
          const previous = zoom;
          const contentX = viewport.scrollLeft + anchorX;
          const contentY = viewport.scrollTop + anchorY;
          zoom = Math.min(3, Math.max(0.04, next));
          viewMode = 'manual';
          renderZoom();
          requestAnimationFrame(() => {
            if (center) {
              viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
              viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
              return;
            }
            const ratio = zoom / previous;
            viewport.scrollLeft = Math.max(0, contentX * ratio - anchorX);
            viewport.scrollTop = Math.max(0, contentY * ratio - anchorY);
          });
        }

        function fitToViewport() {
          const availableWidth = Math.max(200, viewport.clientWidth - 36);
          const availableHeight = Math.max(180, viewport.clientHeight - 36);
          zoom = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
          viewMode = 'fit';
          renderZoom();
          requestAnimationFrame(() => {
            viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
            viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
          });
        }

        controls.forEach((control) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = control.label;
          button.title = control.title;
          button.setAttribute('aria-label', control.title);
          button.addEventListener('click', control.action);
          toolbar.appendChild(button);
        });
        caption.appendChild(toolbar);

        viewport.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
          viewport.classList.add('is-dragging');
          viewport.setPointerCapture(event.pointerId);
          event.preventDefault();
        });
        viewport.addEventListener('pointermove', (event) => {
          if (!drag) return;
          viewport.scrollLeft = drag.left - (event.clientX - drag.x);
          viewport.scrollTop = drag.top - (event.clientY - drag.y);
        });
        function stopDragging(event) {
          if (!drag) return;
          drag = null;
          viewport.classList.remove('is-dragging');
          if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
        }
        viewport.addEventListener('pointerup', stopDragging);
        viewport.addEventListener('pointercancel', stopDragging);
        viewport.addEventListener('wheel', (event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          const bounds = viewport.getBoundingClientRect();
          const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
          setZoom(zoom * factor, event.clientX - bounds.left, event.clientY - bounds.top);
        }, { passive: false });
        viewport.addEventListener('dblclick', fitToViewport);
        viewport.addEventListener('keydown', (event) => {
          const panStep = event.shiftKey ? 120 : 48;
          if (event.key === 'ArrowLeft') viewport.scrollLeft -= panStep;
          else if (event.key === 'ArrowRight') viewport.scrollLeft += panStep;
          else if (event.key === 'ArrowUp') viewport.scrollTop -= panStep;
          else if (event.key === 'ArrowDown') viewport.scrollTop += panStep;
          else if (event.key === '+' || event.key === '=') setZoom(zoom * 1.2);
          else if (event.key === '-') setZoom(zoom / 1.2);
          else if (event.key === '0') fitToViewport();
          else return;
          event.preventDefault();
        });

        const resizeObserver = new ResizeObserver(() => {
          if (viewMode === 'fit') fitToViewport();
        });
        resizeObserver.observe(viewport);
        fitToViewport();
      });
    } catch (error) {
      document.querySelectorAll('[data-diagram]').forEach((shell) => shell.classList.add('error'));
      states.forEach((state) => { state.textContent = 'Mermaid unavailable - source preserved'; });
      console.error('Mermaid rendering failed', error);
    }
  </script>
</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Generated ${path.relative(root, outputPath)} from ${path.relative(root, sourcePath)}.`);
