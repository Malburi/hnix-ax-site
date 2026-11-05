/*
 * SM 업무 흐름 시나리오 영상 — 여러 제품을 오가며 한 건을 끝까지 처리한다.
 *   시나리오 A  고객 ITSM 티켓 → 서비스 요청 → 자동화 흐름(감시 트리거 → 분류·처리안 → 승인함) → 배정 → 원인 찾기 → AX-NAVI IDE 로 수정 → 처리 → 고객 반영 → 지식 문서
 *   시나리오 B  메신저·웹 창구(현업 창구가 1차 응대 → 담당자 접수 → 매뉴얼 보강)와 전화(담당자가 대신 등록)
 *
 *   node tools/scenario-prep.mjs
 *   node tools/record-demo.mjs --scenarios scenario-scenarios.mjs --scenario sm-a --out video/scenarios
 *
 * 흐름의 설명은 demo/scenarios.md(소개 사이트)와 같다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { APPS, DEMO_REPO, runAgent } from "./demo-scenarios.mjs";
import { clickNear, closeModal, ensureChecked, ideQuickLogin, modalBtn, pmsxProject, vtype } from "./feature-scenarios.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const L = APPS.platform.url;
const P = APPS.pmsx.url;
/** 시나리오 A 에서 AX-NAVI 가 고치는 연습 저장소 파일 — 녹화 뒤 되돌린다 */
const DEMO_FILE = `${DEMO_REPO}/src/main/java/com/hd/hr/EmpDao.java`;
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
    title: "시나리오 A — 고객 ITSM 티켓: 접수 → 자동화 흐름(분류·처리안·담당자 확인) → 배정 → AX-NAVI IDE 로 수정 → 처리 → 고객 반영 → 지식 문서",
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

      // ── ③ 자동화 흐름 — 감시 트리거가 새 서비스 요청을 잡아 '서비스 요청 분류·처리' 흐름을 깨운다
      await r.go(`${L}/flows`);
      await pause(1500);
      await clickNear(r, "서비스 요청 분류·처리", "열기", { after: 2500 });
      await r.caption("③ 자동화 흐름 '서비스 요청 분류·처리' — 새 요청마다 정해진 순서대로", "유형 분류(사내 모델) → 갈래 → 장애 담당 에이전트 / 지식 문서 검색 → 담당자 확인 → 처리안 확정");
      await pause(6000);
      await r.find("새 서비스 요청 감시", { selector: "div, span, b", timeout: 4000 });
      await pause(1200);
      await r.caption("감시 트리거 — PMS-X 서비스 요청 목록(pmsx__srs)을 몇 분마다 보고 새 요청이 생기면 흐름을 깨웁니다", "실행은 SM 담당자(이개발) 권한으로 · 이미 있던 요청은 기준선 · 시간당 한도");
      await pause(5500);
      await clickNear(r, "새 서비스 요청 감시", "지금 실행", { after: 2500 });
      await r.caption(`지금 실행 — 방금 들어온 ${srNo} 하나를 흐름에 넣습니다`, "평소에는 사람이 누르지 않아도 주기마다 저절로");
      if (!(await r.waitFor("!!document.querySelector('[data-test=flow-run-result]') && /사람 확인 대기|승인함에서 결정/.test(document.querySelector('[data-test=flow-run-result]').innerText)", 300000))) console.warn("  ! 흐름이 사람 확인까지 가지 않았습니다");
      await pause(1200);
      await r.caption("모델이 유형을 고르고 그 갈래대로 처리안을 만든 뒤 — 담당자 확인에서 멈췄습니다", "캔버스에 지나간 노드 · 아래 실행 디버거에 단계별 시간과 토큰");
      await pause(6000);
      await r.scroll(500, ".n-layout-scroll-container, .n-scrollbar-container");
      await pause(4000);

      // ── ④ 담당자 확인 — SM 운영 책임자가 승인함에서
      await r.go(`${L}/hub?tab=approvals`);
      await pause(1500);
      await r.caption("④ 담당자 확인 — 흐름의 처리안이 MCP 허브 승인함에 올라옵니다", "SM 운영 책임자(관리자)가 분류 결과와 처리안을 읽고 결정 · 실행한 사람은 스스로 승인할 수 없습니다");
      await pause(4000);
      if (await clickNear(r, "flows__confirm", "검토", { after: 1500 })) {
        await pause(4500);
        await r.type("결정 사유", "처리안대로 진행 — 개발 담당 배정", { delay: 45 });
        await modalBtn(r, "승인", 2000);
        await r.caption("승인 — 흐름이 멈춘 곳부터 이어 가 '처리안 확정'으로 끝납니다", "흐름 실행 기록·디버거에 누가 언제 승인했는지 남습니다");
        await pause(4500);
      }

      // ── ⑤ PMS-X — 분류 의견 → 확정·배정
      await r.caption(`⑤ PMS-X 서비스 요청 ${srNo} — 요청자·처리 기한이 자동으로`, "처리 기한 계산은 접수 순간부터");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      await pause(5000);
      await r.clickSel("[data-test=sr-triage-run]", 1000);
      await r.caption("분류 의견 — 비슷한 과거 요청·지식 문서를 근거로 유형·우선순위·대상 화면·담당 후보", "사내 모델이 제안하고, 확정은 사람이 합니다");
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

      // ── ⑥ 원인 찾기 — 구현 명세 · As-Is 뷰어
      await r.eval("[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '구현 명세')?.scrollIntoView({ block: 'center' })");
      await pause(800);
      await r.click("구현 명세", { selector: "button", after: 2500 });
      await r.caption("⑥ 원인 찾기 — 구현 명세", "대상 화면의 버튼 흐름 · 영향 테이블·컬럼 · 소스 위치 · 테스트 — 개발자와 AX-NAVI 에 넘기는 작업 지시서");
      await pause(6000);
      await r.press("Escape");
      await pause(800);
      await r.eval("document.querySelector('[data-test=sr-open-viewer]')?.scrollIntoView({ block: 'center' })");
      await pause(600);
      if (await r.click("화면 뷰어에서 보기", { selector: "a, button", after: 3500 })) {
        await r.caption("As-Is 화면 뷰어 — 실제 화면 위에서 버튼 → 함수 → SQL → 테이블", "착수 때 수집기로 올린 분석 자산");
        await pause(6500);
      }

      // ── ⑦ 고치기 — 개발자가 AX-NAVI IDE 에서. IDE 는 로그인만으로 플랫폼 MCP 허브에 연결돼 PMS-X·코드 색인 도구를 함께 쓴다
      await r.caption("⑦ 고치기 — 개발자(이개발)가 AX-NAVI IDE 에서 이 요청을 처리합니다", "IDE 는 로그인만으로 플랫폼 MCP 허브에 연결 — PMS-X 서비스 요청과 코드 색인을 IDE 안에서");
      await pause(4000);
      const original = readFileSync(DEMO_FILE);
      try {
        await r.browser(
          async (b) => {
            await b.clickAt({ x: 1290, y: 400 });
            await b.caption("⑦ AX-NAVI IDE — 서비스 요청 번호만 주고 맡깁니다", "에이전트가 허브 도구로 요청을 읽고, 코드 색인으로 고칠 곳을 찾습니다");
            await pause(3500);
            await b.webType("textarea", `PMS-X 서비스 요청 ${srNo} 를 처리해줘. hnix-ax 허브의 pmsx__srs 로 '퇴사자' 를 찾아 요청 내용을 확인하고, 코드 색인으로 HR_EMP 를 이름으로 조회하는 SQL 을 찾아 재직자만(RETIRE_YN = 'N') 나오게 고쳐줘. 다른 메서드는 건드리지 말고, 빌드·검증 명령은 돌리지 마(리뷰는 따로 한다).`);
            await pause(1500);
            await b.press("Enter");
            await b.caption("조회 도구(pmsx__srs·코드 색인)는 묻지 않고 바로 — 허브가 사람 권한·정책·감사를 적용합니다", "파일을 바꾸는 일만 개발자가 확인합니다");
            await runAgent(b, {
              1: ["파일 수정 — 개발자가 diff 를 보고 승인합니다", "이름 조회 SQL 에 재직 조건(RETIRE_YN = 'N')"],
              2: ["수정안을 확인하고 저장"],
            }, 300);
            await b.caption("수정 완료 — EmpDao.searchByName 에 재직 조건", "변경 리뷰·품질 게이트를 지나 머지 요청으로");
            await pause(6000);
          },
          { ide: DEMO_REPO, ideEnv: { AXNAVI_SELFTEST: "login" } },
          async (b) => {
            await ideQuickLogin(b);
            // 로그인 직후 채팅 웹뷰가 다시 그려진다 — 입력 칸이 뜰 때까지
            for (let t = 0; t < 30 && !(await b.webFind("", { selector: "textarea", timeout: 1000 })); t++) await pause(1000);
            await pause(3000);
            await b.overlay();
          },
        );
      } finally {
        writeFileSync(DEMO_FILE, original);
      }

      // ── ⑧ 처리 완료
      await r.caption("⑧ 고친 뒤 — 처리 내용을 남기고 '처리 완료'", "리뷰·품질 게이트를 지나 배포");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      await r.type("css:[data-test=sr-comment] textarea", "EmpDao.searchByName 에 재직 조건(RETIRE_YN = 'N')을 넣었습니다. AX-NAVI 리뷰 통과 후 오늘 배포했습니다.", { delay: 18 });
      await r.clickSel("[data-test=sr-comment-post]", 1500);
      await transition(r, "처리 완료");
      await pause(5000);

      // ── ⑨ 고객 ITSM 에 반영
      await r.caption("⑨ 고객 ITSM 에 반영 — 다음 동기화 때 자동으로");
      await r.login("platform", "admin");
      await r.go(`${L}/itsm`);
      await r.click("demo-itsm", { selector: "b", after: 1500 });
      await r.click("지금 동기화", { selector: "button", exact: true, after: 4000 });
      await tabPart(r, "이은 티켓");
      await r.caption(`⑨ 고객 ITSM 에 자동 반영 — ${ticket} 상태 Resolved, 처리 내용은 댓글로`, "고객이 ITSM 에서 닫으면 서비스 요청은 '고객 확인'으로 넘어갑니다");
      await pause(5500);
      await tabPart(r, "동기화 기록");
      await r.caption("동기화 기록 — 들어온 것(← 고객)과 나간 것(→ 고객)이 모두 남습니다");
      await pause(4500);

      // ── ⑩ 자산화 — 지식 문서
      await r.caption("⑩ 자산화 — 끝난 요청으로 지식 문서 초안(증상·원인·조치)", "요청 본문과 처리 내역을 사내 모델이 요약 · 사람이 확인하고 등록");
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await openSr(r, srNo);
      if (await r.click("AI 지식 문서 초안", { selector: "button", after: 1500 })) {
        await r.caption("⑩ 자산화 — 끝난 요청으로 지식 문서 초안(증상·원인·조치)", "요청 본문과 처리 내역을 사내 모델이 요약 · 사람이 확인하고 등록");
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
    // 현업 창구 '말로 묻기' — 녹음 파일을 마이크로(tools/demo-files/ask-voice.wav, 사내 음성 인식 서버가 떠 있어야 글로 바뀐다)
    browserArgs: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${fileURLToPath(new URL("./demo-files/ask-voice.wav", import.meta.url)).replace(/\\/g, "/")}`],
    async run(r) {
      const pp = prep();

      // ── B-1 ① 현업 창구가 답한다
      await r.login("platform", "dev");
      await r.go(`${L}/desk/hr-help`);
      await r.caption("시나리오 B-1 — 메신저·메일·웹 창구로 들어온 질문", "현업 창구가 운영 매뉴얼과 과거 처리 사례를 근거로 먼저 답합니다 · Teams·메일로도 같은 창구");
      await pause(5000);
      await r.caption("창구마다 고객사 색·로고, 첫 화면에 자주 묻는 질문 · 마이크로 말로 물을 수도 있습니다");
      await pause(3000);
      // 말로 묻기 — 사내 음성 인식 모델(게이트웨이 별칭 voice-stt)이 글로 바꾼다. 마이크가 없으면 자주 묻는 질문 버튼으로
      let spoke = false;
      if (await r.clickSel("[data-test=mic-button]", 500)) {
        await r.caption("말로 묻기 — 「사원 조회 화면에 퇴사자가 같이 나와요. 어떻게 해야 하나요?」", "말한 내용은 게이트웨이를 거쳐 사내 음성 인식 모델이 글로 바꿉니다 — 음성도 밖으로 나가지 않습니다");
        await pause(7000);
        await r.clickSel("[data-test=mic-button]", 500);
        spoke = await r.waitFor("[...document.querySelectorAll('textarea')].some((t) => t.value.includes('퇴사'))", 60000);
        await pause(1500);
        if (spoke) await r.clickSel("[data-test=desk-send]", 1000);
      }
      if (!spoke) await r.click("사원 조회에 퇴사자가 같이 나와요", { selector: ".chip", exact: true });
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
      await r.caption("접수된 요청은 시나리오 A 와 같은 길로 — 감시 트리거가 자동화 흐름(분류·처리안·담당자 확인)에 넣습니다", "어느 길로 들어와도 처리 순서는 하나");
      await pause(4500);

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
