# MCP 허브와 승인함

사내 도구를 MCP(Model Context Protocol) 하나로 모은다. Claude Code, AX-NAVI, 플랫폼 에이전트가 같은 주소로 붙고, 같은 정책과 감사를 거친다.

## 붙이는 법

**손으로 붙이지 않는다.** 개인 PC 설치 파일(`HNIX-AX-PC-Setup`)로 깐 AX-NAVI IDE 가 플랫폼에 로그인하면 그 PC 전용 허브 키를 받아
IDE 채팅의 MCP 서버 `hnix-ax` 로 등록하고, PC 에 Claude Code 가 있으면 Claude Code 의 사용자 MCP 서버로도 넣는다. 로그아웃·기기 해지면 지운다.

IDE 없이 붙일 때(서버·CI 등):

```bash
claude mcp add --transport http hnix-ax http://ax-platform:8700/mcp \
  --header "Authorization: Bearer hx-<mcp 키>"
```

도구 이름은 `<서버>__<도구>` 형식이다.

| 서버 | 도구 예 | 내용 |
|---|---|---|
| `pmsx` (16개) | `pmsx__screen`, `pmsx__workflow`, `pmsx__impact`, `pmsx__crud`, `pmsx__tables`, `pmsx__srs`, `pmsx__sr`, `pmsx__similar`, `pmsx__spec`, `pmsx__sla`, `pmsx__handover_gaps` … | 화면·버튼 흐름, 영향도, CRUD, 테이블, 서비스 요청(SR) 목록·상세·유사 사례, 구현 명세, 처리 기한(SLA), 인수인계 갭 |
| `axnavi` (12개) | `axnavi__search`, `axnavi__callers`, `axnavi__callees`, `axnavi__trace`, `axnavi__sql`, `axnavi__table`, `axnavi__endpoint` … | 심볼 검색, 호출 관계, 흐름 추적, SQL·테이블·컬럼 사용처, 엔드포인트 |
| `docs` | `docs__collections`, `docs__search`, **`docs__save`** | 문서 RAG 검색, 정리한 내용을 컬렉션에 문서로 저장(매뉴얼 보강) |
| `agents` | `agents__list`, **`agents__run`**, `agents__run_status` | 플랫폼 에이전트를 부른다 — 내가 만든 것과 공개된 것, 내 권한으로 |
| `runbook` | 런북 이름 | 등록한 조치(사람 승인 후 실행) |
| `itsm` | `itsm__ticket`, `itsm__links`, **`itsm__comment`** | 고객 ITSM 티켓 조회·서비스 요청 연결·댓글 |
| `platform` | `platform__approval_status` | 승인 요청 상태 |
| 외부 MCP·A2A | 등록한 이름 | 관리자 승인 후 사용 |

- **굵게** 쓴 것은 쓰기 도구다. 허브의 도구 정책으로 '승인 후 실행'을 걸 수 있다.
- PMS-X 커넥터는 서비스 계정으로 조회하고, 쓰기는 **지식 문서 등록**(`pmsx__kb_create`) 하나뿐이다 — 본문 끝에 '허브에서 등록'이 남고, 누가 불렀는지는 허브 감사에 남는다. PMS-X에 별도 API 키 인증을 추가하지 않는다.

## 만든 자산을 MCP 로 쓰기

SM 업무에서 남긴 자산은 IDE 채팅·Claude Code·다른 에이전트가 같은 도구로 찾고 보탠다.

| 자산 | 찾기 | 남기기 |
|---|---|---|
| 지식 문서(PMS-X) | `pmsx__similar` → `pmsx__kb` | `pmsx__kb_create` — 처리한 서비스 요청에서 증상·원인·조치 |
| 매뉴얼·규정(문서 RAG) | `docs__search` | `docs__save` — 매뉴얼 보강, 채팅에서 찾은 답 |
| 런북 | 허브 도구 목록 | 플랫폼 화면에서 등록(실행은 승인 후) |
| 에이전트 | `agents__list` | 플랫폼 화면에서 '내 에이전트 만들기' → `agents__run` 으로 실행 |

예: IDE 채팅에 "SR-0042 처리 내용으로 지식 문서를 등록해 줘" → `pmsx__sr` 로 읽고 → `pmsx__kb_create`.
- AX-NAVI 커넥터는 설치 폴더의 색인 조회 모듈을 직접 불러, 개발자 PC에서와 같은 답을 낸다.

## 호출이 지나는 길

```mermaid
flowchart LR
    A["인증"] --> S["도구 상태<br/>승인·스키마 변경"] --> P["정책<br/>허용·거부·승인"] --> V["인자 점검<br/>필수·형식·64KB"] --> X["실행<br/>60초"] --> L["결과 100,000자 제한"] --> R["호출 기록<br/>인자 이름·크기만"]
```

- **스키마 변경 차단**: 외부 서버 도구의 입력 스키마가 바뀌면 관리자가 다시 승인할 때까지 막는다.
- **정책**: 우선순위가 높은 것부터 첫 일치를 적용한다. 대상은 도구 이름(glob), 서버, 워크스페이스, 역할, 쓰기 도구 여부.
- **호출 기록**: 인자 값은 남기지 않는다. 이름과 크기, 결과, 시간만 남긴다.

## 승인함

정책 효과가 `approve`인 호출은 승인 요청을 만들고 멈춘다. 승인함은 왼쪽 메뉴 맨 위에 있고(`/approvals`), 내가 결정할 대기 건수가 배지로 붙는다. 에이전트·채팅의 도구 호출, 런북 실행, 자동화 흐름의 '사람 확인'이 모두 여기로 모인다. 예전 주소(`/hub?tab=approvals`)와 알림 링크는 이 화면으로 열린다.

<figure><img src="img/platform-approvals.png" alt="왼쪽 메뉴의 승인함 — 대기 건수 배지와 승인 대기 목록"><figcaption>승인함 — 메뉴의 배지가 내가 결정할 대기 건수다. 여러 건을 골라 한꺼번에 승인·반려할 수도 있다.</figcaption></figure>

<figure><img src="img/platform-hub-approval-review.png" alt="도구 호출 승인 검토 창"><figcaption>요청자, 도구, 정책 사유, 인자를 보고 승인하거나 반려한다.</figcaption></figure>

- 승인되면 요청자가 **같은 인자로 다시 부를 때 한 번** 실행된다. 인자 해시가 다르면 실행하지 않는다.
- 기한은 하루. 지나면 만료된다.
- 자기 요청은 스스로 승인할 수 없다.
- 인자 원문은 결정 전까지만 보관하고, 결정하면 지운다.
- 에이전트와 MCP 클라이언트는 `platform__approval_status`로 상태를 확인한다.
