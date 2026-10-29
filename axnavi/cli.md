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
axnavi modernize <레시피>        현대화 레시피 — java17 · java21 · jakarta · boot3 · oracle-pg (AI 불필요, --draft 는 AI 초안)
axnavi test plan|scaffold|status  SR 테스트 계획·골격·진행 상태 (AI 불필요)
axnavi coverage [--diff A..B]    커버리지 — 전체와 바뀐 줄 (AI 불필요)
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

## 테스트 계획과 커버리지

PMS-X 구현 명세(SR 화면의 "구현 명세 내보내기" JSON, 또는 에이전트의 `pmsx__spec` 도구)에는 테스트 케이스(단계, 기대 결과, 근거)와 관련 서버 소스가 들어 있다. AX-NAVI는 이를 받아 AI 없이 테스트 계획과 골격을 만들고, 테스트 결과로 진행 상태를 잰다. 본문은 사람이나 에이전트("SR-0012 테스트 채워줘")가 채운다.

```text
axnavi test plan --spec <명세.json> [--framework junit5|vitest]   명세 → 계획 (_workspace/tests/<SR>.plan.json)
axnavi test scaffold <SR> [--out <파일>]                          계획 → 테스트 골격
axnavi test status [SR] [--junit <폴더>]                           테스트 결과 → 진행 상태 (종료 코드 0/3/4)
axnavi coverage [--jacoco <xml>] [--lcov <info>] [--diff A..B|--staged] [--min <%>]
```

- **골격**: 서버 소스가 자바면 JUnit 5(관련 소스의 패키지에 `SR_0012Test`), 프런트만 있으면 Vitest. 케이스마다 `@DisplayName("TC01 …")`과 `@Disabled("작성 필요")`(Vitest는 `it.todo`)로 시작해 빌드는 깨지지 않고 남은 일로 보인다. 단계와 기대 결과는 주석으로 들어간다.
- **재개**: 명세가 바뀌어 다시 만들면 없는 케이스만 덧붙인다. 사람이 쓴 본문은 건드리지 않는다.
- **진행 상태**: 테스트를 돌린 뒤 JUnit XML(Maven surefire, Gradle, Vitest junit 리포터)을 읽어 케이스마다 작성 필요·실패·통과를 매긴다. 실패가 있으면 STOP(4), 남은 케이스가 있으면 HOLD(3), 다 통과하면 GO(0).
- **커버리지**: 빌드가 만든 JaCoCo XML·lcov를 읽는다(흔한 위치는 자동으로 찾는다). `--diff`를 주면 **이번에 바뀐 줄**의 커버리지를 따로 재고, 테스트가 닿지 않은 줄 번호를 보여 준다. 레거시 전체 수치는 낮아도 새로 고친 줄은 덮였는지가 기준이다. `--min` 미달이면 HOLD.

## 현대화 레시피

Java 8 → 17/21, Spring Boot 2 → 3, javax → jakarta, Oracle → PostgreSQL 전환을 결정론적 규칙으로 훑어 **자동**(의미가 같은 기계적 치환)과 **수동**(사람이 판단해야 함 + 안내)으로 나눈다. 레시피 자체는 AI를 부르지 않는다. 판단이 필요한 SQL 은 `--draft` 로 AI 초안을 따로 받는다.

```text
axnavi modernize <java17|java21|jakarta|boot3|oracle-pg> [경로...]
    [--apply] [--force] [--verify "<빌드·테스트 명령>"] [--format md|json] [--out <파일>]
    [--boot 3.5.x]                 boot3 의 Spring Boot 버전(기본 3.5.0 — 최신 3.5 패치를 쓴다)
    [--draft [--draft-limit N]]    oracle-pg 수동 SQL 의 AI 초안(소스는 고치지 않음)
```

| 레시피 | 자동 | 수동(안내) |
|---|---|---|
| `java17` · `java21` | 빌드 대상 1.8 → 17/21(Maven·Gradle), `new Integer(…)` → `Integer.valueOf(…)` | `sun.misc.BASE64*`, JDK에서 빠진 `javax.xml.bind` 등, Nashorn, `finalize()`, `Thread.stop`, SecurityManager, 내부 API. 21은 `new URL`·`new Locale` 추가 |
| `jakarta` | Java EE 패키지 `javax.*` → `jakarta.*`(servlet·persistence·validation·transaction·annotation 일부 등), 배치 서술자 네임스페이스 | `javax` 의존성 좌표(→ jakarta, Spring 6·Boot 3·Tomcat 10.1+ 함께). JDK에 남은 `javax.crypto`·`javax.sql`·`javax.transaction.xa` 등은 건드리지 않는다 |
| `boot3` | Spring Boot 부모·플러그인 버전, dependency-management 1.1.7, `javax` 의존성 좌표 → `jakarta`(Maven 블록·Gradle 문자열, 버전 포함), 이름이 바뀐 설정 키(`spring.redis.*` → `spring.data.redis.*` 등), Hibernate 버전별 방언 → 공통 방언. `jakarta` 레시피를 함께 돈다 | `WebSecurityConfigurerAdapter`, `antMatchers`·`authorizeRequests`, `spring.factories` 자동 구성, `@Type(type=…)`, YAML 설정 키 |
| `oracle-pg` | `NVL` → `COALESCE`, `SYSDATE` → `LOCALTIMESTAMP`, `FROM DUAL` 제거, `SEQ.NEXTVAL` → `nextval('seq')`, `MINUS` → `EXCEPT`, DDL `VARCHAR2`·`NUMBER`, 한 줄에서 닫히는 `DECODE` → `CASE`, `NVL2` → `CASE`, 인자 두 개 `INSTR` → `strpos` | 여러 줄 `DECODE`, `ROWNUM`, `(+)` 외부 조인, `CONNECT BY`, `MERGE`, Oracle 전용 함수, 힌트, `TO_DATE` 형식 |

- **범위**: 매퍼 XML, SQL 파일, 자바 문자열 안의 SQL만 SQL 규칙을 적용한다. 자바 메서드 이름 `NVL(…)` 같은 것은 건드리지 않는다.
- **EUC-KR 레거시**: UTF-8이 아닌 파일은 바이트를 그대로 둔 채 한글이 없는 줄만 고치고, 한글이 섞인 줄은 수동 항목으로 남긴다.
- **되돌릴 수 있게**: `--apply`는 고칠 파일에 커밋하지 않은 변경이 있으면 고치지 않는다(`--force`로 무시).
- **단계 게이트**: 종료 코드 0/3/4. 고친 뒤 `--verify` 명령이 실패하면 STOP, 수동 항목이 남으면 HOLD, 다 끝났으면 GO. 리포트는 `_workspace/reports/modernize_<레시피>.md`.
- **DECODE 의 NULL**: Oracle `DECODE` 는 NULL = NULL 을 참으로 본다. 찾는 값이 모두 리터럴이면 단순 `CASE x WHEN …`, NULL 이나 컬럼·바인드(`#{…}`)가 있으면 `CASE WHEN x IS NULL …`·`IS NOT DISTINCT FROM` 으로 바꿔 뜻을 지킨다. 바깥 식이 복잡하면(여러 번 계산하게 되면) 수동으로 남긴다.
- **권장 순서**: `java17` → `boot3`(Spring Boot 를 쓰면, 아니면 `jakarta`) → `oracle-pg`. 단계마다 고치고 `axnavi review`로 변경을 다시 판정한 뒤 다음 단계로 간다.

### 판단이 필요한 SQL 은 AI 초안

`--draft` 는 수동으로 남은 `ROWNUM` 페이징·`(+)` 조인·`CONNECT BY`·`MERGE`·여러 줄 `DECODE` 를 **문장 단위로** 잘라 AI 에게 PostgreSQL 초안을 받는다. 매퍼는 감싸는 `<select id="…">` 요소 전체, SQL 파일은 `;` 사이, 자바는 이어지는 문자열 묶음을 보낸다. 같은 문장에 걸린 여러 규칙은 한 번에 묻는다.

- 결과는 `_workspace/reports/modernize_oracle-pg_drafts.md` — 문장마다 원문, 초안, **확인할 점**(ORDER BY 전에 자르던 ROWNUM, 빈 문자열 = NULL, 날짜 산술 등) 체크리스트. 소스는 고치지 않는다. 사람이 비교해 옮기고 테스트로 확인한다.
- 모델은 HNIX AX 게이트웨이(`AXNAVI_OPENAI_BASE_URL`, 사내 모델)를 먼저 쓰고, 없으면 본인 PC의 claude CLI(조직 정책이 구독을 허용할 때)를 쓴다.
- MyBatis 태그·`#{…}` 바인드·자바 문자열 구조는 그대로 두라고 지시한다. 한 번에 보내는 문장 수는 `--draft-limit`(기본 20).

> 실측(사내 연습용 레거시 서버, 파일 2,700여 개): `jakarta` 자동 200건, `java17` 자동 3건·수동 22건, `oracle-pg` 자동 2,936건(EUC-KR 매퍼 포함)·수동 6,364건. 수동의 대부분은 `DECODE`·`(+)`·`ROWNUM`이다.

## CI에 넣기

GitLab 머지 요청 템플릿이 CLI 저장소에 둘 있다. 변경 리뷰(`docs/ci/gitlab-axnavi-review.yml`)와 테스트·커버리지·현대화(`docs/ci/gitlab-axnavi-quality.yml` — 빌드·테스트 → `test status` → 바뀐 줄 커버리지 게이트 `AXNAVI_COVERAGE_MIN`, 현대화 점검은 수동 실행). HOLD는 경고로 통과시키고 STOP은 머지를 막는다. 모델·API 키·외부 네트워크를 쓰지 않으므로 폐쇄망 러너에서 그대로 돈다. 자세한 옵션은 [변경 리뷰와 보안 점검](/axnavi/review.md)에 있다.

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
