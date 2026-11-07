# AX Platform

AX Platform은 HNIX AX 제품군이 함께 쓰는 AI 기반이다. 모델 호출, 도구 호출, 사용량, 승인, 문서 검색을 한곳에서 다룬다. 기존 도구(PMS-X, AX-NAVI)는 고치지 않고 커넥터로 연결한다.

<video controls preload="metadata" poster="video/platform.jpg" src="video/platform.mp4" style="width:100%;border-radius:10px"></video>

> 게이트웨이 · 워크스페이스 채팅 · 문서 RAG · 업무 흐름 개선 · 에이전트 · MCP 허브 · 현업 창구 · 런북 · Insight 를 사내 모델이 실제로 답하는 화면으로(5분). [시연 영상 전체](/demo/README.md)


| 모듈 | 하는 일 |
|---|---|
| [LLM 게이트웨이](/platform/gateway.md) | OpenAI·Anthropic 호환 API, 가상 키, 라우팅·폴백, 한국형 개인정보 마스킹, 예산, 데이터 등급별 로컬 모델 강제 |
| [Insight](/platform/insight.md) | 게이트웨이·Claude Code·AX-NAVI·에이전트 사용량을 한 기준으로 모아 비용·추이를 본다(메뉴 AI 사용 현황 › 사용량·비용) |
| [생산성 보고서](/platform/productivity.md) | 커밋·MR을 서비스 요청(SR)과 잇고 AI 관여를 표시, 기준선 대비 공수·리드타임 절감률(30% 약정) 보고 |
| [전사 AI 관측](/platform/enterprise-ai.md) | 고객 회사의 Claude(Admin API)·Copilot·그 밖의 AI 사용량, AI 자산 대장과 검토·허브 통제, 그림자 AI 찾기(메뉴 AI 사용 현황 › 외부 AI·자산) |
| [AX-NAVI 조직 설정](/axnavi/integration.md#조직-설정-배포) | 규칙·스킬·SDLC 양식·MCP·인증 정책을 묶어 전사·팀에 배포, 버전·되돌리기·받아 간 기록 |
| [AX-NAVI 사용 허가](/axnavi/license.md) | IDE 로그인·기기 승인, 허가(좌석)와 엔진 위치, 기기 폐기, 스킬·판정 엔진 배포, 유출본의 받은 사람 찾기 |
| [MCP 허브와 승인함](/platform/hub.md) | 도구 레지스트리, 정책(허용·거부·승인), 스키마 변경 차단, 호출 감사, PMS-X·AX-NAVI 커넥터, 왼쪽 메뉴의 승인함 |
| [에이전트 실행기와 A2A](/platform/agents.md) | 게이트웨이와 허브를 거쳐 도는 에이전트, 트리거(경보·예약·새 요청), 실행 디버거, 외부 에이전트 가져오기(A2A·LangGraph·OpenAI 호환·HTTP) |
| [자동화 흐름](/platform/flows.md) | 모델 질문·도구·에이전트·분기·반복·사람 확인을 캔버스에 그려 정해진 순서대로 실행, 판 기록, 화면·REST·MCP·트리거 |
| [에이전트 평가](/platform/agent-eval.md) | 시험 문항(도구 사용·정규식·턴·모델 채점)으로 에이전트·흐름을 채점하고 이전 평가와 문항별 비교 |
| [현업 창구](/platform/desk.md) | 매뉴얼·처리 사례 근거로 현업 질문에 답하고, 못 찾으면 사용자 확인 후 티켓으로 접수 |
| [고객 ITSM 연동](/platform/itsm.md) | ServiceNow·Jira·일반 REST 티켓과 PMS-X 서비스 요청 양방향 동기화, 웹훅, 모니터링 경보(Alertmanager·Grafana·Zabbix) 정리 |
| [업무 시스템 연결](/platform/biz.md) | SAP·Salesforce·Microsoft 365·네이버웍스·사내 REST(OpenAPI)를 허브 도구로 — 조회 허용, 쓰기는 기본 승인 필요 |
| [음성](/platform/voice.md) | 게이트웨이 음성 인식·합성 별칭, 현업 창구·채팅에서 말로 묻고 소리로 듣기 |
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

왼쪽 메뉴는 하는 일로 묶었다(관리자 22칸, 일반 사용자 13칸). 비슷한 화면은 메뉴 한 칸에 두고 화면 위 **묶음 탭**으로 오간다. 주소는 화면마다 그대로라 알림·북마크가 깨지지 않는다.

<figure><img src="img/platform-menu.png" alt="왼쪽 메뉴 묶음과 AI 사용 현황 화면 위의 묶음 탭(사용량·비용, 품질·지연, 외부 AI·자산)"><figcaption>'AI 사용 현황' 한 칸 — 화면 위 탭으로 사용량·비용(Insight) · 품질·지연(관측) · 외부 AI·자산(전사 AI 관측)을 오간다. 메뉴 맨 위의 승인함에는 내가 결정할 대기 건수가 붙는다.</figcaption></figure>

| 묶음 | 메뉴 | 내용 |
|---|---|---|
| — | 대시보드 | 오늘 AI 사용·비용, 승인 대기·정책 차단·개인정보, 지금 확인할 일, 바로 가기(볼 수 있는 화면만) |
| — | **승인함** | 도구 호출·런북 실행·자동화 흐름의 사람 확인을 한곳에서 검토·승인(대기 건수 배지) |
| 내 작업 | 워크스페이스 채팅 · 업무 흐름 개선 · 내 연결 설정 | 내 연결 설정 = 연결 설정 / 내 AX-NAVI 기기(탭) |
| AI 통제 | LLM 게이트웨이 · MCP 허브 · 문서 RAG | 내 키·모델 별칭·라우트·개인정보 보호 / 연결·서버·도구 승인·정책·호출 기록 / 컬렉션·문서 올리기(새 판으로 바꾸기)·검색 |
| 에이전트·자동화 | 에이전트 · 자동화 흐름 · 런북 · 평가 | 평가 = 에이전트 평가 / 모델 평가(탭) |
| 관측·보고 | AI 사용 현황 · 생산성 보고서 | AI 사용 현황 = 사용량·비용 / 품질·지연 / 외부 AI·자산(탭) |
| 현업·연동(관리자) | 현업 창구 · 고객 ITSM 연동 · 업무 시스템 연결 | 창구 설정·대화 기록·접수(PMS-X 프로젝트는 이름으로 고른다), ITSM 동기화, ERP·CRM 연결 |
| 관리(관리자) | AX-NAVI 관리 · 사용자·워크스페이스 · 현장 연결 점검 · 알림 보내기 · 감사 로그 | AX-NAVI 관리 = 사용 허가 / 조직 설정(탭) |

좁은 화면(태블릿 세로·휴대폰, 900px 이하)에서는 메뉴가 ☰ 서랍으로 들어가고, 머리의 테마·비밀번호·로그아웃은 ⋯ 안으로 들어간다. 현업 창구 화면(`/desk/<이름>`)은 휴대폰 폭에 맞춰 따로 만들어져 있다.

<figure><img src="img/platform-mobile.png" alt="휴대폰 폭에서 ☰ 로 연 메뉴 서랍" style="max-width:320px"><figcaption>휴대폰 폭 — ☰ 로 여는 메뉴 서랍(일반 사용자).</figcaption></figure>

## 권한

| 역할 | 할 수 있는 일 |
|---|---|
| 시스템 관리자 | 모든 설정, 프로바이더·정책·에이전트 정의, 승인 결정, 조직 수집 키 발급 |
| 감사자 | 전체 조회(사용자별 사용량 포함), 설정 변경 불가 |
| 사용자 | 본인 키 발급, 본인 기록과 팀 단위 집계 조회, 에이전트 실행, 문서 검색(소속 워크스페이스) |
