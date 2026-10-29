# 설치와 운영

AX Platform은 고객사 폐쇄망에 설치하는 것을 전제로 만들었다. 설치 패키지에 Node 런타임까지 들어 있어 인터넷이나 `npm install` 없이 뜬다.

## 설치 패키지

```bash
npm run package -- --target all --verify
# → dist/release/hnix-ax-<버전>-win-x64.zip
#   dist/release/hnix-ax-<버전>-linux-x64.tar.gz
```

| 들어 있는 것 | 비고 |
|---|---|
| 서버 번들, 웹 | `node_modules` 불필요 |
| Node 런타임 | nodejs.org 체크섬(SHASUMS256)으로 검증한 판 |
| sqlite-vec 확장 | 대상 OS용 |
| 서비스 정의 | Windows: WinSW, Linux: systemd |
| 설치 스크립트·안내 | `install.ps1` · `install.sh`, `INSTALL.md` |
| `SHA256SUMS.txt` | 패키지 파일 무결성 확인 |

`--verify`는 Windows 패키지를 임시 폴더에 풀어 마이그레이션 → 관리자 생성 → 기동 → 로그인·웹·허브 도구 → 백업까지 실제로 돌려 본다.

## 설치

```powershell
# Windows (관리자 PowerShell) — 서비스 이름 hnix-ax
.\install.ps1 -AdminLogin admin -AdminPassword '<비밀번호>'
```

```bash
# Linux — systemd, 전용 계정 hnixax, 쓰기는 data·backups 폴더만
sudo ./install.sh --admin admin '<비밀번호>'      # --prefix /opt/hnix-ax (기본), --no-service
```

설정은 `config/hnix-ax.yaml` 하나다. 값에 `${env:이름}`이나 `${env:이름:-기본값}`을 쓰면 환경변수로 채운다.

## 백업과 복원

```bash
hnix-ax backup                        # 지금 백업
hnix-ax backup list                   # 목록
hnix-ax restore --from <폴더> --force  # 서버를 멈춘 뒤 복원
```

- SQLite는 `VACUUM INTO`로 서버가 도는 중에도 일관된 사본을 뜬다.
- 암호화 키(`master.key`)와 설정을 함께 담는다. 이 키가 없으면 저장된 프로바이더 키를 풀 수 없다.
- 백업마다 SHA-256 목록(manifest)을 남기고, 복원 전에 검증한다.
- `backup.time: "02:30"`이면 매일 그 시각에 자동 백업하고, `backup.keep`개만 남긴다.

## LDAP·AD 로그인

```yaml
auth:
  ldap:
    enabled: true
    url: ldaps://ad.example.local
    baseDn: DC=example,DC=local
    userFilter: (sAMAccountName={0})
    bindDn: CN=svc-hnixax,OU=Service,DC=example,DC=local
    bindPassword: ${env:HNIX_AX_LDAP_PASSWORD}
    adminGroups: [CN=AX-Admins,OU=Groups,DC=example,DC=local]
```

- 서비스 계정으로 사용자를 찾고, 사용자 DN으로 비밀번호를 확인한다. 빈 비밀번호는 거절한다.
- 처음 로그인하면 계정을 만들고 기본 워크스페이스에 넣는다. `adminGroups` 구성원은 시스템 관리자가 된다(자동 강등은 하지 않는다).
- 디렉터리가 응답하지 않으면 503을 내고, 로그인 실패 횟수에는 넣지 않는다.
- 로컬 계정은 그대로 로컬 비밀번호로 로그인한다. 5회 실패하면 잠긴다.

## 저장소

| 규모 | 권장 |
|---|---|
| 팀·사업부 단위 | SQLite (기본, 파일 하나, sqlite-vec로 벡터 검색) |
| 전사 | PostgreSQL (`db.driver: postgres`, `db.url`) |

PostgreSQL 경로는 실제 PostgreSQL 에서 마이그레이션부터 주요 기능까지 자동 시험으로 확인한다. PostgreSQL 에서는 키워드 검색이 LIKE(조사 뗀 줄기 포함), 의미 검색은 직접 계산이라 컬렉션당 수만 청크까지가 실용 범위다.

## 여러 대로 띄우기 (이중화)

같은 PostgreSQL 과 같은 `master.key` 를 쓰는 서버 여러 대를 분산기 뒤에 둔다(`cluster.enabled: true`, 서버마다 `cluster.instanceId`). 로그인 토큰은 어느 서버에서나 검증되므로 고정 세션이 필요 없다.

- 예약·감시 트리거 점검, 오래된 대화 정리, 정기 백업은 DB 임대를 잡은 **한 대만** 돈다. 그 서버가 죽으면 임대가 만료되어 다른 서버가 이어받는다.
- 키별 분당 요청 한도는 DB 로 세어 서버 수만큼 늘지 않는다.
- 분산기는 `GET /readyz`(DB 까지 닿아야 200, 인스턴스·임대 표시)로 상태를 본다. 스트리밍 응답이 끊기지 않게 버퍼링을 끈다.

설정 예시와 nginx 예시는 플랫폼 저장소 `deploy/ha/`에 있다.

## 보안 헤더와 자체 점검

모든 응답에 CSP(같은 출처 스크립트만), X-Frame-Options, nosniff, Referrer-Policy 를 붙이고, `server.publicUrl` 이 https 면 HSTS 와 Secure 쿠키를 쓴다. 현업 창구를 포털에 iframe 으로 넣으려면 포털 주소를 `security.frameAncestors` 에 적는다.

```bash
node scripts/security-check.mjs --url https://ax.corp.local --token <관리자 토큰> --user-token <일반 사용자 토큰>
```

인젝션·XSS·정보 누출·인증·인가·로그인 잠금·세션·CSRF·업로드·평문 전송·보안 헤더 12개 항목을 실제 요청으로 확인한다. 공인 취약점 진단을 대신하지는 않는다.

## 부하 시험

```bash
node scripts/loadtest.mjs --self --vus 50 --duration 20      # 임시 서버 + 즉시 답하는 가짜 모델
```

| DB | 동시 | 초당 처리 | p95 | 오류 |
|---|---|---|---|---|
| SQLite | 50 | 245 | 0.28초 | 0 |
| SQLite | 200 | 235 | 1.19초 | 0 |
| PostgreSQL | 50 | 249 | 0.34초 | 0 |

개발 PC 기준, 플랫폼 자체(키 확인·예산·개인정보 처리·라우팅·기록·계량)만 잰 값이다. 서버 한 대가 초당 약 240건을 처리하므로 사용자 2,000명 규모는 한 대로 충분하고, 이중화는 가용성을 위해 둔다. 실제 응답 시간은 모델이 정한다.

## 현장 연결 점검

설치 뒤에는 **관리 › 현장 연결 점검**으로 기본 설치(DB·접속 주소·로그인·백업)와 모델·도구 서버·고객 ITSM·Git·외부 AI·자동화 연결을 한 번에 확인한다. 순서와 고객 쪽 준비물은 [고객사 설치와 연결 점검](/getting-started/onsite.md)에 있다.
