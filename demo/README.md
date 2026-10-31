# 시연 — 영상과 진행 순서

HNIX AX 네 제품이 실제로 도는 모습을 영상으로 담았다. 영상은 모두 **실제로 띄운 제품**(E2E 환경 — 플랫폼·PMS-X·AX-NAVI IDE·AX-DataLake를 한 PC에)을 조작하며 녹화했다. 꾸민 화면이나 목업이 아니다. 아래 자막은 녹화할 때 화면 위에 덧그린 설명이고, 주황 물결은 누른 곳이다.

## 전체 투어 — 10분

<video controls preload="metadata" poster="video/tour.jpg" src="video/tour.mp4" style="width:100%;border-radius:10px;background:#0f1d2b"></video>

제목 카드 → AX Platform → PMS-X → AX-NAVI IDE → AX-DataLake 순서다. 시연회 첫 화면에 틀어 두거나, 라이브 시연이 막혔을 때 이어서 보여 준다. 전체 흐름 그림은 [AI 생태계 워크플로우](/demo/ecosystem.md)에 있다.

## 제품별 영상

### AX Platform — 공통 AI 기반 (1분 40초)

<video controls preload="metadata" poster="video/platform.jpg" src="video/platform.mp4" style="width:100%;border-radius:10px"></video>

LLM 게이트웨이(가상 키·모델 별칭·개인정보 가명화·요청 로그) → MCP 허브(서버·정책·승인함·호출 기록) → 에이전트와 트리거 → 런북 → 현업 창구 → Insight → 현장 연결 점검.

### PMS-X — SM 운영 · AI 보조 · As-Is 분석 (1분 45초)

<video controls preload="metadata" poster="video/pmsx.jpg" src="video/pmsx.mp4" style="width:100%;border-radius:10px"></video>

SM 프로젝트로 바꾸고 → 경보로 자동 생성된 SR → 현업 SR 에서 **AI 분류 추천**(사내 모델이 실제로 답한다) → 장애 → As-Is 화면 분석(코드 순서도·통합 추적·한국어 설명) → KB → 인수인계 퀴즈.

### AX-NAVI IDE — 변경 리뷰 · AI로 수정 · 다시 리뷰 (5분)

<video controls preload="metadata" poster="video/axnavi.jpg" src="video/axnavi.mp4" style="width:100%;border-radius:10px"></video>

상태 표시줄의 변경 리뷰 → **STOP**(SQL 문자열 결합, 치명) → 지적 상세(OWASP A03·CWE-89·권장 조치) → **AX-NAVI 로 수정** → 에이전트가 파일을 읽고 고치는 동안 개발자가 읽기·저장을 승인 → 다시 리뷰하면 치명 지적이 사라지고 **HOLD**(중간 2건)로. 에이전트는 개발자 본인의 Claude 구독 로그인으로 돈다. 모델이 생각하는 동안 멈춘 화면은 영상에서 줄였다.

### AX-DataLake — 온톨로지 · 거버넌스 · 계보 (2분 10초)

<video controls preload="metadata" poster="video/datalake.jpg" src="video/datalake.mp4" style="width:100%;border-radius:10px"></video>

분석가로 들어가 인사 테이블이 가려진 것을 보고 → 객체 탐색에서 장애를 찾아 **직전 72시간 변경**을 SQL 없이 따라가고 → 관계 그래프(담당자 이름도 가림) → 진단 메모 → **진단 에이전트 요청**은 승인 대기 → 엔지니어가 승인하면 플랫폼 경보 진단 에이전트 웹훅으로(202) → 계보 → AI 질문.

## 시연회 진행 순서 — 30분

라이브로 할 때의 각본이다. 각 단계의 "보여 줄 것"은 위 영상의 같은 장면이다.

| 시간 | 단계 | 보여 줄 것 | 말할 것 |
|---|---|---|---|
| 0–3분 | 오프닝 | [생태계 그림 1쪽·2쪽](/demo/ecosystem.md) | 제품 넷이 한 기반을 쓴다. 사람은 판단·승인만, 찾고·모으고·기록하는 일은 에이전트와 제품이 |
| 3–7분 | ① 경보 → 장애·SR | PMS-X › 운영(SM) › SR 목록 · 장애 | 모니터링 웹훅이 장애·SR을 만든다. 같은 경보는 하나로 |
| 7–11분 | ② AI 분류·배정 | SR 상세 › AI 분류 추천 | 모델은 게이트웨이 뒤 사내 모델. 후보는 PMS-X가 좁히고, 반영은 사람이 |
| 11–16분 | ⑳ 원인 후보 | AX-DataLake › 객체 탐색 › 장애 › 직전 72시간 변경 · 관계 그래프 | 테이블이 아니라 업무 객체로. 분석가에게는 담당자 이름·전화가 가려진다 |
| 16–19분 | ④ 승인 | 진단 에이전트 요청 → 실행 요청(승인함) → 승인 · 플랫폼 › 에이전트 실행 기록 | 에이전트가 하자는 일은 사람이 승인한 뒤 한 번만. 요청자는 스스로 승인 못 한다 |
| 19–25분 | ⑦ 수정 · 리뷰 | AX-NAVI IDE › 변경 리뷰 STOP → AX-NAVI 로 수정 → 다시 리뷰 | 판정 엔진은 CI와 같다. 읽기·수정은 개발자가 승인. 구독 자격은 PC 밖으로 안 나간다 |
| 25–28분 | ⑧⑨ 지식 · 관측 | PMS-X › KB 초안 · 플랫폼 › Insight · AX-DataLake › 계보 | 종료 SR은 KB로, 모든 AI 사용은 주체별로, 데이터는 누가 어느 길로 읽었는지까지 |
| 28–30분 | 거버넌스 정리 | [생태계 그림 4쪽](/demo/ecosystem.md#_4-ai-거버넌스) | 통제 지점 넷 — 모델·도구·데이터·사용. 고객망 안 설치본 하나씩 |

### 라이브 시연 준비

1. 시연 PC에 [E2E 꾸러미](/getting-started/e2e-kit.md)를 풀고 `start.ps1 -Fresh`로 네 제품을 띄운다(처음 3~5분).
2. `node scripts\smoke.mjs`로 21단계 자동 점검을 돌려 모두 통과하는지 본다 — 통과하면 위 각본의 데이터가 모두 준비된 것이다.
3. 계정 — 플랫폼 `admin`·`dev1`, PMS-X `op.seo`(운영자), AX-DataLake `ana01`(분석가, 소속 HD01)·`eng`(엔지니어). 비밀번호는 꾸러미 README.
4. 브라우저 탭을 미리 연다 — 플랫폼 `:8710`, PMS-X `:8080`, AX-DataLake `:8790`. AX-NAVI IDE는 `start.ps1`이 연습 저장소로 띄운다.
5. 막히면 이 쪽의 영상으로 넘어간다. 영상은 오프라인판에도 들어 있다.

## 영상 다시 만들기

제품을 고친 뒤 영상을 새로 찍는 방법이다. E2E 환경을 띄운 상태에서 이 저장소의 `tools/`로 한다.

```powershell
node tools/record-demo.mjs --scenario all        # video/platform·pmsx·axnavi·datalake.mp4
node tools/make-tour.mjs                         # video/tour.mp4 + 포스터
node tools/record-demo.mjs --scenario pmsx --dry # 녹화 없이 시나리오만 돌려 보기
```

- 녹화는 헤드리스 Edge(AX-NAVI는 IDE를 임시 프로필로 한 번 더 띄워)에 DevTools로 붙어, 화면이 바뀔 때마다 장면을 받아 ffmpeg로 MP4를 만든다. 사용자의 브라우저·IDE 설정은 건드리지 않는다.
- 시나리오(누를 곳·자막)는 `tools/demo-scenarios.mjs`에 있다. 글자로 버튼을 찾기 때문에 화면 문구가 바뀌면 시나리오도 고친다.
- AX-NAVI 시나리오는 연습 저장소의 파일을 실제로 고치므로, 녹화가 끝나면 원래 내용으로 되돌린다. 에이전트가 명령을 실행하려 하면 연습 저장소의 AX-NAVI 스크립트일 때만 승인하고 그 밖은 거절한다.
