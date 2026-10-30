# HNIX AX

HNIX AX는 SI 구축과 SM 운영 현장을 위한 AI 제품군이다. 레거시 코드와 화면을 **스크립트로 전수 분석해 근거를 먼저 만들고**, AI는 그 근거 위에서 설명·분류·요약·변경 검토를 돕는다. 네 제품이 하나의 공통 기반 위에서 같은 데이터를 본다.

<div class="home-grid">
  <a class="home-card" href="#/platform/README">
    <span class="eyebrow">공통 기반</span>
    <strong>AX Platform</strong>
    <span class="desc">LLM 게이트웨이와 MCP 허브 위에 경보 진단 에이전트, 현업 창구, 고객 ITSM 연동, 승인 후 실행하는 런북, 생산성 보고서, 전사 AI 관측. 폐쇄망 설치 패키지 하나로 뜬다.</span>
  </a>
  <a class="home-card" href="#/axnavi/README">
    <span class="eyebrow">개발</span>
    <strong>AX-NAVI IDE</strong>
    <span class="desc">VS Code처럼 쓰는 레거시 개발용 AI IDE. 전수 색인 위에서 채팅으로 찾고 고치고, 변경 리뷰·보안 Findings·단계 게이트·테스트·현대화 레시피까지 같은 판정 엔진으로.</span>
  </a>
  <a class="home-card" href="#/pmsx/README">
    <span class="eyebrow">관리·운영</span>
    <strong>PMS-X</strong>
    <span class="desc">화면의 버튼 하나가 어떤 함수·API·SQL·테이블로 이어지는지 보여 주는 SI·SM 통합 프로젝트 관리 시스템. SR·SLA·업무 템플릿·인수인계 퀴즈까지.</span>
  </a>
  <a class="home-card" href="#/datalake/README">
    <span class="eyebrow">데이터</span>
    <strong>AX-DataLake</strong>
    <span class="desc">폐쇄망 레이크하우스. 업무 DB·파일·실시간 이벤트를 표준 파일로 모으고, 사람과 AI 에이전트가 같은 권한·개인정보 가림·행 제한으로 읽는다. 자연어 질문은 사내 모델로.</span>
  </a>
</div>

<figure>
  <img src="img/pmsx-viewer.png" alt="PMS-X As-Is 화면 분석 뷰어 — 캡처 위 버튼을 누르면 함수·API·SQL·테이블 흐름이 펼쳐진다">
  <figcaption>PMS-X As-Is 화면 분석 뷰어. 저장 버튼을 누르면 <code>fn_save()</code> → <code>POST /hr/emp/save.do</code> → 서비스 → SQL → <code>TB_EMP</code> 흐름이 펼쳐진다.</figcaption>
</figure>

## 무엇이 다른가

| 관점 | 일반적인 AI 도구 | HNIX AX |
|---|---|---|
| 레거시 이해 | 사람이 파일을 골라 보여 주고 AI가 요약한다 | 수집기와 인덱서가 소스·DB·화면을 **전수 분석**해 화면 → 버튼 → 함수 → SQL → 테이블 그래프를 만든다. AI 호출 0회 |
| AI의 역할 | 답을 지어낸다 | 미리 만든 근거 안에서 고르고 설명한다. 근거가 약하면 등급(녹·황·적)으로 드러낸다 |
| 변경 안전 | 승인 대화상자 | 영향 범위·보안 규칙·실행 증거로 GO / HOLD / STOP 판정. 종료 코드로 CI에 바로 연결 |
| 모델 선택 | 한 회사 모델에 고정 | Claude와 사내 로컬 모델을 섞어 쓰고, 데이터 등급에 따라 로컬 모델을 강제한다 |
| 거버넌스 | 도구마다 따로 | 게이트웨이·Claude Code·AX-NAVI·에이전트 사용량을 한 화면에서 같은 기준으로 본다 |
| 데이터 | AI 에 데이터를 넘기면 무엇을 봤는지 모른다 | 레이크의 권한·열 가림·행 제한이 사람·에이전트·AI 질문에 똑같이 걸리고, 누가 어떤 길로 무엇을 읽었는지 남는다 |
| 설치 | 클라우드 SaaS | 고객사 폐쇄망에 설치. 외부 호출 0건으로 운영할 수 있다 |

## 통합ITO 운영에서 하는 일

요청 하나가 들어와 처리되고 보고되기까지, 각 단계에서 무엇이 일하는지 보여 준다. 자세한 상태는 [기능 현황과 로드맵](/reference/roadmap.md)에 있다.

| 단계 | 하는 일 | 제품 |
|---|---|---|
| 접수 | 현업 질문에 매뉴얼·사례 근거로 1차 답변, 못 하면 SR 접수. 고객 ITSM 티켓·모니터링 경보도 SR·장애로 | [현업 창구](/platform/desk.md) · [ITSM 연동](/platform/itsm.md) · [경보 접수](/pmsx/sm-ai.md) |
| 분석 | 경보 진단 에이전트가 원인을 좁히고, SR 분류·배정 추천, 영향도와 화면 흐름으로 고칠 곳을 찾는다 | [에이전트 실행기](/platform/agents.md) · PMS-X · AX-NAVI |
| 처리 | 업무 템플릿 절차대로, 코드는 AX-NAVI 로 고치고, 정해진 조치는 승인 후 런북으로(실패하면 원복) | [업무 템플릿](/pmsx/sm-ai.md#업무-템플릿) · [AX-NAVI](/axnavi/README.md) · [런북](/platform/runbooks.md) |
| 검증 | 변경 리뷰 GO/HOLD/STOP, 보안 Findings, 테스트 계획·바뀐 줄 커버리지를 CI 게이트로 | [변경 리뷰](/axnavi/review.md) · [CLI와 CI](/axnavi/cli.md) |
| 보고 | SLA·월간 운영보고, 커밋 ↔ SR 로 공수 절감률, AI 사용량·비용, 고객 전사 AI 관측 | [생산성 보고서](/platform/productivity.md) · [Insight](/platform/insight.md) · [전사 AI 관측](/platform/enterprise-ai.md) |
| 데이터 | 업무 DB·장애·로그를 한곳에 모아 기간·계열사별 분석, 에이전트의 근거 데이터로(개인정보는 가린 채) | [AX-DataLake](/datalake/README.md) |
| 이관·현대화 | SI → SM 인수인계 갭·이해도 퀴즈, Java·Spring Boot·Oracle → PostgreSQL 레시피 | [인수인계](/pmsx/handover.md) · [현대화 레시피](/axnavi/cli.md#현대화-레시피) |

## 네 제품이 이어지는 방식

```mermaid
flowchart LR
    subgraph DEV["개발자 PC"]
        NAVI["AX-NAVI IDE<br/>색인·리뷰·게이트"]
        CC["Claude Code<br/>(각자 로그인)"]
    end
    subgraph PLAT["AX Platform"]
        GW["LLM 게이트웨이"]
        HUB["MCP 허브·승인함"]
        INS["Insight"]
        RAG["문서 RAG"]
        RUN["에이전트 실행기"]
    end
    PMSX["PMS-X<br/>As-Is·SM 운영"]
    LAKE["AX-DataLake<br/>레이크·거버넌스"]
    LLM[("Claude · 사내 로컬 모델")]
    EXT["고객 ITSM·GitLab·모니터링"]
    NAVI -- "게이트웨이 경로" --> GW
    NAVI -- "MCP 도구" --> HUB
    CC -. "사용량(OTLP)" .-> INS
    PMSX -- "AI 기능(켤 때만)" --> GW
    HUB -- "읽기 전용 커넥터" --> PMSX
    HUB -- "레이크 조회(가림·행 제한)" --> LAKE
    LAKE -- "AI 질문" --> GW
    RUN --> GW
    RUN --> HUB
    GW --> LLM
    GW -. "계량" .-> INS
    EXT -- "티켓·커밋·경보(웹훅)" --> PLAT
    RUN -- "승인 후 런북" --> EXT
```

- 지식은 복제하지 않는다. AX Platform은 PMS-X와 AX-NAVI가 이미 가진 그래프를 **커넥터로 읽기만** 한다.
- 모든 모델 호출은 게이트웨이를 지난다. 키 관리·개인정보 마스킹·예산·데이터 등급 라우팅·계량이 한곳에서 일어난다.
- Claude 구독 사용자는 각자 PC에서 각자 로그인해 쓰고, 플랫폼에는 사용량 기록만 온다. 자세한 내용은 [Claude 연결](/getting-started/connect.md)에 있다.

## 처음이라면

1. [제품 구성과 구조](/getting-started/architecture.md)에서 전체 그림을 본다.
2. [빠른 시작](/getting-started/quickstart.md)으로 제품을 내 PC에 띄운다.
3. [장애 한 건 따라가기](/getting-started/scenario.md)에서 경보 접수부터 KB 등록까지 제품이 이어지는 흐름을 본다.
4. 고객사에 설치한다면 [고객사 설치와 연결 점검](/getting-started/onsite.md)의 순서대로 연동을 확인한다.

## 저장소

| 제품 | 저장소 | 기술 |
|---|---|---|
| AX Platform | `Malburi/hnix-ax-platform` (비공개) | TypeScript, Fastify, Vue 3, SQLite·PostgreSQL |
| AX-NAVI IDE | `Malburi/axnavi-ide` (비공개) | VSCodium 재포장 + Roo Code 포크 확장 |
| AX-NAVI CLI (판정 엔진) | [Malburi/AX-NAVI-CLI](https://github.com/Malburi/AX-NAVI-CLI) · [문서](https://malburi.github.io/AX-NAVI-CLI/) | Node.js CLI, Claude Code 플러그인 |
| PMS-X | `Malburi/hnix-pmsx` (비공개) | Spring Boot 3·Java 21, Vue 3, Python 수집기 |
| AX-DataLake | `Malburi/ax-datalake` (비공개) | TypeScript, Fastify, Vue 3, 내장 SQL 엔진 · Parquet |

이 사이트는 제품 소개와 사용 안내다. 설치 파일과 상세 설계 문서는 각 저장소에 있다.

## 오프라인판

인터넷이 안 되거나 GitHub Pages에 접속할 수 없는 곳에서는 오프라인판을 쓴다. [hnix-ax-offline.zip](download/hnix-ax-offline.zip ':ignore')을 받아 풀고 `offline/index.html`을 더블클릭하면 된다. 내용과 화면은 이 사이트와 같고, 검색과 다이어그램도 인터넷 없이 동작한다.
