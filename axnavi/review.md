# 변경 리뷰와 보안 점검

변경 리뷰와 보안 점검은 AI를 부르지 않는다. 색인과 규칙만으로 판정하므로 같은 변경에는 늘 같은 결과가 나온다. IDE에서 버튼으로 돌린 판정과 CI가 머지 요청에서 내는 판정이 같은 엔진에서 나온다.

## IDE에서

<figure><img src="img/axnavi-ide-review.png" alt="변경 리뷰 STOP — Findings 패널, 문제 탭, 상태 표시줄"><figcaption>변경 리뷰 STOP — 아래 AX-NAVI › Findings에 심각도별 지적, 코드에 물결 밑줄, 상태 표시줄에 <code>리뷰 STOP</code></figcaption></figure>

| 하려는 것 | 하는 곳 |
|---|---|
| 작업 트리 리뷰 | 소스 제어 뷰 제목줄의 리뷰 버튼, 또는 상태 표시줄의 **AX-NAVI** |
| 스테이지한 것만 | 소스 제어 뷰 › **변경 리뷰 (스테이지)** |
| 브랜치 전체(`origin/main..HEAD`) | 명령 팔레트 › **AX-NAVI: 변경 리뷰 (범위 지정)** |
| 보안 점검 | Findings 패널 제목줄의 방패 버튼, 또는 탐색기에서 폴더 우클릭 › **보안 점검 (OWASP)** |

결과는 세 곳에 함께 나온다.

- **상태 표시줄** — `리뷰 GO` / `리뷰 HOLD` / `리뷰 STOP`. HOLD는 노랑, STOP은 빨강 배경.
- **아래쪽 패널 AX-NAVI › Findings** — 판정과 대상, 심각도(치명 · 높음 · 중간 · 낮음)별 지적. 항목을 누르면 그 줄로 간다.
- **문제 탭과 편집기** — 같은 지적이 진단으로 들어가 코드에 밑줄이 그어진다.

### AI로 고치기

Findings 항목의 ✨ 버튼, 또는 편집기에서 밑줄 위 전구(빠른 수정) › **AI 로 고치기**를 누르면 그 지적이 에이전트 작업으로 바뀐다. 작업 지시에는 위치, 규칙(OWASP·CWE), 코드, 영향, 권장 조치가 들어가고, 에이전트는 최소한으로 고친 뒤 같은 패턴이 그 파일의 다른 곳에도 있는지 확인한다. 의도적으로 남겨야 하는 경우라면 고치지 않고 이유를 설명한다.

고친 뒤 리뷰를 다시 돌려 GO가 나오는지 본다.

## 명령줄과 CI에서

IDE가 부르는 것과 같은 명령이다.

### 변경 리뷰

```bash
axnavi review                          # HEAD 대비 작업 트리
axnavi review --staged                 # 스테이징된 변경
axnavi review --diff origin/main..HEAD --verify "npm test" --format md --out review.md
```

| 판정 | 종료 코드 | 의미 |
|---|---|---|
| <span class="pill go">GO</span> | 0 | 진행 |
| <span class="pill hold">HOLD</span> | 3 | 사람이 확인하고 진행 (CI에서는 경고) |
| STOP | 4 | 철회·재설계 (CI에서 차단) |

판정은 6개 차원의 점수로 낸다: 회귀 위험, 컨벤션 일치, 사이드 이펙트, 롤백 가능성, 보안(가중치 2), 테스트 적정성. 컨벤션 일치는 AI 판정이라 헤드리스에서는 평가하지 않고 리포트에 그렇게 적는다.

**즉시 STOP**이 되는 경우:

- 평문 비밀번호·키
- SQL 문자열 결합, MyBatis `${}`
- 인가 검사 제거
- `DROP`·`TRUNCATE`·`WHERE` 없는 `DELETE`
- `--verify`로 준 검증 명령 실패

```text
## 결정: STOP — 철회·재설계
- 즉시 STOP 트리거 1건: SQL 문자열 결합(인젝션 가능)

| 심각도 | 규칙 | 위치 | 조치 |
| 치명 | SEC-SQLI-CONCAT · A03:2021 CWE-89 | …Service.java:874 | PreparedStatement·바인드 변수로 바꾼다 |

## 영향 범위(인덱스)
- 바뀐 심볼 1개 — 호출자 3
- 관련 테이블 3개 (쓰기 SQL 3건)
- 거슬러 올라간 진입점(화면 이벤트) 3개 — 회귀 확인 대상
STOP  종합 4 · 보안 10 · 종료 코드 4
```

색인이 있으면 바뀐 메서드의 호출자 수, 관련 테이블, 엔드포인트, 거슬러 올라간 화면 이벤트까지 리포트에 나온다. 레거시에서는 이 "어느 화면이 영향받나"가 회귀 테스트 범위가 된다.

#### 의도된 사용 억제

그 줄이나 바로 윗줄에 이유를 적는다. 억제한 항목도 리포트에 사유와 함께 남는다.

```java
// axnavi:allow SEC-SQLI-CONCAT 정렬 컬럼은 허용 목록으로 검증함
String sql = "SELECT * FROM TB_EMP ORDER BY " + sortColumn;
```

### 보안 점검

```bash
axnavi scan security                   # 저장소 전체 → _workspace/reports/security_scan.md
axnavi scan security src/ --fail-on high --format json
```

결과는 심각도(critical · high · medium · low)·규칙·위치·원인·영향·조치로 정규화한다. `--fail-on <심각도>`를 주면 그 이상이 하나라도 있을 때 종료 코드 1을 낸다.

### CI에 넣기

GitLab 머지 요청 템플릿이 저장소에 있다(`docs/ci/gitlab-axnavi-review.yml`). HOLD는 경고로 통과시키고, STOP은 머지를 막는다. 모델·API 키·외부 네트워크를 쓰지 않으므로 폐쇄망 러너에서 그대로 돈다.

```yaml
# 줄인 것 — 전체는 docs/ci/gitlab-axnavi-review.yml
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

테스트 job을 앞에 두지 않았다면 `--tests-passed` 대신 `--verify "mvn -q -B test"`처럼 검증 명령을 넘긴다. 프로젝트 액세스 토큰을 주면 리포트를 머지 요청 댓글로 단다.
