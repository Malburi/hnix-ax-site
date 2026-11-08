/*
 * 컨설팅 시연 영상 — 서버판 도입 → 초기 설정 → SM 유지보수 구성 → 업무 AX 전환(한 편).
 * 해설 음성은 presentations/sm-ax-video 에서 먼저 만들고(tts.mjs → durations.json), 녹화는 장면마다 해설 길이만큼 머문다.
 * 녹화가 끝나면 장면 시작 시각을 timeline.json 에 남긴다 → mix.mjs 가 음성을 그 시각에 얹는다.
 *
 *   node tools/record-demo.mjs --scenarios consult-scenarios.mjs --scenario sm-ax --out "<sm-ax-video 폴더>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { APPS } from "./demo-scenarios.mjs";
import { clickNear, closeModal, down, modalBtn, sideMenu, tab, top, vtype } from "./feature-scenarios.mjs";

/** 해설 음성·카드·결과를 두는 작업 폴더(durations.json·card.html 이 있는 곳) — 환경 변수 CONSULT_DIR */
const V = (process.env.CONSULT_DIR ?? "").replace(/\\/g, "/").replace(/\/$/, "");
if (!V) throw new Error("CONSULT_DIR 에 컨설팅 영상 작업 폴더(durations.json·card.html)를 지정하세요");
const DUR = JSON.parse(readFileSync(`${V}/durations.json`, "utf8"));
const L = APPS.platform.url;
const P = APPS.pmsx.url;
/** 시연용 SM 프로젝트(○○공사 인사시스템 운영) — 첫 SM 프로젝트가 아닐 수 있어 이름으로 고른다 */
const SM_NAME = "인사시스템 운영";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const card = (id) => `${pathToFileURL(`${V}/card.html`).href}?c=${id}`;

const marks = [];
/** 장면 시작 — 자막을 바꾸고 시각을 적는다. 돌려준 함수를 부르면 해설이 끝날 때까지 기다린다 */
async function beat(r, id, cap, sub = "") {
  await r.caption(cap ?? "", sub);
  const t = Date.now() / 1000;
  marks.push({ id, wall: t, frame: r.frames?.length ?? 0 });
  const end = t + (DUR[id] ?? 5) + 1.0;
  return async (extra = 0) => {
    const left = end + extra - Date.now() / 1000;
    if (left > 0) await pause(left * 1000);
  };
}
async function smProject(r, who) {
  return r.eval(`(async () => {
    const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(APPS.pmsx.users[who])}) }).then((x) => x.json()).then((j) => j.accessToken);
    const p = (await fetch('/api/v1/projects', { headers: { authorization: 'Bearer ' + t } }).then((x) => x.json())).find((x) => x.type === 'SM' && x.name.includes(${JSON.stringify(SM_NAME)}));
    if (!p) return null;
    localStorage.setItem('project', JSON.stringify({ currentProjectId: p.projectId }));
    const ss = await fetch('/api/v1/projects/' + p.projectId + '/systems', { headers: { authorization: 'Bearer ' + t } }).then((x) => x.json());
    return ((ss.content ?? ss).find((s) => s.code === 'HR') ?? {}).systemId ?? null;
  })()`);
}

export const SCENARIOS = {
  "sm-ax": {
    title: "HNIX AX 서버판 도입 · SM 유지보수 AX 전환",
    maxGap: 600,
    async run(r) {
      // ── 시작
      await r.go(card("intro"));
      let w = await beat(r, "s01");
      await w();

      // ── 1단계 설치
      await r.go(card("install"));
      w = await beat(r, "s02");
      await w();

      await r.login("platform", "admin");
      await r.go(`${L}/admin/readiness`);
      w = await beat(r, "s03", "현장 연결 점검 — 설치 뒤 확인할 것을 한 화면에", "DB · 접속 주소 · 로그인 · 백업 · 모델 연결 · 도구 서버");
      await w();
      w = await beat(r, "s04", "연결 시험 포함 점검 — 모델·도구 서버에 실제로 붙어 봅니다", "항목마다 상태와 할 일");
      await r.click("연결 시험 포함 점검", { selector: "button", after: 5000 });
      await down(r, 600);
      await w();

      // ── 2단계 초기 설정
      await r.go(card("setup"));
      w = await beat(r, "s05");
      await w();

      await r.go(`${L}/gateway`);
      w = await beat(r, "s06", "LLM 게이트웨이 — 사내 모든 AI 호출이 지나는 관문", "키 · 예산 · 데이터 등급 · 개인정보 가리기 · 요청 기록");
      await pause(6000);
      await down(r, 300);
      await w();
      await top(r);
      await r.click("모델 별칭", { selector: ".n-tabs-tab", exact: true, after: 1500 });
      w = await beat(r, "s07", "모델 별칭 — hnix-local · hnix-smart · hnix-code", "모델을 바꿔도 쓰는 쪽은 그대로");
      await w();

      await r.go(`${L}/axnavi-seats`);
      w = await beat(r, "s08", "AX-NAVI 사용 허가 — 허가된 사람의 승인된 기기만", "회수하면 그 사람의 기기가 모두 잠깁니다");
      await pause(6500);
      await r.click("기기 (", { selector: ".n-tabs-tab, [role=tab], div" });
      await w();

      // ── 3단계 SM 구성
      await r.go(card("sm"));
      w = await beat(r, "s09");
      await w();

      await r.login("pmsx", "admin");
      const HR = await smProject(r, "admin");
      await r.go(`${P}/sm/srs`);
      w = await beat(r, "s10", "PMS-X 운영(SM) 프로젝트", "서비스 요청 · 장애 · 변경 · 지식 문서 · 처리 기한");
      await w();

      await r.go(`${P}/asis/runs`);
      w = await beat(r, "s11", "수집 이력 — 수집기 받기 · 회차별 결과", "소스가 있는 PC 에서 더블클릭 → 소스 폴더 고르기 → 점검 → 수집 → 올리기");
      await pause(7000);
      await r.scroll(400, null);
      await w();

      await r.go(`${P}/asis/viewer`);
      w = await beat(r, "s12", "화면 분석 뷰어 — 화면 위 요소 번호 · 버튼 → 함수 → SQL → 테이블");
      await pause(6000);
      if (await r.click("통합 추적", { selector: "button", exact: true, after: 1500 })) await pause(2000);
      await w();

      await r.go(`${P}/asis/impact?systemId=${HR}`);
      w = await beat(r, "s13", "영향도 분석 — 사원 테이블(TB_EMP)을 바꾸면 어디가 영향받나");
      await r.type("이름으로 검색", "TB_EMP", { delay: 90 });
      await pause(1200);
      await r.click("tbl:HR.TB_EMP", { selector: ".v-list-item" });
      await r.waitFor("document.body.innerText.includes('영향 버튼')", 15000);
      await w();

      // ── 4단계 AX 전환
      await r.go(card("ax"));
      w = await beat(r, "s14");
      await w();

      await r.login("platform", "dev");
      await r.go(`${L}/desk/hr-help`);
      const answers = "(document.body.innerText.match(/(^|\\n)듣기(?=\\n|$)/g) || []).length";
      w = await beat(r, "s15", "현업 창구 — 운영 매뉴얼을 근거로 먼저 답합니다");
      let n0 = await r.eval(answers);
      await r.type("예: 사원 조회에", "사원 조회에 퇴사자가 같이 나와요", { delay: 55 });
      await r.click("보내기", { selector: "button" });
      await r.waitFor(`${answers} > ${n0}`, 120000);
      await w(1.5);

      w = await beat(r, "s16", "근거를 확인하지 못한 답은 그렇다고 표시 — 담당자에게 넘깁니다", "대화 기록과 함께 PMS-X 서비스 요청으로");
      n0 = await r.eval(answers);
      await r.type("예: 사원 조회에", "법인카드를 잃어버렸는데 분실 신고는 어떻게 하나요?", { delay: 50 });
      await r.click("보내기", { selector: "button" });
      await r.waitFor(`${answers} > ${n0}`, 120000);
      await pause(2500);
      const before = await r.eval("JSON.stringify(document.body.innerText.match(/SR-\\d{4}/g) || [])");
      await r.click("담당자에게 넘기기", { selector: "button", exact: true });
      await r.type("담당자에게 덧붙일 내용", "분실 신고 절차 안내 부탁드립니다", { delay: 40 });
      await r.click("대화 기록과 함께 접수", { selector: "button" });
      const fresh = `(document.body.innerText.match(/SR-\\d{4}/g) || []).filter((x) => !${before}.includes(x))`;
      await r.waitFor(`${fresh}.length > 0`, 40000);
      const sr = await r.eval(`${fresh}[0] || null`);
      await w(1.5);

      await r.login("pmsx", "op");
      await smProject(r, "op");
      await r.go(`${P}/sm/srs`);
      w = await beat(r, "s17", `서비스 요청 — 방금 접수된 ${sr ?? "요청"}`, "AI 분류 추천 → 유형 · 우선순위 · 담당 제안, 반영은 사람이");
      await pause(3000);
      if (sr) {
        await vtype(r, "조회", sr, 70);
        await r.press("Enter");
        await pause(1500);
        await r.click(sr, { selector: "td", after: 1500 });
      }
      await r.click("AI 분류 추천", { selector: "button" });
      await r.waitFor("[...document.querySelectorAll('button')].some((b) => /반영|적용/.test(b.innerText))", 90000);
      await w(3);
      await r.press("Escape");

      // 자동화 흐름 — 현업 담당자가 실행 → 담당자 확인에서 멈춤
      await r.go(`${L}/flows`);
      w = await beat(r, "s18", "자동화 흐름 — 새 요청 → 모델 분류 → 갈래 → 에이전트 조사 → 담당자 확인");
      await r.waitFor("document.body.innerText.includes('서비스 요청 분류·처리')", 20000);
      await pause(800);
      await clickNear(r, "서비스 요청 분류·처리", "열기", { after: 2500 });
      await r.clickSel("[data-test=flow-test-run]", 1500);
      await r.type("css:[data-test=flow-run-input-title] textarea", "사원 조회에 퇴사자가 같이 나와요", { delay: 40 });
      await r.type("css:[data-test=flow-run-input-body] textarea", "인사팀에서 사원 조회 화면을 열면 퇴사한 사람까지 함께 나온다고 문의했습니다.", { delay: 15 });
      await r.clickSel("[data-test=flow-run-start]", 1500);
      await r.waitFor("!!document.querySelector('[data-test=flow-run-result]') && /사람 확인 대기|승인함에서 결정/.test(document.querySelector('[data-test=flow-run-result]').innerText)", 150000);
      await r.caption("담당자 확인에서 멈춤 — 승인함으로", "지나간 노드가 캔버스에 표시됩니다");
      await w(2);

      await r.login("platform", "admin");
      await r.go(`${L}/approvals`);
      w = await beat(r, "s19", "승인함 — 사람이 결정할 일이 모입니다", "승인한 뒤에만 한 번 실행 · 누가 언제 무엇을 승인했는지 기록");
      await pause(2500);
      if (await clickNear(r, "flows__confirm", "검토", { after: 1500 })) {
        await pause(2500);
        await r.type("결정 사유", "안내 문구 그대로 회신해 주세요", { delay: 45 });
        await modalBtn(r, "승인", 2000);
      }
      await w();

      await r.login("pmsx", "admin");
      await smProject(r, "admin");
      await r.go(`${P}/sm/kb`);
      w = await beat(r, "s20", "지식 문서 — 끝난 요청에서 AI 가 초안", "증상 · 원인 · 조치 · 재발 방지 · 출처 요청");
      await pause(2000);
      await r.click("퇴사자도 함께", { selector: ".v-list-item, .v-card, li", after: 1500 });
      await w();

      await r.go(`${P}/sm/sla`);
      w = await beat(r, "s21", "처리 기한 준수율 · 임박 · 위반 — 자동 집계", "월간 운영 보고서도 같은 데이터로");
      await pause(6000);
      await r.go(`${P}/sm/reports`);
      await w();

      await r.go(`${L}/`);
      await sideMenu(r, "AI 사용 현황");
      w = await beat(r, "s22", "AI 사용 현황 — 누가 · 어느 업무에 · 얼마나", "AX 전환 성과의 근거");
      await pause(5000);
      await r.click("작업번호(요청·CR)", { selector: "button", exact: true, after: 1500 });
      await w();

      await r.go(card("outro"));
      w = await beat(r, "s23");
      await w(1);
      // 마지막 화면이 멈춰 있으면 프레임이 안 와 영상 끝이 잘린다 — 커서를 움직여 프레임을 받는다
      await r.pointAt({ x: 1380, y: 860 });
      await pause(600);

      // 영상 시각 = 인코딩(record-demo encode)과 같은 방식으로 앞 프레임들의 길이를 더한 값
      const ts = (r.frames ?? []).map((f) => f.t);
      const at = [0];
      for (let i = 0; i < ts.length - 1; i++) at.push(at[i] + Number(Math.max(0.034, Math.min(ts[i + 1] - ts[i], 600)).toFixed(3)));
      // 장면 시작 직전에 받은 프레임(k)의 영상 시각 + 그 뒤 흐른 시간(화면이 멈춰 있으면 프레임이 안 오므로)
      const video = (m) => {
        const k = Math.min(m.frame, ts.length) - 1;
        if (k < 0) return 0;
        const gap = k + 1 < ts.length ? ts[k + 1] - ts[k] : Infinity;
        return at[k] + Math.max(0, Math.min(m.wall - ts[k], gap));
      };
      writeFileSync(`${V}/timeline.json`, JSON.stringify({ marks: marks.map((m) => ({ ...m, video: Number(video(m).toFixed(2)) })) }, null, 1));
    },
  },
};
