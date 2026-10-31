# 기능 현황과 로드맵

통합ITO 운영에 필요한 기능을 영역별로 정리한 표다. **제품에 있음**은 각 저장소의 자동 시험과 네 제품 통합 점검([E2E 꾸러미](/getting-started/e2e-kit.md))을 통과한 것, **현장 확인**은 기능은 있지만 고객 시스템(ITSM·GitLab·AI 조직 계정·GPU 서버)에 붙여 봐야 끝나는 것, **계획**은 아직 만들지 않은 것이다.

> 2026-10-30 기준 · 자동 시험: AX Platform 243건 · AX-NAVI 529건 · PMS-X 서버 260건·웹 237건 · AX-DataLake 80건 · 통합 점검 21단계

## 접수 — 요청·경보가 들어오는 곳

| 기능 | 상태 | 문서 | 남은 것 |
|---|---|---|---|
| 현업 창구(포털 위젯·메신저·Teams·메일) — 매뉴얼·사례 근거 답변, 못 하면 사용자 확인 후 접수 | 제품에 있음 | [현업 창구](/platform/desk.md) | 고객 Teams 테넌트 연결 |
| 고객 ITSM 양방향 동기화(ServiceNow·Jira·일반 REST) | 현장 확인 | [고객 ITSM 연동](/platform/itsm.md) | 고객 인스턴스로 확인, 첨부·담당자 동기화 |
| 모니터링 경보 → 에이전트 진단(Alertmanager·Grafana·Zabbix) | 제품에 있음 | [에이전트 실행기](/platform/agents.md) | 고객 모니터링에 웹훅 등록 |
| 경보 → PMS-X 장애·SR 자동 생성(중복 묶기) | 제품에 있음 | [SM 운영과 AI 보조](/pmsx/sm-ai.md) | — |

## 분석 — 무엇을 고쳐야 하나

| 기능 | 상태 | 문서 | 남은 것 |
|---|---|---|---|
| As-Is 화면 → 버튼 → 함수 → SQL → 테이블 전수 분석 | 제품에 있음 | [As-Is 화면 분석](/pmsx/asis.md) | — |
| 코드 전수 색인·영향도(AX-NAVI) | 제품에 있음 | [AX-NAVI 개요](/axnavi/README.md) | — |
| SR 분류·배정 추천, 유사 사례·KB 초안 | 제품에 있음 | [SM 운영과 AI 보조](/pmsx/sm-ai.md) | 고객 SR 이력으로 정답 세트 보강 |
| 구현 명세 내보내기(SR → 요구·흐름·영향·테스트) | 제품에 있음 | [인수인계와 구현 명세](/pmsx/handover.md) | — |

## 처리 — 고치고 조치한다

| 기능 | 상태 | 문서 | 남은 것 |
|---|---|---|---|
| AI IDE(채팅 에이전트·모드·슬래시 명령) | 제품에 있음 | [AX-NAVI IDE](/axnavi/README.md) | — |
| 조직 설정 배포(규칙·스킬·양식·MCP·정책·IDE 사용자 정의 모드) | 제품에 있음 | [플랫폼 연동](/axnavi/integration.md#조직-설정-배포) | IDE 화면 안에서 직접 받기(지금은 CLI 가 깔아 줌) |
| 런북 — 승인 후 실행, 점검(dry-run), 실패 시 원복 | 제품에 있음 | [런북](/platform/runbooks.md) | 고객 자동화 도구(AWX 등) 실연결 |
| 업무 템플릿(SR·장애·변경 절차 체크리스트) | 제품에 있음 | [SM 운영과 AI 보조](/pmsx/sm-ai.md#업무-템플릿) | 고객사 표준 양식 반영 |
| 현대화 레시피(Java 17·21, Spring Boot 3, jakarta, Oracle → PostgreSQL) | 제품에 있음 | [CLI와 CI 게이트](/axnavi/cli.md#현대화-레시피) | IDE 화면 |
| 여러 줄 Oracle SQL 의 AI 초안 | 제품에 있음 | [CLI와 CI 게이트](/axnavi/cli.md#현대화-레시피) | 고객 레거시로 초안 품질 측정 |

## 검증 — 고친 것이 안전한가

| 기능 | 상태 | 문서 | 남은 것 |
|---|---|---|---|
| 변경 리뷰 GO/HOLD/STOP·보안 Findings·CI 게이트 | 제품에 있음 | [변경 리뷰와 보안 점검](/axnavi/review.md) | — |
| SDLC 산출물·단계 게이트·ADR | 제품에 있음 | [SDLC 산출물과 단계 게이트](/axnavi/sdlc.md) | 고객 양식 반영 |
| SR 테스트 계획·골격·진행, 바뀐 줄 커버리지, CI 템플릿 | 제품에 있음 | [CLI와 CI 게이트](/axnavi/cli.md#테스트-계획과-커버리지) | 테스트 본문 작성 에이전트 |
| 모델 평가(정답 세트) | 현장 확인 | [모델 평가](/platform/eval.md) | 고객 GPU 서버 설치, 사내 SR 로 만든 세트 |

## 데이터 — 모으고 같은 규칙으로 읽는다

| 기능 | 상태 | 문서 | 남은 것 |
|---|---|---|---|
| 레이크(표준 Parquet · 시점 조회 · 바뀐 행), 카탈로그(설명·등급·태그) | 제품에 있음 | [AX-DataLake](/datalake/README.md) | — |
| ITO 온톨로지(객체·관계·액션·승인), 계보·영향 범위, 커넥터(SQL Server·Snowflake·REST·폴더/S3) | 제품에 있음(0.2.0) | [온톨로지](/datalake/ontology.md) · [계보](/datalake/lineage.md) | SQL Server·Snowflake 실서버 연결은 PoC, 열 단위 계보 |
| 파일 수집(EUC-KR CSV·Excel·Parquet·JSON) | 제품에 있음 | [수집](/datalake/ingest.md#파일) | — |
| 원본 DB 동기화(PostgreSQL·MySQL — 통째로·증분·병합, 주기) | 제품에 있음 | [수집](/datalake/ingest.md#원본-db) | — |
| 원본 DB 동기화 — Oracle(클라이언트 설치 불필요) | 현장 확인 | [수집](/datalake/ingest.md#원본-db) | 고객 Oracle 서버로 연결 확인(타입 변환은 시험 완료) |
| 실시간 수집(Kafka·HTTP, Debezium 변경 반영, 정확히 한 번) | 제품에 있음 | [수집](/datalake/ingest.md#실시간-스트림) | 고객 Kafka·CDC 연결 |
| 조회 권한·개인정보 열 가림·소속 행 제한(화면·API·에이전트·AI 질문 공통) | 제품에 있음 | [거버넌스](/datalake/governance.md) | 고객 개인정보 분류 기준 반영 |
| AI 질문(자연어 → SQL, 기밀은 사내 모델만), MCP 도구(허브 등록) | 제품에 있음 | [AI 질문과 에이전트](/datalake/ai.md) | 고객 데이터로 질문 정답 세트 |
| 폐쇄망 설치본(Windows·Linux 서비스), 매일 파일 정리 | 제품에 있음 | [설치와 운영](/datalake/operations.md) | Linux 설치본을 고객 서버에서 첫 확인, 여러 대(PostgreSQL 카탈로그·S3 호환 저장소) 실측 |
| 외부 데이터 형식(Iceberg) 읽기, 비정형 문서 | 계획 | — | — |

## 보고·거버넌스

| 기능 | 상태 | 문서 | 남은 것 |
|---|---|---|---|
| SLA·월간 운영보고 | 제품에 있음 | [SM 운영과 AI 보조](/pmsx/sm-ai.md) | — |
| 생산성 보고서(커밋·MR ↔ SR, AI 관여, 공수·리드타임 절감률) | 현장 확인 | [생산성 보고서](/platform/productivity.md) | 고객 GitLab 연결, 기준선 합의 |
| AI 사용량·비용(Insight) | 제품에 있음 | [Insight](/platform/insight.md) | — |
| 전사 AI 관측(Claude 조직·Copilot·CSV, AI 자산 대장) | 현장 확인 | [전사 AI 관측](/platform/enterprise-ai.md) | 고객 조직 계정으로 확인, M365 Copilot API 직접 연결 |
| 인수인계 갭 리포트·이해도 퀴즈 | 제품에 있음 | [인수인계와 구현 명세](/pmsx/handover.md) | — |

## 운영 기반

| 기능 | 상태 | 문서 | 남은 것 |
|---|---|---|---|
| 폐쇄망 설치 패키지·서비스·백업·LDAP·OIDC | 제품에 있음 | [설치와 운영](/platform/operations.md) | — |
| PostgreSQL·여러 대 운영·보안 헤더·부하 시험 | 제품에 있음 | [설치와 운영](/platform/operations.md#여러-대로-띄우기-이중화) | 운영 서버에서 다시 측정, 공인 취약점 진단, DB 복제 전환 연습 |
| 현장 연결 점검 | 제품에 있음 | [고객사 설치와 연결 점검](/getting-started/onsite.md) | — |
