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
