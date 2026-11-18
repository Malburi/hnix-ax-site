/*
 * 해설 시연 영상 2026-11-13 판 — 해설 음성을 먼저 만들고(presentations/hnix-ax-demo-1113: narr.json → tts.mjs → durations.json),
 * 녹화는 장면마다 해설 길이만큼 머문다. AI 를 기다리는 긴 구간은 빨리 감는다(ff). 끝나면 timeline-<편>.json 에 장면 시각.
 *   ops  현업 문의 한 건이 지식이 되기까지 — 현업 창구(매뉴얼 + 레이크 문서) → 담당자 접수 → 업무 자동화·승인함 → PMS-X → AX-NAVI IDE → 지식 문서
 *   gov  데이터·통제·도입 구성 — 레이크 대시보드·AI 분석 · 레이크 문서 · 플랫폼 문서 검색 · 게이트웨이 · 기능 모듈 · 사내 AD·SSO(선택)
 *
 *   node tools/story-prep.mjs && node tools/feature-prep-analysis.mjs
 *   set STORY_DIR=<presentations\hnix-ax-demo-1113> & set AXNAVI_IDE_EXE=<IDE 1.2.8 exe>
 *   node tools/record-demo.mjs --scenarios story-scenarios.mjs --scenario ops --out <STORY_DIR>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { APPS, DEMO_REPO, runAgent } from "./demo-scenarios.mjs";
import { clickNear, closeModal, down, ideQuickLogin, modalBtn, pick, pmsxProject, sideMenu, top, vtype } from "./feature-scenarios.mjs";

const V = (process.env.STORY_DIR ?? "").replace(/\\/g, "/").replace(/\/$/, "");
if (!V) throw new Error("STORY_DIR 에 영상 작업 폴더(durations.json·card.html)를 지정하세요");
const DUR = JSON.parse(readFileSync(`${V}/durations.json`, "utf8"));
const PREP = JSON.parse(readFileSync(new URL("./.story-prep.json", import.meta.url), "utf8"));
APPS.platform.users.hyun = PREP.hyun;
const L = APPS.platform.url;
const P = APPS.pmsx.url;
const D = APPS.datalake.url;
const DL_READY = "document.readyState === 'complete' && !!document.querySelector('.n-layout-header')";
const DEMO_FILE = `${DEMO_REPO}/src/main/java/com/hd/hr/EmpDao.java`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const card = (id) => `${pathToFileURL(`${V}/card.html`).href}?c=${id}`;

let marks = [];
let ffs = [];
/** 장면 시작 — 자막을 바꾸고 시각을 적는다. 돌려준 함수를 부르면 해설이 끝날 때까지 기다린다 */
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
/** AI 를 기다리는 구간 — 영상에서는 keep 초로 빨리 감는다(해설이 흐르지 않을 때만 쓴다) */
async function ff(r, wait, keep = 3, cap = "") {
  if (cap) await r.caption(cap, "기다리는 동안은 빨리 감기");
  const t0 = now();
  const res = await wait();
  const t1 = now();
  if (t1 - t0 > keep + 1) ffs.push([t0, t1, keep]);
  return res;
}
/** 빨리 감기를 프레임 시각과 장면 시각에 반영하고 timeline 을 쓴다 — record-demo 가 r.frames 로 인코딩한다 */
async function finish(r, part) {
  await r.pointAt({ x: 1380, y: 860 });
  await pause(700);
  const map = (t) => {
    let shift = 0;
    for (const [a, b, keep] of ffs) {
      if (t <= a) break;
      if (t < b) return t - shift - (t - a) + (t - a) * (keep / (b - a));
      shift += b - a - keep;
    }
    return t - shift;
  };
  ffs.sort((x, y) => x[0] - y[0]);
  for (const f of r.frames ?? []) f.t = map(f.t);
  // 인코더는 프레임마다 최소 0.034초를 준다 — 그보다 촘촘한 프레임(IDE 는 초당 수십 장)을 두면 영상이 느려지므로 솎는다
  const kept = [];
  for (const f of r.frames ?? []) {
    // 너무 촘촘하면 앞 프레임 자리에 이번 화면을 덮어쓴다 — 마지막 화면(바뀐 자막 등)을 잃지 않게
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
  console.log(`  timeline-${part}.json — 장면 ${marks.length} · 빨리 감기 ${ffs.length}곳(${ffs.reduce((n, [a, b, k]) => n + (b - a - k), 0).toFixed(0)}초 줄임)`);
}

/** 사내 모델을 미리 깨워 둔다 — 잠든 임베딩·대화 모델이 첫 요청에서 수십 초 걸리는 것을 녹화에 넣지 않게 */
async function warm() {
  const a = APPS.platform;
  const tok = (await (await fetch(`${a.url}${a.loginApi}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a.users.dev) })).json()).accessToken;
  await fetch(`${a.url}/api/v1/docs/search`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify({ query: "급여 배치", k: 3 }) }).catch(() => undefined);
}

/** PMS-X 서비스 요청 하나를 연다 */
async function openSr(r, no) {
  await r.go(`${P}/sm/srs`);
  await pause(1500);
  await r.clickSel("[data-test=sr-search] input", 400);
  for (const ch of no) {
    await r.send("Input.insertText", { text: ch });
    await pause(60);
  }
  await r.press("Enter");
  await pause(1500);
  await r.click(no, { selector: "td", after: 1800 });
}
/** PMS-X 서비스 요청 상태 바꾸기 */
async function transition(r, label, opts = {}) {
  // 상태 버튼은 상세 칸 맨 위 '다음 단계' 띠에 있다(PMS-X 1.3.16~) — 처리 내역까지 내려와 있으면 화면 밖이라 먼저 올린다
  await r.eval("document.querySelector('[data-test=sr-transitions]')?.scrollIntoView({ block: 'center' })").catch(() => undefined);
  await pause(500);
  const ok = await r.click(label, { selector: "[data-test=sr-transitions] button", exact: true, after: 900 });
  if (!ok) return false;
  if (opts.assignee) {
    const filled = await r.eval("(() => { const f = document.querySelector('[data-test=sr-transition-assignee] input'); return !!f && !!f.value; })()").catch(() => false);
    if (!filled) {
      await r.clickSel("[data-test=sr-transition-assignee] input", 500);
      for (const ch of opts.assignee) {
        await r.send("Input.insertText", { text: ch });
        await pause(70);
      }
      await pause(1500);
      await r.click(opts.assignee, { selector: ".v-list-item", after: 700 });
    }
  }
  if (opts.comment) await r.type("css:[data-test=sr-transition-comment] textarea", opts.comment, { delay: 25 });
  await r.clickSel("[data-test=sr-transition-ok]", 1500);
  return true;
}
/** PMS-X 접수 요청 — 분류·배정 칸에서 담당자를 정하고 바로 배정(PMS-X 1.3.17~). 운영 담당은 [나에게 배정] */
async function classifyAssign(r, name) {
  const me = await r.eval("!!document.querySelector('[data-test=sr-classify-me]')").catch(() => false);
  if (me) {
    await r.clickSel("[data-test=sr-classify-me]", 700);
  } else {
    const filled = await r.eval("(() => { const f = document.querySelector('[data-test=sr-classify-assignee] input'); return !!f && !!f.value; })()").catch(() => false);
    if (!filled && name) {
      await r.clickSel("[data-test=sr-classify-assignee] input", 500);
      for (const ch of name) {
        await r.send("Input.insertText", { text: ch });
        await pause(70);
      }
      await pause(1500);
      await r.click(name, { selector: ".v-list-item", after: 700 });
    }
  }
  await r.clickSel("[data-test=sr-classify-assign]", 1500);
}
const answered = (n) => `document.querySelectorAll('[data-test=desk-answer]').length >= ${n} && !document.querySelector('.msg.bot .n-spin, .typing')`;

export const SCENARIOS = {
  /* ================= ① 운영 ================= */
  ops: {
    title: "현업 문의 한 건이 지식이 되기까지",
    maxGap: 600,
    async run(r) {
      marks = [];
      ffs = [];
      let srNo = null;

      await r.go(card("ops-intro"));
      let w = await beat(r, "o01");
      await w();

      // ── 현업 창구 — 김현업
      await warm();
      await r.login("platform", "hyun");
      await r.go(`${L}/desk/hr-help`);
      await pause(1500);
      w = await beat(r, "o02", "현업 창구 — 인사시스템 도움 창구", "김현업(인사팀) · 매뉴얼과 운영 보고서를 근거로 먼저 답합니다");
      await w();

      await r.type("예: 사원 조회에", "지난달 급여 계산 배치가 늦어진 원인이 뭐였나요?", { delay: 55 });
      await r.click("보내기", { selector: "button", exact: true });
      await ff(r, () => r.waitFor(answered(1), 120000), 3);
      await pause(800);
      w = await beat(r, "o03", "근거 번호를 단 답 — 플랫폼 매뉴얼 + AX-DataLake 문서", "레이크의 장애 보고서·회의록까지 함께 찾습니다");
      await w();
      await r.eval("document.querySelector('.sources')?.scrollIntoView({ block: 'center' })").catch(() => undefined);
      w = await beat(r, "o04", "근거 — 레이크 '운영 보고서·회의록'의 장애 보고서, 원인 분석 슬라이드", "개인정보는 레이크에 넣을 때 가림 · 창구는 레이크 분석가 권한으로만 읽음");
      await w(-2);
      await r.click("해결됐어요", { selector: "button", exact: true, after: 2000 });

      await r.type("예: 사원 조회에", "사원 조회 화면에 퇴사한 사람이 같이 나와요", { delay: 55 });
      await r.click("보내기", { selector: "button", exact: true });
      await ff(r, () => r.waitFor(answered(2), 120000), 3);
      await pause(800);
      w = await beat(r, "o05", "운영 매뉴얼 근거 — 조회 조건을 '재직'으로", "'그래도 보이면 서비스 요청으로' — 매뉴얼의 안내 그대로");
      await w();

      await r.clickSel("[data-test=desk-escalate-open]", 1200);
      w = await beat(r, "o06", "담당자에게 넘기기 — 대화 기록과 함께 PMS-X 서비스 요청으로");
      await r.type("담당자에게 덧붙일 내용", "재직 구분을 '재직'으로 바꿔도 퇴사자가 계속 나옵니다. 사원관리 화면, 사원명 '김' 으로 조회.", { delay: 30 });
      await r.clickSel("[data-test=desk-escalate]", 500);
      await r.waitFor("/SR-\\d{4}/.test(document.body.innerText)", 40000);
      srNo = await r.eval("(document.body.innerText.match(/SR-\\d{4}/) || [null])[0]");
      await r.caption(`접수 — ${srNo}`, "Teams 는 \"접수\" 한마디 · 접수처는 창구마다(PMS-X · 고객 ITSM · 웹훅)");
      await w();
      if (!srNo) throw new Error("접수 번호를 읽지 못했습니다");

      // ── 업무 자동화 — 감시 트리거 → 분류·처리안 → 사람 확인
      await r.caption("");
      await r.login("platform", "admin");
      await r.go(`${L}/flows`);
      await pause(1500);
      await clickNear(r, "서비스 요청 분류·처리", "열기", { after: 2500 });
      w = await beat(r, "o07", "업무 자동화 '서비스 요청 분류·처리'", "감시 트리거가 PMS-X 의 새 서비스 요청을 찾아 흐름을 깨웁니다");
      await w(-3);
      await clickNear(r, "새 서비스 요청 감시", "지금 실행", { after: 1500 });
      await ff(r, () => r.waitFor("!!document.querySelector('[data-test=flow-run-result]') && /사람 확인 대기|승인함에서 결정/.test(document.querySelector('[data-test=flow-run-result]').innerText)", 300000), 4, `지금 실행 — ${srNo} 를 흐름에`);
      await pause(800);
      w = await beat(r, "o08", "분류 → 처리안 → 담당자 확인에서 멈춤", "아래 실행 디버거 — 단계마다 시간·토큰");
      await pause(7000);
      await r.scroll(500, ".n-layout-scroll-container, .n-scrollbar-container");
      await w();

      await r.caption("");
      await r.go(`${L}/approvals`);
      await pause(1500);
      w = await beat(r, "o09", "승인함 — SM 운영 책임자가 처리안을 보고 결정", "실행한 사람은 스스로 승인할 수 없습니다 · 누가 언제 승인했는지 기록");
      if ((await clickNear(r, "업무 자동화 — 사람 확인", "검토", { after: 1500 })) || (await clickNear(r, "flows__confirm", "검토", { after: 1500 }))) {
        await pause(3500);
        await r.type("결정 사유", "처리안대로 진행 — 개발 담당 배정", { delay: 45 });
        await modalBtn(r, "승인", 1500);
      }
      await w();

      // ── PMS-X
      await r.caption("");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      w = await beat(r, "o10", `PMS-X 서비스 요청 ${srNo}`, "요청자 · 대화 기록 · 처리 기한(접수 순간부터)");
      await w();
      await r.clickSel("[data-test=sr-triage-run]", 800);
      await ff(r, () => r.waitFor("!!document.querySelector('[data-test=sr-triage-result]')", 90000), 3, "분류 의견 — 사내 모델");
      w = await beat(r, "o11", "분류 의견 — 유형 · 우선순위 · 대상 화면 · 담당 후보", "사내 모델이 제안, 확정은 사람이");
      await pause(4500);
      await classifyAssign(r, PREP.pmsxOpName ?? "");
      await transition(r, "처리 시작");
      await w();

      await r.clickSel("button[aria-label='수정']", 1200);
      await r.clickSel("[data-test=sr-form-pick]", 1500);
      w = await beat(r, "o12", "대상 화면 — As-Is 메뉴 트리의 '사원관리'");
      await r.click("사원관리", { exact: true, after: 1500 });
      // 대상 화면 선택 창 [적용](PMS-X 1.3.17~) → 서비스 요청 수정 창 [저장]
      await r.click("적용", { selector: ".v-overlay--active button", exact: true, after: 1200 });
      await r.click("저장", { selector: ".v-overlay--active button", exact: true, after: 1500 });
      if (!(await r.waitFor("!!document.querySelector('[data-test=sr-open-viewer]')", 8000))) console.log("  ! 대상 화면이 저장되지 않았습니다(화면 뷰어 단추 없음)");
      await w();

      await r.eval("[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '구현 명세')?.scrollIntoView({ block: 'center' })");
      await pause(600);
      await r.click("구현 명세", { selector: "button", after: 2000 });
      w = await beat(r, "o13", "구현 명세 — Markdown·JSON 으로 내보내 개발자·AX-NAVI 에", "As-Is 화면 뷰어 — 화면 위에서 버튼 → 함수 → SQL → 테이블");
      await pause(6500);
      await r.press("Escape");
      await pause(600);
      await r.eval("document.querySelector('[data-test=sr-open-viewer]')?.scrollIntoView({ block: 'center' })");
      await r.click("화면 뷰어에서 보기", { selector: "a, button", after: 2500 });
      await w();

      // ── AX-NAVI IDE — 이개발
      const original = readFileSync(DEMO_FILE);
      // IDE 를 띄우고 로그인하는 동안은 화면이 멈춰 있다 — 빨리 감기로 1초만 남긴다(11-14 판 4:40~5:02 정지)
      const tPre = now();
      try {
        await r.browser(
          async (b) => {
            const tb = now();
            if (tb - tPre > 2) ffs.push([tPre, tb, 1]);
            const n0 = b.frames.length;
            await b.clickAt({ x: 1290, y: 400 });
            w = await beat(b, "o14", "AX-NAVI IDE — 서비스 요청 번호만 주고 맡깁니다", "로그인만으로 플랫폼 MCP 허브 연결 — PMS-X 요청과 코드 색인을 IDE 안에서");
            await b.webType("textarea", `PMS-X 서비스 요청 ${srNo} 를 처리해줘. hnix-ax 허브의 pmsx__srs 로 '퇴사' 를 찾고 pmsx__sr 로 요청 본문을 읽어 확인하고, 코드 색인으로 HR_EMP 를 이름으로 조회하는 SQL 을 찾아 재직자만(RETIRE_YN = 'N') 나오게 고쳐줘. 다른 메서드는 건드리지 말고, 빌드·검증 명령은 돌리지 마(리뷰는 따로 한다).`);
            await w(-2);
            await b.press("Enter");
            w = await beat(b, "o15", "조회 도구는 묻지 않고 바로 · 파일 수정만 개발자가 확인", "허브가 개발자 권한·회사 정책을 적용하고 모든 호출을 기록");
            await w();
            await ff(b, () => runAgent(b, {
              1: ["파일 수정 — 개발자가 바뀌는 줄을 보고 승인", "이름 조회 SQL 에 재직 조건"],
              2: ["수정안을 확인하고 저장"],
            }, 300), 8, "에이전트 작업 중");
            w = await beat(b, "o16", "수정 완료 — 이름 조회 SQL 에 재직 조건", "변경 리뷰 · 품질 게이트를 지나 배포");
            await w();
            // 첫 프레임을 이 장면 시작 시각으로 — 그 뒤는 프레임 사이 간격 그대로
            const fr = b.frames.slice(n0);
            if (fr.length) {
              const off = tb - fr[0].t;
              for (const x of fr) x.t += off;
              console.log(`  IDE 프레임 시각 보정 ${off.toFixed(1)}초 · ${fr.length}장`);
            }
          },
          { ide: DEMO_REPO, ideEnv: { AXNAVI_SELFTEST: "login" } },
          async (b) => {
            await ideQuickLogin(b);
            for (let t = 0; t < 30 && !(await b.webFind("", { selector: "textarea", timeout: 1000 })); t++) await pause(1000);
            await pause(3000);
            await b.overlay();
          },
        );
      } finally {
        writeFileSync(DEMO_FILE, original);
      }

      // ── 처리 완료 → 지식 문서
      await r.caption("");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      w = await beat(r, "o17", "처리 내용을 남기고 '처리 완료'", "처리 기한 준수율 · 월간 운영 보고에 그대로");
      await r.type("css:[data-test=sr-comment] textarea", "사원 이름 조회 SQL 에 재직 조건을 넣었습니다. AX-NAVI 리뷰 통과 후 오늘 배포했습니다.", { delay: 18 });
      await r.clickSel("[data-test=sr-comment-post]", 1200);
      await transition(r, "처리 완료", { comment: "재직 조건을 넣은 수정 배포 완료 — 요청자 확인 요청" });
      await w();

      await r.eval("document.querySelector('[data-test=sr-kb-draft-open]')?.scrollIntoView({ block: 'center' })");
      await pause(800);
      if (await r.clickSel("[data-test=sr-kb-draft-open]", 1000)) {
        await ff(r, () => r.waitFor("!!document.querySelector('[data-test=sr-kb-draft-save]') && !document.querySelector('[data-test=sr-kb-draft-save]').disabled", 150000), 3, "지식 문서 초안 — 사내 모델");
        w = await beat(r, "o18", "지식 문서 초안 — 증상 · 원인 · 조치", "사람이 확인하고 등록 · 다음 문의의 근거");
        await pause(8000);
        await r.clickSel("[data-test=sr-kb-draft-save]", 2000);
        await r.go(`${P}/sm/kb`);
        await w();
      }

      await r.caption("");
      await r.go(card("ops-end"));
      w = await beat(r, "o19");
      await w(1);
      await finish(r, "ops");
    },
  },

  /* ================= ② 데이터·통제 ================= */
  gov: {
    title: "데이터 · 통제 · 도입 구성",
    maxGap: 600,
    async run(r) {
      marks = [];
      ffs = [];
      await r.go(card("gov-intro"));
      let w = await beat(r, "g01");
      await w();

      // ── 레이크 — 분석가
      await r.login("datalake", "ana");
      await r.go(`${D}/dashboards`, DL_READY);
      await pause(1500);
      await r.click("장애 현황", { selector: ".card", after: 1500 });
      await r.waitFor("document.querySelectorAll('.tile canvas, .tile svg').length >= 2", 30000);
      w = await beat(r, "g02", "AX-DataLake 대시보드 '장애 현황' — 분석가", "전체 900건 중 자기 계열사 300건만 · 열 때마다 보는 사람 권한으로 다시 조회");
      await pause(8000);
      await down(r, 600);
      await w();
      await top(r);
      await r.type("이 대시보드에 물어보기", "시스템별 장애 건수", { delay: 60 });
      await r.click("묻기", { selector: "button", exact: true });
      await ff(r, () => r.waitFor("document.body.innerText.includes('검증된 질의') || document.body.innerText.includes('확인된 질문') || document.body.innerText.includes('AI 초안')", 90000), 2);
      w = await beat(r, "g03", "AI 분석 — 확인된 질문은 모델 없이 같은 답", "새 질문은 지표 정의를 근거로 사내 모델이 SQL·차트");
      await w();

      // ── 레이크 문서 — 엔지니어
      await r.login("datalake", "eng");
      await r.go(`${D}/documents`, DL_READY);
      await pause(1500);
      await r.clickSel("button[aria-label='운영 보고서·회의록 더 보기']", 800);
      await r.click("파일 목록", { selector: ".n-dropdown-option", exact: true, after: 2000 });
      w = await beat(r, "g04", "레이크 문서 '운영 보고서·회의록' — PPT · 회의록 · 엑셀 · 스캔", "조각 · 표 · 글자 인식 · 넣을 때 가린 개인정보");
      await w();
      await closeModal(r);

      // ── 플랫폼 문서 검색 — 이개발
      await r.login("platform", "dev");
      await r.go(`${L}/docs`);
      await pause(1500);
      await r.type("질문이나 낱말로 찾기", "급여 계산 배치가 늦어진 원인", { delay: 55 });
      await warm();
      await r.click("검색", { selector: "button", exact: true, after: 500 });
      await ff(r, () => r.waitFor("document.body.innerText.includes('레이크 · ')", 60000), 2);
      await pause(800);
      w = await beat(r, "g05", "플랫폼 문서 검색 — 플랫폼 문서와 레이크 문서를 한 번에", "'레이크 · 운영 보고서·회의록' · 권한 없는 '경영 검토(제한)'는 나오지 않음");
      await pause(7000);
      await down(r, 400);
      await w();

      // ── 게이트웨이 — 관리자
      await r.login("platform", "admin");
      await r.go(`${L}/gateway?tab=requests`);
      await pause(3000);
      w = await beat(r, "g06", "LLM 게이트웨이 요청 기록 — 누가 · 어느 기능 · 어느 모델 · 토큰 · 시간", "기밀 등급 데이터는 사내 모델로만");
      await w();

      // ── 현장 연결 점검 — 기능 모듈
      await r.go(`${L}/admin/readiness`);
      await pause(2000);
      await r.eval("[...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === '기능 모듈')?.scrollIntoView({ block: 'start' })").catch(() => undefined);
      w = await beat(r, "g07", "기반 + 선택 모듈 여덟 개 — 설정으로 켜고 끔", "끈 모듈은 메뉴·API·도구·예약 작업에서 빠지고 자료는 남음 · AX-DataLake 문서 연결 상태");
      await pause(9000);
      await r.eval("[...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'AX-DataLake 문서')?.scrollIntoView({ block: 'center' })").catch(() => undefined);
      await w();

      // ── 사내 AD·SSO — 선택(녹화용 레이크에 AD·SSO 를 켠 모습)
      await r.go(`${D}/`);
      await r.eval("fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(() => localStorage.clear())").catch(() => undefined);
      await r.go(`${D}/login`);
      await pause(1500);
      w = await beat(r, "g08", "계정 — 자체 계정이 기본, 사내 AD·SSO 는 설정으로 켭니다", "이 레이크는 AD·SSO 를 켠 모습 — 'SSO 버튼' · 같은 칸으로 AD 비밀번호");
      await pause(6000);
      await r.login("datalake", "admin");
      await r.go(`${D}/admin/users`, DL_READY);
      await pause(4000);
      await r.click("사용자 만들기", { selector: "button", after: 1500 });
      await r.eval("document.querySelectorAll('.n-modal input').forEach((i) => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })").catch(() => undefined);
      await pick(r, "레이크 계정(비밀번호를 여기서 정함)", "사내 계정(AD·SSO 로 로그인)");
      await pause(1500);
      await w(-1);
      await closeModal(r);

      await r.go(card("gov-end"));
      w = await beat(r, "g09");
      await w(1);
      await finish(r, "gov");
    },
  },

  /* ================= ④ As-Is 분석 (PMS-X 1.3.18) ================= */
  asis: {
    title: "레거시 화면 하나를 분석서로 — PMS-X As-Is 분석",
    maxGap: 600,
    async run(r) {
      marks = [];
      ffs = [];
      await r.go(card("asis-intro"));
      let w = await beat(r, "a01");
      await w();

      await r.login("pmsx", "admin");
      await pmsxProject(r, "SI");
      // 급여시스템(PY) · 급여계산(PY0101) · 급여관리 묶음 · SP_PAY_CALC — 시연 데이터를 새로 만들면 ID 가 바뀌므로 이름으로 찾는다
      const ids = await r.eval(`(async () => {
        const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(APPS.pmsx.users.admin)}) }).then((x) => x.json()).then((j) => j.accessToken);
        const h = { authorization: 'Bearer ' + t };
        const p = (await fetch('/api/v1/projects', { headers: h }).then((x) => x.json())).find((x) => x.type === 'SI');
        const ss = await fetch('/api/v1/projects/' + p.projectId + '/systems', { headers: h }).then((x) => x.json());
        const sys = ((ss.content ?? ss).find((s) => s.code === 'PY') ?? {}).systemId;
        const tree = await fetch('/api/v1/systems/' + sys + '/menu-tree', { headers: h }).then((x) => x.json());
        let scr = null, menu = null;
        const walk = (ns) => { for (const n of ns ?? []) { if (n.screen?.screenCode === 'PY0101') scr = n.screen.screenId; if (n.name === '급여관리') menu = n.menuId; walk(n.children); } };
        walk(tree);
        return { sys, scr, menu };
      })()`);
      if (!ids?.sys || !ids?.scr) throw new Error("급여시스템·급여계산 화면을 찾지 못했습니다");
      console.log("  ids", JSON.stringify(ids));

      // ── 화면 분석 뷰어 + 메뉴 묶음
      await r.go(`${P}/asis/viewer/${ids.sys}/${ids.scr}`);
      await pause(2500);
      w = await beat(r, "a02", "As-Is 메뉴 — 준비 · 화면으로 보기 · 데이터로 보기 · 업무로 보기 · 진척·산출", "화면 분석 뷰어 — 급여시스템 › 급여관리 › 급여계산");
      await pause(5500);
      await r.pointAt({ x: 130, y: 420 });
      await w();

      // ── PL/SQL 탭
      await r.eval("document.querySelector('[data-test=tab-plsql]')?.scrollIntoView({ block: 'nearest', inline: 'center' })").catch(() => undefined);
      await r.clickSel("[data-test=tab-plsql]", 1800);
      await r.eval("document.querySelector('[data-test=screen-plsql]')?.scrollIntoView({ block: 'center' })").catch(() => undefined);
      w = await beat(r, "a03", "PL/SQL — 이 화면이 부르는 프로시저·함수", "급여 계산 SP_PAY_CALC → 세금 계산 SP_PAY_TAX · 루틴마다 직접 읽고 쓰는 테이블");
      await w();

      // ── 로직 분석
      await r.clickSel("[data-test=plsql-name]", 2500);
      await r.waitFor("!!document.querySelector('[data-test=routine-logic]')", 15000);
      w = await beat(r, "a04", "PL/SQL 분석 › SP_PAY_CALC — 로직 분석 개요", "파라미터 · 저장하는 테이블 · 부르는 루틴 · 쓰는 화면 · 복잡도(분기 수·중첩 깊이)");
      await pause(5000);
      await r.wheel(420, { x: 1050, y: 600 });
      await w();
      await r.clickSel("[data-test=rl-tab-logic]", 1500);
      await r.clickSel("[data-test=rl-view-flow]", 1500);
      w = await beat(r, "a05", "로직 — 조건 · 반복 · 예외 처리를 순서도로", "AI 없이 소스 구조만으로 · 줄 번호를 누르면 원본 소스로");
      await pause(5500);
      await r.wheel(360, { x: 1050, y: 600 });
      await pause(3000);
      await r.clickSel("[data-test=rl-view-pseudo]", 1500);
      await r.caption("같은 내용을 의사코드로 · 한국어 설명으로", "");
      await pause(3500);
      await r.clickSel("[data-test=rl-view-explain]", 1500);
      await w();
      await r.clickSel("[data-test=rl-tab-review]", 1500);
      w = await beat(r, "a06", "점검 — 업무 규칙 후보와 확인 필요", "조건 → 오류·저장·종료 · 반복 안 저장 · 정의를 찾지 못한 호출 — 업무 규칙인지는 현업이 확인");
      await pause(6000);
      await r.wheel(380, { x: 1050, y: 600 });
      await w();

      // ── As-Is 분석서
      await r.go(`${P}/asis/viewer/${ids.sys}/${ids.scr}`);
      await pause(2000);
      await r.click("분석서로 보기", { selector: "a, button", after: 2500 });
      await r.waitFor("!!document.querySelector('[data-test=report-doc]')", 15000);
      w = await beat(r, "a07", "As-Is 분석서 — 화면 문서 7절", "문단마다 출처: 소스 확인 · 분석 추림 · 분석자 · 수집 안 함");
      await pause(6000);
      await r.eval("document.querySelector('[data-test=report-legend]')?.scrollIntoView({ block: 'center' })").catch(() => undefined);
      await w();
      await r.eval("document.querySelector('[data-test=report-sec-flow]')?.scrollIntoView({ block: 'start' })").catch(() => undefined);
      w = await beat(r, "a08", "업무 흐름상 위치 — 여는 팝업 · 앞선 화면 · 이어지는 화면", "수행 절차 — 버튼 순서대로 확인 메시지와 저장 테이블");
      await pause(7000);
      await r.eval("document.querySelector('[data-test=report-sec-procedure]')?.scrollIntoView({ block: 'start' })").catch(() => undefined);
      await w();
      await r.eval("document.querySelector('[data-test=report-sec-questions]')?.scrollIntoView({ block: 'start' })").catch(() => undefined);
      w = await beat(r, "a09", "현업 확인 항목 — 현업에 물을 것 / 분석이 더 읽을 것", "실행 로그가 없으면 '알 수 없음'이라고 적습니다");
      await w();

      // ── AI 서술(개요 절)
      await r.eval("document.querySelector('[data-test=report-sec-overview]')?.scrollIntoView({ block: 'start' })").catch(() => undefined);
      await pause(800);
      const canDraft = await r.eval("!!document.querySelector('[data-test=report-sec-overview] [data-test=narrative-draft]')").catch(() => false);
      if (canDraft) {
        await r.clickSel("[data-test=report-sec-overview] [data-test=narrative-draft]", 500);
        await ff(r, () => r.waitFor("!!document.querySelector('[data-test=report-sec-overview] [data-test=narrative-text]') || /서술을 처리하지 못했습니다|근거/.test(document.querySelector('.v-snackbar')?.innerText ?? '')", 240000), 3, "AI 서술 만들기 — 사내 모델");
        await pause(800);
        await r.eval("document.querySelector('[data-test=report-sec-overview] [data-test=narrative-facts-toggle]')?.click()").catch(() => undefined);
      }
      await r.eval("document.querySelector('[data-test=report-sec-overview]')?.scrollIntoView({ block: 'start' })").catch(() => undefined);
      const drafted = await r.eval("!!document.querySelector('[data-test=report-sec-overview] [data-test=narrative-text]')").catch(() => false);
      w = await beat(r, "a10", "AI 서술 — 이 절의 사실 목록만 넘기고, 문장마다 근거 사실 번호",
        drafted ? "근거 없는 문장 · 사실을 그대로 옮긴 문장은 버림 · 확정 전에는 'AI · 검수 전'" : "작은 시연 모델 — 근거를 단 문장이 남지 않아 붙이지 않음 · 더 큰 모델을 정하거나 분석자가 직접");
      await pause(drafted ? 9000 : 11000);
      if (!drafted && (await r.clickSel("[data-test=report-sec-overview] [data-test=narrative-write]", 1200))) {
        await r.type("css:[data-test=report-sec-overview] [data-test=narrative-edit] textarea", "급여 대상자를 조회해 급여를 계산하고, 결과를 급여계산과 급여항목에 저장한 뒤 마감하는 화면입니다.", { delay: 35 });
        await pause(600);
        await r.clickSel("[data-test=report-sec-overview] [data-test=narrative-save]", 2000);
        await r.caption("분석자가 직접 쓴 서술 — '분석자' 출처로 표시, 확정은 분석자가", "");
      }
      await w();

      // ── 묶음 문서
      if (ids.menu) {
        await r.eval(`document.querySelector('[data-test=report-node-${ids.menu}]')?.scrollIntoView({ block: 'center' })`).catch(() => undefined);
        await r.clickSel(`[data-test=report-node-${ids.menu}]`, 2500);
      }
      w = await beat(r, "a11", "묶음 문서 — 급여관리", "아래 화면들의 구성 · 함께 쓰는 테이블 · 화면 사이 연결");
      await pause(6000);
      await r.wheel(420, { x: 1000, y: 600 });
      await w();

      // ── Word
      await r.go(`${P}/asis/report?systemId=${ids.sys}&screenId=${ids.scr}`);
      await r.waitFor("!!document.querySelector('[data-test=report-doc]')", 15000);
      await pause(1500);
      await r.clickSel("[data-test=report-docx]", 3000);
      await r.go(pathToFileURL(`${V}/word-view.html`).href);
      await pause(800);
      w = await beat(r, "a12", "Word 로 받기 — 같은 절과 표 · 출처 표시 · 쪽 번호", "산출물 화면에서 여러 화면을 묶으면 표지 · 차례를 붙여 한 파일로");
      await w(1);

      await r.go(card("asis-end"));
      w = await beat(r, "a13");
      await w(1);
      await finish(r, "asis");
    },
  },
};
