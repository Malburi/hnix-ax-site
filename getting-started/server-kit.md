# 회사 서버에 설치하기 — 서버판 꾸러미

회사 서버 한 대에 네 제품을 설치하고 서로 잇는다. 여러 사람이 각자 PC에서 브라우저와 AX-NAVI IDE로 접속해 함께 시험한다. 혼자 PC 한 대로 시연만 볼 때는 [회사 PC 꾸러미](/getting-started/e2e-kit.md)를 쓴다.

```
[사용자 PC]                           [중앙 서버 1대 — 서버판 꾸러미]
 브라우저 ─────────────────────────▶  AX Platform  :8700  게이트웨이 · MCP 허브 · 에이전트 · Insight
 개발자: AX-NAVI IDE + CLI ────────▶  PMS-X        :8080  SR · As-Is 분석 · SM (시연 데이터)
   (client 꾸러미로 연결,              AX-DataLake  :8790  레이크 · 온톨로지 · 거버넌스
    Claude 구독은 각자 로그인)         사내 모델     :11434 Ollama — 서버 안에서만
```

## 받을 것

GitHub `Malburi/hnix-ax-platform` › Releases › **서버판 꾸러미 2026-10-31**(`server-kit-20261031`) (비공개 저장소).

| 파일 | 크기 | 어디에 |
|---|---|---|
| `hnix-ax-server-kit-<날짜>.zip` | 약 450MB | 서버 |
| `ollama-model-qwen2.5-3b.zip` · `ollama-model-nomic-embed-text-latest.zip` | 약 1.8GB · 240MB | 서버 `packages\`에 풀지 않고 넣는다(`e2e-kit-20261028` 릴리스) |
| `hnix-ax-client-<날짜>.zip` | 약 420MB | 개발자 PC마다 |

| 서버 꾸러미 안 | 내용 |
|---|---|
| 설치본 셋 | AX Platform(Node 포함) · AX-DataLake 0.2.0(Node·SQL 엔진 포함) · PMS-X 1.3.1(JRE 21, 시연 데이터) |
| 사내 모델 | Ollama CPU 판 — 임베딩(문서 RAG)과 CPU 대화 모델 |
| AX-NAVI CLI · 연습 저장소 | 허브의 `axnavi__` 도구와 자동 점검용 |
| `server.ps1` · `server.config.json` | 설치·시작·멈춤·상태·내리기, 설정 하나 |
| `scripts\` | 제품 잇기(시드)와 자동 점검 21단계 |

## 서버 준비

| 항목 | 기준 |
|---|---|
| OS | Windows Server 2019 이상(또는 Windows 10/11 64비트) |
| 메모리 | 32GB 권장, 최소 16GB |
| 디스크 | 여유 100GB 권장(최소 20GB) |
| 네트워크 | 사용자 PC → 서버 8700·8080·8790 |
| 권한 | 관리자 PowerShell(서비스 등록·방화벽) |

## 설치

```powershell
# 1) D:\hnix-ax-server 처럼 짧은 영문 경로에 푼다 — 이 폴더가 곧 설치 위치다
# 2) 모델 zip 두 개를 packages\ 에 넣는다
# 3) server.config.json — 주소·포트·비밀번호(비워 두면 만들어 적는다)·모델
# 4) 관리자 PowerShell
powershell -ExecutionPolicy Bypass -File server.ps1 install
```

| 순서 | 하는 일 |
|---|---|
| 1 | 패키지를 `apps\`·`tools\`·`work\`에 푼다 |
| 2 | 사내 모델 — Ollama를 Windows 서비스로(127.0.0.1에서만), 모델 넣기 |
| 3 | AX Platform — `0.0.0.0`·`publicUrl`·매일 백업·런북, 서비스, 관리자·점검용 계정 |
| 4 | 게이트웨이 — 모델 별칭 `hnix-local`·`hnix-smart`·`hnix-embed`, 제품끼리 쓰는 가상 키 |
| 5 | AX-DataLake — 서비스, AI 질문은 플랫폼 게이트웨이로, 시연 테이블·ITO 온톨로지·거버넌스, 허브 등록 |
| 6 | PMS-X — 서비스(시연 프로필), AI 보조는 게이트웨이로 |
| 7 | MCP 허브 — PMS-X·AX-NAVI·레이크 도구, 승인 정책, 에이전트, 문서 RAG |
| 8 | Windows 방화벽 — 세 포트 인바운드 허용(도메인·개인 네트워크) |

다시 돌려도 된다 — 있는 것은 그대로, 빠진 것만 채운다. 끝나면 `관리 › 현장 연결 점검`에서 '연결 시험 포함 점검'으로 확인한다([고객사 설치와 연결 점검](/getting-started/onsite.md)과 같은 화면).

**모델** — CPU의 3B 모델은 흐름 확인용이다. 품질까지 보려면 `server.config.json`의 `model.gpu`에 사내 GPU 모델 서버(OpenAI 호환, [GPU 모델 서버](/platform/eval.md))를 넣거나, 설치 전에 환경 변수 `ANTHROPIC_API_KEY`로 조직 API 키를 준다. 기밀 등급 데이터는 어느 경우든 게이트웨이가 사내 모델로만 보낸다.

## 사용자·권한

| | 하는 법 |
|---|---|
| 접속 대역 | `server.config.json`의 `allowedSubnets`(예 `["10.20.30.0/24"]`)에 적고 `server.ps1 install`을 다시 — Windows 방화벽이 그 대역만 허용한다. 비우면 사내망 어디서나 |
| 사용자 등록 | 엑셀 명단(아이디·이름·소속·제품별 역할) 하나로 `server.ps1 users -Csv users.csv` — 세 제품 계정과 PMS-X 프로젝트 멤버를 한 번에 만든다. 틀린 칸이 있으면 아무것도 만들지 않고 고칠 곳을 알려 주고, 이미 있는 계정은 건드리지 않는다 |
| 첫 비밀번호 | 비워 두면 만들어 서버의 결과 파일에만 적는다. 각자 첫 로그인 뒤 바꾼다 — 플랫폼·AX-DataLake는 오른쪽 위 '비밀번호 바꾸기', PMS-X는 이름 › '비밀번호 변경'. 바꾸면 다른 PC의 로그인은 끊긴다 |
| 사내 계정 | 플랫폼은 AD(LDAP)·SSO(OIDC) — 첫 로그인 때 계정이 생긴다. PMS-X는 AD 로그인을 쓰되 계정을 먼저 등록한다. AX-DataLake는 로컬 계정만 |

| 제품 | 역할 |
|---|---|
| AX Platform | 관리자 · 감사자(보기만) · 사용자 |
| PMS-X | 프로젝트마다 PM · PL · 분석가 · 개발자 · 품질 · 운영자 · 고객 · 협력사 — 멤버가 아니면 그 프로젝트가 안 보인다 |
| AX-DataLake | 관리자 · 엔지니어(수집·작업) · 분석가(조회만, 소속 행만, 개인정보 가림) |

허브의 PMS-X 도구는 서비스 계정 권한으로 읽는다(읽기 전용, 호출 기록·승인은 부른 사람 이름으로). 시연 데이터로 시험할 때는 괜찮지만, 실제 고객 데이터를 붙이기 전에는 부른 사람의 PMS-X 권한으로 읽게 바꿔야 한다.

## 개발자 PC 잇기

```powershell
# client 꾸러미 폴더에서 — 관리자 권한 불필요
powershell -ExecutionPolicy Bypass -File connect-client.ps1 -Server http://<서버>:8700
```

AX-NAVI IDE·CLI를 설치하고, 본인 플랫폼 계정으로 로그인해 **본인 키 3개**(사용량 수집·게이트웨이·MCP 허브)를 받는다. 받은 키는 사용자 환경 변수와 IDE MCP 설정(`hnix-ax`)에 넣고, AX-NAVI 조직 설정도 받는다. 키 원문은 화면에 찍지 않는다. 사용량·도구 호출은 키 주인의 권한과 예산으로 기록된다. Claude 구독이 있으면 IDE에서 각자 로그인한다([Claude 연결](/getting-started/connect.md)).

`-Check`를 붙이면 서버 응답과 로그인만 확인하고 아무것도 바꾸지 않는다.

## 운영

```powershell
server.ps1 status       # 서비스·응답·접속 주소
server.ps1 stop | start
server.ps1 uninstall    # 서비스·방화벽 규칙 내림(데이터는 남김, -RemoveData 로 다 지움)
tools\node\node.exe scripts\smoke.mjs   # 자동 점검 21단계 — 시험 기록이 서버에 남는다
```

- PMS-X 시연 계정(`admin`·`op.seo`·`customer` 등)은 비밀번호가 알려져 있다. 사내망에 열면 바꾼다. `admin`·`op.seo`(허브가 PMS-X를 읽는 서비스 계정)를 바꿨으면 `server.config.json`의 `pmsx.adminPassword`·`serviceAccountPassword`에도 적고 `install`을 다시 돌린다.
- 사내 AD 로그인은 플랫폼 `auth.ldap`([설치와 운영](/platform/operations.md)).
- 관리자 권한 없이 시험만 하려면 `server.ps1 install -NoService`. 지금 로그인한 사용자로 띄우고 방화벽은 열지 않는다.

## 확인한 것

2026-10-31 개발 PC에서 `-NoService` 모드로 꾸러미를 새 폴더에 풀어 설치했다. 다른 PC가 여는 주소(LAN IP)로 세 제품 로그인·주요 화면을 확인했고, 꾸러미 안 자동 점검은 21단계 통과 20·주의 1(작은 로컬 모델의 창구 답변)·실패 0이었다. 현장 연결 점검은 문제 0이었다. 개발자 PC 연결(`connect-client.ps1`)은 별도 프로필로 돌려 보았다. 내 권한으로 쓸 수 있는 허브 도구 50개, `axnavi doctor`의 Insight·게이트웨이 경로, 게이트웨이 대화까지 확인했다. 사용자 일괄 등록은 틀린 명단(아무것도 안 만들고 고칠 곳 5군데 표시)·확인만(-Dry)·실제·엑셀 기본 저장(CP949)·다시 돌리기(있음)로 시험했고, 만든 계정이 세 제품에서 역할·PMS-X 프로젝트·레이크 소속 행 제한대로 동작하고 각자 비밀번호를 바꿀 수 있는 것을 확인했다. **Windows 서비스 등록과 방화벽 규칙(접속 대역 포함)은 관리자 권한이 없어 아직 실제로 돌려 보지 못했다** — 첫 설치 때 `server.ps1 status`로 확인한다.

## 꾸러미 만들기(개발 PC)

```bash
node e2e/tools/build-server-kit.mjs     # 플랫폼 저장소에서 → dist/server-kit/
```
