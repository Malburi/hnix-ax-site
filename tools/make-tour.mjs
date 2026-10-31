#!/usr/bin/env node
/*
 * 전체 투어 영상 — 제품 영상 넷 사이에 제목 카드를 넣어 하나로 잇는다(시연회 첫 화면용).
 *   node tools/make-tour.mjs        → video/tour.mp4
 * 제목 카드는 HTML 을 헤드리스 Edge 로 찍어 만든다. 필요: video/{platform,pmsx,axnavi,datalake}.mp4, ffmpeg.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VID = join(ROOT, "video");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => existsSync(p));
const FF = process.env.FFMPEG ?? "ffmpeg";
const tmp = mkdtempSync(join(tmpdir(), "hnix-tour-"));

const CARDS = [
  { id: "intro", eyebrow: "HNIX AX — 통합 ITO AI 생태계", title: "새벽 경보 하나가 지식이 되기까지", lines: ["AX Platform · PMS-X · AX-NAVI IDE · AX-DataLake", "고객망 안에 설치 — 모든 AI 호출·도구 호출·데이터 조회가 한 기반을 지난다"], img: "img/ecosystem-p2.png" },
  { id: "platform", eyebrow: "1 / 4 · 공통 AI 기반", title: "AX Platform", lines: ["LLM 게이트웨이 · MCP 허브와 승인함 · 에이전트와 트리거", "런북 · 현업 창구 · Insight · 현장 연결 점검"], video: "platform" },
  { id: "pmsx", eyebrow: "2 / 4 · 관리 · 운영", title: "PMS-X", lines: ["경보 → 장애·SR 자동 생성 · AI 분류·배정 추천(사내 모델)", "As-Is 화면 분석(화면→버튼→SQL→테이블) · KB · 인수인계 퀴즈"], video: "pmsx" },
  { id: "axnavi", eyebrow: "3 / 4 · 개발", title: "AX-NAVI IDE", lines: ["변경 리뷰 STOP → 지적 상세 → AX-NAVI 로 수정", "읽기·수정은 개발자 승인 → 다시 리뷰 — CI 게이트와 같은 판정"], video: "axnavi" },
  { id: "datalake", eyebrow: "4 / 4 · 데이터", title: "AX-DataLake", lines: ["개인정보 가림·소속 행 제한 · 온톨로지(장애 → 직전 72시간 변경)", "진단 요청은 승인 뒤 플랫폼 에이전트로 · 계보 · AI 질문"], video: "datalake" },
  { id: "outro", eyebrow: "HNIX AX", title: "사람은 판단과 승인만", lines: ["찾고 · 모으고 · 기록하는 일은 에이전트와 제품이", "에이전트도 사람과 같은 권한·가림·승인 규칙 — 고객망 안에서"], img: "img/ecosystem-p4.png" },
];

function cardHtml(c) {
  const bg = c.img ? `<img src="${pathToFileURL(join(ROOT, c.img)).href}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.12">` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;width:1440px;height:900px;background:#0f1d2b;color:#fff;font-family:"Malgun Gothic","Noto Sans KR",sans-serif;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
    .w{position:relative;text-align:center;max-width:1180px}
    .e{color:#7fe0e6;font-size:26px;letter-spacing:2px;font-weight:700}
    h1{font-size:76px;margin:18px 0 26px;font-weight:800}
    p{font-size:28px;color:#d4dde3;margin:8px 0;line-height:1.5}
    .bar{width:120px;height:6px;background:#0f7b85;margin:0 auto 26px;border-radius:3px}
  </style></head><body>${bg}<div class="w"><div class="bar"></div><div class="e">${c.eyebrow}</div><h1>${c.title}</h1>${c.lines.map((l) => `<p>${l}</p>`).join("")}</div></body></html>`;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`${cmd} 실패`);
}

/** 헤드리스 Edge 에 DevTools 로 붙어 HTML 을 PNG 로 찍는다(--screenshot 플래그는 새 헤드리스에서 비어 나온다) */
async function shooter() {
  const port = 9900 + Math.floor(Math.random() * 90);
  const proc = spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmp, "prof")}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise((r) => setTimeout(r, 200));
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === "page"), () => null);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m.result);
  });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return {
    async shot(url, file) {
      await send("Page.navigate", { url });
      await new Promise((r) => setTimeout(r, 1200));
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(data, "base64"));
    },
    async close() {
      await send("Browser.close").catch(() => undefined);
      ws.close();
      proc.kill();
      await new Promise((r) => setTimeout(r, 800));
    },
  };
}

const cam = await shooter();
const parts = [];
for (const c of CARDS) {
  const html = join(tmp, `${c.id}.html`);
  const png = join(tmp, `${c.id}.png`);
  writeFileSync(html, cardHtml(c));
  await cam.shot(pathToFileURL(html).href, png);
  const clip = join(tmp, `${c.id}.mp4`);
  // 카드 4초(처음·끝은 6초) — 소리 없는 영상, 제품 영상과 같은 규격
  run(FF, ["-y", "-loglevel", "error", "-loop", "1", "-t", c.video ? "4" : "6", "-i", png, "-vf", "fps=30,format=yuv420p,fade=in:0:12", "-c:v", "libx264", "-preset", "slow", "-crf", "24", clip]);
  parts.push(clip);
  if (c.video) parts.push(join(VID, `${c.video}.mp4`));
}
await cam.close();
const list = join(tmp, "list.txt");
writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
const out = join(VID, "tour.mp4");
run(FF, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,scale=1440:900,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-movflags", "+faststart", out]);
// 영상마다 첫 장면을 포스터로(사이트에서 재생 전 보이는 그림)
for (const v of ["platform", "pmsx", "axnavi", "datalake", "tour"]) {
  run(FF, ["-y", "-loglevel", "error", "-ss", v === "tour" ? "2" : "3", "-i", join(VID, `${v}.mp4`), "-frames:v", "1", "-vf", "scale=960:-1", "-q:v", "4", join(VID, `${v}.jpg`)]);
}
try {
  rmSync(tmp, { recursive: true, force: true });
} catch {
  /* 브라우저가 아직 쥐고 있으면 남긴다 */
}
console.log("->", out);
