# MCP 허브와 승인함

사내 도구를 MCP(Model Context Protocol) 하나로 모은다. Claude Code, AX-NAVI, 플랫폼 에이전트가 같은 주소로 붙고, 같은 정책과 감사를 거친다.

## 붙이는 법

```bash
claude mcp add --transport http hnix-ax http://ax-platform:8700/mcp \
  --header "Authorization: Bearer hx-<mcp 키>"
```

도구 이름은 `<서버>__<도구>` 형식이다.

| 서버 | 도구 예 | 내용 |
|---|---|---|
| `pmsx` (16개) | `pmsx__screen`, `pmsx__workflow`, `pmsx__impact`, `pmsx__crud`, `pmsx__tables`, `pmsx__srs`, `pmsx__sr`, `pmsx__similar`, `pmsx__spec`, `pmsx__sla`, `pmsx__handover_gaps` … | 화면·버튼 흐름, 영향도, CRUD, 테이블, SR 목록·상세·유사 사례, 구현 명세, SLA, 인수인계 갭 |
| `axnavi` (12개) | `axnavi__search`, `axnavi__callers`, `axnavi__callees`, `axnavi__trace`, `axnavi__sql`, `axnavi__table`, `axnavi__endpoint` … | 심볼 검색, 호출 관계, 흐름 추적, SQL·테이블·컬럼 사용처, 엔드포인트 |
| `docs` | `docs__search` | 문서 RAG 검색 |
| `platform` | `platform__approval_status` | 승인 요청 상태 |
| 외부 MCP·A2A | 등록한 이름 | 관리자 승인 후 사용 |

- PMS-X 커넥터는 서비스 계정으로 **조회(GET)만** 한다. PMS-X에 별도 API 키 인증을 추가하지 않는다.
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

정책 효과가 `approve`인 호출은 승인 요청을 만들고 멈춘다.

<figure><img src="img/platform-hub-approval-review.png" alt="도구 호출 승인 검토 창"><figcaption>요청자, 도구, 정책 사유, 인자를 보고 승인하거나 반려한다.</figcaption></figure>

- 승인되면 요청자가 **같은 인자로 다시 부를 때 한 번** 실행된다. 인자 해시가 다르면 실행하지 않는다.
- 기한은 하루. 지나면 만료된다.
- 자기 요청은 스스로 승인할 수 없다.
- 인자 원문은 결정 전까지만 보관하고, 결정하면 지운다.
- 에이전트와 MCP 클라이언트는 `platform__approval_status`로 상태를 확인한다.
