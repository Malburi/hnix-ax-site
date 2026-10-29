# 고객 ITSM 연동

통합 유지보수에서 고객은 보통 자기 ITSM(ServiceNow, Jira Service Management 등)을 **기록의 원본**으로 둔다. 우리는 PMS-X에서 SR로 일한다. 두 시스템을 사람이 오가며 옮겨 적으면 누락과 상태 불일치가 생긴다. 고객 ITSM 연동은 고객 티켓과 PMS-X SR을 잇고 상태를 양방향으로 맞춘다.

메뉴 "고객 ITSM 연동"(관리자, 감사자는 보기).

## 연결할 수 있는 ITSM

| 종류 | 쓰는 API | 범위 지정 |
|---|---|---|
| ServiceNow | Table API(기본 `incident` 테이블) | encoded query — 예: `assignment_group.name=HNIX-ITO` |
| Jira Service Management | REST v2(검색·이슈·댓글·전이) | JQL — 예: `project = SD AND "Team" = HNIX` |
| 일반 REST | 경로 템플릿(`{id}`·`{since}`·`{limit}`)과 필드 위치(점 경로)로 맞춤 | 검색 경로에 조건을 넣는다 |

인증은 계정+비밀번호(Basic) 또는 토큰(Bearer)이다. 비밀번호·토큰은 플랫폼 비밀 저장소에 암호화해 두고 화면에 다시 보이지 않는다.

## 동기화 규칙

| 방향 | 언제 | 하는 일 |
|---|---|---|
| 고객 → PMS-X | 범위에 맞는 **새 티켓** | PMS-X SR 접수(제목 `[INC0010001] …`, 우선순위 대응표), 고객 티켓에 "SR-0041 로 접수" 댓글 |
| 고객 → PMS-X | 이은 티켓의 상태가 바뀜 | 기록. 고객이 티켓을 **끝냈고 SR이 '처리 완료'**면 SR을 '확인'으로 넘긴다(끌 수 있음). 그 밖에는 SR에 내부 댓글 |
| PMS-X → 고객 | SR 상태가 바뀜 | 대응표에 있으면 고객 티켓 상태를 바꾸고(Jira는 전이 이름이나 도착 상태로), 없으면 댓글 "PMS-X SR-0041 상태: …" |

- **주기**: 기본 5분마다 지난번 이후 바뀐 티켓만 찾는다(5분 겹쳐서). 서버가 여러 대여도 한 대만 돈다.
- **웹훅**: 고객 ITSM에서 바뀔 때마다 `/itsm-hooks/<연결 id>`(헤더 `X-HNIX-Token`)를 부르게 하면 그 티켓은 바로 반영된다. ServiceNow는 비즈니스 규칙의 REST 메시지로 `{"sys_id": "…"}`, Jira는 시스템 웹훅으로.
- **실패**: 티켓마다 오류를 남기고 다음 주기에 다시 한다. 예를 들어 Jira에 그 상태로 가는 전이가 없으면 "가능: …"과 함께 오류로 남는다.
- **기록**: 모든 접수·상태 변경·댓글·오류가 "동기화 기록"에 방향(← 고객, → 고객)과 함께 남는다.

## 현업 창구와 에이전트

- **현업 창구**의 담당자 접수 방식에 "고객 ITSM 연결"이 추가됐다. 창구가 답을 못 하면 사용자 확인 뒤 고객 ITSM에 바로 티켓을 만든다.
- 에이전트 도구:
  - `itsm__ticket` — 고객 티켓 한 건(상태, 우선순위, 설명, 요청자)
  - `itsm__links` — SR 번호나 티켓 번호로 이어진 쌍과 양쪽 상태
  - `itsm__comment` — 고객 티켓에 댓글. 쓰기 도구라 허브 정책으로 승인을 걸 수 있다

## 모니터링 경보

[에이전트 트리거](/platform/agents.md)의 웹훅은 모니터링 경보 본문을 알아보고 한 모양으로 정리한다.

| 보내는 곳 | 알아보는 방법 |
|---|---|
| Prometheus Alertmanager | `alerts[]` + `version`·`groupKey` |
| Grafana 알림 | 위와 같은 모양 + `orgId`·`panelURL` |
| Zabbix 웹훅 미디어 | `event_id` + `trigger_name`·`host` |

입력 문장에서 `{{alert.title}}`, `{{alert.severity}}`, `{{alert.host}}`, `{{alert.description}}`, `{{alert.url}}`을 쓰고, 중복 키는 `{{alert.fingerprint}}`로 잡는다. **해소(resolved) 알림은 에이전트를 깨우지 않고** '건너뜀'으로 남긴다. 해소 알림도 받으려면 트리거 설정에 `skipResolved: false`를 넣는다.

## Teams

Teams는 이미 두 방향으로 붙어 있다. 들어오는 쪽은 [현업 창구](/platform/desk.md)의 Teams 나가는 웹훅(HMAC 서명 확인)이고, 나가는 쪽은 트리거 실행 결과 알림(Incoming Webhook)이다.
