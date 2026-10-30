# 설치와 운영

AX-DataLake는 고객사 폐쇄망 설치를 전제로 만들었다. 설치본 하나에 실행에 필요한 것이 모두 들어 있어 인터넷·`npm install`·별도 DB 엔진 설치 없이 뜬다.

## 설치본

| 파일 | 대상 |
|---|---|
| `ax-datalake-<버전>-win-x64.zip` | Windows Server / Windows 10+ — WinSW 서비스 |
| `ax-datalake-<버전>-linux-x64.tar.gz` | Linux x64 — systemd 서비스(전용 사용자 `axdl`) |

| 들어 있는 것 | 비고 |
|---|---|
| Node 런타임 | nodejs.org 체크섬으로 검증한 판 |
| 서버 한 파일 · 웹 화면 | |
| SQL 엔진(네이티브) · 확장 | 테이블 형식 · 카탈로그(SQLite·PostgreSQL) · 원본 DB(MySQL·PostgreSQL) · S3 호환 저장소 · 엑셀 |
| 오라클 드라이버 | 순수 JS — 오라클 클라이언트 불필요 |
| 서비스 정의 · 설치 스크립트 | `install.ps1` · `install.sh`, `INSTALL.md` |
| `SHA256SUMS.txt` | 파일 무결성 확인 |

```powershell
# Windows — 관리자 PowerShell, 압축을 푼 폴더에서
powershell -ExecutionPolicy Bypass -File .\install.ps1 -AdminPassword '<관리자 비밀번호>'
```

```sh
# Linux
sudo ./install.sh --admin-password '<관리자 비밀번호>'
```

서비스 `ax-datalake` 가 등록되고 `http://서버:8790` 이 뜬다. Windows 설치본은 빌드 때 압축을 풀어 저장소 없이 관리자 생성 → 기동 → 테이블 만들기 → 조회 → 웹 화면까지 돌려 보는 **설치 리허설**을 거친다.

## 배치

| 규모 | 카탈로그 | 데이터 | 서버 |
|---|---|---|---|
| 시작(한 대) | SQLite(설치 폴더 `data`) | 로컬 디스크 | 1대 |
| 여러 대 | PostgreSQL | S3 호환 저장소(MinIO 등) 또는 NAS | 계산 노드 여러 대가 같은 레이크를 함께 쓴다 |

메모리는 엔진(수집·조회·작업)마다 상한을 정한다(`lake.memoryLimit`). 넘치는 계산은 임시 폴더로 흘려 처리한다.

## 설정 요점

| 항목 | 설정 |
|---|---|
| 포트·공개 주소 | `server.port` · `server.publicUrl`(https 면 로그인 쿠키에 Secure) |
| 카탈로그·데이터 위치 | `lake.catalog` · `lake.dataPath` · `lake.s3` |
| 조회 한도 | `query.maxRows`(기본 1만 행) · `query.timeoutSeconds` · `query.concurrency` |
| AI 질문 | `ai.gateway`(플랫폼 게이트웨이 주소·가상 키·모델 별칭) |
| 실시간·동기화 | `streams.enabled` · `syncs.scheduler` — 점검·복구 때 끈다(정의는 남는다) |
| 파일 정리 | `maintenance.hour`(기본 새벽 3시) · `retainDays`(시점 보관, 기본 30일) |

비밀번호는 설정 파일에 `${env:이름}` 으로 환경 변수에서 받는다.

## 파일 정리

매일 정한 시각에(관리자가 '지금 정리'로도):

1. 실시간·소량 적재가 카탈로그 안에 쌓아 둔 행을 Parquet 파일로 내보낸다.
2. 잘게 쪼개진 파일을 합친다.
3. 보관 기간이 지난 시점과 더 이상 쓰지 않는 파일을 지운다 — **지운 시점으로는 시점 조회가 안 된다.**

결과는 감사 기록에 남는다(내보낸 행·합친 파일·지운 시점·지운 파일).

## API 키

| 범위 | 쓰는 곳 |
|---|---|
| 조회 | BI 도구·스크립트 — `POST /api/v1/query` |
| 수집 | 로그 수집기·HTTP 스트림 — `POST /api/v1/streams/<id>/events` |
| 에이전트(MCP) | AX Platform 허브·Claude Code — `/mcp` |

키는 만든 사람의 권한(역할·소속·가림 규칙)으로 움직이고, 원문은 만들 때 한 번만 보인다. 정지한 사용자의 키는 바로 막힌다.

## 백업

서비스를 멈추고 설치 폴더의 `data/`(메타 DB·마스터 키·카탈로그·데이터 파일)를 통째로 복사한다. 카탈로그를 PostgreSQL·데이터를 S3 호환 저장소에 두었다면 그쪽 백업 정책을 따르고, `data/master.key` 는 반드시 따로 보관한다(잃으면 원본 DB 비밀번호 같은 시크릿을 되살릴 수 없다).
