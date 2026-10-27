# 설치와 첫 사용

## 1. 설치

**AX-NAVI IDE** (Windows x64)

1. 배포 zip(`AX-NAVI-IDE-win32-x64-<버전>.zip`)을 풀고 `설치.cmd`를 더블클릭한다. 관리자 권한은 필요 없다.
2. 시작 메뉴에서 **AX-NAVI IDE**를 실행한다.

| 설치하면 | 위치 |
|---|---|
| 프로그램 | `%LOCALAPPDATA%\Programs\AX-NAVI IDE` |
| 바로가기 | 시작 메뉴, 바탕 화면 |
| 명령 | `axnavi-ide` (PATH에 추가) |
| 설정·확장 | `%USERPROFILE%\.axnavi-ide`, `%APPDATA%\AX-NAVI IDE` — VS Code와 따로 저장 |

설치 옵션은 PowerShell로 줄 수 있다.

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -InstallDir "D:\Tools\AX-NAVI IDE" -NoDesktopShortcut
# -NoPath  PATH에 넣지 않음   -NoKorean  한국어 언어 팩을 넣지 않음
```

제거는 "앱 및 기능"에서 하거나 설치 폴더의 `uninstall.ps1`을 실행한다. `-Purge`를 붙이면 사용자 데이터까지 지운다.

**쓰던 VS Code에 넣기**

```bash
code --install-extension axnavi-<버전>.vsix
```

IDE와 기능이 같다. 회사 표준 VS Code 설정과 확장을 그대로 두고 AX-NAVI만 더할 때 쓴다.

**판정 엔진(CLI)**

변경 리뷰, 보안 점검, 단계 게이트, 코드 인덱스는 AX-NAVI CLI가 계산한다. 한 번 설치해 둔다.

```bash
npm i -g axnavi          # 폐쇄망은 배포받은 tgz:  npm i -g axnavi-<버전>.tgz
```

PATH에 없는 곳에 두었다면 설정 `axnavi.cliPath`(실행 파일), `axnavi.cliRoot`(패키지 폴더)로 알려 준다.

## 2. AI 연결

채팅 에이전트가 쓸 Claude 연결을 고른다. 셋 중 가진 것 하나면 된다.

| 연결 | 준비 | 프로필 이름 | 과금 |
|---|---|---|---|
| **Claude 구독** (Pro · Max · Team · Enterprise) | 터미널에서 `claude`를 한 번 실행해 로그인 | `AX-NAVI 구독 (Claude Code)` | 본인 구독·좌석 |
| **API 키** | 환경 변수 `ANTHROPIC_API_KEY` | `AX-NAVI API 키 (Anthropic)` | 키 주인 |
| **사내 게이트웨이** | 명령 팔레트 → **AX-NAVI: AI 연결 설정** → 가상 키(`hx-…`) 입력 | `AX-NAVI 사내 게이트웨이` | 조직 (게이트웨이가 계량) |

- IDE를 처음 열면 가진 것을 찾아 프로필을 만들고 하나를 고른다. 순서는 **조직 선호 → 개발자 선호(`AXNAVI_AUTH`) → 구독 로그인 → API 키 → 게이트웨이**다.
- 조직 정책(`%ProgramData%\axnavi\policy.json`, 저장소 `.axnavi/policy.json`)이 허용하지 않는 연결은 만들지 않고, 있던 프로필도 지운다. 정책에 없는 연결로 작업을 시작하면 그 자리에서 멈추고 이유를 말한다.
- 구독 연결은 개발자 본인이 로그인한 `claude`를 언어 모델로만 부른다. 이때 API 키 환경 변수를 빼므로 의도와 다르게 종량제로 과금되지 않는다.
- 게이트웨이 키는 이 PC의 보안 저장소에만 저장된다.
- PC에서 돌리는 로컬 모델(Ollama, LM Studio 등 `localhost`)은 어느 경로에도 속하지 않아 정책과 관계없이 쓸 수 있다. 설정 화면에서 프로필을 직접 추가한다.

자세한 경로 규칙은 [Claude 연결](/getting-started/connect.md)에 있다.

## 3. 프로젝트 열고 색인

1. **파일 › 폴더 열기**로 저장소를 연다.
2. 명령 팔레트(`Ctrl+Shift+P`)에서 **AX-NAVI: 인덱스 만들기 (전수 색인)**를 실행한다. AI를 부르지 않고 스크립트로 화면 → 버튼 → 함수 → SQL → 테이블 지도를 만든다. 코드가 바뀌면 **인덱스 갱신 (변경분)**.
3. 처음 맡는 프로젝트라면 채팅에서 `/harness-init`을 실행한다. 색인에 더해 프로젝트 규칙(`CLAUDE.md`), 코드 패턴, 검증 리포트까지 만든다.

색인은 MCP 도구 `QueryIndex`로 에이전트에 자동으로 붙는다(설정 `axnavi.mcp.autoRegister`). 에이전트는 "이 테이블을 쓰는 화면" 같은 질문에 grep 대신 색인을 조회한다.

## 4. 채팅

채팅은 **오른쪽 보조 사이드바**에 있다. 폴더를 열면 기본으로 보이고, 닫았다면 **보기 › 모양 › 보조 사이드바**(`Ctrl+Alt+B`)로 다시 연다. 첫 화면에서는 마스코트 **나침이**가 인사하고, 최근 작업이 아래에 나온다. 입력창 아래에서 모드와 연결을 고른다.

| 모드 | 쓰는 때 |
|---|---|
| **Ask** | 읽기만 한다. "이 버튼을 누르면 어디까지 가나?" |
| **Architect** | 계획과 설계. 바꾸기 전에 범위와 단계를 정한다 |
| **Code** | 코드를 쓰고 고친다. 파일 수정은 diff로 보여 주고 승인받는다 |
| **Debug** | 오류 원인을 좁혀 간다 |
| **Orchestrator** | 큰 작업을 하위 작업으로 나눠 맡긴다 |

- `@`로 파일·폴더·문제 목록을 대화에 붙인다.
- 파일 수정, 터미널 명령, MCP 도구 호출은 실행 전에 승인을 받는다. 입력창 아래 auto-approve로 범위를 정할 수 있다.
- 작업마다 체크포인트가 남아 이전 상태로 되돌릴 수 있다.

## 5. 슬래시 명령 — AX-NAVI 스킬

입력창에서 `/`를 누르면 AX-NAVI 스킬 목록이 나온다. 스킬은 AX-NAVI CLI 설치 폴더에서 읽으므로 CLI를 올리면 함께 갱신된다.

<figure><img src="img/axnavi-ide-slash.png" alt="입력창에 /를 누르면 나오는 슬래시 명령 목록"><figcaption><code>/</code>를 누르면 AX-NAVI 스킬이 설명과 함께 나온다.</figcaption></figure>

| 하고 싶은 일 | 명령 |
|---|---|
| 처음 맡은 코드베이스 파악 | `/harness-init` — 색인, 프로젝트 규칙, 코드 패턴, 검증 리포트 |
| 기능 위치 찾기 | `/find` (`/find-feature`) |
| 흐름·로직 따라가기 | `/flow` (`/trace-logic`) — 진입점부터 DB까지 |
| 바꾸면 어디가 영향받나 | `/impact` (`/analyze-impact`) — 직간접 영향과 위험도 |
| 안전하게 고치기 | `/modify` (`/safe-modify`) — 사전 영향 분석 → 적용 → 사후 안전성 평가 |
| 작은 수정은 빠르게 | `/vibe` — 영향·안전성 게이트는 건너뛰고 패턴과 최소 검증만 |
| 새 기능 뼈대 | `/scaffold` (`/scaffold-feature`) — 프로젝트 컨벤션대로 Controller·Service·DAO·테스트 |
| SQL 리뷰 | `/sql` (`/review-sql`) — 사용처, 인덱스, N+1, 인젝션, 락 |
| 보안 점검 | `/security-scan` |
| 요구사항 명확화 | `/spec-gate` — 시작 전 목적·범위·제약 인터뷰 |
| 산출물 | `/sdlc-docs` |
| 위키 | `/wiki` (`/generate-wiki`), `/publish-wiki`, `/wiki-hub` |
| 마이그레이션 계획 | `/plan-migration` |
| 백엔드·프론트엔드 저장소가 나뉜 경우 | `/pair-init`으로 짝짓고 `/cross-repo-modify`, `/cross-repo-scaffold` |

괄호 안은 같은 스킬의 원래 이름이다. 짧은 이름이 별칭이다.

## 6. 설정

| 설정 | 기본값 | 뜻 |
|---|---|---|
| `axnavi.cliPath` | (비움) | CLI 실행 파일. 비우면 PATH의 `axnavi` |
| `axnavi.cliRoot` | (비움) | CLI 패키지 폴더(색인 도구 위치). 비우면 `axnavi` 옆에서 찾는다 |
| `axnavi.offline` | `true` | 폐쇄망 모드 — 시작할 때 공개 모델 목록을 받아 오지 않는다 |
| `axnavi.mcp.autoRegister` | `true` | 색인 도구를 에이전트 MCP 서버로 자동 등록 |
| `axnavi.gateway.baseUrl` | (비움) | 사내 게이트웨이 주소. 조직 정책에 있으면 그것이 우선 |
| `axnavi.gateway.model` | (비움) | 게이트웨이 모델 별칭 |
| `axnavi.insight.server` | (비움) | Insight 서버. 명령 **AX-NAVI: Insight 키 설정**의 키와 함께 있을 때만 작업 요약을 보낸다 |

명령 팔레트에서 `AX-NAVI`를 입력하면 모든 명령이 나온다. 환경이 이상하면 **AX-NAVI: 환경 점검 (doctor)**부터 실행한다.
