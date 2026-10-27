# AX-NAVI IDE

AX-NAVI IDE는 레거시 개발용 AI IDE다. VS Code처럼 설치해 쓰면 AX-NAVI 에이전트가 기본으로 들어 있다. 채팅으로 코드를 찾고 고치고, 변경을 리뷰받고, 보안 지적을 AI로 고치고, 단계 게이트를 넘는 일을 한 화면에서 한다. 쓰던 VS Code가 있다면 같은 확장(.vsix)만 깔아도 된다.

<figure><img src="img/axnavi-ide-welcome.png" alt="AX-NAVI IDE — 오른쪽 AX-NAVI 채팅과 마스코트 나침이, 아래 Findings와 상세 칸"><figcaption>오른쪽은 AX-NAVI 채팅(첫 화면에서 나침이가 인사한다), 아래는 변경 리뷰 결과 Findings와 상세 칸. 상태 표시줄에 판정 <code>리뷰 STOP</code>이 뜬다.</figcaption></figure>

<div class="home-grid">
  <a class="home-card" href="#/axnavi/start">
    <span class="eyebrow">시작</span>
    <strong>설치와 첫 사용</strong>
    <span class="desc">설치, AI 연결, 첫 색인, 채팅 모드와 슬래시 명령까지 순서대로.</span>
  </a>
  <a class="home-card" href="#/axnavi/review">
    <span class="eyebrow">리뷰</span>
    <strong>변경 리뷰와 보안 점검</strong>
    <span class="desc">버튼 하나로 GO / HOLD / STOP. 지적 사항은 Findings 패널에서 AI로 고친다.</span>
  </a>
  <a class="home-card" href="#/axnavi/sdlc">
    <span class="eyebrow">산출물</span>
    <strong>SDLC 산출물과 단계 게이트</strong>
    <span class="desc">조직 양식으로 산출물을 만들고, 요구 → 설계 → 개발 → 테스트 단계 전환을 판정한다.</span>
  </a>
  <a class="home-card" href="#/axnavi/cli">
    <span class="eyebrow">CI</span>
    <strong>CLI와 CI 게이트</strong>
    <span class="desc">IDE가 쓰는 판정 엔진을 터미널과 머지 요청 파이프라인에서 그대로 쓴다.</span>
  </a>
</div>

## 무엇으로 되어 있나

| 구성 | 하는 일 | 바탕 |
|---|---|---|
| **AX-NAVI IDE** | 설치형 IDE. 이름·아이콘·데이터 폴더가 따로라 VS Code와 함께 깔아도 서로 영향이 없다. 한국어 표시, 폐쇄망 빌드(확장 마켓 연결 없음) | VSCodium 재포장 |
| **AX-NAVI 확장** | 채팅 에이전트, 변경 리뷰·Findings, 보안 점검, 단계 게이트, 코드 인덱스 연결, AI 연결 관리. IDE에 내장되어 있고 VS Code에도 깔 수 있다 | Roo Code 포크 |
| **AX-NAVI CLI** (판정 엔진) | 색인, 리뷰, 보안 점검, 게이트를 실제로 계산한다. IDE가 이것을 불러 쓰고, CI도 같은 것을 쓴다 | `npm i -g axnavi` |

IDE와 CI가 같은 엔진을 쓰므로 **개발자가 IDE에서 본 판정과 머지 요청에서 받는 판정이 같다.** 리뷰·보안 점검·게이트·색인은 AI를 부르지 않아 같은 변경에는 늘 같은 결과가 나온다.

## IBM Bob과 비교하면

| IBM Bob | AX-NAVI IDE |
|---|---|
| 오른쪽 채팅 패널 | 채팅은 Bob처럼 **오른쪽 보조 사이드바**에 열린다. 첫 화면에서 마스코트 **나침이**가 인사하고 최근 작업을 보여 준다 |
| 채팅 에이전트와 모드 | Architect · Code · Ask · Debug · Orchestrator 모드. 파일 수정은 diff로 보여 주고 승인받는다. 체크포인트로 되돌린다 |
| 슬래시 명령 | `/`를 누르면 AX-NAVI 스킬 26개 — `/find`, `/flow`, `/impact`, `/safe-modify`, `/review-sql`, `/security-scan`, `/plan-migration` 등 |
| 코드베이스 이해 | **코드 인덱스** — AI 없이 만든 전수 색인(화면 → 버튼 → 함수 → SQL → 테이블)을 에이전트가 MCP 도구로 바로 조회한다. grep으로 추측하지 않는다 |
| `/review`, 리뷰 패널 | **변경 리뷰** — 소스 제어 뷰 버튼이나 상태 표시줄로 실행. GO / HOLD / STOP과 영향 범위(호출자, 테이블, 화면 이벤트) |
| Findings | **Findings 패널 + 상세 칸 + 문제 탭** — 항목을 고르면 오른쪽 상세 칸에 **파일로 이동 / AX-NAVI로 수정 / 닫기**. 심각도 필터, 심각도별·파일별 묶기 |
| 보안 점검 | **보안 점검** — OWASP 기준. 탐색기에서 폴더를 우클릭해도 된다 |
| SDLC 단계 | **단계 게이트** — 요구 · 설계 · 개발 · 테스트마다 산출물, ADR, 리뷰, 보안 점검 통과 여부 |
| 조직 사용량 관리 | **Insight** — 설정하면 작업 요약을 HNIX AX 플랫폼으로 보낸다 |
| 모델 선택 | **AI 연결** — Claude 구독, API 키, 사내 게이트웨이, PC의 로컬 모델. 조직 정책이 허용한 연결만 쓴다 |

레거시 쪽은 Bob보다 깊다. Struts 1과 자체 프레임워크, MyBatis·iBatis, JSP, Nexacro·XPlatform·MiPlatform, WebSquare, Vue·React, ASP.NET·WinForms, EUC-KR 소스를 색인한다. 인코딩은 도구가 도는 동안만 UTF-8로 바꾸고 끝나면 되돌린다.

## 채팅에서 일하는 모습

<figure><img src="img/axnavi-ide-chat.png" alt="AX-NAVI 채팅 — 파일을 읽겠다는 승인 요청과 작업 완료"><figcaption>에이전트는 파일을 읽거나 고치기 전에 무엇을 하려는지 보여 주고, 끝나면 바늘이 북쪽에 멈추며 <b>작업 완료</b>를 띄운다.</figcaption></figure>

작업 중에는 코드 나침 표식의 바늘이 방향을 찾아 흔들리고 "생각하는 중… / 코드를 살펴보는 중…" 같은 짧은 진행 문구가 돈다. 요청이 끝나면 "API 요청"으로 바뀐다. 화면 아래의 연결 이름(예: `AX-NAVI 구독 (Claude Code)`)이 지금 어느 경로로 과금되는지 알려 준다.

## 무엇을 근거로 판단하나

| 판단 | 근거 | AI 호출 |
|---|---|---|
| 기능 위치, 호출 관계, SQL·테이블 사용처 | 전수 색인(심볼, 호출 그래프, SQL, 트랜잭션, 엔드포인트, 화면 이벤트) | 없음 |
| 변경 리뷰 판정 | 색인 + 보안 규칙 + 실행한 검증 명령 결과 | 없음 |
| 단계 게이트 | 산출물 필수 절 작성 여부, 승인 상태, ADR, 리뷰·보안 점검 결과 | 없음 |
| 설명, 수정, 산출물 서술 | 위 근거를 붙여 모델이 작성 | 있음 |
