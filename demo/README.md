# 시연 — 영상과 진행 순서

HNIX AX 네 제품이 실제로 도는 모습을 영상으로 담았다. 영상은 모두 **실제로 띄운 제품**(E2E 환경 — 플랫폼·PMS-X·AX-NAVI IDE·AX-DataLake를 한 PC에)을 조작하며 녹화했다. 꾸민 화면이나 목업이 아니다. 아래 자막은 녹화할 때 화면 위에 덧그린 설명이고, 주황 물결은 누른 곳이다.

## 전체 투어 — 13분

<video controls preload="metadata" poster="video/tour.jpg" src="video/tour.mp4" style="width:100%;border-radius:10px;background:#0f1d2b"></video>

제목 카드 → AX Platform → PMS-X → AX-NAVI IDE → AX-DataLake 순서다. 시연회 첫 화면에 틀어 두거나, 라이브 시연이 막혔을 때 이어서 보여 준다. 전체 흐름 그림은 [AI 생태계 워크플로우](/demo/ecosystem.md)에 있다.

## 제품별 영상

### AX Platform — 공통 AI 기반 (5분)

<video controls preload="metadata" poster="video/platform.jpg" src="video/platform.mp4" style="width:100%;border-radius:10px"></video>

AX Platform이 실제로 무엇을 하는지 기능마다 한 번씩 써 본다. 답은 모두 사내 로컬 모델(`hnix-local`)이 그 자리에서 낸 것이다.

- **LLM 게이트웨이** — 가상 키와 모델 별칭. 모든 AI 호출이 여기를 지난다.
- **워크스페이스 채팅** — 근거 문서(운영 매뉴얼)를 고르고 "사원 조회에 퇴사자가 같이 나와요"라고 물으면, 매뉴얼 절을 근거로 답하고 근거 문서를 접어 보여 준다. 오른쪽에서 내 권한의 MCP 도구도 함께 고른다.
- **문서 RAG** — 매뉴얼·절차서를 올리면 절 단위로 나눠 색인한다. "급여 배치가 실패하면 뭘 먼저 봐야 해?"로 키워드+의미 검색.
- **Process Studio** — 업무 절차서(인사 발령)를 넣으면 As-Is 흐름(담당·단계·시스템·입력→산출) → Pain point → **To-Be(AI 제안)** → Blueprint(BPMN·Mermaid). 새 분석 창을 연 뒤, 미리 돌려 둔 결과를 본다(한 문서에 2~3분).
- **에이전트** — `sm-helper`가 PMS-X 도구(`pmsx__srs`)를 불러 퇴사자 관련 서비스 요청을 찾아 정리한다. 모델 → 도구 → 모델 단계와 시간이 기록된다.
- **MCP 허브** — PMS-X·AX-NAVI·AX-DataLake 도구를 한 곳에, 정책과 승인함.
- **현업 창구** — 현업 직원이 쓰는 화면. 매뉴얼에 있는 질문은 근거와 함께 답하고, 근거가 없는 질문("회의실 예약은 어떻게 하나요?")은 지어내지 않고 **담당자에게 넘기기** → 대화 기록과 함께 PMS-X 서비스 요청으로 접수(요청 번호가 돌아온다).
- **런북 · Insight** — 승인 뒤 실행하는 조치, 호출 주체별 AI 사용 현황.

### PMS-X — SM 운영 · AI 보조 · As-Is 분석 · WBS (2분 50초)

<video controls preload="metadata" poster="video/pmsx.jpg" src="video/pmsx.mp4" style="width:100%;border-radius:10px"></video>

- **SM 운영(운영자)** — 경보로 자동 생성된 서비스 요청 → 현업 요청에서 **AI 분류 추천**(사내 모델이 실제로 답한다) → 지식 문서.
- **As-Is 분석(SI 프로젝트, 인사시스템)** — 시스템 관리(소스 수집기로 전수 분석) → 분석 진척 현황 → **화면 분석 뷰어**(캡처 위 요소 · 코드 순서도 · 통합 추적 · AI 설명 초안) → **테이블 정의서**(TB_EMP 컬럼과 쓰는 화면) → **ERD**(FK + 조인에서 추정한 관계) → **CRUD 매트릭스**(화면·요소 × 테이블) → **화면 이동 맵** → **영향도 분석**(TB_EMP를 바꾸면 화면·버튼·API·서버 함수가 몇 개, 버튼별 호출 경로).
- **일정** — **WBS·간트**(계획·실적·SPI, 베이스라인·크리티컬 패스, 월 단위) → 칸반.
- **인수인계 퀴즈**(SM) — As-Is 분석·요청 이력에서 자동 출제된 문제를 풀어 본다.

### AX-NAVI IDE — 변경 리뷰 · AI로 수정 · 다시 리뷰 (3분)

<video controls preload="metadata" poster="video/axnavi.jpg" src="video/axnavi.mp4" style="width:100%;border-radius:10px"></video>

상태 표시줄의 변경 리뷰 → **STOP**(SQL 문자열 결합, 치명) → 지적 상세(OWASP A03·CWE-89·권장 조치) → **AX-NAVI 로 수정** → 에이전트가 파일을 읽고 고치는 동안 개발자가 읽기·저장을 승인 → 다시 리뷰하면 치명 지적이 사라지고 **HOLD**(중간 2건)로. 에이전트는 개발자 본인의 Claude 구독 로그인으로 돈다. 모델이 생각하는 동안 멈춘 화면은 영상에서 줄였다.

### AX-DataLake — Kafka 실시간 수집 · 온톨로지 · 거버넌스 · 계보 (3분 50초)

<video controls preload="metadata" poster="video/datalake.jpg" src="video/datalake.mp4" style="width:100%;border-radius:10px"></video>

- **Kafka 실시간 수집(엔지니어)** — 실제 Kafka 브로커에 모니터링 경보가 초당 8건씩 들어오는 중에, 화면에서 **스트림을 새로 만든다**(브로커·토픽·스키마·테이블·2초 묶음) → 시작 → 5초마다 누적 행·분당·밀린 메시지(lag)가 늘어난다.
- **SQL로 바로 조회** — 들어온 경보를 등급별로 세고, 몇 초 뒤 다시 세면 건수가 늘어 있다. 출처 열(`_partition`·`_offset`·`_ingested_at`)로 정확히 한 번 적재를 확인한다.
- **Debezium CDC** — ERP 주문 DB 변경 토픽을 기본 키로 반영한 `erp.orders`(생성·변경·삭제가 그대로) · 카탈로그의 커밋별 시점 이력.
- **거버넌스(분석가)** — 인사 테이블은 가려지고 소속 행만 → 객체 탐색에서 장애를 찾아 **직전 72시간 변경**을 SQL 없이 → 관계 그래프 → **진단 에이전트 요청**은 승인 대기 → 엔지니어 승인 → 계보(Kafka 토픽 → `ops.alert_events`) → AI 질문.

## 시연회 진행 순서 — 30분

라이브로 할 때의 각본이다. 각 단계의 "보여 줄 것"은 위 영상의 같은 장면이다.

| 시간 | 단계 | 보여 줄 것 | 말할 것 |
|---|---|---|---|
| 0–2분 | 오프닝 | [생태계 그림 1쪽·2쪽](/demo/ecosystem.md) | 제품 넷이 한 기반을 쓴다. 사람은 판단·승인만, 찾고·모으고·기록하는 일은 에이전트와 제품이 |
| 2–5분 | 현업 창구 | 플랫폼 › `/desk/hr-help` — 매뉴얼 질문 → 근거 답 · 모르는 질문 → 담당자에게 넘기기 → 요청 번호 | 현업은 이 화면 하나. 근거가 없으면 지어내지 않고 사람에게 넘긴다 |
| 5–8분 | ① 요청 → AI 분류 | PMS-X › 운영(SM) › 서비스 요청 › 방금 접수된 요청 · AI 분류 추천 | 경보·창구에서 요청이 생긴다. 모델은 게이트웨이 뒤 사내 모델, 반영은 사람이 |
| 8–11분 | 채팅 · 문서 RAG · 에이전트 | 플랫폼 › 워크스페이스 채팅(운영 매뉴얼 근거) · 문서 RAG 검색 · 에이전트 `sm-helper` | 사내 문서와 내 권한의 도구를 한 대화에서. 에이전트는 단계마다 기록 |
| 11–13분 | Process Studio | 플랫폼 › Process Studio › 인사 발령 프로세스 — As-Is · Pain point · To-Be · Blueprint | 업무 절차서에서 현행 흐름과 개선안을. 분석 자체는 2~3분이라 미리 돌려 둔다 |
| 13–17분 | As-Is 분석 | PMS-X(SI) › 화면 분석 뷰어 · 테이블 정의서 · ERD · CRUD · 화면 이동 맵 · 영향도(TB_EMP) · WBS | AI 없이 소스에서 그래프를. 테이블 하나를 바꾸면 어느 화면·버튼까지 |
| 17–20분 | 실시간 수집 | AX-DataLake › 실시간 수집 › 스트림 만들기 → 시작 → SQL로 건수 두 번 | Kafka 토픽이 초 단위로 테이블이 된다. 출처 열로 정확히 한 번 |
| 20–23분 | ⑳ 원인 후보 · 승인 | AX-DataLake › 객체 탐색 › 장애 › 직전 72시간 변경 → 진단 에이전트 요청 → 엔지니어 승인 | 테이블이 아니라 업무 객체로. 에이전트가 하자는 일은 사람이 승인한 뒤 한 번만 |
| 23–28분 | ⑦ 수정 · 리뷰 | AX-NAVI IDE › 변경 리뷰 STOP → AX-NAVI 로 수정 → 다시 리뷰 | 판정 엔진은 CI와 같다. 읽기·수정은 개발자가 승인. 구독 자격은 PC 밖으로 안 나간다 |
| 28–30분 | 지식 · 관측 · 정리 | PMS-X › 지식 문서 · 플랫폼 › Insight · [생태계 그림 4쪽](/demo/ecosystem.md#_4-ai-거버넌스) | 끝난 요청은 지식 문서로, 모든 AI 사용은 주체별로. 통제 지점 넷 — 모델·도구·데이터·사용 |

### 라이브 시연 준비

1. 시연 PC에 [E2E 꾸러미](/getting-started/e2e-kit.md)를 풀고 `start.ps1 -Fresh`로 네 제품을 띄운다(처음 3~5분).
2. `node scripts\smoke.mjs`로 21단계 자동 점검을 돌려 모두 통과하는지 본다 — 통과하면 위 각본의 데이터가 대부분 준비된 것이다.
3. 실시간 수집 장면에는 Kafka 브로커가 필요하다(JDK 17 이상 — 아래 [영상 다시 만들기](#영상-다시-만들기)). 브로커를 띄우고 이 저장소에서 `node tools/demo-prep.mjs`를 한 번 돌리면 현업 창구 `hr-help`, Process Studio 결과, 인수인계 퀴즈, 경보 토픽과 CDC 스트림이 준비된다. 경보는 `node tools/demo-kafka-producer.mjs <토픽>`으로 흘려 보낸다.
4. 계정 — 플랫폼 `admin`·`dev1`, PMS-X `op.seo`(운영자), AX-DataLake `ana01`(분석가, 소속 HD01)·`eng`(엔지니어). 비밀번호는 꾸러미 README.
5. 브라우저 탭을 미리 연다 — 플랫폼 `:8710`, PMS-X `:8080`, AX-DataLake `:8790`. AX-NAVI IDE는 `start.ps1`이 연습 저장소로 띄운다.
6. 막히면 이 쪽의 영상으로 넘어간다. 영상은 오프라인판에도 들어 있다.

## 지난 판 영상

위 영상은 2026-11-01 확장판이다 — 플랫폼은 채팅·문서 RAG·Process Studio·에이전트·현업 창구를 실제로 써 보고, PMS-X는 As-Is 분석 산출물과 WBS를, AX-DataLake는 Kafka 실시간 수집을 더했다. 그 전 판들은 지우지 않고 온라인 사이트에 보관한다(오프라인판에는 넣지 않는다).

| 영상 | 2026-11-01 짧은 판(용어 한글화 직후) | 2026-10-31 판(화면에 SR·KB·SLA) |
|---|---|---|
| 전체 투어 | [tour.mp4](https://malburi.github.io/hnix-ax-site/video/2026-11-01/tour.mp4) | [tour.mp4](https://malburi.github.io/hnix-ax-site/video/2026-10-31/tour.mp4) |
| AX Platform | [platform.mp4](https://malburi.github.io/hnix-ax-site/video/2026-11-01/platform.mp4) | [platform.mp4](https://malburi.github.io/hnix-ax-site/video/2026-10-31/platform.mp4) |
| PMS-X | [pmsx.mp4](https://malburi.github.io/hnix-ax-site/video/2026-11-01/pmsx.mp4) | [pmsx.mp4](https://malburi.github.io/hnix-ax-site/video/2026-10-31/pmsx.mp4) |
| AX-NAVI IDE | [axnavi.mp4](https://malburi.github.io/hnix-ax-site/video/2026-11-01/axnavi.mp4) | [axnavi.mp4](https://malburi.github.io/hnix-ax-site/video/2026-10-31/axnavi.mp4) |
| AX-DataLake | [datalake.mp4](https://malburi.github.io/hnix-ax-site/video/2026-11-01/datalake.mp4) | [datalake.mp4](https://malburi.github.io/hnix-ax-site/video/2026-10-31/datalake.mp4) |

## 영상 다시 만들기

제품을 고친 뒤 영상을 새로 찍는 방법이다. 바꾸기 전 영상은 `video/<날짜>/`로 옮겨 두고 찍는다. E2E 환경을 띄운 상태에서 이 저장소의 `tools/`로 한다.

```powershell
node tools/demo-prep.mjs                         # 시연 데이터 준비(현업 창구·Process Studio·퀴즈·Kafka 토픽)
node tools/record-demo.mjs --scenario all        # video/platform·pmsx·axnavi·datalake.mp4
node tools/make-tour.mjs                         # video/tour.mp4 + 포스터
node tools/record-demo.mjs --scenario pmsx --dry # 녹화 없이 시나리오만 돌려 보기
```

- 녹화는 헤드리스 Edge(AX-NAVI는 IDE를 임시 프로필로 한 번 더 띄워)에 DevTools로 붙어, 화면이 바뀔 때마다 장면을 받아 ffmpeg로 MP4를 만든다. 사용자의 브라우저·IDE 설정은 건드리지 않는다.
- 시나리오(누를 곳·자막)는 `tools/demo-scenarios.mjs`에 있다. 글자로 버튼을 찾기 때문에 화면 문구가 바뀌면 시나리오도 고친다.
- AX-NAVI 시나리오는 연습 저장소의 파일을 실제로 고치므로, 녹화가 끝나면 원래 내용으로 되돌린다. 에이전트가 명령을 실행하려 하면 연습 저장소의 AX-NAVI 스크립트일 때만 승인하고 그 밖은 거절한다.
- **Kafka 실시간 장면** — 녹화 PC에 Kafka 브로커(`localhost:9092`, KRaft 단일 노드)가 떠 있어야 한다. Kafka 4.x는 JDK 17 이상이 필요하다(JDK 11에서는 클래스 버전 오류로 안 뜬다). `demo-prep.mjs`는 매번 새 이름의 경보 토픽(`ito.monitoring.alerts.<시각>`, 파티션 3)을 만들고 지난 `monitoring-alerts` 스트림과 `ops.alert_events` 테이블을 지운다 — 스트림은 녹화 중에 화면에서 새로 만든다. Windows의 Kafka는 토픽을 지우면 브로커가 멈추므로 토픽은 지우지 않고 새 이름을 쓴다. 녹화하는 동안 시나리오가 `demo-kafka-producer.mjs`(초당 8건)를 띄우고 끝나면 끈다. AX-DataLake 영상을 다시 찍을 때마다 `demo-prep.mjs`를 먼저 돌린다.
- **모델이 답하는 장면** — 채팅·현업 창구·에이전트·AI 분류 추천·AI 질문은 사내 로컬 모델이 녹화 중에 실제로 답한다. 작은 모델이라 답이 매번 조금씩 다르다. Process Studio는 한 문서에 2~3분 걸리고 가끔 To-Be가 비어 나오므로 `demo-prep.mjs`가 To-Be까지 나온 분석 하나를 미리 만들어 둔다(최대 4번 시도).
