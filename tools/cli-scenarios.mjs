/*
 * 해설 시연 영상 ③ AX-NAVI CLI — 회사 설치본 로그인(기기 승인) → 색인 → 묻기 → 변경 리뷰 STOP.
 * 실제 PowerShell 을 pty 로 띄워(cli-bridge.py) 브라우저 화면(xterm.js)으로 보이고, 명령은 사람이 치듯 넣는다. 출력은 CLI 가 낸 그대로다.
 * 해설은 presentations/hnix-ax-demo-1113 의 narr.json(c01~) → tts.mjs → durations.json 이 먼저 있어야 한다.
 *
 *   set STORY_DIR=<presentations\hnix-ax-demo-1113>
 *   node tools/record-demo.mjs --scenarios cli-scenarios.mjs --scenario cli --out <STORY_DIR>
 *   node mix.mjs cli   (STORY_DIR 에서)
 *
 * 작업 폴더는 %TEMP%\hnix-cli-demo 를 W: 로 잇는다(subst) — 화면 경로에 사용자 폴더 이름이 나오지 않게. 끝나면 끊는다.
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { APPS } from "./demo-scenarios.mjs";

const V = (process.env.STORY_DIR ?? "").replace(/\\/g, "/").replace(/\/$/, "");
if (!V) throw new Error("STORY_DIR 에 영상 작업 폴더(durations.json·card.html)를 지정하세요");
const DUR = JSON.parse(readFileSync(`${V}/durations.json`, "utf8"));
const L = APPS.platform.url;
const CLI_HOME = process.env.AXNAVI_CLI_HOME ?? "C:/Users/onlys/AX-NAVI-CLI";
/** pywinpty 가 깔린 파이썬 */
const PY = process.env.BRIDGE_PYTHON ?? "C:/Users/onlys/anaconda3/python.exe";
const ROOT = join(tmpdir(), "hnix-cli-demo");
const DRIVE = process.env.CLI_DRIVE ?? "W:";
const WORK = `${DRIVE}\\hr-system`;
const PORT = 8798;
const B = `http://127.0.0.1:${PORT}`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const card = (id) => `${pathToFileURL(`${V}/card.html`).href}?c=${id}`;

let marks = [];
let ffs = [];
async function beat(r, id, cap = "", sub = "") {
  await r.caption(cap, sub);
  const t = now();
  marks.push({ id, wall: t });
  const end = t + (DUR[id] ?? 5) + 0.9;
  return async (extra = 0) => {
    const left = end + extra - now();
    if (left > 0) await pause(left * 1000);
  };
}
async function ff(r, wait, keep = 3, cap = "") {
  if (cap) await r.caption(cap, "기다리는 동안은 빨리 감기");
  const t0 = now();
  const res = await wait();
  const t1 = now();
  if (t1 - t0 > keep + 1) ffs.push([t0, t1, keep]);
  return res;
}
/** story-scenarios.mjs 의 finish 와 같다 — 빨리 감기를 프레임·장면 시각에 반영하고 timeline-<편>.json 을 쓴다 */
async function finish(r, part) {
  // 마지막 카드는 화면이 바뀌지 않아 프레임이 오지 않는다 — 커서를 움직여 끝 시각의 프레임을 남긴다(없으면 영상이 카드에서 끊긴다)
  await r.pointAt({ x: 1380, y: 860 });
  await pause(700);
  ffs.sort((x, y) => x[0] - y[0]);
  const map = (t) => {
    let shift = 0;
    for (const [a, b, keep] of ffs) {
      if (t <= a) break;
      if (t < b) return t - shift - (t - a) + (t - a) * (keep / (b - a));
      shift += b - a - keep;
    }
    return t - shift;
  };
  for (const f of r.frames ?? []) f.t = map(f.t);
  const kept = [];
  for (const f of r.frames ?? []) {
    if (kept.length && f.t - kept[kept.length - 1].t < 0.034) kept[kept.length - 1] = { t: kept[kept.length - 1].t, data: f.data };
    else kept.push(f);
  }
  r.frames.splice(0, r.frames.length, ...kept);
  const ts = r.frames.map((f) => f.t);
  const at = [0];
  for (let i = 0; i < ts.length - 1; i++) at.push(at[i] + Number(Math.max(0.034, Math.min(ts[i + 1] - ts[i], 600)).toFixed(3)));
  const video = (wall) => {
    const w = map(wall);
    let k = -1;
    for (let i = 0; i < ts.length && ts[i] <= w; i++) k = i;
    if (k < 0) return 0;
    const gap = k + 1 < ts.length ? ts[k + 1] - ts[k] : Infinity;
    return at[k] + Math.max(0, Math.min(w - ts[k], gap));
  };
  writeFileSync(`${V}/timeline-${part}.json`, JSON.stringify({ marks: marks.map((m) => ({ ...m, video: Number(video(m.wall).toFixed(2)) })), ff: ffs }, null, 1));
  console.log(`  timeline-${part}.json — 장면 ${marks.length} · 빨리 감기 ${ffs.length}곳`);
}

// ── 터미널 다리 ─────────────────────────────────────────
const state = async () => (await fetch(`${B}/state`)).json();
async function typeCmd(text, delay = 0.055) {
  await fetch(`${B}/type`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, delay }) });
}
/** 명령을 치고 다음 프롬프트가 나올 때까지 */
async function run(text, { timeout = 300000, delay } = {}) {
  const before = (await state()).prompts;
  await typeCmd(text, delay);
  await pause(400);
  await typeCmd("\r");
  const t0 = Date.now();
  for (;;) {
    const s = await state();
    if (s.prompts > before && s.idle > 0.6) return s;
    if (Date.now() - t0 > timeout) throw new Error(`명령이 끝나지 않았습니다: ${text}\n${s.tail.slice(-600)}`);
    await pause(250);
  }
}
async function until(re, timeout = 120000) {
  const t0 = Date.now();
  for (;;) {
    const s = await state();
    const m = re.exec(s.tail);
    if (m) return m;
    if (Date.now() - t0 > timeout) throw new Error(`기다린 글이 나오지 않았습니다: ${re}\n${s.tail.slice(-600)}`);
    await pause(250);
  }
}

/** 대화형 모드에 스킬을 친다 */
let skillAt = 0;
async function skill(r, text) {
  await typeCmd(text, 0.05);
  await pause(600);
  await typeCmd("\r");
  skillAt = Date.now();
}
/** 스킬이 끝날 때까지 — 도는 동안은 바닥의 진행 표시가 계속 바뀐다. 읽기 전용 명령 확인이 뜨면 허용한다 */
async function skillDone(timeout = 600000) {
  for (;;) {
    const s = await state();
    if (/이번 세션 동안 (모두 )?묻지 않음/.test(s.tail.slice(-800)) && s.idle > 1) {
      await typeCmd("\r");
      await pause(1500);
      continue;
    }
    if (Date.now() - skillAt > 8000 && s.idle > 3) return;
    if (Date.now() - skillAt > timeout) throw new Error(`스킬이 끝나지 않았습니다\n${s.tail.slice(-600)}`);
    await pause(400);
  }
}
/** 답의 첫머리(친 스킬 줄)부터 보여 주고 seconds 동안 끝까지 천천히 내린다 */
async function scrollAnswer(r, marker, seconds) {
  const info = await r.eval(`(() => { const t = window.__term, b = t.buffer.active; let i = b.length - 1; for (; i >= 0; i--) { if ((b.getLine(i)?.translateToString(true) || '').includes(${JSON.stringify(marker)})) break; } if (i >= 0) t.scrollToLine(i); return { i, base: b.baseY }; })()`);
  if (!info || info.i < 0) return;
  const lines = Math.max(0, info.base - info.i);
  if (!lines) return;
  await pause(1500);
  const step = Math.max(80, ((seconds - 2) * 1000) / lines);
  for (let k = 0; k < lines; k++) {
    await r.eval("window.__term.scrollLines(1)");
    await pause(step);
  }
}

let bridge = null;
function setup() {
  mkdirSync(ROOT, { recursive: true });
  const cur = spawnSync("subst", [], { encoding: "utf8" }).stdout ?? "";
  if (!cur.toUpperCase().includes(`${DRIVE.toUpperCase()}\\:`)) {
    if (existsSync(`${DRIVE}\\`)) throw new Error(`${DRIVE} 드라이브가 이미 있습니다 — CLI_DRIVE 로 다른 글자를 주세요`);
    const s = spawnSync("subst", [DRIVE, ROOT], { encoding: "utf8" });
    if (s.status !== 0) throw new Error(`subst 실패: ${s.stdout}${s.stderr}`);
  }
  const prep = spawnSync(process.execPath, [new URL("./cli-prep.mjs", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), WORK], { encoding: "utf8" });
  if (prep.status !== 0) throw new Error(`cli-prep 실패: ${prep.stderr}`);
  // 런처 상태(로그인·받은 엔진)만 W: 에 둔다 — 홈 폴더는 그대로(개발자 본인 claude 로그인을 에이전트가 쓴다)
  const home = `${DRIVE}\\home`;
  // 막 설치한 PC 처럼 — 지난 로그인·받아 둔 엔진을 지운다
  rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  for (const d of [`${home}\\AppData\\Local`, `${DRIVE}\\bin`]) mkdirSync(d, { recursive: true });
  // 설치본의 axnavi 명령 — 런처(launcher/src)를 W:\AX-NAVI CLI 로 복사해 돌린다(whoami 의 설치 폴더가 사용자 폴더를 드러내지 않게)
  const inst = `${DRIVE}\\AX-NAVI CLI`;
  rmSync(inst, { recursive: true, force: true });
  mkdirSync(`${inst}\\launcher\\src`, { recursive: true });
  for (const n of readdirSync(`${CLI_HOME}/launcher/src`)) copyFileSync(`${CLI_HOME}/launcher/src/${n}`, `${inst}\\launcher\\src\\${n}`);
  copyFileSync(`${CLI_HOME}/launcher/package.json`, `${inst}\\launcher\\package.json`);
  writeFileSync(`${DRIVE}\\bin\\axnavi.cmd`, `@echo off\r\n"${process.execPath}" "${inst}\\launcher\\src\\main.mjs" %*\r\nexit /b %ERRORLEVEL%\r\n`);
  // whoami 가 PATH 의 파이썬 경로를 보여 준다 — 사용자 폴더 이름이 나오지 않게 W:\py 로 잇는다(설치본에는 파이썬이 들어 있다)
  const PYDIR = process.env.CLI_PYTHON_DIR ?? "C:\\Users\\onlys\\AppData\\Local\\Programs\\Python\\Python312";
  if (!existsSync(`${DRIVE}\\py`) && existsSync(PYDIR)) spawnSync("cmd", ["/c", "mklink", "/J", `${DRIVE}\\py`, PYDIR], { stdio: "ignore" });
  // 기기 이름은 PC 이름(hostname)이다 — 녹화에는 개인 PC 이름 대신 DEV-PC01
  writeFileSync(`${DRIVE}\\bin\\demo-host.mjs`, `import os from "node:os"; import { syncBuiltinESMExports } from "node:module"; os.hostname = () => "DEV-PC01"; syncBuiltinESMExports();\n`);
  const env = {
    AXNAVI_LAUNCHER_HOME: `${home}\\AppData\\Local\\AX-NAVI CLI`,
    HNIX_AX_SERVER: L,
    NODE_OPTIONS: `--import=file:///${DRIVE}/bin/demo-host.mjs`,
    // 스킬의 에이전트는 개발자 본인 Claude 구독(claude CLI 로그인) — 시연 PC 의 사내 CPU 모델(4B)은 코드 탐색 답이 부정확하다.
    // 설치본 기본은 사내 게이트웨이이고, 구독은 PC 정책이 허용할 때만. 비용 표시는 cli-bridge 가 녹화 화면에서 가린다
    AXNAVI_AUTH: process.env.CLI_AUTH ?? "subscription", AXNAVI_PROVIDER: "", ANTHROPIC_API_KEY: "",
  };
  const args = [new URL("./cli-bridge.py", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), "--port", String(PORT), "--cwd", WORK, "--path-prepend", `${DRIVE}\\bin;${DRIVE}\\py`, "--title", "Windows PowerShell"];
  for (const [k, v] of Object.entries(env)) args.push("--env", `${k}=${v}`);
  bridge = spawn(PY, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  bridge.stderr.on("data", (d) => process.stderr.write(`  [bridge] ${d}`));
}
/** 이개발의 다른 AX-NAVI 기기(영상 ① 에서 로그인한 IDE — 실제 PC 이름)를 끊는다. 끊은 기기는 화면에서 기본으로 숨는다 */
async function disconnectOtherDevices() {
  const a = APPS.platform;
  const tok = (await (await fetch(`${a.url}${a.loginApi}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a.users.dev) })).json()).accessToken;
  const h = { authorization: `Bearer ${tok}` };
  const list = await (await fetch(`${a.url}/api/v1/axnavi/my/devices`, { headers: h })).json();
  for (const d of list.items ?? []) if (d.status === "active") await fetch(`${a.url}/api/v1/axnavi/my/devices/${d.id}`, { method: "DELETE", headers: h });
}
async function teardown() {
  await fetch(`${B}/quit`, { method: "POST" }).catch(() => undefined);
  await pause(800);
  bridge?.kill();
  spawnSync("subst", [DRIVE, "/d"]);
}

export const SCENARIOS = {
  cli: {
    title: "AX-NAVI CLI — 터미널에서 레거시 길 찾기",
    maxGap: 600,
    async run(r) {
      marks = [];
      ffs = [];
      // 제목 카드를 먼저 띄우고 준비한다(녹화 첫머리가 빈 화면이 되지 않게)
      await r.go(card("cli-intro"));
      await disconnectOtherDevices();
      setup();
      try {
        for (let i = 0; i < 40; i++) {
          if (await fetch(`${B}/state`).then((x) => x.ok, () => false)) break;
          await pause(250);
        }
        let w = await beat(r, "c01");
        await w();

        // ── 로그인 — 브라우저에서 이 PC 승인
        await r.go(`${B}/`, "!!window.__term");
        await until(/PS [A-Z]:\\hr-system>\s*$/);
        await pause(800);
        w = await beat(r, "c02", "axnavi login — 회사 플랫폼에서 이 PC 를 승인합니다", "설치본에는 엔진이 없습니다 · 로그인한 PC 만 엔진을 받습니다");
        await typeCmd("axnavi login --no-browser");
        await pause(500);
        await typeCmd("\r");
        const m = await until(/승인 주소\s+(\S+)[\s\S]*?확인 코드\s+([A-Z0-9]{4}-[A-Z0-9]{4})/);
        const [, url, code] = m;
        await w();
        await r.login("platform", "dev");
        await r.go(url, "document.readyState === 'complete' && /이 기기 승인/.test(document.body.innerText)");
        await pause(800);
        w = await beat(r, "c03", `브라우저 — 확인 코드 ${code} 가 같은지 보고 [이 기기 승인]`, "이개발 · 사내 계정 · 기기 DEV-PC01 · AX-NAVI CLI");
        await pause(Math.max(2500, ((DUR.c03 ?? 8) - 4) * 1000));
        await r.click("이 기기 승인", { selector: "button", exact: true, after: 1500 });
        await w();
        await r.go(`${B}/`, "!!window.__term");
        await ff(r, () => until(/이제 작업 폴더에서/, 180000), 3, "엔진을 받는 중");
        await pause(1500);

        // ── 색인 — AI 없이
        await run("cls");
        w = await beat(r, "c04", "axnavi index build — AI 없이 코드 전체 지도", "화면 · 자바 · 매퍼 SQL · 테이블 · 호출 관계 · SQL 사용처");
        await run("axnavi index build");
        await w();

        // ── 대화형 모드 — /find · /impact 스킬
        await run("cls");
        await typeCmd("axnavi");
        await pause(400);
        await typeCmd("\r");
        await until(/자연어로 물어보세요/, 60000);
        await pause(1000);
        w = await beat(r, "c05", "axnavi — 대화형 모드 · IDE 와 같은 스킬 26종", "이클립스·인텔리J 옆 터미널, 서버 SSH 에서도 · 이 시연의 에이전트는 개발자 본인 Claude 구독");
        await pause(2500);
        await skill(r, "/find 사원 목록 조회 기능이 어디 있어?");
        await w();
        await ff(r, () => skillDone(), 4, "find 스킬 — 색인을 조회하고 파일을 읽는 중");
        w = await beat(r, "c06", "/find — 화면 버튼부터 테이블까지, 파일과 줄 번호로", "찾은 것 · 확인했는데 없는 것 · 확인하지 못한 것을 나눠서");
        await scrollAnswer(r, "/find 사원", (DUR.c06 ?? 15) - 2);
        await w();

        await skill(r, "/impact EmpMapper.selectEmpList 의 정렬(ORDER BY)을 바꾸면 영향 받는 곳");
        await ff(r, () => skillDone(), 4, "impact 스킬 — 호출자와 화면을 거슬러 올라가는 중");
        w = await beat(r, "c07", "/impact — 같은 SQL 을 쓰는 곳 · 화면 · 테스트 유무 · 위험도", "목록 조회와 엑셀 다운로드 두 곳 · 확인하지 못한 것까지");
        await scrollAnswer(r, "/impact EmpMapper", (DUR.c07 ?? 15) - 2);
        await w();
        {
          const before = (await state()).prompts;
          await typeCmd("/exit", 0.08);
          await pause(300);
          await typeCmd("\r");
          for (let i = 0; i < 60; i++) {
            if ((await state()).prompts > before) break;
            await pause(250);
          }
        }

        // ── IDE 에 없는 일괄 명령 — 현대화 레시피
        await run("cls");
        w = await beat(r, "c08", "axnavi modernize oracle-pg — 저장소 전체를 한 번에(AI 없이)", "IDE 에 없는 일괄 명령 · 자동으로 고칠 것과 사람이 볼 것을 나눔 · --apply 뒤 --verify");
        await run("axnavi modernize oracle-pg");
        await pause(1200);
        await run("Get-Content _workspace\\reports\\modernize_oracle-pg.md -Encoding utf8 -TotalCount 19", { delay: 0.03 });
        await w();

        // ── 머지 게이트 — 리뷰 STOP · 종료 코드
        await run("cls");
        await run("axnavi review");
        w = await beat(r, "c09", "axnavi review — STOP · MyBatis ${} 직접 치환(OWASP A03 · CWE-89)", "AI 없이 바뀐 줄만 검사 · CI 러너에서는 종료 코드로 머지를 막습니다");
        await pause(Math.max(3000, ((DUR.c09 ?? 12) * 1000) / 2));
        await run("$LASTEXITCODE");
        await w();

        await r.go(card("cli-end"));
        w = await beat(r, "c10");
        await w(1);
        await finish(r, "cli");
      } finally {
        await teardown();
      }
    },
  },
};
