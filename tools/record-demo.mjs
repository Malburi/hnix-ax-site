#!/usr/bin/env node
/*
 * 시연 영상 녹화 — 실제로 떠 있는 HNIX AX 제품 화면을 헤드리스 Edge 로 조작하며 녹화해 MP4 로 만든다.
 * 화면 아래에 단계 자막, 클릭하는 곳에 커서·물결 표시를 덧그린다(제품 화면 자체는 손대지 않는다).
 *
 *   node tools/record-demo.mjs --scenario datalake            # video/datalake.mp4
 *   node tools/record-demo.mjs --scenario all
 *   node tools/record-demo.mjs --probe http://127.0.0.1:8710/hub --app platform   # 화면의 버튼·탭 글자 보기
 *   node tools/record-demo.mjs --scenario pmsx --dry          # 녹화 없이 돌려 보기
 *
 * 필요: Edge(또는 Chrome), ffmpeg(PATH 또는 --ffmpeg), E2E 환경(hnix-ax-platform/e2e/start.ps1)이 떠 있을 것.
 * 시나리오는 tools/demo-scenarios.mjs.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { APPS, SCENARIOS } from "./demo-scenarios.mjs";
import { launchIde } from "./ide-session.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    scenario: { type: "string" },
    probe: { type: "string" },
    app: { type: "string" },
    out: { type: "string", default: resolve(HERE, "..", "video") },
    width: { type: "string", default: "1440" },
    height: { type: "string", default: "900" },
    browser: { type: "string" },
    ffmpeg: { type: "string", default: "ffmpeg" },
    keep: { type: "boolean", default: false },
    /** 녹화하지 않고 시나리오만 돌린다(짤 때) */
    dry: { type: "boolean", default: false },
  },
});

const W = Number(values.width);
const H = Number(values.height);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browserPath = [values.browser, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].filter(Boolean).find((p) => existsSync(p));
if (!browserPath) throw new Error("Edge/Chrome 을 찾지 못했습니다.");

/** 화면 위에 덧그리는 것 — 자막·커서·클릭 물결. 페이지가 바뀌어도 다시 붙는다 */
const OVERLAY = `(() => {
  if (window.__demo) return;
  const css = document.createElement('style');
  css.textContent = \`
    #__demo_cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1100px;z-index:2147483647;
      background:rgba(15,23,33,.88);color:#fff;border-radius:12px;padding:12px 22px;font:500 19px/1.45 "Malgun Gothic","Noto Sans KR",sans-serif;
      box-shadow:0 6px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .35s;pointer-events:none;text-align:center}
    #__demo_cap b{color:#7fe0e6;margin-right:8px}
    #__demo_cap small{display:block;font-size:14px;color:#c9d3da;margin-top:2px}
    #__demo_cur{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform .55s cubic-bezier(.3,.7,.2,1)}
    .__demo_ripple{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #ff7a1a;z-index:2147483646;
      pointer-events:none;animation:__demo_r .6s ease-out forwards}
    @keyframes __demo_r{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}
    .__demo_hl{outline:3px solid #ff7a1a !important;outline-offset:2px !important;border-radius:6px}
  \`;
  document.documentElement.appendChild(css);
  const cap = document.createElement('div'); cap.id='__demo_cap'; document.documentElement.appendChild(cap);
  const cur = document.createElement('div'); cur.id='__demo_cur';
  // innerHTML 은 쓰지 않는다 — VS Code(IDE) 화면은 Trusted Types 로 막는다
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22'); svg.setAttribute('viewBox', '0 0 22 22');
  const path = document.createElementNS(NS, 'path'); path.setAttribute('d', 'M2 2 L2 18 L7 13.5 L10.5 21 L13.5 19.6 L10 12.3 L17 12 Z');
  path.setAttribute('fill', '#fff'); path.setAttribute('stroke', '#111'); path.setAttribute('stroke-width', '1.4'); path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path); cur.appendChild(svg);
  document.documentElement.appendChild(cur);
  let pos = window.__demo_pos || [700, 450];
  cur.style.transform = 'translate(' + pos[0] + 'px,' + pos[1] + 'px)';
  window.__demo = {
    caption(title, sub) {
      cap.replaceChildren();
      if (title) { cap.append(document.createTextNode(title)); if (sub) { const sm = document.createElement('small'); sm.textContent = sub; cap.append(sm); } }
      cap.style.opacity = title ? 1 : 0;
    },
    move(x, y) { pos = [x, y]; window.__demo_pos = pos; cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; },
    ripple(x, y) { const r = document.createElement('div'); r.className='__demo_ripple'; r.style.left=x+'px'; r.style.top=y+'px'; document.documentElement.appendChild(r); setTimeout(()=>r.remove(), 700); },
  };
})()`;

class Recorder {
  constructor() {
    this.frames = [];
    this.recording = false;
    this.lastCaption = null;
  }

  /** ide 를 주면 헤드리스 Edge 대신 AX-NAVI IDE(임시 프로필)에 붙는다 */
  async start(opts = {}) {
    let target;
    if (opts.ide) {
      const s = await launchIde({ folder: opts.ide });
      Object.assign(this, { port: s.port, profile: s.profile, proc: s.proc, ide: true });
      target = s.target;
    } else {
      this.port = 9500 + Math.floor(Math.random() * 400);
      this.profile = mkdtempSync(join(tmpdir(), "hnix-demo-"));
      this.proc = spawn(browserPath, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${this.port}`, `--user-data-dir=${this.profile}`, `--window-size=${W},${H}`, "--lang=ko-KR", "about:blank"], { stdio: "ignore" });
      for (let i = 0; i < 60 && !target; i++) {
        await sleep(200);
        target = await fetch(`http://127.0.0.1:${this.port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === "page"), () => null);
      }
    }
    if (!target) throw new Error("브라우저 DevTools 에 붙지 못했습니다.");
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => this.ws.addEventListener("open", r, { once: true }));
    this.seq = 0;
    this.pending = new Map();
    this.ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)(m);
        this.pending.delete(m.id);
      }
      if (m.method === "Page.screencastFrame") {
        const { data, sessionId, metadata } = m.params;
        if (this.recording) this.frames.push({ t: metadata.timestamp, data });
        this.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
      }
      if (m.method === "Runtime.exceptionThrown") console.error("  [page error]", m.params.exceptionDetails?.exception?.description?.split("\n")[0]);
    });
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    if (this.ide) {
      await sleep(6000);
      await this.overlay();
      return;
    }
    await this.send("Page.addScriptToEvaluateOnNewDocument", { source: `document.addEventListener('DOMContentLoaded', () => { ${OVERLAY} })` });
  }

  send(method, params = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: 시간 초과`));
      }, timeoutMs);
      this.pending.set(id, (m) => {
        clearTimeout(timer);
        if (m.error) reject(new Error(`${method}: ${m.error.message}`));
        else resolve(m.result);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  }

  async waitFor(expression, ms = 15000) {
    for (let t = 0; t < ms; t += 200) {
      if (await this.eval(expression).catch(() => false)) return true;
      await sleep(200);
    }
    return false;
  }

  async overlay() {
    await this.eval(OVERLAY).catch(() => undefined);
    if (this.lastCaption) await this.eval(`window.__demo && window.__demo.caption(${JSON.stringify(this.lastCaption[0])}, ${JSON.stringify(this.lastCaption[1])})`).catch(() => undefined);
  }

  // ── 조작 ──────────────────────────────────────────────

  async login(app, who) {
    const a = APPS[app];
    const cred = a.users[who];
    await this.send("Page.navigate", { url: `${a.url}${a.loginPath ?? "/login"}` });
    await this.waitFor("document.readyState === 'complete'");
    const ok = await this.eval(`fetch(${JSON.stringify(a.loginApi)}, {method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body: JSON.stringify(${JSON.stringify(cred)})}).then(r => r.ok)`);
    if (!ok) throw new Error(`${app} ${who} 로그인 실패`);
  }

  async go(url, ready = "document.readyState === 'complete'") {
    await this.send("Page.navigate", { url });
    await this.waitFor(ready, 20000);
    await sleep(900);
    await this.overlay();
  }

  async caption(title, sub = "") {
    this.lastCaption = [title, sub];
    await this.overlay();
  }

  /** 글자로 요소를 찾는다 — 버튼·링크·탭·메뉴·표 칸 순서로, 화면에 보이는 것만 */
  async find(text, opts = {}) {
    const js = `(() => {
      const want = ${JSON.stringify(text)};
      const exact = ${!!opts.exact};
      const within = ${JSON.stringify(opts.within ?? null)};
      const root = within ? document.querySelector(within) : document;
      if (!root) return null;
      const sel = ${JSON.stringify(opts.selector ?? "button, a, [role=tab], [role=button], [role=menuitem], .n-tabs-tab, .n-menu-item-content, .v-tab, .v-list-item, .v-btn, .n-button, li, td, th, label, span, div")};
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight + 2000; };
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const cands = [...root.querySelectorAll(sel)].filter((el) => vis(el) && !el.closest('#__demo_cap'));
      const hit = (el) => { const t = norm(el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label')); return exact ? t === want : t.includes(want); };
      // 가장 안쪽(글자가 가장 짧은) 요소
      const list = cands.filter(hit).sort((a, b) => norm(a.innerText).length - norm(b.innerText).length);
      const el = list[${opts.nth ?? 0}];
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    for (let t = 0; t < (opts.timeout ?? 6000); t += 300) {
      const p = await this.eval(js).catch(() => null);
      if (p) return p;
      await sleep(300);
    }
    return null;
  }

  async pointAt(p) {
    await this.eval(`window.__demo && window.__demo.move(${p.x}, ${p.y})`).catch(() => undefined);
    await sleep(650);
  }

  async clickAt(p) {
    await this.pointAt(p);
    await this.eval(`window.__demo && window.__demo.ripple(${p.x}, ${p.y})`).catch(() => undefined);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await this.send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", clickCount: 1 });
    await sleep(500);
  }

  /** 글자로 찾아 누른다. 없으면 건너뛰고 알린다(시나리오가 멈추지 않게) */
  async click(text, opts = {}) {
    const p = await this.find(text, opts);
    if (!p) {
      console.warn(`  ! 못 찾음: "${text}"`);
      return false;
    }
    await this.clickAt(p);
    await sleep(opts.after ?? 900);
    await this.overlay();
    return true;
  }

  async clickSel(selector, after = 900) {
    const p = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)}; })()`);
    if (!p) {
      console.warn(`  ! 못 찾음: ${selector}`);
      return false;
    }
    await this.clickAt(p);
    await sleep(after);
    return true;
  }

  /** 입력 칸(placeholder·선택자)에 사람처럼 친다 */
  async type(target, text, opts = {}) {
    const p = target.startsWith("css:")
      ? await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(target.slice(4))}); if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x: Math.round(r.left + Math.min(r.width/2, 120)), y: Math.round(r.top + r.height/2)}; })()`)
      : await this.eval(`(() => { const el = [...document.querySelectorAll('input, textarea')].find((e) => (e.getAttribute('placeholder') || '').includes(${JSON.stringify(target)}) && e.getBoundingClientRect().width > 0); if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x: Math.round(r.left + Math.min(r.width/2, 120)), y: Math.round(r.top + r.height/2)}; })()`);
    if (!p) {
      console.warn(`  ! 입력 칸 못 찾음: ${target}`);
      return false;
    }
    await this.clickAt(p);
    if (opts.clear) {
      await this.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
      await this.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
      await this.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
      await this.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
    }
    for (const ch of text) {
      await this.send("Input.insertText", { text: ch });
      await sleep(opts.delay ?? 55);
    }
    await sleep(400);
    return true;
  }

  async press(key) {
    const codes = { Enter: 13, Escape: 27, Tab: 9 };
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: codes[key] ?? 0, ...(key === "Enter" ? { text: "\r" } : {}) });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: codes[key] ?? 0 });
    await sleep(600);
  }

  /** 부드럽게 내린다(페이지 또는 선택자 안) */
  async scroll(dy, selector = null, steps = 12) {
    for (let i = 0; i < steps; i++) {
      await this.eval(selector ? `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.scrollBy(0, ${dy / steps}); })()` : `window.scrollBy(0, ${dy / steps})`).catch(() => undefined);
      await sleep(45);
    }
    await sleep(500);
  }

  async wheel(dy, at = { x: W / 2, y: H / 2 }, steps = 8) {
    for (let i = 0; i < steps; i++) {
      await this.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY: dy / steps });
      await sleep(60);
    }
    await sleep(500);
  }

  // ── IDE 웹뷰(채팅·상세 패널) ──────────────────────────

  /** 웹뷰 안의 요소를 글자로 찾아 화면 좌표로 — 웹뷰는 iframe 두 겹이라 위치를 더한다 */
  async webFind(text, opts = {}) {
    const sel = opts.selector ?? "button, vscode-button, a, [role=button], [role=option], li, span, div";
    for (let t = 0; t < (opts.timeout ?? 8000); t += 400) {
      const list = await fetch(`http://127.0.0.1:${this.port}/json/list`).then((r) => r.json()).catch(() => []);
      for (const fr of list.filter((x) => x.type === "iframe")) {
        const id = /[?&]id=([^&]+)/.exec(fr.url)?.[1];
        const inner = await cdpEval(fr.webSocketDebuggerUrl, `(() => {
          const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
          const d = f.contentDocument; const want = ${JSON.stringify(text)};
          const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
          const els = [...d.querySelectorAll(${JSON.stringify(sel)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && norm(e.innerText || e.getAttribute('aria-label') || e.getAttribute('title')).includes(want); })
            .sort((a, b) => norm(a.innerText).length - norm(b.innerText).length);
          const el = els[${opts.nth ?? 0}]; if (!el) return null;
          el.scrollIntoView({ block: 'center' });
          const r = el.getBoundingClientRect(); const fr = f.getBoundingClientRect();
          return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
        })()`);
        if (!inner) continue;
        const host = await this.eval(`(() => { const f = [...document.querySelectorAll('iframe')].find((e) => e.src.includes(${JSON.stringify(id ?? "")})); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
        if (host) return { x: Math.round(host.x + inner.x), y: Math.round(host.y + inner.y) };
      }
      await sleep(400);
    }
    return null;
  }

  async webClick(text, opts = {}) {
    const p = await this.webFind(text, opts);
    if (!p) {
      console.warn(`  ! 웹뷰에서 못 찾음: "${text}"`);
      return false;
    }
    await this.clickAt(p);
    await sleep(opts.after ?? 900);
    return true;
  }

  /** 웹뷰 안 글자 전체(진행 확인용) */
  async webText() {
    const list = await fetch(`http://127.0.0.1:${this.port}/json/list`).then((r) => r.json()).catch(() => []);
    const out = [];
    for (const fr of list.filter((x) => x.type === "iframe")) out.push(await cdpEval(fr.webSocketDebuggerUrl, "(() => { const f = document.querySelector('iframe'); try { return f.contentDocument.body.innerText; } catch { return ''; } })()"));
    return out.join("\n---\n");
  }

  /** 단축키 — 예: key('p', { ctrl: true }) */
  async key(k, mods = {}) {
    const m = (mods.alt ? 1 : 0) | (mods.ctrl ? 2 : 0) | (mods.shift ? 8 : 0);
    const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
    const vk = k.length === 1 ? k.toUpperCase().charCodeAt(0) : ({ Enter: 13, Escape: 27, Tab: 9, Backspace: 8 })[k] ?? 0;
    await this.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, modifiers: m, windowsVirtualKeyCode: vk });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers: m, windowsVirtualKeyCode: vk });
    await sleep(700);
  }

  /** 화면에 보이는 버튼·탭 글자(시나리오를 짤 때) */
  async dump(label = "") {
    const texts = await this.eval(`[...document.querySelectorAll('button, a, [role=tab], .n-tabs-tab, .v-tab, .v-btn, .v-list-item-title, th, input, textarea')].filter(e => e.getBoundingClientRect().width > 0).map(e => (e.tagName + ': ' + ((e.innerText || e.getAttribute('placeholder') || '').replace(/\\s+/g, ' ').trim())).slice(0, 90)).filter(t => !t.endsWith(': '))`);
    console.log(`--- ${label}\n` + [...new Set(texts)].join("\n"));
  }

  async snap(file) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(file, Buffer.from(data, "base64"));
  }

  // ── 녹화 ──────────────────────────────────────────────

  async record(name, fn, maxGap = 8) {
    this.frames = [];
    await this.send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    this.recording = true;
    const t0 = Date.now();
    try {
      await fn(this);
      await sleep(1500);
    } finally {
      this.recording = false;
      await this.send("Page.stopScreencast").catch(() => undefined);
    }
    const out = resolve(values.out, `${name}.mp4`);
    encode(this.frames, out, maxGap);
    console.log(`  → ${out} (${((Date.now() - t0) / 1000).toFixed(0)}초, 장면 ${this.frames.length})`);
  }

  async close() {
    await this.send("Browser.close").catch(() => undefined);
    this.ws?.close();
    this.proc?.kill();
    await sleep(800);
    try {
      rmSync(this.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
    } catch {
      /* 브라우저가 아직 파일을 쥐고 있으면 임시 폴더는 남긴다 */
    }
  }
}

/** 다른 DevTools 대상(웹뷰 iframe)에서 식 하나를 평가한다 */
async function cdpEval(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  try {
    await new Promise((ok, no) => {
      ws.addEventListener("open", ok, { once: true });
      ws.addEventListener("error", no, { once: true });
    });
    const res = await new Promise((ok) => {
      ws.addEventListener("message", (e) => ok(JSON.parse(e.data)), { once: true });
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    });
    return res.result?.result?.value ?? null;
  } catch {
    return null;
  } finally {
    ws.close();
  }
}

/** 화면이 바뀔 때만 오는 장면들 → 실제 시간 간격을 지켜 30fps MP4 로 */
function encode(frames, out, maxGap = 8) {
  if (!frames.length) throw new Error("녹화된 장면이 없습니다.");
  const dir = mkdtempSync(join(tmpdir(), "hnix-demo-frames-"));
  const lines = [];
  frames.forEach((f, i) => {
    const file = join(dir, `f${String(i).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.t ?? f.t + 1.5;
    lines.push(`file '${file.replace(/\\/g, "/")}'`, `duration ${Math.max(0.034, Math.min(next - f.t, maxGap)).toFixed(3)}`);
  });
  lines.push(`file '${join(dir, `f${String(frames.length - 1).padStart(6, "0")}.jpg`).replace(/\\/g, "/")}'`);
  writeFileSync(join(dir, "list.txt"), lines.join("\n"));
  mkdirSync(dirname(out), { recursive: true });
  const r = spawnSync(values.ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-movflags", "+faststart", out], { stdio: "inherit" });
  if (!values.keep) rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error("ffmpeg 인코딩 실패");
}

// ── 실행 ──────────────────────────────────────────────────
let rec = new Recorder();
try {
  if (values.probe) {
    await rec.start();
    if (values.app) await rec.login(values.app, Object.keys(APPS[values.app].users)[0]);
    await rec.go(values.probe);
    await sleep(2500);
    const texts = await rec.eval(`[...document.querySelectorAll('button, a, [role=tab], .n-tabs-tab, .v-tab, .v-btn, .n-menu-item-content, th, input, textarea')].filter(e => e.getBoundingClientRect().width > 0).map(e => (e.tagName + ': ' + ((e.innerText || e.getAttribute('placeholder') || '').replace(/\\s+/g, ' ').trim())).slice(0, 80)).filter(t => !t.endsWith(': '))`);
    console.log([...new Set(texts)].join("\n"));
    const { data } = await rec.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(tmpdir(), "hnix-probe.png"), Buffer.from(data, "base64"));
    console.log("화면:", join(tmpdir(), "hnix-probe.png"));
  } else {
    const names = values.scenario === "all" ? Object.keys(SCENARIOS) : [values.scenario];
    for (const n of names) {
      if (!SCENARIOS[n]) throw new Error(`없는 시나리오: ${n} (있는 것: ${Object.keys(SCENARIOS).join(", ")})`);
      console.log(`▶ ${n} — ${SCENARIOS[n].title}`);
      rec = new Recorder();
      await rec.start({ ide: SCENARIOS[n].ide });
      try {
        if (values.dry) await SCENARIOS[n].run(rec, APPS);
        else await rec.record(n, (r) => SCENARIOS[n].run(r, APPS), SCENARIOS[n].maxGap);
      } finally {
        await rec.close();
      }
    }
  }
} finally {
  if (values.probe) await rec.close();
}
