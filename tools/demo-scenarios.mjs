/*
 * 시연 영상 시나리오 — record-demo.mjs 가 하나씩 녹화한다.
 * 주소·계정은 E2E 환경(hnix-ax-platform/e2e/e2e.config.json)과 같다.
 * r 의 조작: login · go · caption · click(글자) · clickSel · type · press · scroll · wheel · find · clickAt
 */
export const APPS = {
  platform: { url: "http://127.0.0.1:8710", loginApi: "/api/v1/auth/login", users: { admin: { loginId: "admin", password: "Admin!2026" }, dev: { loginId: "dev1", password: "Dev1!2026" } } },
  pmsx: { url: "http://127.0.0.1:8080", loginApi: "/api/v1/auth/login", users: { op: { loginId: "op.seo", password: "pmsx1234!" }, admin: { loginId: "admin", password: "pmsx1234!" } } },
  datalake: { url: "http://127.0.0.1:8790", loginApi: "/api/v1/auth/login", users: { ana: { loginId: "ana01", password: "Lake!2026" }, eng: { loginId: "eng", password: "Lake!2026" }, admin: { loginId: "admin", password: "Lake!2026" } } },
};

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const DEMO_REPO = "C:/Users/onlys/axnavi-ide-demo";
/** kafkajs 를 빌려 쓰는 AX-DataLake 저장소(시연 준비·생산기) */
export const DATALAKE_REPO = "C:/Users/onlys/ax-datalake";
const DL_READY = "document.readyState === 'complete' && !!document.querySelector('.n-layout-header')";

export const SCENARIOS = {
  axnavi: {
    title: "AX-NAVI IDE — 변경 리뷰 · AI 로 수정 · 다시 리뷰",
    ide: DEMO_REPO,
    // 모델이 생각하는 동안 멈춘 화면은 1.2초까지만(영상 시간 압축)
    maxGap: 1.2,
    async run(r) {
      const file = `${DEMO_REPO}/src/main/java/com/hd/hr/EmpDao.java`;
      const before = readFileSync(file);
      try {
        await pause(6000);
        await r.clickAt({ x: 1290, y: 400 });
        await r.caption("AX-NAVI IDE — 레거시를 함께 읽고 안전하게 고치는 AI 동료", "VSCodium 기반 · 전수 색인(화면→버튼→SQL→테이블) 위에서 일합니다");
        await pause(6000);
        await r.clickSel('[aria-label*="변경 리뷰"]');
        await r.caption("변경 리뷰 — 상태 표시줄 한 번으로 GO / HOLD / STOP", "CI 와 같은 판정 엔진(AX-NAVI CLI) — 모델 없이 규칙과 색인으로");
        await pause(9000);
        await r.caption("STOP — SQL 문자열 결합(인젝션 가능) 치명 1건, 머지 차단");
        await pause(3000);
        await r.click("SQL 문자열 결합", { selector: ".monaco-list-row, .label-name, span" });
        await r.caption("지적 상세 — OWASP A03 · CWE-89 · 위치 · 영향 · 권장 조치");
        await pause(4500);
        await r.webClick("AX-NAVI 로 수정");
        await r.caption("AX-NAVI 로 수정 — 지적을 그대로 에이전트에 넘깁니다", "에이전트는 개발자 본인 Claude 구독(로그인)으로 — 자격 증명은 PC 밖으로 안 나갑니다");
        await pause(3000);
        // 파일 읽기·수정 승인 — 뜰 때마다 누른다. 끝났다는 표시가 나오거나 3분이 지나면 멈춘다
        let approvals = 0;
        for (let t = 0; t < 180; t += 3) {
          const text = await r.webText();
          if (/Task Completed|작업 완료/.test(text)) break;
          // 명령 실행은 연습 저장소의 AX-NAVI 스크립트·색인 조회일 때만 승인하고, 그 밖은 거절한다
          const run = await r.webFind("Run", { selector: "button, vscode-button", timeout: 500 });
          if (run) {
            const chat = text.split("\n---\n")[0].slice(-800);
            const safe = /axnavi|_workspace|\.claude[\\/]/i.test(chat) && !/\b(rm|del|curl|wget|Invoke-WebRequest|git\s+push)\b/i.test(chat);
            console.log(`  명령 실행 요청 — ${safe ? "승인" : "거절"}: ${chat.slice(-300).replace(/\s+/g, " ")}`);
            await pause(1500);
            if (safe) await r.clickAt(run);
            else await r.webClick("Deny", { selector: "button, vscode-button", timeout: 500 });
            await pause(3000);
            continue;
          }
          const btn = (await r.webFind("Approve", { selector: "button, vscode-button", timeout: 500 })) ?? (await r.webFind("Save", { selector: "button, vscode-button", timeout: 500 }));
          if (btn) {
            approvals++;
            if (approvals === 1) await r.caption("파일 읽기·수정은 개발자가 승인합니다", "에이전트가 무엇을 하려는지 보고 Approve");
            if (approvals === 2) await r.caption("수정안 — 문자열 결합을 바인드 변수(PreparedStatement)로", "바뀐 부분을 diff 로 보고 저장");
            await pause(1800);
            await r.clickAt(btn);
          }
          await pause(3000);
        }
        await r.caption("수정이 끝났습니다 — 다시 리뷰합니다");
        await pause(2500);
        await r.clickSel('[aria-label*="리뷰"]');
        await pause(9000);
        await r.caption("다시 리뷰 — 치명 지적이 사라졌습니다", "같은 판정이 머지 요청의 CI 게이트에서도 돌아갑니다");
        await pause(6000);
      } finally {
        writeFileSync(file, before);
      }
    },
  },
  pmsx: {
    title: "PMS-X — SM 운영 · AI 보조 · As-Is 분석 · WBS",
    maxGap: 3,
    async run(r, A) {
      const P = A.pmsx.url;
      // ── SM 운영(운영자)
      await r.login("pmsx", "op");
      await r.go(`${P}/sm/srs`);
      await r.caption("PMS-X — 운영자(서운영)로 SM 프로젝트를 엽니다", "서비스 요청 접수·배정·처리, 처리 기한까지 남은 시간은 1분마다 갱신");
      await pause(1500);
      await r.click("차세대 SI");
      await r.click("인사시스템 운영");
      await r.waitFor("[...document.querySelectorAll('td')].some((t) => t.innerText.includes('SR-00'))", 15000);
      await pause(2000);
      await r.click("SR-0034", { selector: "td" });
      await r.caption("경보가 장애·서비스 요청으로 자동 생성됐습니다", "모니터링 웹훅 → 같은 경보는 하나로 묶고, 처리 절차 체크가 붙습니다");
      await pause(4000);
      await r.click("SR-0004", { selector: "td" });
      await r.caption("현업 서비스 요청 — \"사원 조회 시 퇴사자가 함께 보여요\"");
      await pause(2500);
      await r.click("AI 분류 추천", { selector: "button" });
      await r.caption("AI 분류·배정 추천 — 사내 모델이 유형·우선순위·대상 화면·담당자를 제안", "비슷한 요청·화면 그래프를 근거로, 반영은 사람이 합니다(게이트웨이 경유)");
      await r.waitFor("[...document.querySelectorAll('button')].some((b) => /반영|적용/.test(b.innerText))", 40000);
      await pause(4500);
      await r.go(`${P}/sm/kb`);
      await r.caption("지식 문서 — 끝난 요청에서 AI 가 초안(증상·원인·조치·재발 방지), 출처 요청 표시");
      await pause(3000);

      // ── As-Is 분석·WBS(관리자, SI 프로젝트)
      await r.login("pmsx", "admin");
      const ids = await r.eval(`(async () => {
        const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(A.pmsx.users.admin)}) }).then((x) => x.json()).then((j) => j.accessToken);
        const h = { authorization: 'Bearer ' + t };
        const si = (await fetch('/api/v1/projects', { headers: h }).then((x) => x.json())).find((p) => p.type === 'SI');
        const ss = await fetch('/api/v1/projects/' + si.projectId + '/systems', { headers: h }).then((x) => x.json());
        localStorage.setItem('project', JSON.stringify({ currentProjectId: si.projectId }));
        return { hr: (ss.content ?? ss).find((s) => s.code === 'HR').systemId };
      })()`);
      const HR = ids.hr;
      await r.go(`${P}/asis/systems`);
      await r.caption("As-Is 분석 — 인사·급여·교육 시스템을 소스 수집기로 전수 분석", "화면 → 버튼 → 함수 → SQL → 테이블 그래프 · AI 없이 결정론으로");
      await pause(3500);
      await r.go(`${P}/asis/progress?systemId=${HR}`);
      await r.caption("분석 진척 — 화면마다 상태·담당·요소 수·미매칭", "사람이 검토해 확정하고, 바뀐 화면은 다시 분석 대상으로");
      await pause(3500);
      await r.go(`${P}/asis/viewer/${HR}`);
      await r.caption("화면 분석 뷰어 — 캡처한 화면 위에 버튼·입력 요소와 연결", "버튼을 누르면 어느 함수·SQL·테이블까지 닿는지");
      await pause(3000);
      await r.click("코드 순서도", { selector: "button" });
      await r.caption("코드 순서도 — 이벤트부터 SQL 까지 호출 흐름");
      await pause(3000);
      await r.click("통합 추적", { selector: "button" });
      await r.caption("통합 추적 — 버튼 하나가 어느 테이블까지 닿는지", "요청의 영향 범위 · 구현 명세의 근거가 됩니다");
      await pause(3500);
      await r.click("한국어 설명", { selector: "button" });
      await r.caption("AI 설명 초안 — 근거 등급(녹·황·적)과 함께, 사람이 확정");
      await pause(3500);
      await r.go(`${P}/asis/tables?systemId=${HR}`);
      await r.caption("테이블 정의서 — 소스·DB 에서 뽑은 테이블·컬럼과 그 테이블을 쓰는 화면", "산출물 양식 그대로 엑셀로 내보냅니다");
      await pause(2500);
      await r.click("TB_EMP", { selector: "td" });
      await pause(3000);
      await r.go(`${P}/asis/erd?systemId=${HR}`);
      await r.caption("ERD — FK 와, SQL 조인에서 추정한 관계(점선 · 신뢰도 %)", "추정 관계는 사람이 확정하거나 기각합니다");
      await pause(4500);
      await r.go(`${P}/asis/crud?systemId=${HR}`);
      await r.caption("CRUD 매트릭스 — 화면 × 테이블, 등록·조회·수정·삭제", "버튼 단위로 보면 어느 버튼이 어떤 테이블을 바꾸는지");
      await pause(3500);
      await r.click("요소", { selector: "button", exact: true });
      await pause(3000);
      await r.go(`${P}/asis/navmap?systemId=${HR}`);
      await r.caption("화면 이동 맵 — 화면 사이의 이동·팝업·탭 호출", "화면을 누르면 분석 뷰어로");
      await pause(4000);
      await r.go(`${P}/asis/impact?systemId=${HR}`);
      await r.caption("영향도 분석 — 테이블·컬럼·함수·API·SQL 을 바꾸면 어디가 영향받나");
      await pause(1500);
      await r.type("이름으로 검색", "TB_EMP", { delay: 90 });
      await pause(1200);
      await r.click("tbl:HR.TB_EMP", { selector: ".v-list-item", exact: false });
      await r.waitFor("document.body.innerText.includes('영향 버튼')", 15000);
      await r.caption("TB_EMP 를 바꾸면 — 화면 5 · 버튼·요소 18 · API 13 · 서버 함수 26", "버튼마다 호출 경로와 최근 요청·결함·담당자까지");
      await pause(3500);
      await r.scroll(600, null);
      await pause(3000);
      await r.go(`${P}/schedule/wbs`);
      await r.caption("WBS · 간트 — 계획·실적·SPI·공정준수율, 베이스라인과 크리티컬 패스", "표에서 바로 고치고, 간트 막대를 끌어 일정을 바꿉니다");
      await pause(4000);
      await r.click("월", { selector: "button", exact: true });
      await pause(3000);
      await r.go(`${P}/schedule/kanban`);
      await r.caption("칸반 — 같은 WBS 작업을 상태별로");
      await pause(3000);
      // 퀴즈는 운영(SM) 프로젝트에 있다 — demo-prep 이 '인사시스템 인수인계 퀴즈'를 만들어 둔다
      await r.eval(`(async () => {
        const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(A.pmsx.users.admin)}) }).then((x) => x.json()).then((j) => j.accessToken);
        const sm = (await fetch('/api/v1/projects', { headers: { authorization: 'Bearer ' + t } }).then((x) => x.json())).find((p) => p.type === 'SM');
        localStorage.setItem('project', JSON.stringify({ currentProjectId: sm.projectId }));
        return true;
      })()`);
      await r.go(`${P}/sm/handover-quiz`);
      await r.caption("인수인계 퀴즈 — As-Is 분석·요청 이력·업무 절차·처리 기한에서 자동 출제", "SI → SM 인수인계 이해도를 점수로");
      await r.waitFor("[...document.querySelectorAll('[data-test=quiz-item]')].some((e) => e.innerText.includes('인사시스템 인수인계 퀴즈'))", 15000);
      await pause(1500);
      await r.eval(`[...document.querySelectorAll('[data-test=quiz-item]')].find((e) => e.innerText.includes('인사시스템 인수인계 퀴즈')).querySelector('button').click()`);
      await pause(3500);
      await r.scroll(500, null);
      await pause(3000);
    },
  },

  platform: {
    title: "AX Platform — 채팅 · 문서 RAG · Process Studio · 에이전트 · 현업 창구",
    maxGap: 3,
    async run(r, A) {
      const L = A.platform.url;
      await r.login("platform", "admin");
      // 대시보드는 건너뛴다 — 카드에 비교 대상(타사) 제품 이름이 있어 공개 영상에 넣지 않는다
      await r.go(`${L}/gateway`);
      await r.caption("AX Platform — 모든 AI 호출과 도구 호출이 지나는 공통 기반", "LLM 게이트웨이 — 제품·사람마다 가상 키, 허용 모델·데이터 등급·분당 한도");
      await pause(3000);
      await r.click("모델 별칭", { selector: ".n-tabs-tab" });
      await r.caption("모델 별칭 — 제품은 hnix-local 같은 별칭만 압니다", "조직 키 · 사내 GPU · 사내 CPU 모델로 라우팅·폴백, 기밀 등급은 사내 모델만");
      await pause(3000);

      // ── 워크스페이스 채팅: 근거 문서 + 사내 모델
      await r.go(`${L}/chat`);
      await r.caption("워크스페이스 채팅 — 사내 모델에 근거 문서와 내 권한의 도구를 붙여 묻습니다");
      await pause(2000);
      await r.click("운영 매뉴얼", { selector: "label, .n-checkbox" });
      await pause(800);
      await r.type("질문을 입력하세요", "사원 조회 화면에 퇴사자가 같이 나온다는 문의가 왔어요. 원인과 현업 안내 방법을 알려 주세요.", { delay: 40 });
      await r.click("보내기", { selector: "button" });
      await r.caption("근거 문서 컬렉션 '운영 매뉴얼'을 찾아 답합니다", "질문·답 본문은 저장하지 않고, 누가 어느 모델을 썼는지만 기록");
      await r.waitFor("[...document.querySelectorAll('summary')].length > 0", 90000);
      await pause(1500);
      await r.caption("답 아래에 근거 — 어느 문서의 어느 절인지", "운영 매뉴얼 › 1. 사원 조회에 퇴사자가 함께 나올 때");
      await pause(5000);

      // ── 문서 RAG
      await r.go(`${L}/docs`);
      await r.caption("문서 RAG — 매뉴얼·절차서를 올리면 절 단위로 나눠 색인", "키워드 + 의미 검색(사내 임베딩 모델), 채팅·현업 창구·에이전트가 같이 씁니다");
      await pause(2500);
      await r.type("질문이나 낱말로 찾기", "급여 배치가 실패하면 뭘 먼저 봐야 해?", { delay: 45 });
      await r.click("검색", { selector: "button", exact: true });
      await pause(4500);

      // ── Process Studio
      await r.go(`${L}/process`);
      await r.caption("Process Studio — 업무 문서에서 As-Is 흐름·Pain point 를 뽑고 To-Be 를 제안");
      await pause(1500);
      await r.click("새 분석", { selector: "button" });
      await r.caption("분석할 업무 문서와 모델을 고르면 시작 — 한 문서에 2~3분", "아래는 '인사 발령 업무 절차서'로 미리 돌려 둔 결과");
      await pause(3500);
      await r.click("취소", { selector: ".n-modal button, .n-card button", exact: true });
      await r.click("인사 발령 프로세스", { selector: "a, td" });
      await pause(1500);
      await r.caption("As-Is 흐름 — 담당 · 단계 · 시스템 · 입력→산출", "단계마다 문서 원문을 인용하고, 서버가 원문과 대조해 근거 등급(녹·황·적)");
      await pause(5000);
      await r.click("Pain point", { selector: ".n-tabs-tab" });
      await r.caption("Pain point — 문서에 적힌 어려움을 근거와 함께");
      await pause(4000);
      await r.click("To-Be (AI 제안)", { selector: ".n-tabs-tab" });
      await r.caption("To-Be — AI 제안, 사람이 고쳐 확정합니다");
      await pause(4000);
      await r.click("Blueprint", { selector: ".n-tabs-tab" });
      await r.caption("Blueprint — As-Is 와 To-Be 를 나란히, BPMN·Mermaid 로 내보내기");
      await pause(4500);

      // ── 에이전트
      await r.go(`${L}/agents`);
      await r.caption("에이전트 — 모델은 게이트웨이, 도구는 MCP 허브로", "실행자 권한 그대로 · 승인 정책 · 단계(span) 기록");
      await pause(1500);
      await r.clickSel(".n-base-selection");
      await r.click("sm-helper", { selector: ".n-base-select-option" });
      await r.type("무엇을 할까요", "pmsx__srs 도구에 q=퇴사자 로 검색해서 나온 서비스 요청 번호와 제목, 처리 방향을 한국어 세 줄로 정리해줘", { delay: 35 });
      await r.click("실행", { selector: "button", exact: true });
      await r.caption("에이전트가 PMS-X 도구를 불러 요청을 찾고 답합니다", "모델 → 도구(pmsx__srs) → 모델, 단계마다 시간·결과 기록");
      await r.waitFor("/완료|succeeded|실패/.test(document.querySelector('.n-card:nth-of-type(2)')?.innerText || document.body.innerText.slice(0, 3000))", 90000);
      await pause(5000);
      await r.scroll(700, ".n-layout-scroll-container");
      await r.caption("트리거 — 경보 웹훅 · 예약 · 감시가 사람 대신 에이전트를 깨웁니다");
      await pause(3500);

      // ── MCP 허브
      await r.go(`${L}/hub`);
      await r.click("서버", { selector: ".n-tabs-tab", exact: true });
      await r.caption("MCP 허브 — PMS-X · AX-NAVI · AX-DataLake 도구를 한곳에", "새 도구는 관리자가 승인해야 쓰이고, 도구마다 허용 · 거부 · 승인 후 실행");
      await pause(3500);
      await r.click("승인함", { selector: ".n-tabs-tab", exact: true });
      await r.caption("승인함 — 같은 인자로 한 번만, 요청한 본인은 승인 못 함");
      await pause(3000);

      // ── 현업 창구
      await r.go(`${L}/desk/hr-help`);
      await r.caption("현업 창구 — 현업 직원이 묻는 화면(포털·메신저에 붙임)", "운영 매뉴얼·처리 사례 근거로 1차 응답");
      await pause(2000);
      await r.type("예: 사원 조회에", "사원 조회에 퇴사자가 같이 나와요", { delay: 60 });
      await r.click("보내기", { selector: "button" });
      await r.waitFor("document.body.innerText.includes('재직')", 90000);
      await pause(1200);
      await r.caption("매뉴얼 근거로 답합니다 — 근거 문서가 함께 보입니다");
      await pause(5000);
      await r.type("예: 사원 조회에", "회의실 예약은 어떻게 하나요?", { delay: 60 });
      await r.click("보내기", { selector: "button" });
      await r.waitFor("document.body.innerText.includes('찾지 못했습니다')", 90000);
      await pause(1200);
      await r.caption("근거가 없으면 지어내지 않고 — 담당자에게 넘깁니다");
      await pause(2500);
      await r.click("담당자에게 넘기기", { selector: "button" });
      await r.type("담당자에게 덧붙일 내용", "회의실 예약 시스템 사용법 안내 부탁드립니다", { delay: 40 });
      await r.click("대화 기록과 함께 접수", { selector: "button" });
      await r.waitFor("/SR-\\d{4}/.test(document.body.innerText)", 30000);
      await r.caption("PMS-X 서비스 요청으로 접수 — 대화 기록과 함께, 요청 번호가 돌아옵니다");
      await pause(4500);

      // ── 런북·Insight
      await r.go(`${L}/runbooks`);
      await r.caption("런북 — 정해진 조치를 요청 → 다른 사람이 승인 → 실행·기록");
      await pause(3000);
      await r.go(`${L}/insight`);
      await r.click("소스", { selector: "button", exact: true });
      await r.caption("Insight — 호출 주체별(게이트웨이·허브·에이전트·현업 창구·AX-NAVI) 사용량·비용");
      await pause(3500);
    },
  },
  datalake: {
    title: "AX-DataLake — Kafka 실시간 · CDC · 온톨로지 · 거버넌스 · 계보",
    maxGap: 3,
    async run(r, A) {
      const D = A.datalake.url;
      const prep = JSON.parse(readFileSync(new URL("./.demo-prep.json", import.meta.url), "utf8"));
      // 녹화하는 동안 모니터링 경보를 Kafka 로 쉬지 않고 보낸다(초당 8건)
      const producer = spawn(process.execPath, [fileURLToPath(new URL("./demo-kafka-producer.mjs", import.meta.url)), prep.alertTopic, "--rate", "8", "--seconds", "600"], { stdio: "ignore" });
      try {
        // ── Kafka 실시간 수집(엔지니어)
        await r.login("datalake", "eng");
        await r.go(`${D}/streams`, DL_READY);
        await r.caption("실시간 수집 — Kafka 토픽을 레이크 테이블로", "위의 erp-orders-cdc 는 Debezium CDC — 업무 DB 변경(생성·수정·삭제)을 그대로 반영 중");
        await pause(4000);
        await r.click("스트림 만들기", { selector: "button" });
        await r.caption("새 스트림 — 모니터링 경보 토픽(파티션 3)을 ops.alert_events 로");
        await r.typeLabel("이름", "monitoring-alerts");
        await r.typeLabel("브로커", "localhost:9092", { tag: true });
        await r.typeLabel("토픽", prep.alertTopic, { delay: 25 });
        await r.typeLabel("스키마", "ops", { clear: true });
        await r.typeLabel("테이블", "alert_events");
        await r.typeLabel("묶음(밀리초)", "2000", { clear: true });
        await r.caption("JSON · 붙이기 · 2초마다 한 묶음 커밋", "출처 열(수신 시각·파티션·오프셋)을 붙여 정확히 한 번을 확인합니다");
        await pause(2500);
        await r.click("저장", { selector: ".n-drawer button, .n-modal button, button", exact: true });
        await pause(1500);
        await r.click("시작", { selector: "button", exact: true });
        // 오른쪽 끝 '시작' 버튼을 누르느라 표가 가로로 밀린다 — 스트림 이름이 보이게 되돌린다
        await pause(800);
        await r.eval("document.querySelectorAll('.n-scrollbar-container, .n-data-table-base-table-body').forEach((e) => { e.scrollLeft = 0; }), true");
        await r.caption("시작 — 생산기가 초당 8건씩 경보를 보내고 있습니다", "5초마다 누적 행 · 분당 · 밀린 메시지(lag)가 갱신됩니다");
        await pause(12000);
        await r.caption("누적 행이 계속 늘고, 밀린 메시지는 0 근처 — 따라잡고 있습니다");
        await pause(9000);

        await r.go(`${D}/sql`, DL_READY);
        const run = async (sql, cap, sub = "") => {
          await r.type("css:.editor textarea", sql, { clear: true, delay: 12 });
          await r.click("실행 (Ctrl+Enter)", { selector: "button" });
          await r.waitFor("!!document.querySelector('.n-data-table, table')", 20000);
          if (cap) await r.caption(cap, sub);
          await pause(3500);
        };
        await run("SELECT severity, count(*) AS n FROM ops.alert_events GROUP BY 1 ORDER BY 2 DESC", "들어온 경보를 바로 SQL 로 — 등급별 건수", "Kafka → 2초 묶음 → 공개 표준 Parquet(DuckLake)");
        await pause(3000);
        await run("SELECT severity, count(*) AS n FROM ops.alert_events GROUP BY 1 ORDER BY 2 DESC", "몇 초 뒤 다시 — 건수가 늘었습니다");
        await run("SELECT alert_id, host, severity, message, _partition, _offset, _ingested_at FROM ops.alert_events ORDER BY _ingested_at DESC LIMIT 8", "출처 열 — 파티션·오프셋을 테이블과 같은 트랜잭션에 기록", "재시작·장애에도 빠짐·중복 없이(정확히 한 번)");
        await run("SELECT status, count(*) AS n FROM erp.orders GROUP BY 1 ORDER BY 1", "CDC — 주문 300건 생성 · 120건 결제 완료로 수정 · 11건 삭제", "업무 DB 의 변경이 레이크 테이블에 그대로(키로 반영)");
        await pause(1500);
        await r.go(`${D}/catalog/ops/alert_events?tab=history`, DL_READY);
        await r.caption("시점 이력 — 커밋마다 스냅샷", "그 시점으로 되돌려 조회하고, 두 시점 사이 바뀐 행만 뽑습니다");
        await pause(4500);

        // ── 거버넌스·온톨로지(분석가)
        await r.login("datalake", "ana");
        await r.go(`${D}/catalog/hr/staff?tab=preview`, DL_READY);
        await r.caption("분석가(소속 HD01)로 들어왔습니다", "인사 테이블 — 이름·주민번호·전화는 가려지고, HD01 행만 보입니다");
        await pause(4500);
        await r.go(`${D}/ontology?type=incident`, DL_READY);
        await r.caption("온톨로지 — 테이블이 아니라 업무 객체로 찾습니다", "장애 · 서비스 · 구성 요소 · 변경 · 문제 · 서비스 요청 · 담당자");
        await pause(2500);
        await r.type("이름·키로 찾기", "디스크");
        await r.press("Enter");
        await pause(1200);
        await r.click("INC-0241", { selector: ".res" });
        await r.caption("장애 INC-0241 — 속성과 관계", "관계마다 이어진 객체 수 — 누르면 따라갑니다");
        await pause(3000);
        await r.click("직전 72시간 변경", { selector: "button" });
        await r.caption("같은 구성 요소에서 장애 직전 72시간 안에 끝난 변경", "SQL 없이 한 번에 — 원인 후보를 바로 봅니다");
        await pause(3500);
        await r.click("관계 그래프", { selector: ".n-tabs-tab" });
        await pause(1500);
        await r.click("2단계");
        await r.caption("관계 그래프 2단계 — 서비스 · 구성 요소 · 담당자 · 변경이 한 화면에", "담당자 이름은 그래프에서도 가려집니다");
        await pause(4500);
        await r.click("속성·관계", { selector: ".n-tabs-tab" });
        await r.click("진단 에이전트 요청", { selector: "button" });
        await r.type("css:.n-modal textarea", "직전 변경과의 관계를 진단해 주세요", { delay: 35 });
        await r.click("요청", { selector: ".n-modal button", exact: true });
        await r.caption("진단 에이전트 요청 — 웹훅 액션은 승인 대기", "요청한 사람은 스스로 승인할 수 없습니다");
        await pause(3000);

        await r.login("datalake", "eng");
        await r.go(`${D}/ontology?tab=runs`, DL_READY);
        await r.caption("엔지니어가 실행 요청을 승인", "분석가 화면 요청 · 에이전트(MCP) 요청이 같은 승인함에");
        await pause(2500);
        await r.click("승인·실행", { selector: "button" });
        await r.caption("승인 → 플랫폼 경보 진단 에이전트 웹훅으로 전달(202)", "보낸 객체는 요청자가 본 모습 그대로 — 가린 값은 가린 채");
        await pause(3500);

        await r.go(`${D}/lineage?node=lake:ops.alert_events`, DL_READY);
        await r.caption("계보 — Kafka 토픽 → 테이블 → 소비 경로", "원본이 바뀌면 영향 범위를 바로 봅니다");
        await pause(4500);

        await r.login("datalake", "ana");
        await r.go(`${D}/sql`, DL_READY);
        await r.caption("AI 질문 — 말로 물으면 사내 모델이 SQL 을 씁니다", "모델에는 테이블 구조만 보내고 값은 보내지 않습니다");
        await r.type("말로 물어보세요", "시스템별 P1 장애 건수", { delay: 70 });
        await r.click("AI 에게 묻기", { selector: "button" });
        await r.waitFor("!!document.querySelector('.n-data-table, table')", 40000);
        await pause(2500);
        await r.caption("만든 SQL 도 같은 거버넌스 — 분석가 소속 행만 집계됩니다");
        await pause(4500);
      } finally {
        producer.kill();
      }
    },
  },
};
