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

import { readFileSync, writeFileSync } from "node:fs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const DEMO_REPO = "C:/Users/onlys/axnavi-ide-demo";
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
    title: "PMS-X — SM 운영 · AI 보조 · As-Is 분석",
    async run(r, A) {
      const P = A.pmsx.url;
      await r.login("pmsx", "op");
      await r.go(`${P}/sm/srs`);
      await r.caption("PMS-X — 운영자(서운영)로 SM 프로젝트를 엽니다", "SR 접수·배정·처리, SLA 남은 시간은 1분마다 갱신");
      await pause(1500);
      await r.click("차세대 SI");
      await r.click("인사시스템 운영");
      await r.waitFor("[...document.querySelectorAll('td')].some((t) => t.innerText.includes('SR-00'))", 15000);
      await pause(2000);
      await r.click("SR-0034", { selector: "td" });
      await r.caption("경보가 장애·SR 로 자동 생성됐습니다", "모니터링 웹훅 → 같은 경보는 하나로 묶고, 처리 절차 체크가 붙습니다");
      await pause(4000);
      await r.click("SR-0004", { selector: "td" });
      await r.caption("현업 요청 SR — \"사원 조회 시 퇴사자가 함께 보여요\"");
      await pause(2500);
      await r.click("AI 분류 추천", { selector: "button" });
      await r.caption("AI 분류·배정 추천 — 사내 모델이 유형·우선순위·대상 화면·담당자를 제안", "유사 SR·화면 그래프를 근거로, 반영은 사람이 합니다(게이트웨이 경유)");
      await r.waitFor("[...document.querySelectorAll('button')].some((b) => /반영|적용/.test(b.innerText))", 40000);
      await pause(4500);
      await r.scroll(500, null);
      await pause(1500);
      await r.go(`${P}/sm/incidents`);
      await r.caption("장애 — 경보 묶음 · 타임라인 · 장애보고서");
      await pause(3500);
      await r.go(`${P}/asis/viewer`);
      await r.caption("As-Is 화면 분석 — 화면 → 버튼 → 함수 → SQL → 테이블", "AI 없이 소스에서 전수로 뽑은 그래프(결정론)");
      await pause(3500);
      await r.click("코드 순서도", { selector: "button" });
      await pause(3000);
      await r.click("통합 추적", { selector: "button" });
      await r.caption("통합 추적 — 버튼 하나가 어느 테이블까지 닿는지", "SR 의 영향 범위 · 구현 명세의 근거가 됩니다");
      await pause(4000);
      await r.click("한국어 설명", { selector: "button" });
      await r.caption("AI 설명 초안 — 근거 등급(녹·황·적)과 함께, 사람이 확정");
      await pause(4000);
      await r.go(`${P}/sm/kb`);
      await r.caption("KB — 종료된 SR 에서 AI 가 초안(증상·원인·조치·재발 방지), 출처 SR 표시");
      await pause(3500);
      await r.go(`${P}/sm/handover-quiz`);
      await r.caption("인수인계 퀴즈 — 화면·데이터·SR 이력·업무 절차·SLA 문항으로 이해도 확인");
      await pause(3500);
    },
  },

  platform: {
    title: "AX Platform — 게이트웨이 · 허브 · 에이전트 · 관측",
    async run(r, A) {
      const L = A.platform.url;
      await r.login("platform", "admin");
      // 대시보드는 건너뛴다 — 카드에 비교 대상(타사) 제품 이름이 있어 공개 영상에 넣지 않는다
      await r.go(`${L}/gateway`);
      await r.caption("AX Platform — 모든 AI 호출과 도구 호출이 지나는 공통 기반", "먼저 LLM 게이트웨이 — 제품·사람마다 가상 키, 허용 모델·데이터 등급·분당 한도");
      await pause(3000);
      await r.click("모델 별칭", { selector: ".n-tabs-tab" });
      await r.caption("모델 별칭 — 제품은 hnix-claude · hnix-local 같은 별칭만 압니다", "Claude 조직 키 · 사내 GPU(vLLM·Ollama) 라우팅·폴백");
      await pause(3500);
      await r.click("개인정보 보호", { selector: ".n-tabs-tab" });
      await r.caption("개인정보 보호 — 주민번호·전화·카드·사업자번호를 가명화한 뒤 모델로", "기밀 등급은 사내 모델로만");
      await pause(3500);
      await r.click("요청 로그", { selector: ".n-tabs-tab" });
      await r.caption("요청 로그 — 누가 어느 모델을 얼마나(본문은 저장하지 않음)");
      await pause(3500);
      await r.go(`${L}/hub`);
      await r.click("서버", { selector: ".n-tabs-tab", exact: true });
      await r.caption("MCP 허브 — PMS-X · AX-NAVI · AX-DataLake 도구를 한곳에", "새 도구는 관리자가 승인해야 쓰입니다");
      await pause(3500);
      await r.click("정책", { selector: ".n-tabs-tab", exact: true });
      await r.caption("정책 — 도구마다 허용 · 거부 · 승인 후 실행");
      await pause(3000);
      await r.click("승인함", { selector: ".n-tabs-tab", exact: true });
      await r.caption("승인함 — 같은 인자로 한 번만, 요청한 본인은 승인 못 함");
      await pause(3000);
      await r.click("호출 기록", { selector: ".n-tabs-tab", exact: true });
      await r.caption("호출 기록 — 인자는 이름·크기만 남깁니다");
      await pause(3000);
      await r.go(`${L}/agents`);
      await r.caption("에이전트 · 트리거 — 경보 웹훅 · 예약 · 감시가 에이전트를 깨웁니다", "모델은 게이트웨이, 도구는 허브 — 실행자 권한 그대로, 단계(span) 기록");
      await pause(3000);
      await r.scroll(700, ".n-layout-scroll-container");
      await pause(3000);
      await r.go(`${L}/runbooks`);
      await r.caption("런북 — 정해진 조치를 요청 → 다른 사람이 승인 → 실행·기록");
      await pause(3000);
      await r.go(`${L}/desks`);
      await r.caption("현업 창구 — 매뉴얼·KB 근거로 1차 응답, 못 찾으면 PMS-X SR 로 접수");
      await pause(3000);
      await r.go(`${L}/insight`);
      await r.click("소스", { selector: "button", exact: true });
      await r.caption("Insight — 호출 주체별(게이트웨이·허브·에이전트·AX-NAVI·Claude Code) 사용량·비용");
      await pause(3500);
      await r.go(`${L}/admin/readiness`);
      await r.caption("현장 연결 점검 — 설치 뒤 MCP 서버에 실제로 붙어 보고 상태를 보여 줍니다");
      await pause(3500);
    },
  },
  datalake: {
    title: "AX-DataLake — 온톨로지 · 거버넌스 · 계보",
    async run(r, A) {
      const D = A.datalake.url;
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
      await r.click("진단 메모 남기기", { selector: "button" });
      await r.type("css:.n-modal textarea", "물류 DB 디스크 사용률 급증 — 직전 OS 패치 후 로그 순환 설정 확인 필요", { delay: 35 });
      await r.click("실행", { selector: ".n-modal button", exact: true });
      await r.caption("진단 메모 — 원본 데이터는 바꾸지 않고 객체에 남깁니다");
      await pause(3000);
      await r.click("진단 에이전트 요청", { selector: "button" });
      await r.type("css:.n-modal textarea", "직전 변경과의 관계를 진단해 주세요", { delay: 35 });
      await r.click("요청", { selector: ".n-modal button", exact: true });
      await r.caption("진단 에이전트 요청 — 웹훅 액션은 승인 대기", "요청한 사람은 스스로 승인할 수 없습니다");
      await pause(3000);

      await r.login("datalake", "eng");
      await r.go(`${D}/ontology?tab=runs`, DL_READY);
      await r.caption("엔지니어가 실행 요청을 봅니다", "분석가 화면 요청 · 에이전트(MCP) 요청이 같은 승인함에");
      await pause(3000);
      await r.click("승인·실행", { selector: "button" });
      await r.caption("승인 → 플랫폼 경보 진단 에이전트 웹훅으로 전달(202)", "보낸 객체는 요청자가 본 모습 그대로 — 가린 값은 가린 채");
      await pause(4000);

      await r.go(`${D}/lineage?node=lake:ito.incident`, DL_READY);
      await r.caption("계보 — 데이터가 어디서 와서 어디로 가나", "원본 → 테이블 → 객체 유형 → 소비 경로(화면·API·에이전트·AI 질문)");
      await pause(4500);
      await r.go(`${D}/lineage?node=use:mcp`, DL_READY);
      await r.caption("에이전트(MCP)가 읽은 테이블도 계보에 남습니다", "누가 어느 길로 무엇을 읽었는지 — 감사와 같은 기록");
      await pause(4000);

      await r.login("datalake", "ana");
      await r.go(`${D}/sql`, DL_READY);
      await r.caption("AI 질문 — 말로 물으면 사내 모델이 SQL 을 씁니다", "모델에는 테이블 구조만 보내고 값은 보내지 않습니다");
      await r.type("말로 물어보세요", "시스템별 P1 장애 건수", { delay: 70 });
      await r.click("AI 에게 묻기", { selector: "button" });
      await r.waitFor("!!document.querySelector('.n-data-table, table')", 40000);
      await pause(2500);
      await r.caption("만든 SQL 도 같은 거버넌스 — 분석가 소속 행만 집계됩니다");
      await pause(4500);
    },
  },
};
