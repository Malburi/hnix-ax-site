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
  const home = `${DRIVE}\\home`;
  // 막 설치한 PC 처럼 — 지난 로그인·받아 둔 엔진을 지운다
  rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  for (const d of [`${home}\\.axnavi`, `${home}\\AppData\\Local`, `${home}\\AppData\\Roaming`, `${DRIVE}\\bin`]) mkdirSync(d, { recursive: true });
  // 엔진의 새 판 알림(GitHub 조회)을 녹화에서 뺀다
  writeFileSync(`${home}\\.axnavi\\update-check.json`, JSON.stringify({ at: Date.now(), latest: null }));
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
    USERPROFILE: home, HOME: home, LOCALAPPDATA: `${home}\\AppData\\Local`, APPDATA: `${home}\\AppData\\Roaming`,
    AXNAVI_LAUNCHER_HOME: `${home}\\AppData\\Local\\AX-NAVI CLI`,
    HNIX_AX_SERVER: L,
    NODE_OPTIONS: `--import=file:///${DRIVE}/bin/demo-host.mjs`,
    AXNAVI_AUTH: "", AXNAVI_PROVIDER: "", ANTHROPIC_API_KEY: "",
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
        await ff(r, () => until(/이제 작업 폴더에서/, 180000), 3, "엔진과 사내 게이트웨이 연결을 받는 중");
        await pause(1500);

        // ── whoami
        await run("axnavi whoami");
        w = await beat(r, "c04", "axnavi whoami — 사람 · 사용 허가 · 엔진 · 사내 모델", "모델 호출은 모두 사내 LLM 게이트웨이로 — 사용량이 플랫폼에 남습니다");
        await w();

        // ── 색인
        await run("cls");
        await run("axnavi index build");
        await run("axnavi index coverage");
        w = await beat(r, "c05", "axnavi index build — AI 없이 코드 전체 지도", "화면 · 자바 · 매퍼 SQL · 테이블 · 호출 관계 — 커버리지 진단으로 다룰 수 있는 범위를 숫자로");
        await w();

        // ── 대화형 모드 — 에이전트·스킬 목록(모델은 부르지 않는다: 시연 PC 의 CPU 모델은 코드 탐색 답이 부정확해 넣지 않음)
        await run("cls");
        await typeCmd("axnavi");
        await pause(400);
        await typeCmd("\r");
        await until(/자연어로 물어보세요/, 60000);
        await pause(1200);
        w = await beat(r, "c06", "axnavi — 대화형 모드 · 에이전트 19종 · 스킬 26종", "프로젝트 · 인덱스 상태 · 실행 경로(사내 게이트웨이)가 먼저 보입니다 · 파일을 바꾸기 전에는 묻습니다");
        await pause(Math.max(3000, ((DUR.c06 ?? 10) * 1000) / 2));
        await typeCmd("/agents", 0.08);
        await pause(400);
        await typeCmd("\r");
        await until(/writer/, 30000);
        await w();
        await pause(1500);
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

        // ── 변경 리뷰
        await run("cls");
        await run("git --no-pager diff --stat; git --no-pager diff -- src/main/resources", { delay: 0.035 });
        w = await beat(r, "c08", "개발자의 변경 — 사원 목록에 정렬 추가", "화면에서 고른 정렬 컬럼을 ${} 로 SQL 에 그대로 붙였습니다");
        await w();
        await run("cls");
        await run("axnavi review");
        w = await beat(r, "c09", "axnavi review — STOP · MyBatis ${} 직접 치환(OWASP A03 · CWE-89)", "AI 없이 바뀐 줄만 검사 · 위치와 고치는 법");
        await w();
        await run("$LASTEXITCODE");
        w = await beat(r, "c10", "종료 코드 4 — CI 에서 머지를 막습니다", "GO 0 · HOLD 3 · STOP 4 — 같은 판정을 IDE 상태 표시줄과 CI 가 씁니다");
        await w();

        // ── 관리자 — 기기
        await r.login("platform", "admin");
        await r.go(`${L}/axnavi-seats`);
        await pause(1500);
        await r.click("기기 (", { selector: ".n-tabs-tab", after: 1200 });
        w = await beat(r, "c11", "플랫폼 › AX-NAVI 사용 허가 — 사람 · 기기 · 엔진", "방금 승인한 DEV-PC01 · 끊으면 그 PC 의 CLI 는 바로 잠깁니다");
        await w();

        await r.go(card("cli-end"));
        w = await beat(r, "c12");
        await w(1);
        await finish(r, "cli");
      } finally {
        await teardown();
      }
    },
  },
};
