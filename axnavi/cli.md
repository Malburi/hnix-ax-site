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
```

IDE의 명령과 이렇게 대응한다.

| IDE 명령 | CLI |
|---|---|
| AX-NAVI: 인덱스 만들기 / 갱신 | `axnavi index build` / `refresh` |
| AX-NAVI: 변경 리뷰 (작업 트리 / 스테이지 / 범위 지정) | `axnavi review` / `--staged` / `--diff origin/main..HEAD` |
| AX-NAVI: 보안 점검 (OWASP) | `axnavi scan security [경로]` |
| AX-NAVI: 단계 게이트 점검 | `axnavi gate <단계>` |
| AX-NAVI: 환경 점검 (doctor) | `axnavi doctor` |

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
