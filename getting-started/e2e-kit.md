# 회사 PC에서 따라 하기 — E2E 꾸러미

네 제품을 다른 PC(회사 PC)에 띄워 [장애 한 건](/getting-started/scenario.md)을 끝까지 점검한다. 꾸러미 하나에 실행에 필요한 것이 다 들어 있어 **Node·Java·npm 설치나 저장소 접근이 필요 없다.** 관리자 권한도 필요 없다.

<figure><img src="img/hnix-ax-e2e-flow.png" alt="E2E 워크플로우 — 모니터링·고객, PMS-X, AX Platform, 개발자, 모델 레인의 ①~⑨"><figcaption>꾸러미가 점검하는 흐름 ①~⑨. 그림을 누르면 크게 보인다.</figcaption></figure>

## 받을 것

GitHub `Malburi/hnix-ax-platform` › Releases › **E2E 꾸러미 2026-10-30 (3판 — AX-DataLake)**(`e2e-kit-20261030-3`) (비공개 저장소 — 접근 권한으로 로그인). 모델 zip 두 개는 바뀌지 않아 `e2e-kit-20261028` 릴리스에 있다.

| 파일 | 크기 | 필요 |
|---|---|---|
| `hnix-ax-e2e-kit-<날짜>.zip` | 약 720MB | 필수 |
| `ollama-model-qwen2.5-3b.zip` | 약 1.8GB | 회사망에서 `ollama.com`이 막혀 있으면 |
| `ollama-model-nomic-embed-text-latest.zip` | 약 240MB | 위와 같음 |
| `SHA256SUMS.txt` | — | 받은 파일 확인(선택) |

꾸러미 안에 든 것:

| 구성 | 내용 |
|---|---|
| AX Platform 오프라인 패키지 | 서버 번들·웹·**Node 24 런타임** 포함 |
| AX-DataLake 0.1.1 설치본 | **Node·SQL 엔진·확장** 포함, 시연 테이블(장애·운영 인력)·가림·행 제한, 허브에 외부 MCP 서버로 등록 |
| PMS-X 1.3.0 오프라인 패키지 | **JRE 21** 포함, 시연 데이터(○○공사 인사시스템 SI·SM), 업무 템플릿·인수인계 퀴즈 |
| AX-NAVI IDE 1.0.4 | 사용자 폴더에 설치 |
| AX-NAVI CLI | 판정 엔진 — 실행에 필요한 의존성만 |
| Ollama CPU 판 | 약 120MB(GPU 라이브러리 뺌). 이미 설치된 Ollama가 있으면 그것을 쓴다 |
| 연습 저장소 | SQL 인젝션이 들어간 작은 Java DAO + 색인 |
| 스크립트·안내서 | `setup.ps1`·`start.ps1`·`stop.ps1`, 자동 점검 `scripts\smoke.mjs`, 경보 흉내 `scripts\send-alert.mjs`, `README.md`, 아키텍처 `architecture.drawio` |

## 필요한 것

| 항목 | 기준 |
|---|---|
| OS | Windows 10/11 64비트 |
| 메모리 | 16GB 권장(최소 12GB) — PMS-X 1GB, 사내 모델 약 2.5GB, AX-DataLake 약 1GB, IDE |
| 디스크 | 여유 8GB |
| Git for Windows | ⑦ 변경 리뷰에 필요 |

## 순서

```powershell
# 1) C:\hnix-ax-e2e 처럼 짧은 영문 경로에 꾸러미를 푼다. 모델 zip 은 꾸러미 폴더의 packages\ 에(풀지 않는다)
# 2) 꾸러미 폴더에서 — 처음 한 번
powershell -ExecutionPolicy Bypass -File setup.ps1
# 3) 새 PowerShell 창에서(사용자 PATH 적용) — 처음 3~5분
powershell -ExecutionPolicy Bypass -File start.ps1
# 4) 자동 점검 ①~⑲
node scripts\smoke.mjs
```

| 단계 | 하는 일 |
|---|---|
| `setup.ps1` | 플랫폼 패키지·Node·AX-NAVI CLI·Ollama를 `tools\`에, 연습 저장소를 `work\`에 풀고, 모델 zip을 `%USERPROFILE%\.ollama\models`에 넣고, AX-NAVI IDE를 설치하고, 사용자 PATH에 `tools\bin`·`tools\node`·`tools\ollama`를 넣는다 |
| `start.ps1` | Ollama → 플랫폼(:8710) → 게이트웨이·가상 키 → AX-DataLake(:8790 — 시연 테이블·거버넌스·허브 등록) → PMS-X 시연(:8080, AI 켬) → 허브(PMS-X·AX-NAVI 커넥터)·승인 정책·에이전트·문서 RAG → AX-NAVI IDE(허브 등록, Insight 전송, 사내 게이트웨이 연결) |
| `smoke.mjs` | 경보 묶음 → SR 분류 추천 → 에이전트 도구 호출 → 승인 1회·본인 승인 차단 → AI 설명 근거 등급 → 구현 명세 → 허브로 코드·SR 조회와 리뷰 STOP → KB 초안 → Insight(①~⑨), 이어서 트리거 → 현업 창구 → 런북 승인 → 커밋 ↔ SR → AX-NAVI 조직 설정(IDE 모드 포함) → 전사 AI 관측 → 업무 템플릿·인수인계 퀴즈 → 현장 연결 점검(⑩~⑰) → 허브 경유 레이크 조회(분석가 권한의 가림·행 제한 그대로) → AI 질문(사내 모델이 SQL 작성, 행 제한 적용)(⑱⑲). 2026-10-30 3판 기준 개발 PC 실측 20단계 통과 19·주의 1(작은 로컬 모델의 창구 답변)·실패 0 |

계정: 플랫폼 `admin` / `Admin!2026`, `dev1` / `Dev1!2026` · PMS-X `admin`·`op.seo`(운영자)·`customer` / `pmsx1234!` · AX-DataLake `admin` / `Lake!2026`, `eng`(엔지니어)·`ana01`(분석가, 소속 HD01) — 같은 비밀번호

화면에서 직접 따라 하는 ①~⑨는 꾸러미의 `README.md`에 있다(이 사이트의 [장애 한 건 따라가기](/getting-started/scenario.md)와 같은 흐름).

## AX-NAVI IDE 채팅 — 두 가지 연결

| 연결 | 준비 | 품질 |
|---|---|---|
| **사내 게이트웨이 → 로컬 모델** (기본) | 따로 할 것 없음 — `start.ps1`이 IDE에 연결을 넣어 연다 | 바로 되지만 작은 CPU 모델이라 답이 단순 |
| **Claude 구독** | 회사 정책이 허용할 때만 — Claude Code를 설치하고 `claude`로 로그인 | 좋음. 로그인돼 있으면 IDE가 구독을 먼저 고른다 |

[Claude 연결](/getting-started/connect.md)의 경로 규칙이 그대로 적용된다.

## 자주 막히는 곳

| 증상 | 확인 |
|---|---|
| "이 시스템에서 스크립트를 실행할 수 없으므로…" | `powershell -ExecutionPolicy Bypass -File …` 형태로 실행 |
| zip·실행 파일이 막힘(백신·SmartScreen) | 파일 속성 › 차단 해제, `Unblock-File`. 백신이 `node.exe`·`ollama.exe`를 막으면 보안 담당에 예외 요청 |
| 모델 받기 실패 | 회사망이 ollama.com을 막은 것 — 모델 zip 두 개를 `packages\`에 넣고 `setup.ps1` 다시 |
| 포트 충돌 | 꾸러미의 `e2e.config.json`에서 `platform.url`(8710)·`pmsx.url`(8080) 포트를 바꾼다 |
| 답이 느리거나 엉뚱 | 3B CPU 모델이라 그렇다 — 사내 GPU 모델 서버가 있으면 `ollama.url`·`chatModel`을 바꾸고 `start.ps1 -Fresh` |

점검은 모두 `127.0.0.1` 안에서 돈다. 밖으로 나가는 것은 Claude 구독(선택)과, 모델 zip 없이 `ollama pull`할 때뿐이다.

## 꾸러미 만들기(개발 PC)

```bash
node e2e/tools/build-kit.mjs     # 플랫폼 저장소에서 → dist/e2e-kit/
```

플랫폼 오프라인 패키지를 새로 만들고(마지막 커밋보다 오래됐으면), PMS-X·AX-NAVI IDE·AX-NAVI CLI·Ollama CPU 판·연습 저장소를 묶은 뒤 모델 zip과 `SHA256SUMS.txt`를 만든다. 자세한 내용은 플랫폼 저장소의 `e2e/README.md`.
