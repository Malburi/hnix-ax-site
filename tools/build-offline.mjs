/*
 * 오프라인 HTML판 빌드 — GitHub Pages(docsify)와 같은 문서를 인터넷 없이 열리는 정적 HTML 로 만든다.
 *
 * docsify 는 CDN 에서 스크립트를 받고 마크다운을 XHR 로 불러 그리므로 file:// 로는 열리지 않는다.
 * 여기서는 마크다운을 미리 HTML 로 바꾸고, 스타일·mermaid·이미지·검색 색인을 폴더 안에 함께 둔다.
 *
 *   cd tools && npm install && npm run offline
 *   → ../offline/ (index.html 을 더블클릭) 과 ../download/hnix-ax-offline.zip
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "offline");
const ONLINE = "https://malburi.github.io/hnix-ax-site/";
const NL = "\n";

/* ---------- 사이드바 → 페이지 목록 ---------- */
// "- **시작하기**" 는 묶음, "  - [제목](/경로.md)" 는 페이지
const sections = [];
for (const line of readFileSync(join(ROOT, "_sidebar.md"), "utf8").split(/\r?\n/)) {
  const group = line.match(/^- \*\*(.+)\*\*\s*$/);
  if (group) { sections.push({ title: group[1], pages: [] }); continue; }
  const item = line.match(/^\s+- \[(.+?)\]\((.+?)\)\s*$/);
  if (item && sections.length) sections.at(-1).pages.push({ title: item[1], src: srcOf(item[2]) });
}
const pages = sections.flatMap((s) => s.pages);

/** docsify 경로("/", "/a/b.md", "#/a/b") → 저장소 안 마크다운 파일 */
function srcOf(route) {
  let r = route.replace(/^#/, "").replace(/^\//, "").replace(/#.*$/, "");
  if (r === "") return "README.md";
  if (!r.endsWith(".md")) r += ".md";
  return r;
}
/** 마크다운 파일 → 오프라인 HTML 경로 (README 는 그 폴더의 index.html) */
function outOf(src) {
  return src.replace(/(^|\/)README\.md$/, "$1index.html").replace(/\.md$/, ".html");
}
/** 이 페이지에서 저장소 뿌리까지 */
const prefixOf = (src) => "../".repeat(src.split("/").length - 1);

/* ---------- 마크다운 렌더링 ---------- */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (text) => text.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");

function render(src) {
  const md = readFileSync(join(ROOT, src), "utf8");
  const prefix = prefixOf(src);
  const toc = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(text, level, raw) {
        const id = slug(raw);
        if (level === 2) toc.push({ id, text: raw });
        return `<h${level} id="${id}"><a href="#${id}" class="anchor"><span>${text}</span></a></h${level}>${NL}`;
      },
      code(code, lang) {
        if (lang === "mermaid") return `<pre class="mermaid">${esc(code)}</pre>${NL}`;
        return `<pre data-lang="${esc(lang ?? "")}"><code>${esc(code)}</code></pre>${NL}`;
      },
      table(header, body) {
        return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>${NL}`;
      },
      link(href, title, text) {
        // docsify 전용 표시(':ignore')는 지운다. 오프라인판 안에 없는 내려받기 파일은 온라인 주소로 보낸다.
        const t = title && !title.startsWith(":") ? title : null;
        const to = href.startsWith("download/") ? ONLINE + href : linkOf(href, prefix);
        return `<a href="${esc(to)}"${t ? ` title="${esc(t)}"` : ""}${/^https?:/.test(to) ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
      },
      image(href, title, text) {
        return `<img src="${esc(/^(https?:|\/)/.test(href) ? href : prefix + href)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ""}>`;
      },
    },
  });
  let html = marked.parse(md);
  // 마크다운 안에 직접 쓴 HTML(홈 카드·그림)의 경로도 고친다
  html = html
    .replace(/href="#(\/[^"]*)"/g, (_m, r) => `href="${linkOf(r, prefix)}"`)
    .replace(/src="img\//g, `src="${prefix}img/`);
  return { html, toc, text: plain(md) };
}

/** 문서 안 링크 → 오프라인 상대 경로 */
function linkOf(href, prefix) {
  if (/^(https?:|mailto:|#[^/])/.test(href)) return href;
  if (href.startsWith("/") || href.startsWith("#/")) {
    const [path, hash] = href.replace(/^#/, "").split("#");
    return prefix + outOf(srcOf(path)) + (hash ? `#${hash}` : "");
  }
  return href;
}

function plain(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- 쪽 틀 ---------- */
function sidebar(current, toc, prefix) {
  const items = sections.map((s) => {
    const li = s.pages.map((p) => {
      const active = p.src === current;
      const sub = active && toc.length ? `<ul>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ul>` : "";
      return `<li${active ? ' class="active"' : ""}><a href="${prefix}${outOf(p.src)}">${esc(p.title)}</a>${sub}</li>`;
    });
    return `<li><strong>${esc(s.title)}</strong><ul>${li.join("")}</ul></li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

function pagination(i, prefix) {
  const prev = pages[i - 1];
  const next = pages[i + 1];
  const cell = (p, label, cls) =>
    p ? `<div class="pagination-item ${cls}"><a href="${prefix}${outOf(p.src)}"><div class="pagination-item-label">${label}</div><div class="pagination-item-title">${esc(p.title)}</div></a></div>` : `<div class="pagination-item ${cls}"></div>`;
  return `<div class="docsify-pagination-container">${cell(prev, "이전", "pagination-item--previous")}${cell(next, "다음", "pagination-item--next")}</div>`;
}

function page({ title, body, side, prefix, pager }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} · HNIX AX</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="${prefix}assets/style.css">
</head>
<body>
  <aside class="sidebar">
    <div class="search"><input type="search" id="q" placeholder="문서 검색" autocomplete="off" aria-label="문서 검색"><div class="results-panel" id="results"></div></div>
    <h1><a href="${prefix}index.html">HNIX AX</a></h1>
    <nav class="sidebar-nav">${side}</nav>
    <p class="offline-note">오프라인판 · <a href="https://malburi.github.io/hnix-ax-site/" target="_blank" rel="noopener">온라인 사이트</a></p>
  </aside>
  <button class="sidebar-toggle" type="button" aria-label="목차 열고 닫기"><span></span><span></span><span></span></button>
  <main class="content">
    <article class="markdown-section">
${body}
${pager}
    </article>
  </main>
  <script>window.HNIX_ROOT = ${JSON.stringify(prefix)};</script>
  <script src="${prefix}assets/search-index.js"></script>
  <script src="${prefix}assets/app.js"></script>
  <script src="${prefix}assets/mermaid.min.js"></script>
  <script>
    (function () {
      if (!window.mermaid || !document.querySelector('.mermaid')) return;
      var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral' });
      window.mermaid.run({ querySelector: '.mermaid' });
    })();
  </script>
</body>
</html>
`;
}

/* ---------- 스타일: 온라인판 index.html 의 <style> 을 그대로 가져온다 ---------- */
function stylesheet() {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  // 웹 글꼴은 인터넷이 있어야 받으므로 빼고, 같은 계열의 시스템 글꼴로 대신한다
  const offline = `
    /* ---- 오프라인판 보탬 ---- */
    .sidebar > h1 { margin-top: 0; }
    .sidebar .search { position: relative; }
    .sidebar .results-panel { max-height: 50vh; overflow-y: auto; }
    .sidebar .matching-post a { display: block; color: var(--ink); }
    .sidebar .matching-post a:hover { text-decoration: none; color: var(--accent-ink); }
    .offline-note { margin: 24px 22px 0; font-size: .75rem; color: var(--muted); }
    .markdown-section pre { position: relative; }
    .markdown-section pre .docsify-copy-code-button { position: absolute; top: 6px; right: 6px; opacity: 0; cursor: pointer; transition: opacity .15s; }
    .markdown-section pre:hover .docsify-copy-code-button, .markdown-section pre .docsify-copy-code-button:focus { opacity: 1; }
    .docsify-pagination-container { display: flex; justify-content: space-between; gap: 16px; }
    .pagination-item { flex: 1 1 0; min-width: 0; }
    .pagination-item--next { text-align: right; }
    .pagination-item a { display: block; padding: 6px 0; }
    .pagination-item a:hover { text-decoration: none; }
    .pagination-item a:hover .pagination-item-title { color: var(--accent-ink); }
    @media print { .sidebar, .sidebar-toggle, .docsify-pagination-container { display: none; } .content { padding-left: 0; } }
`;
  return css + offline;
}

/* ---------- 화면 동작: 목차 토글·코드 복사·검색 ---------- */
const APP_JS = `(function () {
  var body = document.body;
  var toggle = document.querySelector('.sidebar-toggle');
  if (toggle) toggle.addEventListener('click', function () { body.classList.toggle('close'); });
  // 좁은 화면에서 목차 항목을 고르면 목차를 닫는다
  document.querySelectorAll('.sidebar-nav a').forEach(function (a) {
    a.addEventListener('click', function () { if (window.innerWidth <= 860) body.classList.remove('close'); });
  });

  // 코드 복사
  document.querySelectorAll('.markdown-section pre:not(.mermaid)').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'docsify-copy-code-button';
    btn.textContent = '복사';
    btn.addEventListener('click', function () {
      var text = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
      var done = function (ok) { btn.textContent = ok ? '복사됨' : '실패'; setTimeout(function () { btn.textContent = '복사'; }, 1500); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback(text)); });
      } else { done(fallback(text)); }
    });
    pre.appendChild(btn);
  });
  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta); return ok;
  }

  // 이미지 확대 보기 (온라인판 index.html 과 같은 동작)
  function closeZoom() { var z = document.querySelector('.img-zoom'); if (z) z.remove(); }
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('.markdown-section img:not(.no-zoom)');
    if (!img || img.closest('a')) return;
    var box = document.createElement('div');
    box.className = 'img-zoom';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '이미지 확대 보기 (누르거나 Esc 로 닫기)');
    var big = document.createElement('img');
    big.src = img.currentSrc || img.src; big.alt = img.alt || '';
    box.appendChild(big);
    if (img.alt) { var cap = document.createElement('div'); cap.className = 'img-zoom-cap'; cap.textContent = img.alt; box.appendChild(cap); }
    box.addEventListener('click', closeZoom);
    document.body.appendChild(box);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeZoom(); });

  // 검색 — 미리 만든 색인(search-index.js)에서 찾는다
  var q = document.getElementById('q');
  var panel = document.getElementById('results');
  var index = window.HNIX_SEARCH || [];
  var root = window.HNIX_ROOT || '';
  function escape(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(s, word) {
    var i = s.toLowerCase().indexOf(word.toLowerCase());
    if (i < 0) return escape(s);
    return escape(s.slice(0, i)) + '<em class="search-keyword">' + escape(s.slice(i, i + word.length)) + '</em>' + escape(s.slice(i + word.length));
  }
  if (q && panel) q.addEventListener('input', function () {
    var word = q.value.trim();
    if (!word) { panel.classList.remove('show'); panel.innerHTML = ''; return; }
    var lower = word.toLowerCase();
    var hits = [];
    index.forEach(function (p) {
      var inTitle = p.title.toLowerCase().indexOf(lower) >= 0;
      var at = p.text.toLowerCase().indexOf(lower);
      if (!inTitle && at < 0) return;
      var start = Math.max(0, at - 30);
      var snippet = at < 0 ? p.text.slice(0, 80) : (start > 0 ? '…' : '') + p.text.slice(start, at + word.length + 50) + '…';
      hits.push({ p: p, score: inTitle ? 0 : 1, snippet: snippet });
    });
    hits.sort(function (a, b) { return a.score - b.score; });
    panel.innerHTML = hits.length
      ? hits.slice(0, 20).map(function (h) { return '<div class="matching-post"><a href="' + root + h.p.url + '"><h2>' + mark(h.p.title, word) + '</h2><p>' + mark(h.snippet, word) + '</p></a></div>'; }).join('')
      : '<div class="matching-post"><p>검색 결과가 없습니다.</p></div>';
    panel.classList.add('show');
  });
})();
`;

/* ---------- 빌드 ---------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
cpSync(join(ROOT, "img"), join(OUT, "img"), { recursive: true });
cpSync(join(ROOT, "tools", "node_modules", "mermaid", "dist", "mermaid.min.js"), join(OUT, "assets", "mermaid.min.js"));
writeFileSync(join(OUT, "assets", "style.css"), stylesheet());
writeFileSync(join(OUT, "assets", "app.js"), APP_JS);

const search = [];
pages.forEach((p, i) => {
  const { html, toc, text } = render(p.src);
  const prefix = prefixOf(p.src);
  const out = join(OUT, outOf(p.src));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page({ title: p.title, body: html, side: sidebar(p.src, toc, prefix), prefix, pager: pagination(i, prefix) }));
  search.push({ title: p.title, url: posix.normalize(outOf(p.src)), text });
});
writeFileSync(join(OUT, "assets", "search-index.js"), `window.HNIX_SEARCH = ${JSON.stringify(search)};${NL}`);

// 남은 내부 링크가 실제 파일을 가리키는지 확인한다
let broken = 0;
for (const p of pages) {
  const file = join(OUT, outOf(p.src));
  const html = readFileSync(file, "utf8");
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#:]+?)(?:#[^"]*)?"/g)) {
    if (!href || href.startsWith("//")) continue;
    if (!existsSync(join(dirname(file), href))) { broken++; console.error(`깨진 링크: ${outOf(p.src)} → ${href}`); }
  }
}

// 내려받기용 zip (Windows tar.exe·리눅스 zip 어느 쪽이든)
const zipDir = join(ROOT, "download");
mkdirSync(zipDir, { recursive: true });
const zip = join(zipDir, "hnix-ax-offline.zip");
rmSync(zip, { force: true });
try {
  if (process.platform === "win32") execFileSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), ["-a", "-c", "-f", zip, "-C", ROOT, "offline"]);
  else execFileSync("zip", ["-qr", zip, "offline"], { cwd: ROOT });
} catch (e) {
  console.error("zip 을 만들지 못했습니다:", e instanceof Error ? e.message : e);
}

console.log(`페이지 ${pages.length}개 → ${OUT}${broken ? ` · 깨진 링크 ${broken}개` : " · 깨진 링크 없음"}`);
if (existsSync(zip)) console.log(`zip → ${zip}`);
if (broken) process.exitCode = 1;
