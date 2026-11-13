# 설치 가이드 — 서버 PC

회사 서버 한 대에 **AX Platform · PMS-X · AX-DataLake · 사내 모델**을 설치하고 서로 잇는다. 설치 파일 하나(`HNIX-AX-Server-Setup-<날짜>.exe`)로 끝나고, 개발자 PC는 [개인 PC 설치 가이드](https://malburi.github.io/hnix-ax-site/#/getting-started/install-pc)대로 따로 깐다.

```
[개인 PC]                                [서버 PC — 이 가이드]
 브라우저 ───────────────────────────▶  AX Platform  :8700  게이트웨이 · MCP 허브 · 에이전트 · Insight
 AX-NAVI IDE(HNIX-AX-PC-Setup) ──────▶  PMS-X        :8080  서비스 요청 · As-Is 분석 · SM
   설치 → 로그인하면 연결 끝            AX-DataLake  :8790  레이크 · 온톨로지 · 거버넌스
                                         사내 모델     :11434 Ollama — 서버 안에서만
                                         PostgreSQL   :5432  세 제품의 DB — 서버 안에서만
```

## 1. 준비

| 항목 | 기준 |
|---|---|
| OS | Windows Server 2019 이상(또는 Windows 10/11 64비트) |
| 메모리 | 32GB 권장, 최소 16GB — PMS-X 2GB, 레이크 2GB, CPU 모델 약 2.5GB |
| 디스크 | 여유 100GB 권장(최소 20GB) |
| 네트워크 | 개인 PC → 서버 8700·8080·8790(포트는 설치 때 바꿀 수 있다). 사내 방화벽은 따로 연다 |
| 권한 | 관리자(서비스 등록·방화벽). 권한이 없으면 시험 실행으로만 깔 수 있다 |
| Git for Windows | 선택 — 자동 점검의 변경 리뷰 단계에 필요 |

받을 파일(GitHub `Malburi/hnix-ax-platform` › Releases)을 **한 폴더**에 둔다.

| 파일 | 크기 | 설명 |
|---|---|---|
| `HNIX-AX-Server-Setup-<날짜>.exe` | 약 790MB | 서버 설치 프로그램(코드 서명) |
| `ollama-model-qwen2.5-3b.zip` | 약 1.8GB | 사내 대화 모델(기본) — 설치 프로그램이 같은 폴더에서 찾아 넣는다 |
| `ollama-model-nomic-embed-text-latest.zip` | 약 260MB | 문서 검색(임베딩) 모델 |
| `ollama-model-qwen3.5-4b.zip.001` · `.002` | 약 3.2GB | **AX-NAVI IDE 를 사내 게이트웨이로 쓰면 필요** — IDE 에이전트용 코드 모델(`hnix-code`). 더 나은 한국어 대화 모델로도 쓴다(아래 4번) |
| `ollama-model-qwen3.5-2b.zip.001` · `.002` | 약 2.6GB | 선택 — 가벼운 대화 모델 |
| `SHA256SUMS.txt` | — | 받은 파일 확인(선택) |

## 2. 설치

1. `HNIX-AX-Server-Setup-<날짜>.exe` 를 실행한다. 관리자 권한을 묻는다.
   - **모든 사용자용(관리자)** — Windows 서비스(부팅 때 자동 시작)와 방화벽 규칙까지. 운영은 이쪽.
   - **현재 사용자만** — 서비스·방화벽 없이 지금 로그인한 사용자로 띄우는 시험 실행. 재부팅하면 다시 시작해야 한다.
2. **설치 위치** — 기본 `C:\HNIX-AX`. 짧은 영문 경로를 쓴다(안쪽 경로가 길어 260자 한도에 걸릴 수 있다). 이 폴더에 프로그램과 데이터가 함께 생긴다.
3. **접속 주소와 포트**

   | 칸 | 넣을 것 |
   |---|---|
   | 접속 주소 | 개인 PC 가 여는 이름이나 IP(예 `ax-test.corp.local`). 비우면 이 서버의 IP |
   | AX Platform · PMS-X · AX-DataLake 포트 | 기본 8700 · 8080 · 8790 |
   | 접속 허용 대역 | 선택. 예 `10.20.30.0/24`, 여러 개는 쉼표. 비우면 사내망 어디서나 |

   다시 설치하면 지난번 값이 채워져 있다.
4. **설치를 마치면 바로 서버 설치·시작**을 켜 둔 채 설치한다. 진행 창(검은 창)이 열려 아래 순서를 끝까지 돈다. 처음에는 10~20분 걸린다. 창을 닫지 않는다.

| 순서 | 하는 일 |
|---|---|
| 1 | 패키지를 `apps\`(제품)·`tools\`·`work\`에 푼다 |
| 2 | PostgreSQL 18 — 서비스 `hnix-ax-postgresql`(서버 안에서만, 비밀번호 인증), 제품마다 계정·DB, 매일 02:00 백업 예약 |
| 3 | 사내 모델 — Ollama 를 서비스로(서버 안에서만), 모델을 넣는다 |
| 4 | AX Platform — 서비스(DB `hnix_ax`), 관리자·점검용 계정 |
| 5 | 게이트웨이 — 모델 별칭 `hnix-local`·`hnix-smart`·`hnix-embed`, 제품끼리 쓰는 키 |
| 6 | AX-DataLake — 서비스(DB `axdl`·`axdl_lake`), 시연 테이블·온톨로지·거버넌스, 허브 등록 |
| 7 | PMS-X — 서비스(DB `pmsx`, 시연 데이터), AI 보조는 게이트웨이로 |
| 8 | MCP 허브 — PMS-X·AX-NAVI·레이크 도구, 승인 정책, 에이전트, 문서 RAG |
| 9 | Windows 방화벽 — 세 포트 인바운드 허용(PostgreSQL·Ollama 는 열지 않는다) |
| 10 | 개인 PC 설치 파일을 플랫폼 내려받기 폴더에 — 개발자는 '내 연결 설정'에서 받는다 |

DB 는 PostgreSQL 하나에 모은다 — 여러 사람이 동시에 써도 막히지 않고, 돌아가는 중에도 백업할 수 있다. PostgreSQL 은 설치 파일 안에 들어 있어 따로 받거나 깔 것이 없다. 계정 비밀번호는 설치가 만들어 `server.config.json` 의 `database` 에 적는다. 예전 판(제품마다 내장 DB 파일)으로 깔았던 서버는 데이터를 잃지 않도록 내장 DB 를 그대로 쓴다 — 바꾸려면 시험 데이터를 버리고 `server.ps1 uninstall -RemoveData` 뒤 다시 설치한다.

화면 없이 깔 때(배포 도구):

```powershell
HNIX-AX-Server-Setup-<날짜>.exe /VERYSILENT /ADDRESS=ax-test.corp.local /SUBNETS=10.20.30.0/24
# 포트를 바꾸면 /PLATFORMPORT=  /PMSXPORT=  /DATALAKEPORT=
```

## 3. 설치 확인

1. 설치 폴더의 `server.config.json` 을 연다 — `platform.admin` 에 관리자 아이디·비밀번호가 있다(처음 설치 때 만들어 적는다). 이 파일은 관리자·SYSTEM 만 읽게 잠근다.
2. 다른 PC 의 브라우저로 `http://<접속 주소>:8700` 에 관리자로 로그인한다.
3. **관리 › 현장 연결 점검** › '연결 시험 포함 점검' — 문제 0 이면 제품끼리 잘 이어진 것이다.
4. 서버에서 상태 보기:

```powershell
cd C:\HNIX-AX
powershell -ExecutionPolicy RemoteSigned -File server.ps1 status
tools\node\node.exe scripts\smoke.mjs     # 자동 점검 28단계(시험 기록이 서버에 남는다)
```

## 4. 처음 할 설정

| 할 일 | 어디서 |
|---|---|
| 관리자 비밀번호 바꾸기 | 플랫폼 오른쪽 위 **비밀번호 바꾸기** |
| PMS-X 시연 계정 비밀번호 바꾸기 | PMS-X 오른쪽 위 이름 › 비밀번호 변경. `admin`·`op.seo` 를 바꿨으면 `server.config.json` 의 `pmsx.adminPassword`·`serviceAccountPassword` 에도 적고 설치를 다시 돌린다 |
| 사용자 일괄 등록(세 제품) | `users.example.csv` 를 복사해 고친 뒤 `server.ps1 users -Csv users.csv -Dry` → 확인되면 `-Dry` 없이 |
| AX-NAVI 사용 허가(좌석) | 플랫폼 **AX-NAVI › 사용 허가**에서 IDE 를 쓸 사람에게 허가 |
| 사내 AD 로그인 | 플랫폼 설정 `auth.ldap`([설치와 운영](https://malburi.github.io/hnix-ax-site/#/platform/operations)) |

**대화 모델 고르기** — 사내망에서는 `ollama pull` 이 막혀 있으므로 모델은 릴리스의 `ollama-model-*` 파일로 넣는다. 2GB 가 넘는 모델은 `.zip.001`·`.002` 조각으로 나뉘어 있다. 조각을 **모두** 받아 설치 파일과 같은 폴더에 두면 설치가 이어 붙여 넣는다.

| 모델 | CPU 답 속도(짧은 답) | 메모리 | 쓰임 |
|---|---|---|---|
| `qwen2.5:3b`(기본) | 약 8초 | 약 2.5GB | 흐름 확인용. 자동 점검 28단계를 이 모델로 확인했다 |
| `qwen3.5:2b` | 약 13초 | 약 3GB | 가벼운 대안 |
| `qwen3.5:4b` | 약 18초 | 약 4GB | 한국어 답이 가장 자연스럽다. 메모리 32GB 서버 권장 |

바꾸려면 `server.config.json` 의 `model.chatModel` 을 `qwen3.5:4b`(또는 `qwen3.5:2b`)로 고치고 설치를 다시 돌린다(`server.ps1 install`). 게이트웨이 별칭 `hnix-local`·`hnix-smart` 의 사내 모델이 새 모델로 바뀐다. qwen3.5 는 원래 답하기 전에 '생각'을 길게 해서 CPU 에선 답이 빈다 — 게이트웨이가 사내 Ollama 의 qwen3 계열에는 생각을 꺼서 보낸다. 속도는 이 개발 PC(노트북 CPU) 기준이다.

**AX-NAVI IDE 용 모델(`hnix-code`)과 문맥 길이** — IDE 의 AI 에이전트는 매번 도구(파일 읽기·고치기·완료 등)를 불러야 하고, 지시문과 도구 설명만 1만 토큰이 넘는다. 그래서 서버 설치가 두 가지를 맞춘다.

- `model.codeModel`(기본 `qwen3.5:4b`) — 게이트웨이 별칭 `hnix-code` 를 만들고, IDE 가 로그인하면 이 별칭을 받는다(플랫폼 설정 `axnavi.gatewayModel`). 이 모델 파일이 없으면 `hnix-code` 는 대화 모델(`chatModel`)로 답하는데, `qwen2.5:3b` 는 IDE 에서 도구를 제대로 부르지 못해 채팅에 **'모델 응답 불완전'**이 뜬다. `ollama-model-qwen3.5-4b.zip.*` 를 꼭 함께 넣는다.
- `model.contextLength`(기본 `32768`) — 사내 Ollama 의 문맥 길이(`OLLAMA_CONTEXT_LENGTH`). Ollama 기본값(4096)이면 IDE 의 긴 지시문이 잘려 같은 증상이 난다. IDE 요청 한 번이 2만~2만 5천 토큰(지시문 + 도구 설명 — MCP 허브 도구가 많을수록 커진다)이라 **32768 아래로 줄이지 않는다**. 실측: 문맥 4096 이면 2만 2천 토큰 중 2천 토큰만 남아 엉뚱한 도구를 부르고, 32768 이면 `qwen2.5:3b`·`qwen3.5:4b` 모두 맞는 도구(read_file)를 불렀다.
  - Ollama 의 OpenAI 호환 주소는 요청마다 문맥 길이를 주어도 무시한다. 그래서 설치는 문맥을 박은 파생 모델(`qwen3.5:4b-ctx32k` 등 — 원본 가중치를 같이 써서 디스크는 늘지 않는다)을 만들어 `hnix-code` 가 그것을 부르게 한다. 서버에 **이미 다른 Ollama 가 떠 있어** `OLLAMA_CONTEXT_LENGTH` 를 못 바꾼 경우에도 그대로 맞는다.
- CPU 서버에서는 첫 질문에 긴 지시문을 읽느라 1~3분 걸릴 수 있다(같은 대화의 다음 질문은 앞부분을 다시 읽지 않아 빠르다). 여러 사람이 IDE 를 쓰면 GPU 서버(`model.gpu`)를 권장한다 — 있으면 `hnix-code` 도 GPU 모델을 먼저 쓴다.

### 음성 인식 모델 붙이기 (현업 창구에서 말로 묻기)

음성은 사내 음성 서버가 글로 바꾸고, 플랫폼 게이트웨이가 그 서버로 중계한다. 키·예산·데이터 등급·요청 기록이 대화 모델과 똑같이 걸리고, 사용량은 소리 길이(초)로 Insight 에 남는다.

1. 사내 음성 서버를 띄운다 — OpenAI 호환 `POST /v1/audio/transcriptions` 를 주는 서버면 된다. 예: faster-whisper 기반 서버, whisper.cpp 서버(`--inference-path /v1/audio/transcriptions`). 한국어는 `large-v3` 급 모델을 권한다(CPU 면 `small`·`medium` 도 쓸 만하다).
2. 플랫폼 **LLM 게이트웨이 › 프로바이더** 에 그 서버 주소를 **OpenAI 호환**, **사내 로컬** 로 등록한다(예: `http://10.0.0.20:8000/v1`).
3. **모델 별칭** 에서 종류 **음성 인식** 으로 별칭을 만든다(예: `hnix-stt` → 대상 모델 `large-v3`). 답 읽어 주기를 사내 음성 합성 서버로 하려면 같은 방법으로 종류 **음성 합성**(`/v1/audio/speech`) 별칭을 만든다. 없으면 브라우저 내장 음성으로 읽는다(Windows 한국어 음성은 인터넷 없이 동작).
4. **현업 창구 › 수정 › 음성** 에서 '말로 묻기'를 켜고 음성 인식 별칭을 고른다. 받은 글을 바로 보낼지, 답을 자동으로 읽을지도 여기서 정한다. 워크스페이스 채팅은 음성 인식 별칭이 하나라도 있으면 마이크가 나온다.

**브라우저는 HTTPS 주소에서만 마이크를 연다.** `http://<서버>:8700` 처럼 사내 HTTP 주소로 열면 마이크 단추가 그 이유를 안내하고 녹음하지 않는다. 다음 중 하나로 푼다.

- 플랫폼 앞에 사내 인증서로 HTTPS 를 붙인다(권장 — 리버스 프록시, `server.publicUrl` 도 `https://` 로).
- 브라우저 정책으로 이 주소를 안전한 출처로 본다 — Edge·Chrome 그룹 정책 `OverrideSecurityRestrictionsOnInsecureOrigin` 에 `http://<서버>:8700` 을 넣는다.
- 포털에 iframe 으로 넣었으면 iframe 에 `allow="microphone"` 을 함께 준다(포털 주소는 `security.frameAncestors` 에).

녹음 길이·파일 상한은 설정 `voice`(`recordSeconds` 기본 60초, `maxMb` 25, `maxSeconds` 300)로 바꾼다.

### 외부 에이전트 가져오기

다른 프레임워크로 만든 에이전트(A2A·LangGraph 서버·OpenAI 호환 채팅·일반 HTTP)는 **에이전트 › 외부 에이전트 가져오기** 로 등록한다. 흐름의 '에이전트 실행' 노드·에이전트 평가·MCP `agents__run`·A2A 재공개에서 다른 에이전트처럼 쓴다. 기본은 사내 주소만 부르고(사외 주소는 관리자만 허용), 링크 로컬(169.254.x)은 늘 막는다.

외부 에이전트가 모델을 직접 부르면 게이트웨이의 예산·개인정보 보호를 거치지 않는다. **외부 에이전트에는 게이트웨이 가상 키(내 키에서 발급)를 주고, 모델 주소를 `http://<서버>:8700/v1` 로 두게 한다.** 그래야 그 에이전트가 쓴 모델 사용량도 Insight 에 잡힌다.

## 5. 개인 PC 에 배포하기

개인 PC 에서는 스크립트를 돌리지 않는다. 각자 브라우저로 플랫폼에 로그인해 **내 연결 설정**에서 설치 파일을 받으면 된다([개인 PC 설치 가이드](https://malburi.github.io/hnix-ax-site/#/getting-started/install-pc)).

여러 PC 에 한꺼번에 깔 때(관리자):

```powershell
HNIX-AX-PC-Setup-<판>.exe /VERYSILENT /SERVER=http://<접속 주소>:8700             # 사용자별 설치
HNIX-AX-PC-Setup-<판>.exe /VERYSILENT /ALLUSERS /SERVER=http://<접속 주소>:8700   # PC 공용
```

주소와 허용할 AI 경로를 PC 마다 고정하려면 플랫폼 **내 연결 설정 › 관리자** 칸에서 만든 `policy.json` 을 `%ProgramData%\axnavi\policy.json` 에 배포한다.

## 6. 보안 프로그램·코드 서명

두 설치 파일과 그 안의 실행 파일·스크립트는 코드 서명되어 있다. 그래도 사내 보안 프로그램(백신·EDR·응용 프로그램 통제)이 막거나 지우면 보안 담당자에게 다음을 준다.

- `AX-NAVI-IDE-<판>-보안검토.md` — 설치 위치, 실행하는 프로세스, 통신 대상, 인증서 지문
- `AX-NAVI-IDE-<판>-hashes.csv` — 파일별 SHA-256·서명자

**게시자(코드 서명 인증서) 기준 예외**를 요청한다. 판이 바뀌어도 다시 등록하지 않는다. 회사가 직접 만든 인증서로 서명했다면 그 공개 인증서(`.cer`)를 그룹 정책으로 PC 의 '신뢰할 수 있는 루트 인증 기관'과 '신뢰할 수 있는 게시자'에 먼저 배포한다.

## 7. 운영

```powershell
cd C:\HNIX-AX
powershell -ExecutionPolicy RemoteSigned -File server.ps1 status      # 서비스·응답·접속 주소
powershell -ExecutionPolicy RemoteSigned -File server.ps1 stop        # 모두 멈춤
powershell -ExecutionPolicy RemoteSigned -File server.ps1 start       # 모두 시작(서비스는 부팅 때 자동, PostgreSQL 먼저)
powershell -ExecutionPolicy RemoteSigned -File server.ps1 backup      # DB 백업을 지금 한 번
```

| 확인 | 어디서 |
|---|---|
| 로그 | `apps\platform\hnix-ax-*\logs` · `apps\datalake\ax-datalake-*\logs` · `apps\pmsx\pmsx-*\logs` · `data\pgsql\log` |
| DB 백업 | `backups\postgresql\<날짜-시각>\` — 매일 02:00(예약 작업 'HNIX AX PostgreSQL 백업'), 최근 14개. 네 DB 의 `.dump`, 계정 `globals.sql`, 시크릿을 푸는 열쇠(`*.master.key`·`secrets.json`). 서버 밖 저장소로 한 번 더 복사하되 열쇠가 들어 있으니 DB 와 같은 수준으로 보관한다 |
| 파일 백업 | DB 에 들지 않는 파일 — PMS-X 첨부·캡처 `apps\pmsx\pmsx-*\data-demo`, 레이크 데이터 `apps\datalake\ax-datalake-*\data\lake`. 서비스를 멈추고 폴더째 복사 |
| 비밀번호·키 | `server.config.json`, `run\secrets.json` |

**DB 되살리기** — 그 제품의 서비스를 멈추고, 백업 폴더의 파일로:

```powershell
$env:PGPASSWORD = '<server.config.json 의 database.password>'
apps\pgsql\bin\pg_restore -h 127.0.0.1 -p 5432 -U postgres --clean --if-exists -d pmsx backups\postgresql\20261106-0200\pmsx.dump
```

서버를 새로 깔아 되살릴 때는 같은 백업의 `platform.master.key`·`datalake.master.key` 를 각 제품의 `data\master.key` 로 넣은 뒤 서비스를 시작한다.

**판 올리기** — 먼저 `server.ps1 backup`. 새 `HNIX-AX-Server-Setup` 을 같은 위치에 덮어 설치한다. `server.config.json` 과 DB(`data\pgsql`)는 그대로 둔다. 제품 판이 바뀌었으면 `server.ps1 stop` 뒤 옛 판 폴더의 파일 데이터(레이크 `data`, PMS-X `data-demo`)를 새 판 폴더로 옮기고 설치를 다시 돌린다. DB 구조는 제품이 새 판에서 스스로 올린다.

## 8. 제거

'앱 및 기능' › **HNIX AX 서버** › 제거 — 서비스·방화벽 규칙·백업 예약을 내리고 프로그램을 지운다. DB(`data\pgsql`)·제품 파일(`apps\*\data`)·백업(`backups`)·`server.config.json` 은 남긴다. 다 지우려면 제거 전에 `server.ps1 uninstall -RemoveData`(백업 폴더는 그래도 남는다).

## 9. 자주 막히는 곳

| 증상 | 확인 |
|---|---|
| 다른 PC 에서 안 열림 | 서버에서는 열리는가(`server.ps1 status`) → Windows 방화벽 규칙 `HNIX AX *` → 사내 방화벽·라우팅 → 개인 PC 의 프록시 예외 |
| 포트 사용 중 | 설치 프로그램을 다시 실행해 포트를 바꾼다. 5432 를 이미 다른 PostgreSQL 이 쓰면 `server.config.json` 의 `database.port` 를 바꾸고 `server.ps1 install` |
| 제품이 DB 에 못 붙음 | `server.ps1 status` 의 PostgreSQL 줄 → 서비스 `hnix-ax-postgresql` 실행 중인지 → `data\pgsql\log` |
| PMS-X 가 3분 넘게 안 뜸 | `apps\pmsx\pmsx-*\logs`, 메모리. 처음에는 시연 데이터를 채우느라 오래 걸린다 |
| IDE 채팅에 '모델 응답 불완전' | 사내 게이트웨이의 `hnix-code` 가 작은 모델(`qwen2.5:3b`)로 답하거나 문맥이 잘림 — 위 4번 'AX-NAVI IDE 용 모델'대로 `qwen3.5:4b` 파일을 넣고 `server.ps1 install` 을 다시. 게이트웨이 → 모델 별칭에서 `hnix-code` 대상이 `…-ctx32k` 인지 확인. 같은 답이 반복되면 AX-NAVI IDE 를 1.2.5 이상으로 |
| AI 답이 엉뚱함 | CPU 작은 모델의 한계 — `qwen3.5:4b`(위 4번), GPU 서버(`server.config.json` 의 `model.gpu`)나 조직 API 키 |
| 설치 중 '모델 … 을 풀지 못했습니다' | `.zip.001`·`.002` 조각 중 하나가 없거나 받다가 끊겼다 — `SHA256SUMS.txt` 와 대조해 다시 받는다 |
| '모델 … 이 없습니다 — 인터넷으로 받습니다' 뒤 멈춤 | `model.chatModel` 에 적은 모델의 `ollama-model-*` 파일이 설치 폴더 옆에 없다 |
| 설치 파일이 실행되자마자 지워짐 | 보안 프로그램 — 위 6번 |
| 마이크 단추가 'HTTP 주소에서는 마이크를 막습니다'라고 함 | HTTPS 로 열거나 브라우저 정책에 주소를 넣는다 — 위 4번 '음성 인식 모델 붙이기' |
| 말로 물었는데 '음성 인식 모델 별칭이 필요합니다' | 창구 음성 설정의 별칭 종류가 '음성 인식'인지, 프로바이더가 'OpenAI 호환'인지 |
| 외부 에이전트가 '사내 주소가 아닙니다'로 실패 | 주소가 사설 IP 로 풀리는지 확인. 사외 주소가 맞으면 관리자가 '사내 주소만 허용'을 끈다 |
| 진행 창에서 스크립트 실행이 막힘 | 그룹 정책이 '서명된 스크립트만'이면 서명 인증서를 신뢰 목록에 넣거나 보안 담당자와 실행 정책을 맞춘다 |
