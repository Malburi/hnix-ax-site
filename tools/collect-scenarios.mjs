/*
 * 해설 시연 영상 ⑤ — PMS-X 소스 분석기로 소스와 DB를 모아 올리면 As-Is 메뉴가 채워지기까지(2026-11-19). lake-scenarios.mjs 와 같은 방식:
 * 해설 음성을 먼저 만들고(presentations/hnix-ax-demo-1113: narr.json c01~c15 → tts.mjs → durations.json), 장면마다 해설 길이만큼 머문다.
 *
 * 준비(녹화 전마다):
 *   - 가상 인사관리시스템 소스 C:\axdemo\hr-legacy-pg (collector.yaml: 시스템 HRS, DB PostgreSQL 127.0.0.1:15433 hrdb, 읽기 전용 pmsx_ro)
 *   - out 폴더와 %APPDATA%\pmsx-collector\recent.json 을 지워 처음 화면으로
 *   - 소스 분석기 화면: set PMSX_DB_PW=… 후 pmsx-collector.exe app --no-window → 로그의 주소를 COLLECTOR_URL 로
 *   - PMS-X 시연 데이터에 HRS 시스템이 없을 것(있으면 시스템 등록이 '이미 있음'으로 막힌다)
 *
 *   set STORY_DIR=<presentations\hnix-ax-demo-1113>
 *   set COLLECTOR_URL=http://127.0.0.1:<port>/<token>/
 *   node tools/record-demo.mjs --scenarios collect-scenarios.mjs --scenario collect --out <STORY_DIR>
 *   (STORY_DIR 에서) node mix.mjs collect
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { APPS } from "./demo-scenarios.mjs";

const V = (process.env.STORY_DIR ?? "").replace(/\\/g, "/").replace(/\/$/, "");
if (!V) throw new Error("STORY_DIR 에 영상 작업 폴더(durations.json·card.html)를 지정하세요");
const GUI = process.env.COLLECTOR_URL;
if (!GUI) throw new Error("COLLECTOR_URL 에 소스 분석기 화면 주소(app --no-window 가 찍는 주소)를 지정하세요");
const DUR = JSON.parse(readFileSync(`${V}/durations.json`, "utf8"));
const P = APPS.pmsx.url;
const ADMIN = APPS.pmsx.users.admin;
const SRC = "C:\\axdemo\\hr-legacy-pg";
const PX_READY = "document.readyState === 'complete' && !!document.querySelector('.v-navigation-drawer, nav')";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const card = (id) => `${pathToFileURL(`${V}/card.html`).href}?c=${id}`;
const body = (re) => `${re}.test(document.body.innerText)`;

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
async function ff(r, wait, keep = 2) {
  const t0 = now();
  const res = await wait();
  const t1 = now();
  if (t1 - t0 > keep + 1) ffs.push([t0, t1, keep]);
  return res;
}
async function finish(r, part) {
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
  console.log(`  프레임 ${r.frames.length} → ${kept.length}`);
  r.frames.splice(0, r.frames.length, ...kept);
  const ts = (r.frames ?? []).map((f) => f.t);
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

/** 지금 PMS-X 화면(로그인한 상태)에서 HRS 시스템 ID 와 발령관리(HR0103) 화면 ID 를 API 로 찾는다 */
async function ids(r) {
  return r.eval(`(async () => {
    const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(ADMIN)}) }).then((x) => x.json()).then((j) => j.accessToken);
    const H = { authorization: 'Bearer ' + t };
    const ps = await fetch('/api/v1/projects?size=100', { headers: H }).then((x) => x.json());
    for (const p of (ps.content ?? ps)) {
      const ss = await fetch('/api/v1/projects/' + (p.id ?? p.projectId) + '/systems', { headers: H }).then((x) => x.json());
      const s = ss.find((x) => x.code === 'HRS');
      if (!s) continue;
      const sid = s.systemId ?? s.id;
      const tree = await fetch('/api/v1/systems/' + sid + '/menu-tree', { headers: H }).then((x) => x.ok ? x.json() : []);
      const find = (ns) => { for (const n of ns) { if (n.screen && n.screen.screenCode === 'HR0103') return n.screen.screenId; const k = find(n.children || []); if (k) return k; } return null; };
      return { sid, scr: find(tree) };
    }
    return null;
  })()`);
}

export const SCENARIOS = {
  collect: {
    title: "PMS-X 소스 분석기 — 소스와 DB를 모아 올리면 As-Is 메뉴가 채워지기까지",
    maxGap: 600,
    async run(r) {
      marks = [];
      ffs = [];
      await r.go(card("collect-intro"));
      let w = await beat(r, "c01");
      await w();

      // ── PMS-X · 시스템 등록(코드와 이름만)
      await r.login("pmsx", "admin");
      await r.go(`${P}/asis/systems`, PX_READY);
      await pause(1500);
      w = await beat(r, "c02", "PMS-X · As-Is 분석 → 시스템 관리 — 분석할 시스템 등록", "시스템 코드와 이름만 · 화면 기술 · DB 종류는 수집 결과로 채움");
      await r.click("시스템 등록", { selector: "button", after: 1200 });
      await r.type("css:[data-test=system-code] input", "HRS", { delay: 120 });
      await r.type("css:[data-test=system-name] input", "인사관리시스템", { delay: 110 });
      await pause(800);
      await r.click("저장", { selector: ".v-dialog button", exact: true, after: 2000 });
      await r.pointAt({ x: 700, y: 330 });
      await w();

      // ── 소스 분석기(고객사 PC)
      await r.go(GUI, "document.readyState === 'complete' && !!document.querySelector('#pathIn')");
      await pause(1200);
      w = await beat(r, "c03", "고객사 PC · 소스 분석기 ① 소스 선택", "실행 파일 하나 · 소스 폴더를 고르면 설정을 읽거나 만들어 줌");
      await pause(5000);
      await r.type("css:#pathIn", SRC, { delay: 60 });
      await r.press("Enter");
      await w();

      await ff(r, () => r.waitFor(`!/점검 중/.test(document.body.innerText) && ${body("/수집 시작/")}`, 120000));
      await pause(800);
      w = await beat(r, "c04", "② 환경 점검 — 화면 · 서버 기술, 소스 폴더, PostgreSQL 인사 DB 접속", "읽기 전용 계정으로 카탈로그만 조회 · 소스와 DB 는 바꾸지 않음");
      await pause(7000);
      await r.scroll(620, "#main", 16);
      await w();

      await r.scroll(700, "#main", 12);
      w = await beat(r, "c05", "수집 방법 — 화면 그림까지(권장)", "테스트 서버 없이 JSP 를 이 PC 브라우저로 그려 화면 이미지 · 버튼 위치까지");
      await pause(DUR.c05 * 1000 - 2500);
      await r.click("수집 시작 ▶", { selector: "button", exact: true, after: 1000 });
      await w();

      w = await beat(r, "c06", "③ 수집 → ④ 결과", "버튼 23개 중 22개가 처리 함수까지 · 18개가 SQL · 테이블까지");
      await r.waitFor(body("/결과 파일|결과 보기 ▶/"), 120000);
      await pause(600);
      if (await r.eval(body("/결과 보기 ▶/"))) await r.click("결과 보기 ▶", { selector: "button", exact: true, after: 1500 });
      await w();

      await r.scroll(500, "#main", 12);
      w = await beat(r, "c07", "PMS-X 서버로 올리기 — 시스템 코드 HRS 로 찾아 새 회차로", "망분리 현장은 결과 파일(zip)을 반출해 PMS-X 화면에서 업로드");
      await r.type("css:#upServer", P, { delay: 45, clear: true });
      await r.type("css:#upUser", ADMIN.loginId, { delay: 80, clear: true });
      await r.type("css:#upPw", ADMIN.password, { delay: 80 });
      await r.clickSel("#upBtn", 600);
      await r.waitFor(body("/올렸습니다/"), 60000);
      await pause(800);
      await r.scroll(400, "#main", 8);
      await w();

      // ── PMS-X · 올린 결과로 채워진 As-Is 메뉴
      await r.go(`${P}/asis/systems`, PX_READY);
      const id = await ids(r);
      if (!id?.sid || !id.scr) throw new Error(`HRS 시스템 또는 HR0103 화면을 찾지 못함: ${JSON.stringify(id)}`);
      await r.go(`${P}/asis/runs?systemId=${id.sid}`, PX_READY);
      await pause(2000);
      w = await beat(r, "c08", "PMS-X · 수집 이력 — 첫 회차", "이후 화면은 모두 이 결과 파일 하나로 만들어짐");
      await w();

      await r.go(`${P}/asis/viewer/${id.sid}/${id.scr}`, PX_READY);
      await pause(3000);
      w = await beat(r, "c09", "화면 분석 뷰어 — 발령관리(HR0103)", "버튼 → 자바스크립트 함수 → 서버 주소 → 컨트롤러 · 서비스 → 매퍼 → DB 프로시저 → 테이블");
      await pause(6500);
      await r.clickSel("[data-test=hotspot-btnConfirm]", 1500);
      await pause(3500);
      await r.scroll(500, ".v-navigation-drawer--right .v-navigation-drawer__content, aside", 14);
      await w();

      await r.go(`${P}/asis/navmap?systemId=${id.sid}`, PX_READY);
      await pause(3000);
      w = await beat(r, "c10", "화면 이동 맵 — 소스에서 찾은 팝업 · 화면 이동", "사원관리 → 사원 검색 팝업 · 교육이력관리 → 사원 상세");
      await w();

      await r.go(`${P}/asis/tables?systemId=${id.sid}`, PX_READY);
      await pause(2500);
      w = await beat(r, "c11", "테이블 정의서 — DB 에서 읽은 테이블 · 컬럼 · 주석 + 사용 화면", "인사발령(TB_APPOINT)");
      await r.click("TB_APPOINT", { exact: true, after: 2500 });
      await pause(3000);
      await r.click("사용 화면", { selector: ".v-tab, [role=tab]", after: 1500 });
      await w();

      await r.go(`${P}/asis/erd?systemId=${id.sid}`, PX_READY);
      await pause(3500);
      w = await beat(r, "c12", "ERD — 실선은 DB 의 외래 키, 점선은 SQL 조인으로 추정한 관계", "외래 키가 없는 오래된 시스템에서 업무 관계를 찾는 단서");
      await w();

      await r.go(`${P}/asis/dbobjects?systemId=${id.sid}`, PX_READY);
      await pause(2500);
      w = await beat(r, "c13", "PL/SQL 분석 — DB 에서 읽은 프로시저 · 함수 · 트리거", "발령 확정 프로시저(SP_APPT_CONFIRM) · 개요 → 로직 순서도");
      if (!(await r.find("SP_APPT_CONFIRM", { timeout: 1500 }))) await r.click("프로시저", { exact: true, after: 1200 });
      await r.click("SP_APPT_CONFIRM", { exact: true, after: 2500 });
      await pause(7000);
      await r.click("로직", { selector: ".v-tab, [role=tab]", exact: true, after: 2000 });
      await w();

      await r.go(`${P}/asis/report?systemId=${id.sid}&screenId=${id.scr}`, PX_READY);
      await pause(3000);
      w = await beat(r, "c14", "As-Is 분석서 — 같은 수집 결과로 만든 화면 문서", "개요 · 수행 절차 · 쓰는 데이터 · 현업 확인 항목 · Word 내려받기 · AI 서술(선택)");
      await pause(7000);
      await r.scroll(700, null, 14);
      await w();

      await r.go(card("collect-end"));
      w = await beat(r, "c15");
      await w(1);
      await finish(r, "collect");
    },
  },
};
