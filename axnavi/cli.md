# CLI와 CI 게이트

AX-NAVI CLI(`axnavi`)는 AX-NAVI IDE가 내부에서 부르는 판정 엔진이다. 색인, 변경 리뷰, 보안 점검, 단계 게이트를 계산한다. 같은 명령을 터미널과 CI 파이프라인에서 그대로 쓸 수 있어서, IDE에서 본 판정과 머지 요청에서 받는 판정이 같다.

> CLI 자체의 설치·대화형 모드·스킬 설명은 [AX-NAVI CLI 문서](https://malburi.github.io/AX-NAVI-CLI/)에 있다.

## 언제 CLI를 쓰나

| 상황 | 쓰는 것 |
|---|---|
| 개발자가 평소에 코드를 보고 고친다 | **IDE** |
| 머지 요청마다 리뷰·보안 점검으로 막는다 | **CLI** — CI 러너에서 |
| 단계 게이트 결과를 진행 기록서에 남긴다 | **CLI** — `axnavi gate <단계> --record` |
| 터미널에서 일하는 개발자, 원격 서버 | **CLI** — 대화형 모드 `axnavi` |

## 명령 한눈에

```text
axnavi                          대화형 모드
axnavi ask <요청>               한 번 묻고 답받기 (읽기 전용)
axnavi doctor                   실행 환경 진단 (실행 경로 · 과금 · 조직 정책)

axnavi index build|status|refresh   코드베이스 색인 (AI 불필요)

axnavi review [--diff A..B]     변경 리뷰 GO/HOLD/STOP (AI 불필요 · 종료 코드 0/3/4)
axnavi scan security [경로...]  저장소 보안 점검 (AI 불필요)

axnavi doc new <종류|all>       SDLC 산출물 양식
axnavi doc list                 산출물 현황
axnavi adr new "<제목>"          아키텍처 결정 기록
axnavi gate <req|design|dev|test>  단계 게이트 (AI 불필요 · 종료 코드 0/3/4)
axnavi modernize <레시피>        현대화 레시피 — java17 · java21 · jakarta · oracle-pg (AI 불필요)
axnavi org pull|status          조직 설정(플랫폼 배포본) 받기
```

IDE의 명령과 이렇게 대응한다.

| IDE 명령 | CLI |
|---|---|
| AX-NAVI: 인덱스 만들기 / 갱신 | `axnavi index build` / `refresh` |
| AX-NAVI: 변경 리뷰 (작업 트리 / 스테이지 / 범위 지정) | `axnavi review` / `--staged` / `--diff origin/main..HEAD` |
| AX-NAVI: 보안 점검 (OWASP) | `axnavi scan security [경로]` |
| AX-NAVI: 단계 게이트 점검 | `axnavi gate <단계>` |
| AX-NAVI: 환경 점검 (doctor) | `axnavi doctor` |

## 현대화 레시피

Java 8 → 17/21, javax → jakarta, Oracle → PostgreSQL 전환을 결정론적 규칙으로 훑어 **자동**(의미가 같은 기계적 치환)과 **수동**(사람이 판단해야 함 + 안내)으로 나눈다. AI를 부르지 않는다.

```text
axnavi modernize <java17|java21|jakarta|oracle-pg> [경로...]
    [--apply] [--force] [--verify "<빌드·테스트 명령>"] [--format md|json] [--out <파일>]
```

| 레시피 | 자동 | 수동(안내) |
|---|---|---|
| `java17` · `java21` | 빌드 대상 1.8 → 17/21(Maven·Gradle), `new Integer(…)` → `Integer.valueOf(…)` | `sun.misc.BASE64*`, JDK에서 빠진 `javax.xml.bind` 등, Nashorn, `finalize()`, `Thread.stop`, SecurityManager, 내부 API. 21은 `new URL`·`new Locale` 추가 |
| `jakarta` | Java EE 패키지 `javax.*` → `jakarta.*`(servlet·persistence·validation·transaction·annotation 일부 등), 배치 서술자 네임스페이스 | `javax` 의존성 좌표(→ jakarta, Spring 6·Boot 3·Tomcat 10.1+ 함께). JDK에 남은 `javax.crypto`·`javax.sql`·`javax.transaction.xa` 등은 건드리지 않는다 |
| `oracle-pg` | `NVL` → `COALESCE`, `SYSDATE` → `LOCALTIMESTAMP`, `FROM DUAL` 제거, `SEQ.NEXTVAL` → `nextval('seq')`, `MINUS` → `EXCEPT`, DDL `VARCHAR2`·`NUMBER` | `ROWNUM`, `DECODE`, `(+)` 외부 조인, `CONNECT BY`, `MERGE`, Oracle 전용 함수, 힌트, `TO_DATE` 형식 |

- **범위**: 매퍼 XML, SQL 파일, 자바 문자열 안의 SQL만 SQL 규칙을 적용한다. 자바 메서드 이름 `NVL(…)` 같은 것은 건드리지 않는다.
- **EUC-KR 레거시**: UTF-8이 아닌 파일은 바이트를 그대로 둔 채 한글이 없는 줄만 고치고, 한글이 섞인 줄은 수동 항목으로 남긴다.
- **되돌릴 수 있게**: `--apply`는 고칠 파일에 커밋하지 않은 변경이 있으면 고치지 않는다(`--force`로 무시).
- **단계 게이트**: 종료 코드 0/3/4. 고친 뒤 `--verify` 명령이 실패하면 STOP, 수동 항목이 남으면 HOLD, 다 끝났으면 GO. 리포트는 `_workspace/reports/modernize_<레시피>.md`.
- **권장 순서**: `java17` → `jakarta`(Spring Boot 3로 올릴 때) → `oracle-pg`. 단계마다 고치고 `axnavi review`로 변경을 다시 판정한 뒤 다음 단계로 간다.

> 실측(사내 연습용 레거시 서버, 파일 2,700여 개): `jakarta` 자동 200건, `java17` 자동 3건·수동 22건, `oracle-pg` 자동 2,936건(EUC-KR 매퍼 포함)·수동 6,364건. 수동의 대부분은 `DECODE`·`(+)`·`ROWNUM`이다.

## CI에 넣기

GitLab 머지 요청 템플릿이 CLI 저장소에 있다(`docs/ci/gitlab-axnavi-review.yml`). HOLD는 경고로 통과시키고 STOP은 머지를 막는다. 모델·API 키·외부 네트워크를 쓰지 않으므로 폐쇄망 러너에서 그대로 돈다. 자세한 옵션은 [변경 리뷰와 보안 점검](/axnavi/review.md)에 있다.

```yaml
axnavi-review:
  stage: review
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  before_script:
    - npm install -g ${AXNAVI_TGZ:-axnavi} --no-audit --no-fund
    - git fetch -q origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - axnavi index refresh || axnavi index build || true
  script:
    - BASE="origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - axnavi review --diff "$BASE...HEAD" --tests-passed --format md --out axnavi-review.md || CODE=$?
    - exit ${CODE:-0}
```
