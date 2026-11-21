/*
 * 해설 시연 영상 ⑤ — PMS-X 소스 분석기: 화면과 서버 저장소가 나뉜 시스템 + 운영 DB 를 모아 올리면 As-Is 메뉴가 채워지기까지
 * (2026-11-21 저녁 판 — 앱의 'DB 연결' 칸 · ERD 트리거). 이전 판은 presentations/hnix-ax-demo-1113/prev-1121b(DB 없음),
 * prev-1121(가상 인사관리시스템 JSP + PostgreSQL). 해설 음성을 먼저 만들고(narr.json c01~c15 → tts.mjs → durations.json),
 * 장면마다 해설 길이만큼 머문다.
 *
 * 준비(녹화 전마다):
 *   - 가상 영업주문관리 소스: 화면 저장소 C:\axdemo\web\so-front(사용자 웹) · C:\axdemo\web\so-admin(관리자 웹),
 *     서버 저장소 C:\axdemo\api\so-api (pmsx/samples/so-vue-split 복사 — 실명 경로가 영상에 안 나오게)
 *   - 설정·결과 폴더 C:\axdemo\work 를 지우고, %APPDATA%\pmsx-collector\recent.json 을 치워 처음 화면으로
 *   - 소스 분석기 화면: pmsx-collector.exe app --no-window → 로그의 주소를 COLLECTOR_URL 로
 *   - PMS-X 시연 데이터에 SO 시스템이 없을 것(있으면 시스템 등록이 '이미 있음'으로 막힌다)
 *   - 운영 DB 흉내: 로컬 PostgreSQL 127.0.0.1:15433 의 sodb(스키마 SO, 테이블 9 · 함수 2 · 트리거 1, 읽기 전용 계정 pmsx_ro)
 *     — C:\axdemo\db\sodb-postgres.sql. 비밀번호는 DEMO_DB_PW 환경변수로만 넘긴다(이 파일에 쓰지 않음)
 *
 *   set STORY_DIR=<presentations\hnix-ax-demo-1113>
 *   set COLLECTOR_URL=http://127.0.0.1:<port>/<token>/
 *   set DEMO_DB_PW=<sodb 읽기 전용 계정 비밀번호>
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
const FRONT1 = "C:\\axdemo\\web\\so-front";
const FRONT2 = "C:\\axdemo\\web\\so-admin";
const BACK = "C:\\axdemo\\api\\so-api";
const OUT = "C:\\axdemo\\work\\SO\\collector.yaml";
const DB_PW = process.env.DEMO_DB_PW;
if (!DB_PW) throw new Error("DEMO_DB_PW 에 시연 DB(sodb) 읽기 전용 계정 비밀번호를 지정하세요");
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

/** 선택자(또는 ERD 테이블 이름)의 화면 좌표. part: 'badge' 는 트리거 배지, 'body' 는 컬럼 칸 */
async function erdPoint(r, name, part) {
  return r.eval(`(() => {
    const n = [...document.querySelectorAll('.vue-flow__node')].find((x) => x.querySelector('.erd-name')?.textContent.trim() === ${JSON.stringify(name)});
    const el = n && (${JSON.stringify(part)} === 'badge' ? n.querySelector('[data-test=erd-trigger-badge]') : n.querySelector('.erd-cols'));
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + Math.min(b.height / 2, 40)) };
  })()`);
}
/** #main 안의 카드 제목(h2)이 화면 위쪽에 오게 부드럽게 내린다 */
async function scrollToCard(r, title, top = 110) {
  const dy = await r.eval(`(() => { const h = [...document.querySelectorAll('#main h2')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(title)})); return h ? Math.round(h.getBoundingClientRect().top - ${top}) : 0; })()`);
  if (Math.abs(dy) > 10) await r.scroll(dy, "#main", 14);
}

/** 지금 PMS-X 화면(로그인한 상태)에서 SO 시스템 ID 와 화면 ID(화면 코드 → ID)를 API 로 찾는다 */
async function ids(r) {
  return r.eval(`(async () => {
    const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(ADMIN)}) }).then((x) => x.json()).then((j) => j.accessToken);
    const H = { authorization: 'Bearer ' + t };
    const ps = await fetch('/api/v1/projects?size=100', { headers: H }).then((x) => x.json());
    for (const p of (ps.content ?? ps)) {
      const ss = await fetch('/api/v1/projects/' + (p.id ?? p.projectId) + '/systems', { headers: H }).then((x) => x.json());
      const s = ss.find((x) => x.code === 'SO');
      if (!s) continue;
      const sid = s.systemId ?? s.id;
      const sc = await fetch('/api/v1/systems/' + sid + '/analysis/screens?size=100', { headers: H }).then((x) => x.json());
      const by = {};
      for (const x of (sc.content ?? sc)) by[x.screenCode] = x.screenId;
      return { sid, list: by['so-front.OrderList'], stock: by['so-admin.ProductStock'] };
    }
    return null;
  })()`);
}

export const SCENARIOS = {
  collect: {
    title: "PMS-X 소스 분석기 — 화면과 서버 저장소가 나뉜 시스템과 운영 DB 를 모아 올리면 As-Is 메뉴가 채워지기까지",
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
      await r.type("css:[data-test=system-code] input", "SO", { delay: 140 });
      await r.type("css:[data-test=system-name] input", "영업주문관리", { delay: 110 });
      await pause(800);
      await r.click("저장", { selector: ".v-dialog button", exact: true, after: 2000 });
      await r.pointAt({ x: 700, y: 330 });
      await w();

      // ── 소스 분석기(고객사 PC) · 화면 · 서버 저장소를 따로 고르기
      await r.go(GUI, "document.readyState === 'complete' && !!document.querySelector('#pathIn')");
      await pause(1200);
      w = await beat(r, "c03", "고객사 PC · 소스 분석기 ① — 화면 · 서버 저장소가 따로 있을 때", "화면 저장소 두 개(사용자 웹 · 관리자 웹) + 서버 저장소 하나");
      await pause(2500);
      await r.click("화면·서버 저장소가 따로 있을 때", { after: 1200 });
      await r.type("css:#split-fronts-0", FRONT1, { delay: 45 });
      await r.click("+ 화면 저장소 추가", { selector: "button", after: 800 });
      await r.type("css:#split-fronts-1", FRONT2, { delay: 45 });
      await r.type("css:#split-backs-0", BACK, { delay: 45 });
      await pause(600);
      await r.click("훑어보기 ▶", { selector: "button", exact: true, after: 800 });
      await w();

      await ff(r, () => r.waitFor(body("/설정 만들고 점검/"), 120000));
      await pause(800);
      w = await beat(r, "c04", "찾은 내용 — 화면 Vue(앱 2개) · 서버 Spring · MyBatis · 테이블 정의 파일", "화면 앱 이름은 메뉴 맨 위 이름 · 설정과 결과는 저장소 밖에");
      await r.type("css:#code", "SO", { delay: 120, clear: true });
      await r.type("css:#name", "영업주문관리", { delay: 90, clear: true });
      await pause(1500);
      await r.type("css:#appName-0", "사용자 웹", { delay: 110, clear: true });
      await r.type("css:#appName-1", "관리자 웹", { delay: 110, clear: true });
      await pause(1000);
      await r.type("css:#outPath", OUT, { delay: 35, clear: true });
      await w(-1.5);
      await r.click("설정 만들고 점검 ▶", { selector: "button", exact: true, after: 800 });

      await ff(r, () => r.waitFor(`!/점검 중/.test(document.body.innerText) && ${body("/수집 시작/")}`, 120000));
      await pause(800);
      // ── ② DB 연결 — 읽기 전용 계정 · 연결 시험 · 비밀번호는 설정 파일에 쓰지 않음
      w = await beat(r, "c05", "② 환경 점검 — DB 연결(선택) · 운영 PostgreSQL 에 읽기 전용 계정으로", "연결 시험으로 테이블 · 함수 · 트리거 수 확인 · 비밀번호는 설정 파일에 쓰지 않고 앱이 켜져 있는 동안만");
      await pause(1500);
      await r.clickSel("#dbOpenBtn", 1200);
      const sel = await r.eval(`(() => { const el = document.querySelector('#dbType'); const b = el.getBoundingClientRect(); return { x: Math.round(b.left + 80), y: Math.round(b.top + b.height / 2) }; })()`);
      await r.clickAt(sel);
      await r.eval(`(() => { const el = document.querySelector('#dbType'); el.value = 'postgresql'; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await pause(900);
      await r.type("css:#dbHost", "127.0.0.1", { delay: 70 });
      await r.type("css:#dbPort", "15433", { delay: 90 });
      await r.type("css:#dbName", "sodb", { delay: 110 });
      await r.type("css:#dbUser", "pmsx_ro", { delay: 100 });
      await r.type("css:#dbPw", DB_PW, { delay: 90 });
      await r.type("css:#dbSchemas", "SO", { delay: 140 });
      await pause(600);
      await r.clickSel("#dbTestBtn", 800);
      await r.waitFor("!!document.querySelector('#dbTestOk, #dbCard .note.fail')", 60000);
      await pause(2500);
      await r.pointAt(await r.eval(`(() => { const b = document.querySelector('#dbTestOk').getBoundingClientRect(); return { x: Math.round(b.left + 420), y: Math.round(b.top + b.height / 2) }; })()`));
      await w(-2.5);
      await r.clickSel("#dbSaveBtn", 1000);

      await ff(r, () => r.waitFor(`!/점검 중/.test(document.body.innerText) && ${body("/DB 접속/")}`, 120000));
      await pause(800);
      w = await beat(r, "c06", "다시 점검 — 화면 · 서버 소스 · 매퍼 · DB 접속(읽기 전용)", "DB 에 메뉴 테이블이 없으면 수집하면서 소스로 메뉴를 만든다");
      await pause(2500);
      await scrollToCard(r, "점검 결과");
      await pause(3500);
      await r.scroll(420, "#main", 14);
      await w();

      await scrollToCard(r, "수집 방법");
      w = await beat(r, "c07", "수집 방법 — 화면 그림까지(권장)", "Vue 화면도 테스트 서버 없이 이 PC 브라우저로 그려 화면 이미지 · 버튼 위치까지");
      await pause(DUR.c07 * 1000 - 2500);
      await r.click("수집 시작 ▶", { selector: "button", exact: true, after: 1000 });
      await w();

      w = await beat(r, "c08", "③ 수집 → ④ 결과 — 화면 8개 모두 그림 · 버튼 18개 모두 처리 함수까지", "메뉴 12개 — 메뉴 테이블 없이 라우터 정의에서 자동 구성 · 맨 위는 사용자 웹 · 관리자 웹");
      await ff(r, () => r.waitFor(body("/결과 파일|결과 보기 ▶/"), 120000));
      await pause(600);
      if (await r.eval(body("/결과 보기 ▶/"))) await r.click("결과 보기 ▶", { selector: "button", exact: true, after: 1500 });
      await pause(5500);
      await r.scroll(260, "#main", 12);
      await w();

      await r.scroll(500, "#main", 12);
      w = await beat(r, "c09", "PMS-X 서버로 올리기 — 시스템 코드 SO 로 찾아 새 회차로", "망분리 현장은 결과 파일(zip)을 반출해 PMS-X 화면에서 업로드");
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
      if (!id?.sid || !id.list || !id.stock) throw new Error(`SO 시스템 또는 화면을 찾지 못함: ${JSON.stringify(id)}`);
      await r.go(`${P}/asis/viewer/${id.sid}/${id.list}`, PX_READY);
      await pause(3000);
      w = await beat(r, "c10", "화면 분석 뷰어 — 메뉴는 사용자 웹 · 관리자 웹 › 라우터 메뉴", "주문 목록 · 확정 → 화면 함수 → 서버 주소 → 컨트롤러 · 서비스 → 매퍼 → 주문 · 재고 · 주문 이력");
      await r.pointAt({ x: 170, y: 330 });
      await pause(7500);
      await r.clickSel("[data-test=hotspot-el-button7]", 1500);
      await pause(3500);
      await r.scroll(500, ".v-navigation-drawer--right .v-navigation-drawer__content, aside", 14);
      await w();

      await r.go(`${P}/asis/viewer/${id.sid}/${id.stock}`, PX_READY);
      await pause(2500);
      w = await beat(r, "c11", "관리자 웹 › 품목 재고 조정", "다른 앱이지만 같은 서버 — 한 시스템 안에서 함께 분석");
      await r.pointAt({ x: 170, y: 500 });
      await w();

      await r.go(`${P}/asis/tables?systemId=${id.sid}`, PX_READY);
      await pause(2500);
      w = await beat(r, "c12", "테이블 정의서 — 품목 재고(SO_STOCK) · 사용 화면", "사용자 웹과 관리자 웹의 화면이 같은 테이블을 읽고 바꾸는 곳");
      await r.click("SO_STOCK", { exact: true, after: 2500 });
      await pause(2500);
      await r.click("사용 화면", { selector: ".v-tab, [role=tab]", after: 1500 });
      await w();

      // ── ERD — 실선은 DB 외래 키, 번개는 DB 트리거 · 누르면 트리거 → 함수 → 재고 변동 이력(DB 에만 있는 테이블)
      await r.go(`${P}/asis/erd?systemId=${id.sid}`, `${PX_READY} && document.querySelectorAll('.vue-flow__node').length > 5`);
      await pause(3500);
      w = await beat(r, "c13", "ERD — 실선은 DB 에서 읽은 외래 키 · 번개는 운영 DB 의 트리거", "품목 재고 수정 → 트리거 → 함수 → 재고 변동 이력(소스에는 없고 DB 에만 있는 테이블)");
      const badge = await erdPoint(r, "SO_STOCK", "badge");
      if (badge) {
        await r.pointAt(badge);
        await r.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: badge.x, y: badge.y });
        await pause(4500);
      }
      const stock = await erdPoint(r, "SO_STOCK", "body");
      if (stock) await r.clickAt(stock);
      await pause(2500);
      await r.pointAt({ x: 1250, y: 330 });
      await w();

      await r.go(`${P}/asis/report?systemId=${id.sid}&screenId=${id.stock}`, PX_READY);
      await pause(3000);
      w = await beat(r, "c14", "As-Is 분석서 — 관리자 웹 › 품목 재고 조정", "저장 → 확인 메시지 → 품목 재고 · 재고 조정 이력");
      await pause(5000);
      await r.scroll(650, null, 14);
      await w();

      await r.go(card("collect-end"));
      w = await beat(r, "c15");
      await w(1);
      await finish(r, "collect");
    },
  },
};
