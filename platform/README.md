# AX Platform

AX Platform은 HNIX AX 제품군이 함께 쓰는 AI 기반이다. 모델 호출, 도구 호출, 사용량, 승인, 문서 검색을 한곳에서 다룬다. 기존 도구(PMS-X, AX-NAVI)는 고치지 않고 커넥터로 연결한다.

| 모듈 | 하는 일 |
|---|---|
| [LLM 게이트웨이](/platform/gateway.md) | OpenAI·Anthropic 호환 API, 가상 키, 라우팅·폴백, 한국형 개인정보 마스킹, 예산, 데이터 등급별 로컬 모델 강제 |
| [Insight](/platform/insight.md) | 게이트웨이·Claude Code·AX-NAVI·에이전트 사용량을 한 기준으로 모아 비용·추이를 본다 |
| [생산성 보고서](/platform/productivity.md) | 커밋·MR을 SR과 잇고 AI 관여를 표시, 기준선 대비 공수·리드타임 절감률(30% 약정) 보고 |
| [전사 AI 관측](/platform/enterprise-ai.md) | 고객 회사의 Claude(Admin API)·Copilot·그 밖의 AI 사용량, AI 자산 대장과 검토·허브 통제, 그림자 AI 찾기 |
| [AX-NAVI 조직 설정](/axnavi/integration.md#조직-설정-배포) | 규칙·스킬·SDLC 양식·MCP·인증 정책을 묶어 전사·팀에 배포, 버전·되돌리기·받아 간 기록 |
| [MCP 허브와 승인함](/platform/hub.md) | 도구 레지스트리, 정책(허용·거부·승인), 스키마 변경 차단, 호출 감사, PMS-X·AX-NAVI 커넥터 |
| [에이전트 실행기와 A2A](/platform/agents.md) | 게이트웨이와 허브를 거쳐 도는 에이전트, 트리거(경보·예약·새 SR), 외부 A2A 에이전트 연결 |
| [현업 창구](/platform/desk.md) | 매뉴얼·처리 사례 근거로 현업 질문에 답하고, 못 찾으면 사용자 확인 후 티켓으로 접수 |
| [고객 ITSM 연동](/platform/itsm.md) | ServiceNow·Jira·일반 REST 티켓과 PMS-X SR 양방향 동기화, 웹훅, 모니터링 경보(Alertmanager·Grafana·Zabbix) 정리 |
| [모델 평가와 GPU 모델 서버](/platform/eval.md) | 통합ITO 정답 세트로 모델 별칭을 견주고 업무 별칭에 반영, 사내 vLLM 설치 꾸러미 |
| [런북 — 승인 후 실행](/platform/runbooks.md) | 배치 재실행·캐시 비우기 같은 정해진 조치를 다른 사람 승인 후 실행, 점검·실패 시 원복·실행 기록 |
| [문서 RAG](/platform/docs-rag.md) | 키워드(FTS5)와 벡터(sqlite-vec) 검색을 합친 사내 문서 검색 |
| [설치와 운영](/platform/operations.md) | 폐쇄망 설치 패키지, Windows·Linux 서비스, 백업·복원, LDAP(AD)·SSO 로그인, PostgreSQL·여러 대 |
| [현장 연결 점검](/getting-started/onsite.md) | 고객사 설치 뒤 기본 설치·모델·도구 서버·ITSM·Git·외부 AI·자동화 연결 상태를 한 화면에서, 연결 시험 |

## 한 프로세스, 한 포트

```text
http://<서버>:8700
  /           웹 (Vue 3, 한국어)
  /api/v1     관리 REST API (JWT)
  /v1         LLM 게이트웨이 (가상 키 hx-…) · OTLP 수신(/v1/logs, /v1/metrics)
  /mcp        MCP 허브 (Streamable HTTP)
```

Node 런타임을 포함한 설치 패키지 하나로 뜬다. 기본 저장소는 SQLite(파일 하나)이고, 규모가 커지면 PostgreSQL로 바꾼다.

## 화면

| 메뉴 | 내용 |
|---|---|
| 내 연결 설정 | 내 상황(구독·좌석·클라우드·API 키·없음)에 맞는 설정 조각과 키 발급 |
| LLM 게이트웨이 | 내 키, 모델 별칭, 프로바이더, 라우트·예산, 개인정보 보호 규칙, 요청 로그 |
| Insight | 대시보드, 최근 기록, 단가표, 수집 소스 |
| MCP 허브 | 연결·내 도구, 서버, 도구 승인, 정책, 승인함, 호출 기록 |
| 문서 RAG | 컬렉션, 문서 올리기, 검색 |
| 에이전트 | 에이전트 정의, 트리거(경보·예약·새 SR), 실행, 실행 기록과 단계 |
| 런북 | 런북 등록, 점검·실행 요청, 실행 기록(원복 표시) |
| 생산성 보고서 | 저장소·웹훅, 커밋·MR ↔ SR, 기준선, 절감률 보고서 |
| 현업 창구 · 고객 ITSM 연동 | 창구 설정·대화 기록·접수, ITSM 연결·동기화 기록 |
| 전사 AI 관측 · 모델 평가 | 외부 AI 사용량·AI 자산 대장, 정답 세트로 모델 비교 |
| AX-NAVI 조직 설정 | 묶음 편집·배포·비교·되돌리기, 받아 간 기록 |
| 관리 | 사용자, 워크스페이스, 감사 로그, 현장 연결 점검 |

## 권한

| 역할 | 할 수 있는 일 |
|---|---|
| 시스템 관리자 | 모든 설정, 프로바이더·정책·에이전트 정의, 승인 결정, 조직 수집 키 발급 |
| 감사자 | 전체 조회(사용자별 사용량 포함), 설정 변경 불가 |
| 사용자 | 본인 키 발급, 본인 기록과 팀 단위 집계 조회, 에이전트 실행, 문서 검색(소속 워크스페이스) |
