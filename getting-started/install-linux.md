# 설치 가이드 — 리눅스 서버

회사 리눅스 서버 한 대에 **AX Platform · PMS-X · AX-DataLake · 사내 모델**을 설치하고 서로 잇는다. 꾸러미 파일 하나(`hnix-ax-server-linux-<날짜>.tar.gz`)를 서버에 풀고 명령 하나(`sudo ./server.sh install`)로 설치한다. 개발자 PC(Windows)는 [개인 PC 설치 가이드](/getting-started/install-pc.md)대로 따로 깐다. Windows 서버에 깔 때는 [설치 가이드 — 서버 PC](/getting-started/install-server.md).

> **시험판이다 — 아직 실제 리눅스 서버에서 설치 리허설을 하지 않았다.** 그래서 릴리스에도 아직 올리지 않았고, 시험할 서버가 정해지면 꾸러미를 따로 전달한다. 운영 서버가 아니라 시험 서버에 먼저 깔고, 막힌 곳은 이 문서의 12번과 설치 기록(`run/logs/install-*.log`)을 함께 전달한다.

```
[개인 PC]                                [리눅스 서버 — 이 가이드]
 브라우저 ───────────────────────────▶  AX Platform  :8700  게이트웨이 · MCP 허브 · 에이전트 · Insight
 AX-NAVI IDE(HNIX-AX-PC-Setup) ──────▶  PMS-X        :8080  서비스 요청 · As-Is 분석 · SM
   설치 → 로그인하면 연결 끝            AX-DataLake  :8790  레이크 · 온톨로지 · 거버넌스
                                         사내 모델     :11434 Ollama — 서버 안에서만
                                         PostgreSQL   :5432  세 제품의 DB — 서버 안에서만(또는 사내 DB 서버)
```

Windows 서버판과 다른 점은 셋이다.

| | Windows 서버판 | 리눅스 서버판 |
|---|---|---|
| 서비스 | Windows 서비스 | systemd 서비스(`hnix-ax` · `ax-datalake` · `pmsx` · `hnix-ax-ollama`), 전용 계정 `hnixax` 로 실행 |
| DB | PostgreSQL 18 을 꾸러미에 넣어 함께 설치 | 서버의 PostgreSQL(없으면 OS 패키지 저장소에서 설치) 또는 사내 DB 서버 |
| 방화벽 | Windows 방화벽 | firewalld(RHEL 계열) 또는 ufw(Ubuntu)가 켜져 있으면 연다 |

## 1. 준비 — 인프라 담당에게 받을 것

아래 표를 인프라 담당에게 그대로 보내 답을 받는다. 답에 따라 4번(설정)과 5번(DB)에서 고칠 값이 정해진다.

| 항목 | 요청 내용 | 기준 |
|---|---|---|
| 서버 | 리눅스 서버 1대 | x86_64. RHEL · Rocky · AlmaLinux 8/9, Ubuntu 22.04/24.04. systemd 필수 |
| 사양 | CPU · 메모리 · 디스크 | 메모리 32GB 권장(최소 16GB), 디스크 여유 100GB 권장(최소 20GB). CPU 는 많을수록 사내 모델 답이 빠르다 |
| 권한 | root 또는 sudo 계정 | 설치 · 서비스 등록 · 방화벽 · DB 준비에 필요 |
| 설치 위치 | `/opt/hnix-ax-server` 사용 허가 | 다른 곳이면 영문 경로. `/home`·`/root` 아래는 피한다(서비스 계정이 못 들어가거나 SELinux 가 막는다) |
| 포트 | 사내망 → 서버 8700 · 8080 · 8790(TCP) 허용 | 사용자 PC 대역을 알려 주면 그 대역만 열 수 있다. 5432 · 11434 는 열지 않는다 |
| DB | 아래 둘 중 하나 | ① 서버에 PostgreSQL 14 이상 설치(또는 설치 허용) ② 사내 DB 서버에 계정 · DB 생성(5번의 SQL 을 DBA 에게) |
| 패키지 저장소 | dnf · apt 가 닿는 저장소(사내 미러) | PostgreSQL 을 설치가 깔게 하려면 필요. 막혀 있으면 PostgreSQL 을 인프라가 미리 깐다 |
| 명령 | `tar` · `gzip` · `unzip`(또는 `python3`) · `psql` · `pg_dump` | 보통 들어 있다. `psql`·`pg_dump` 는 PostgreSQL 을 깔면 함께 생긴다 |
| 접속 주소 | 사용자가 칠 서버 이름(DNS) 또는 IP | 예 `ax-test.corp.local` |

## 2. 받을 파일

| 파일 | 크기 | 설명 |
|---|---|---|
| `hnix-ax-server-linux-<날짜>.tar.gz` | 약 860MB | 리눅스 서버 꾸러미 — 세 제품 · Java · Ollama · 설치 스크립트 · 개인 PC 설치 파일(시험판이라 따로 전달) |
| `SHA256SUMS.txt` | — | 받은 꾸러미 확인 |
| `ollama-model-qwen2.5-3b.zip` | 약 1.8GB | 사내 대화 모델(기본) — Windows 서버판 릴리스(`Malburi/hnix-ax-platform` › `server-kit-20261105`)의 것과 같다 |
| `ollama-model-nomic-embed-text-latest.zip` | 약 260MB | 문서 검색(임베딩) 모델 |
| `ollama-model-qwen3.5-4b.zip.001` · `.002` | 약 3.2GB | **AX-NAVI IDE 를 사내 게이트웨이로 쓰면 필요** — IDE 에이전트용 코드 모델(`hnix-code`) |
| `ollama-model-qwen3.5-2b.zip.001` · `.002` | 약 2.6GB | 선택 — 가벼운 대화 모델 |

## 3. 서버로 옮기고 풀기

**옮기기** — 내 PC 에서 서버로. WinSCP 같은 프로그램을 써도 되고, 명령으로는:

```powershell
# 내 PC(PowerShell)에서 — 받은 파일이 있는 폴더에서
scp hnix-ax-server-linux-*.tar.gz SHA256SUMS.txt ollama-model-* <계정>@<서버>:/tmp/
```

**확인하고 풀기** — 여기부터는 서버에서(ssh 로 접속):

```sh
cd /tmp
sha256sum -c SHA256SUMS.txt --ignore-missing        # '…: OK' 가 나와야 한다
sudo mkdir -p /opt
sudo tar -xzf hnix-ax-server-linux-*.tar.gz -C /opt  # → /opt/hnix-ax-server
sudo mv /tmp/ollama-model-* /opt/hnix-ax-server/packages/
cd /opt/hnix-ax-server
ls                                                  # server.sh · server.config.json · packages · …
```

## 4. 설정 — `server.config.json`

`sudo vi server.config.json`(또는 `sudo nano`)으로 연다. 비밀번호 칸은 **비워 둔다** — 처음 설치 때 만들어 이 파일에 적는다.

| 칸 | 넣을 것 |
|---|---|
| `address` | 사용자가 여는 서버 이름이나 IP(예 `ax-test.corp.local`). 비우면 서버의 첫 IP |
| `ports` | 기본 8700 · 8080 · 8790. 이미 쓰는 포트가 있으면 바꾼다 |
| `allowedSubnets` | 접속을 허용할 대역. 예 `["10.20.30.0/24"]`. 비우면 사내망 어디서나(방화벽이 켜져 있을 때만 적용) |
| `database` | 5번 |
| `model.chatModel` · `codeModel` | 넣은 모델 파일과 맞춘다(기본 `qwen2.5:3b` · `qwen3.5:4b`) |
| `pmsx.heap` | PMS-X 메모리. 기본 `2g` |

## 5. DB 고르기 — `database`

**① 이 서버의 PostgreSQL(기본, `"source": "system"`)**

- 서버에 PostgreSQL 이 없으면 설치가 OS 패키지 저장소에서 깐다(RHEL 계열은 16, Ubuntu 는 OS 기본판). 저장소에 닿지 않으면 인프라가 14 이상을 미리 깔고 `"autoInstall": false`.
- 설치가 하는 일: `postgres` 계정으로 제품 계정 셋 · DB 넷을 만들고, `pg_hba.conf` 맨 앞에 '제품 계정은 127.0.0.1 에서 비밀번호로 접속' 줄을 넣는다(표시 `# >>> hnix-ax-server` ~ `# <<< hnix-ax-server`). 다른 줄은 건드리지 않는다.
- 서비스 이름을 못 찾으면 `"systemService": "postgresql-16"` 처럼 적는다. 포트가 5432 가 아니면 `"port"` 를 맞춘다.

**② 사내 DB 서버(`"source": "external"`)**

```json
"database": {
  "source": "external",
  "host": "db01.corp.local",
  "port": 5432,
  "admin": { "user": "", "password": "" },
  "passwords": { "platform": "<hnix_ax 비밀번호>", "pmsx": "<pmsx 비밀번호>", "datalake": "<axdl 비밀번호>" }
}
```

- DBA 가 아래 SQL 로 미리 만들어 주고 비밀번호를 `passwords` 에 적는다. `admin` 은 비워 둔다.
- DBA 가 관리자 계정을 빌려주면 `admin` 에 적는다 — 그러면 설치가 계정 · DB 를 만든다(`passwords` 는 비워 두면 만들어 적는다).
- 이 서버에 `psql` · `pg_dump`(PostgreSQL 클라이언트, DB 서버와 같거나 높은 판)가 있어야 한다 — `sudo dnf install postgresql` 또는 `sudo apt install postgresql-client`.

DBA 에게 보낼 SQL:

```sql
SET password_encryption = 'scram-sha-256';
CREATE ROLE hnix_ax LOGIN PASSWORD '<비밀번호 1>';
CREATE ROLE pmsx    LOGIN PASSWORD '<비밀번호 2>';
CREATE ROLE axdl    LOGIN PASSWORD '<비밀번호 3>';
CREATE DATABASE hnix_ax   OWNER hnix_ax ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
CREATE DATABASE pmsx      OWNER pmsx    ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
CREATE DATABASE axdl      OWNER axdl    ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
CREATE DATABASE axdl_lake OWNER axdl    ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
-- pg_hba.conf: host  hnix_ax,pmsx,axdl,axdl_lake  hnix_ax,pmsx,axdl  <이 서버 IP>/32  scram-sha-256
```

## 6. 설치

```sh
cd /opt/hnix-ax-server
sudo ./server.sh install
```

처음에는 10~20분 걸린다(모델 파일 풀기 · PMS-X 시연 데이터 채우기가 오래 걸린다). 끝에 `준비됐습니다` 와 접속 주소가 나오면 성공이다. 화면에 나오는 순서:

| 순서 | 하는 일 |
|---|---|
| 준비물 확인 | OS · 메모리 · 디스크 · SELinux, 비워 둔 비밀번호 만들기, 서비스 계정 `hnixax` |
| 패키지 풀기 | `apps/`(제품 · Java · Ollama) · `tools/`(Node · AX-NAVI CLI) · `work/`(연습 저장소) |
| PostgreSQL | 5번대로 계정 · DB, 매일 02:00 백업 예약(`hnix-ax-backup.timer`) |
| 사내 모델 | 서비스 `hnix-ax-ollama`(127.0.0.1 에서만), 모델 zip 넣기 |
| AX Platform | 서비스 `hnix-ax`, 관리자 · 점검용 계정, 게이트웨이 모델 별칭 · 제품 연결 키 |
| AX-DataLake | 서비스 `ax-datalake`, 시연 테이블 · 온톨로지(처음 한 번), 플랫폼 문서 검색에 레이크 문서 연결 |
| PMS-X | 서비스 `pmsx`(시연 데이터 · AI 보조 켬) |
| MCP 허브 | PMS-X · AX-NAVI · 레이크 도구, 승인 정책, 에이전트, 문서 RAG |
| 방화벽 | firewalld 또는 ufw 가 켜져 있으면 세 포트(`allowedSubnets` 가 있으면 그 대역만). 둘 다 꺼져 있으면 안내만 한다 |
| 판 확인 | 포트마다 실제로 도는 판이 설치한 판인지 |

실패하면 `실패 — <원인>` 과 기록 파일 위치가 나온다. 원인을 고치고 `sudo ./server.sh install` 을 다시 돌리면 된 것은 건너뛰고 이어서 한다. 끝날 때 숫자(종료 코드)는 `echo $?` 로 본다 — 0 정상 · 1 설치 실패 · 2 판 올리기 실패(옛 판으로 되돌림) · 3 실행 중인 판이 설치한 판과 다름 · 4 되돌리기까지 실패.

## 7. 설치 확인

1. 관리자 비밀번호 보기 — `sudo grep -A2 '"admin"' server.config.json`(`platform.admin` 아래). 이 파일은 root 만 읽는다.
2. 내 PC 브라우저로 `http://<접속 주소>:8700` 에 관리자로 로그인한다.
3. **관리 › 현장 연결 점검** › '연결 시험 포함 점검' — 문제 0 이면 제품끼리 잘 이어진 것이다.
4. 서버에서:

```sh
sudo ./server.sh status                          # 서비스 · 응답 · 판 · DB · 백업 · 방화벽
sudo tools/node/bin/node scripts/smoke.mjs       # 자동 점검(시험 기록이 서버에 남는다)
```

## 8. 처음 할 설정

| 할 일 | 어디서 |
|---|---|
| 관리자 비밀번호 바꾸기 | 플랫폼 오른쪽 위 **비밀번호 바꾸기** |
| PMS-X 시연 계정 비밀번호 바꾸기 | PMS-X 오른쪽 위 이름 › 비밀번호 변경. `admin`·`op.seo` 를 바꿨으면 `server.config.json` 의 `pmsx.adminPassword`·`serviceAccountPassword` 에도 적고 `sudo ./server.sh install` |
| 사용자 일괄 등록(세 제품) | `cp users.example.csv users.csv` 로 복사해 고친 뒤 `sudo ./server.sh users --csv users.csv --dry` → 확인되면 `--dry` 없이 |
| AX-NAVI 사용 허가(좌석) | 플랫폼 **AX-NAVI › 사용 허가** |
| 사내 AD 로그인 | 플랫폼 설정 `auth.ldap` — `apps/platform/hnix-ax-*/config/hnix-ax.local.yaml` 에 적는다(설치가 지우지 않는다) |
| 대화 모델 바꾸기 | `model.chatModel` 을 고치고(`qwen3.5:4b` 등) 모델 파일을 `packages/` 에 넣은 뒤 `sudo ./server.sh install` |

**AX-NAVI IDE 용 모델** — IDE 의 AI 에이전트는 지시문과 도구 설명이 길어 `model.codeModel`(기본 `qwen3.5:4b`) 파일이 있어야 제대로 돈다. 없으면 IDE 채팅에 '모델 응답 불완전'이 뜬다. `model.contextLength` 는 32768 아래로 줄이지 않는다. 여러 사람이 IDE 를 쓰면 GPU 서버(`model.gpu`)를 권한다.

**https** — 접속은 http 다. 사내 인증서가 있으면 앞에 nginx 같은 프록시를 두고 https 로 열고, `address` 와 플랫폼 설정 `server.publicUrl` 을 https 주소로 맞춘다. 현업 창구의 '말로 묻기'(마이크)는 https 에서만 된다.

## 9. 개인 PC 에 배포하기

개인 PC 에서는 스크립트를 돌리지 않는다. 각자 브라우저로 플랫폼에 로그인해 **내 연결 설정**에서 설치 파일을 받는다(설치 파일은 꾸러미에 들어 있어 서버가 나눠 준다). 여러 PC 에 한꺼번에 깔 때:

```powershell
HNIX-AX-PC-Setup-<판>.exe /VERYSILENT /SERVER=http://<접속 주소>:8700             # 사용자별 설치
HNIX-AX-PC-Setup-<판>.exe /VERYSILENT /ALLUSERS /SERVER=http://<접속 주소>:8700   # PC 공용
```

## 10. 운영

```sh
cd /opt/hnix-ax-server
sudo ./server.sh status      # 서비스 · 응답 · 판
sudo ./server.sh stop        # 모두 멈춤(PostgreSQL 은 그대로)
sudo ./server.sh start       # 모두 시작 — 서비스라 재부팅하면 저절로 뜬다
sudo ./server.sh backup      # DB 백업을 지금 한 번
```

| 확인 | 어디서 |
|---|---|
| 로그 | `journalctl -u hnix-ax -n 100` (`ax-datalake` · `pmsx` · `hnix-ax-ollama` 도 같은 방법), 실시간은 `-f`. 제품 자체 로그는 `apps/*/*/logs` |
| 설치 기록 | `run/logs/install-<날짜-시각>.log` (비밀번호는 가려 적는다) |
| DB 백업 | `backups/postgresql/<날짜-시각>/` — 매일 02:00, 최근 14개. 네 DB 의 `.dump`, 시크릿을 푸는 열쇠(`*.master.key` · `secrets.json`). 서버 밖에 한 번 더 복사하되 열쇠가 들어 있으니 DB 와 같은 수준으로 보관한다. 예약 확인 `systemctl list-timers hnix-ax-backup.timer` |
| 파일 백업 | DB 에 들지 않는 것 — PMS-X 첨부 · 캡처 `apps/pmsx/pmsx-*/data*`, 레이크 데이터 `data/datalake`. 멈추고 폴더째 복사 |
| 비밀번호 · 키 | `server.config.json`, `run/secrets.json` (둘 다 root 만) |

**DB 되살리기** — `sudo ./server.sh stop` 뒤, 백업 폴더의 파일로(계정 비밀번호는 `server.config.json` 의 `database.passwords`):

```sh
PGPASSWORD='<pmsx 비밀번호>' pg_restore -h 127.0.0.1 -U pmsx -d pmsx --clean --if-exists backups/postgresql/20261201-0200/pmsx.dump
# 계정 — hnix_ax.dump 는 hnix_ax, pmsx.dump 는 pmsx, axdl.dump · axdl_lake.dump 는 axdl
sudo ./server.sh start
```

서버를 새로 깔아 되살릴 때는 같은 백업의 `platform.master.key` 를 `apps/platform/hnix-ax-*/data/master.key` 로, `datalake.master.key` 를 `data/datalake/master.key` 로 넣은 뒤 시작한다.

**판 올리기** — 새 꾸러미를 **다른 곳에** 풀어 필요한 것만 옮긴다. `/opt` 에 그대로 덮어 풀면 `server.config.json`(비밀번호)이 처음 것으로 바뀌니 하지 않는다.

```sh
mkdir -p /tmp/new && tar -xzf hnix-ax-server-linux-<새 날짜>.tar.gz -C /tmp/new
cd /tmp/new/hnix-ax-server
sudo cp -r packages/. /opt/hnix-ax-server/packages/
sudo cp -r server.sh lib scripts README.md 설치가이드-리눅스서버.md /opt/hnix-ax-server/
cd /opt/hnix-ax-server && sudo ./server.sh install
```

`packages/` 에 옛 판 파일이 남아 있어도 판 번호가 가장 높은 것을 쓴다. 설치는 판이 바뀐 제품만 골라: DB 덤프(`backups/pre-upgrade-<날짜>`) → 제품 멈춤 → 새 판 풀기 · 데이터 옮기기(옛 판 폴더는 `old/<날짜>`) → 서비스 다시 시작 → 포트마다 판 확인. 중간에 실패하면 옛 판 · 데이터 · DB 를 되돌리고 옛 판으로 다시 띄운다(종료 코드 2). 되돌리기까지 실패하면(종료 코드 4) README 의 '판 올리기 실패 때' 대로 손으로 되돌린다.

## 11. 제거

```sh
sudo ./server.sh uninstall
```

서비스 · 백업 예약 · 이 꾸러미가 연 방화벽 규칙을 내린다. 데이터(DB · `data/` · `apps/*/data`)는 남긴다.

```sh
sudo ./server.sh uninstall --remove-data
```

설치 · 데이터 폴더와 이 꾸러미가 만든 DB · 계정까지 지운다. PostgreSQL 자체와 `backups/` · `server.config.json` 은 남긴다.

## 12. 자주 막히는 곳

| 증상 | 확인 |
|---|---|
| `root 로 실행하세요` | `sudo ./server.sh …` 로. sudo 권한이 없으면 인프라 담당에게 |
| `./server.sh: Permission denied` | 풀 때 권한이 빠졌다 — `sudo sh server.sh install` 로 돌리거나 `sudo chmod +x server.sh` |
| `꾸러미의 Node 가 실행되지 않습니다` | OS 가 너무 오래됐다(glibc 2.28 미만, 예 CentOS 7). RHEL 8 · Ubuntu 20.04 이상 |
| PostgreSQL 설치에서 멈춤(dnf · apt 오류) | 서버가 패키지 저장소에 닿지 않는다 — 인프라가 PostgreSQL 14 이상을 깔고 `"autoInstall": false`, 또는 프록시 설정(`/etc/dnf/dnf.conf` 의 `proxy=`) |
| `PostgreSQL … 너무 오래됐습니다` | RHEL 9 기본판(13)이 이미 깔려 있다. 다른 데이터가 없는 새 서버면 인프라가 13 을 지우고 16 을 깐 뒤 다시 install. 다른 데이터가 있으면 판 올리기(데이터 이전)를 인프라와 정한다 |
| `계정 … 로 DB … 에 접속하지 못했습니다` | `pg_hba.conf` 에 `# >>> hnix-ax-server` 줄이 있는지(`sudo -u postgres psql -c 'SHOW hba_file'`), 사내 DB 서버면 DBA 가 이 서버 IP 를 허용했는지, `passwords` 가 맞는지 |
| 다른 PC 에서 안 열림 | 서버에서는 열리는가(`curl -I http://127.0.0.1:8700/healthz`) → `sudo firewall-cmd --list-all` 또는 `sudo ufw status` → 사내 방화벽 · 보안 그룹 → 개인 PC 의 프록시 예외 |
| `… 포트를 다른 프로그램이 쓰고 있습니다` | `sudo ss -ltnp 'sport = :8080'` 로 누가 쓰는지 본다. 그 프로그램을 멈추거나 `ports` 를 바꾸고 다시 install |
| 서비스가 바로 죽음 | `journalctl -u pmsx -n 100`(이름을 바꿔서). SELinux 가 Enforcing 이면 `sudo ausearch -m avc -ts recent` — 설치 위치가 `/opt` 아래인지 |
| PMS-X 가 3분 넘게 안 뜸 | 처음에는 시연 데이터를 채우느라 오래 걸린다. `journalctl -u pmsx -f` · `free -g`(메모리) |
| `모델 zip 을 풀 unzip 이나 python3 가 없습니다` | `sudo dnf install unzip` 또는 `sudo apt install unzip` |
| `… 을(를) 풀지 못했습니다 — 조각 …` | 모델 `.zip.001`·`.002` 중 하나가 없거나 끊겼다 — 받은 쪽 `SHA256SUMS.txt` 와 대조 |
| `모델 … 이 없습니다 — 인터넷으로 받습니다` 뒤 멈춤 | `model.chatModel` 에 적은 모델의 `ollama-model-*` 파일이 `packages/` 에 없다 |
| IDE 채팅에 '모델 응답 불완전' | `qwen3.5:4b` 모델 파일을 넣고 다시 install(8번) |
| AI 답이 엉뚱함 | CPU 작은 모델의 한계 — 더 큰 모델, GPU 서버(`model.gpu`), 조직 API 키 |

## 13. 시험 서버가 없을 때 — WSL 로 미리 돌려 보기

Windows PC(메모리 16GB 이상)에 WSL 로 Ubuntu 를 깔면 설치 흐름을 미리 볼 수 있다. 관리자 PowerShell 에서:

```powershell
wsl --install -d Ubuntu-24.04      # 처음이면 재부팅을 묻는다
```

Ubuntu 창에서 systemd 를 켠다(설치 스크립트가 서비스로 띄우려면 필요):

```sh
printf '[boot]\nsystemd=true\n' | sudo tee /etc/wsl.conf
exit                                # PowerShell 에서 wsl --shutdown 뒤 다시 Ubuntu 를 연다
```

그다음은 3번부터 같다(파일은 `/mnt/c/Users/<이름>/Downloads/` 에서 가져온다). WSL 은 메모리를 PC 와 나눠 써서 PMS-X 와 모델이 함께 뜨면 느릴 수 있다. 다른 PC 에서 WSL 안의 서비스로 접속하는 것은 따로 설정이 필요하므로, 확인은 그 PC 의 브라우저에서 `http://localhost:8700` 으로 한다.
