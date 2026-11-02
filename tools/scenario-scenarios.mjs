/*
 * SM 업무 흐름 시나리오 영상 — 여러 제품을 오가며 한 건을 끝까지 처리한다.
 *   시나리오 A  고객 ITSM 으로 들어온 티켓 → 서비스 요청 → 분류 → 원인 찾기 → 처리 → 고객 반영 → 지식 문서
 *   시나리오 B  메신저·웹 창구(현업 창구가 1차 응대 → 담당자 접수 → 매뉴얼 보강)와 전화(담당자가 대신 등록)
 *
 *   node tools/scenario-prep.mjs
 *   node tools/record-demo.mjs --scenarios scenario-scenarios.mjs --scenario sm-a --out video/scenarios
 *
 * 흐름의 설명은 demo/scenarios.md(소개 사이트)와 같다.
 */
import { existsSync, readFileSync } from "node:fs";
import { APPS } from "./demo-scenarios.mjs";
import { clickNear, closeModal, ensureChecked, modalBtn, pmsxProject, vtype } from "./feature-scenarios.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const L = APPS.platform.url;
const P = APPS.pmsx.url;
const prep = () => (existsSync(new URL("./.scenario-prep.json", import.meta.url)) ? JSON.parse(readFileSync(new URL("./.scenario-prep.json", import.meta.url), "utf8")) : {});

/** Naive 탭 — 글자 일부로(건수가 붙는 탭) */
async function tabPart(r, label, wait = 2500) {
  await r.click(label, { selector: ".n-tabs-tab", after: wait });
}

/** PMS-X 서비스 요청 하나를 연다 — 번호로 찾아 줄을 누른다 */
async function openSr(r, no) {
  await r.go(`${P}/sm/srs`);
  await pause(1500);
  await vtype(r, "조회", no, 60);
  await r.press("Enter");
  await pause(1500);
  await r.click(no, { selector: "td", after: 1800 });
}

/** PMS-X 서비스 요청 상태 바꾸기 — 버튼 → (담당자·사유) → 확인 */
async function transition(r, label, opts = {}) {
  const ok = await r.click(label, { selector: "[data-test=sr-transitions] button", exact: true, after: 900 });
  if (!ok) return false;
  if (opts.assignee) {
    const filled = await r.eval("(() => { const f = document.querySelector('[data-test=sr-transition-assignee] input'); return !!f && !!f.value; })()").catch(() => false);
    if (!filled) {
      // 사람 찾기 칸 — 이름을 쳐야 후보가 나온다
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

/** 이은 티켓 표에서 고객 티켓 번호 줄의 서비스 요청 번호 */
const srOf = (r, ticket) => r.eval(`(() => { const row = [...document.querySelectorAll('tr')].find((t) => t.innerText.includes(${JSON.stringify(ticket)})); return row ? (row.innerText.match(/SR-\\d+/) || [null])[0] : null; })()`);

export const SCENARIOS = {
  /* ================= 시나리오 A ================= */
  "sm-a": {
    title: "시나리오 A — 고객 ITSM 티켓: 접수 → 분류 → 원인 찾기 → 처리 → 고객 반영 → 지식 문서",
    maxGap: 3,
    async run(r) {
      const pp = prep();
      const ticket = pp.itsm?.ticket ?? "INC004106";

      // ── ① 고객 티켓 → ② 서비스 요청 접수
      await r.login("platform", "admin");
      await r.go(`${L}/itsm`);
      await r.caption("시나리오 A — 고객 ITSM 으로 들어온 티켓", "고객 ITSM 이 기록의 원본, 우리 일은 PMS-X 서비스 요청에서 — 사람은 옮겨 적지 않습니다");
      await pause(5000);
      await r.click("demo-itsm", { selector: "b", after: 1500 });
      await r.click("연결 시험", { selector: "button", exact: true, after: 2500 });
      await r.caption(`① 고객이 ITSM 에 티켓 등록 — ${ticket} "사원 조회에 퇴사자가 같이 나와요"`, "김현업(인사팀) · 우선순위 High · 여기서는 시험용 가상 고객 ITSM");
      await pause(5500);
      await r.click("지금 동기화", { selector: "button", exact: true, after: 4000 });
      await tabPart(r, "이은 티켓");
      const srNo = (await srOf(r, ticket)) ?? "SR-";
      console.log(`  고객 티켓 ${ticket} → ${srNo}`);
      await r.caption(`② 플랫폼 ITSM 연동이 PMS-X 서비스 요청으로 접수 — ${ticket} → ${srNo}`, "웹훅이면 바로, 아니면 주기(기본 5분) · 우선순위는 대응표대로 · 고객 티켓에는 요청 번호 댓글");
      await pause(6000);

      // ── ③ 서비스 요청 → ④ 분류 의견 → 확정·배정
      await r.caption(`③ PMS-X 서비스 요청 ${srNo} — 요청자·처리 기한이 자동으로`, "처리 기한 계산이 이 순간 시작됩니다");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      await pause(5000);
      await r.clickSel("[data-test=sr-triage-run]", 1000);
      await r.caption("④ 분류 의견 — 비슷한 과거 요청·지식 문서를 근거로 유형·우선순위·대상 화면·담당 후보", "사내 모델이 제안하고, 확정은 사람이 합니다");
      await r.waitFor("!!document.querySelector('[data-test=sr-triage-apply]')", 90000);
      await pause(5000);
      await r.clickSel("[data-test=sr-triage-apply]", 2000);
      await transition(r, "분류 완료");
      await transition(r, "담당 배정", { assignee: pp.pmsxOpName ?? "" });
      await transition(r, "처리 시작");
      await r.caption("분류 완료 → 담당 배정 → 처리 시작", "담당자는 플랫폼 종 알림과 Teams 로 받습니다");
      await pause(4000);

      // ── 대상 화면 잇기 — AI 가 근거 부족으로 비워 둔 칸은 사람이
      await r.clickSel("button[aria-label='수정']", 1500);
      await r.clickSel("[data-test=sr-form-pick]", 2000);
      await r.caption("대상 화면 — 착수 때 만든 As-Is 메뉴 트리의 '사원관리' 화면과 잇습니다", "AI 가 추천한 화면을 사람이 확인하고, 비어 있으면 여기서 고릅니다");
      await r.click("사원관리", { exact: true, after: 2500 });
      await pause(2000);
      await r.click("적용", { selector: ".v-overlay--active button", exact: true, after: 1200 });
      await r.click("저장", { selector: ".v-overlay--active button", exact: true, after: 2500 });

      // ── ⑤ 원인 찾기 — 구현 명세 · As-Is 뷰어
      await r.eval("[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '구현 명세')?.scrollIntoView({ block: 'center' })");
      await pause(800);
      await r.click("구현 명세", { selector: "button", after: 2500 });
      await r.caption("⑤ 원인 찾기 — 구현 명세", "대상 화면의 버튼 흐름 · 영향 테이블·컬럼 · 소스 위치 · 테스트 — 개발자와 AX-NAVI 에 넘기는 작업 지시서");
      await pause(6000);
      await r.press("Escape");
      await pause(800);
      await r.eval("document.querySelector('[data-test=sr-open-viewer]')?.scrollIntoView({ block: 'center' })");
      await pause(600);
      if (await r.click("화면 뷰어에서 보기", { selector: "a, button", after: 3500 })) {
        await r.caption("As-Is 화면 뷰어 — 실제 화면 위에서 버튼 → 함수 → SQL → 테이블", "착수 때 수집기로 올린 분석 자산");
        await pause(6500);
      }

      // ── ⑥ 코드 — AX-NAVI 색인(허브 도구)
      await r.caption("⑥ 고칠 곳 찾기 — AX-NAVI 코드 색인", "플랫폼 MCP 허브의 도구로 이 테이블을 쓰는 SQL 과 호출 지점을 찾습니다");
      await r.login("platform", "dev");
      await r.go(`${L}/hub?tab=connect`);
      await pause(1500);
      await clickNear(r, "테이블 사용처(영향도)", "시험");
      await r.type("css:.n-modal textarea", '{\n  "repo": "hr-demo",\n  "table": "HR_EMP"\n}', { clear: true, delay: 12 });
      await modalBtn(r, "실행", 2500);
      await r.waitFor("!!document.querySelector('.n-modal pre, .n-modal .n-code, .n-modal code')", 30000);
      await r.caption("⑥ 고칠 곳 찾기 — AX-NAVI 코드 색인: HR_EMP 를 읽는 SQL 과 호출 지점", "EmpDao.searchByName — 이름 조회 SQL 에 재직 조건이 없습니다 · IDE 채팅과 에이전트도 같은 도구를 씁니다");
      await pause(7000);
      await closeModal(r);

      // ── ⑦ 처리 완료
      await r.caption("⑦ 고친 뒤 — 처리 내용을 남기고 '처리 완료'", "수정은 AX-NAVI IDE 에서 · 리뷰·품질 게이트를 지나 배포");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      await r.type("css:[data-test=sr-comment] textarea", "EmpDao.searchByName 에 재직 조건(RETIRE_YN = 'N')을 넣었습니다. AX-NAVI 리뷰 통과 후 오늘 배포했습니다.", { delay: 18 });
      await r.clickSel("[data-test=sr-comment-post]", 1500);
      await transition(r, "처리 완료");
      await pause(5000);

      // ── ⑧ 고객 ITSM 에 반영
      await r.caption("⑧ 고객 ITSM 에 반영 — 다음 동기화 때 자동으로");
      await r.login("platform", "admin");
      await r.go(`${L}/itsm`);
      await r.click("demo-itsm", { selector: "b", after: 1500 });
      await r.click("지금 동기화", { selector: "button", exact: true, after: 4000 });
      await tabPart(r, "이은 티켓");
      await r.caption(`⑧ 고객 ITSM 에 자동 반영 — ${ticket} 상태 Resolved, 처리 내용은 댓글로`, "고객이 ITSM 에서 닫으면 서비스 요청은 '고객 확인'으로 넘어갑니다");
      await pause(5500);
      await tabPart(r, "동기화 기록");
      await r.caption("동기화 기록 — 들어온 것(← 고객)과 나간 것(→ 고객)이 모두 남습니다");
      await pause(4500);

      // ── ⑨ 자산화 — 지식 문서
      await r.caption("⑨ 자산화 — 끝난 요청으로 지식 문서 초안(증상·원인·조치)", "요청 본문과 처리 내역을 사내 모델이 요약 · 사람이 확인하고 등록");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      if (await r.click("AI 지식 문서 초안", { selector: "button", after: 1500 })) {
        await r.caption("⑨ 자산화 — 끝난 요청으로 지식 문서 초안(증상·원인·조치)", "요청 본문과 처리 내역을 사내 모델이 요약 · 사람이 확인하고 등록");
        await r.waitFor("[...document.querySelectorAll('.v-overlay--active button')].some((b) => b.innerText.includes('지식 문서 등록') && !b.disabled)", 120000);
        await pause(6000);
        await r.click("지식 문서 등록", { selector: ".v-overlay--active button", after: 2500 });
      }
      await r.go(`${P}/sm/kb`);
      await r.caption("다음에 같은 질문이 오면 — 현업 창구·분류 의견·경보 진단이 이 지식 문서를 근거로 답합니다", "한 건을 닫을 때마다 다음 답의 근거가 쌓입니다");
      await pause(6500);
    },
  },

  /* ================= 시나리오 B ================= */
  "sm-b": {
    title: "시나리오 B — 메신저·웹 창구(현업 창구 1차 응대 → 접수 → 매뉴얼 보강)와 전화(담당자가 대신 등록)",
    maxGap: 3,
    async run(r) {
      const pp = prep();

      // ── B-1 ① 현업 창구가 답한다
      await r.login("platform", "dev");
      await r.go(`${L}/desk/hr-help`);
      await r.caption("시나리오 B-1 — 메신저·메일·웹 창구로 들어온 질문", "현업 창구가 운영 매뉴얼과 과거 처리 사례를 근거로 먼저 답합니다 · Teams·메일로도 같은 창구");
      await pause(5000);
      await r.caption("창구마다 고객사 색·로고, 첫 화면에 자주 묻는 질문");
      await pause(3000);
      await r.click("사원 조회에 퇴사자가 같이 나와요", { selector: ".chip", exact: true });
      await r.waitFor("document.body.innerText.includes('이 답으로 해결됐나요')", 120000);
      await pause(1500);
      await r.caption("① 근거 번호를 단 답 — 어느 매뉴얼의 어느 절인지 함께", "해결되면 '해결됐어요'(Teams 는 \"해결\" 한마디) — 자동 해결률로 셉니다");
      await pause(6000);
      await r.click("해결됐어요", { selector: "button", exact: true, after: 2000 });

      // ── ② 못 찾으면 담당자에게
      await r.type("예: 사원 조회에", "회의실 예약은 어떻게 하나요?", { delay: 55 });
      await r.click("보내기", { selector: "button", exact: true });
      await r.waitFor("document.body.innerText.includes('찾지 못했습니다')", 120000);
      await pause(1200);
      await r.caption("② 근거가 없으면 지어내지 않습니다 — 모른다고 하고 담당자에게 넘길지 묻습니다");
      await pause(4000);
      await r.click("담당자에게 넘기기", { selector: "button" });
      await r.type("담당자에게 덧붙일 내용", "회의실 예약 방법 안내 부탁드립니다", { delay: 40 });
      await r.click("대화 기록과 함께 접수", { selector: "button" });
      await r.waitFor("/SR-\\d{4}/.test(document.body.innerText)", 40000);
      await r.caption("PMS-X 서비스 요청으로 접수 — 대화 기록과 함께, 접수 번호가 바로 돌아옵니다", "Teams 는 \"접수\" 한마디 · 접수처는 창구마다(PMS-X · 고객 ITSM · 웹훅)");
      await pause(5000);

      // ── ③ 담당자 — 종 알림 → 매뉴얼 보강
      await r.caption("③ 담당자 — 머리의 종 알림에 '창구 질문이 담당자에게'", "Teams·Slack·메일 게이트웨이로도 보냅니다(관리 > 알림 보내기)");
      await r.login("platform", "admin");
      await r.go(`${L}/`);
      await pause(2500);
      await r.click("알림", { selector: ".hx-header button", after: 1500 });
      await pause(5000);
      await r.press("Escape");
      await r.go(`${L}/desks?supplement=1`);
      await r.click("/desk/hr-help", { selector: "code", after: 1500 });
      await r.caption("현업 창구 관리 — 창구가 답을 못 찾은 질문이 '매뉴얼 보강 대기'로 모입니다", "자동 해결률 · 답변률 · 담당자 접수율");
      await pause(5000);
      await r.click("매뉴얼 보강", { selector: "td button", exact: true, after: 1500 });
      await r.type("css:.n-modal textarea", "## 회의실 예약\n회의실 예약은 그룹웨어 > 자원 예약 > 회의실 화면에서 날짜와 시간을 고른 뒤 [예약]을 누릅니다. 예약 변경과 취소는 같은 화면의 [내 예약]에서 합니다. 문의는 총무팀(내선 2345)입니다.\n", { clear: true, delay: 14 });
      await r.typeLabel("문서 제목", "회의실 예약 안내", { clear: true, delay: 40 });
      await r.caption("매뉴얼 보강 — 답을 적으면 창구의 근거 문서로 들어갑니다");
      await pause(2500);
      await modalBtn(r, "매뉴얼에 넣고 다시 물어보기", 2000);
      await r.waitFor("document.body.innerText.includes('같은 질문을 다시 물었습니다') || document.body.innerText.includes('다시 묻기 실패')", 120000);
      await pause(1000);
      await r.caption("같은 질문을 다시 물어 확인 — 이제 창구가 방금 넣은 매뉴얼로 답합니다", "다음 사람은 담당자를 기다리지 않습니다");
      await pause(6500);
      await closeModal(r);

      // ── B-2 전화 — 채팅으로 답을 찾고, 서비스 요청으로 남긴다
      await r.caption("시나리오 B-2 — 전화로 온 문의", "SM 담당자가 받고, 통화 중에 워크스페이스 채팅으로 매뉴얼 근거의 답을 찾습니다");
      await r.login("platform", "dev");
      await r.go(`${L}/chat`);
      await pause(4500);
      await r.click("새 대화", { selector: "button", exact: true, after: 1200 });
      await ensureChecked(r, "운영 매뉴얼");
      await r.type("질문을 입력하세요", "비밀번호를 여러 번 틀려서 계정이 잠겼다고 전화가 왔어요. 어떻게 풀어 주나요?", { delay: 35 });
      await r.click("보내기", { selector: "button", exact: true });
      await r.waitFor("[...document.querySelectorAll('summary')].some((s) => s.innerText.includes('['))", 120000);
      await pause(1500);
      await r.caption("① 매뉴얼 근거로 바로 안내", "답 아래 근거 — 어느 문서의 어느 절인지");
      await pause(6000);

      await r.caption("② 바로 끝난 통화도 서비스 요청으로 — 접수 경로 '수기'", "기록이 없으면 처리 실적과 지식으로 남지 않습니다");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await r.go(`${P}/sm/srs`);
      await pause(1500);
      await r.clickSel("[data-test=sr-add]", 1500);
      await vtype(r, "제목", "계정 잠김 해제 문의(전화)", 45);
      await vtype(r, "요청 내용", "비밀번호 5회 오류로 계정이 잠겼다는 전화 문의. 매뉴얼 5절대로 본인 확인 후 잠금 해제를 안내함.", 20);
      await vtype(r, "요청자 이름", "박현업", 60);
      await vtype(r, "소속", "재무팀", 60);
      await vtype(r, "연락처", "내선 3456", 60);
      await pause(1500);
      await r.click("저장", { selector: ".v-overlay--active button", exact: true, after: 2500 });
      const no = await r.eval("(() => { const m = document.body.innerText.match(/SR-\\d{4}/g); return m ? m.sort().at(-1) : null; })()");
      if (no) await openSr(r, no);
      await transition(r, "분류 완료");
      await transition(r, "담당 배정", { assignee: pp.pmsxOpName ?? "" });
      await transition(r, "처리 시작");
      await transition(r, "처리 완료");
      await r.caption(`③ 바로 '처리 완료' — ${no ?? "요청"} 도 처리 기한·월간 운영보고에 들어갑니다`, "즉답이 안 되면 담당자에게 배정 → 시나리오 A 의 원인 찾기부터 같은 흐름");
      await pause(6000);
      await r.caption("같은 사람이 같은 문의로 자주 전화하면 — 현업 창구 주소나 고객 요청 창구로 안내해 B-1 로", "전화·메신저·ITSM 어느 길로 와도 PMS-X 서비스 요청 하나로 모입니다");
      await pause(6000);
    },
  },
};
