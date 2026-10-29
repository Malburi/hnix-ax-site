# 플랫폼 연동

## IDE에서

| 연동 | 설정 |
|---|---|
| **사내 게이트웨이** | 명령 팔레트 › **AX-NAVI: AI 연결 설정** → 가상 키 입력. 주소는 조직 정책의 `gateway.baseUrl`이나 설정 `axnavi.gateway.baseUrl`, 모델 별칭은 `axnavi.gateway.model` |
| **Insight 사용량 전송** | 설정 `axnavi.insight.server` + 명령 **AX-NAVI: Insight 키 설정**. 둘 다 있을 때만 작업 요약(모델, 토큰, 성공 여부, 작업번호)을 보낸다. 기본은 꺼짐 |
| **색인 도구** | 자동. AX-NAVI CLI가 있으면 `QueryIndex`를 에이전트 MCP 서버(`axnavi`)로 등록한다(`axnavi.mcp.autoRegister`) |
| **플랫폼 MCP 허브** | AX-NAVI 채팅 위 톱니(설정) › **MCP** 탭에서 허브 주소(`<플랫폼>/mcp`)와 키를 서버로 추가한다. PMS-X 화면 흐름·영향도·SR 구현 명세, 문서 RAG를 에이전트가 함께 쓴다. 도구 호출은 실행 전에 승인을 받는다 |

- 게이트웨이 경유 작업은 게이트웨이가 요청마다 토큰을 세므로 Insight에는 메타데이터만 보낸다. 구독 연결은 IDE가 토큰을 실어 보낸다. 같은 호출을 두 번 세지 않는다.
- 보내지 못한 요약은 쌓아 두었다가 다음에 함께 보낸다. 실패해도 작업은 막지 않는다.

아래는 CLI(`axnavi`)를 터미널에서 쓸 때의 설정이다.

## 외부 MCP 서버

`.axnavi/mcp.json`에 Claude Code의 `.mcp.json`과 같은 형식으로 적는다. 키는 파일에 쓰지 말고 `${환경변수}`로 받는다.

```json
{
  "mcpServers": {
    "hnix": {
      "type": "http",
      "url": "${HNIX_AX_SERVER}/mcp",
      "headers": { "Authorization": "Bearer ${HNIX_AX_KEY}" }
    }
  }
}
```

- 플랫폼 허브를 붙이면 PMS-X(화면·버튼 흐름, 영향도, SR 구현 명세), 문서 RAG, 사내 도구를 에이전트가 함께 쓴다.
- 이 도구들은 AX-NAVI 기본 도구가 아니라서 실행할 때마다 승인 창을 거친다("이번 세션 동안 묻지 않음" 가능).
- 환경변수가 없거나 설정이 틀린 서버는 그 서버만 빼고 이유를 알린다. `axnavi doctor`에서도 보인다.
- 내장 이름 `axnavi`는 쓸 수 없다.

## 조직 설정 배포

팀마다 개발자 PC를 돌며 규칙과 MCP 설정을 맞추지 않는다. 플랫폼 관리자가 **AX-NAVI 조직 설정** 화면에서 설정 묶음을 만들어 전사 또는 팀(워크스페이스)에 배포하면, 각 PC의 AX-NAVI가 받아 간다.

| 묶음에 넣는 것 | CLI | IDE |
|---|---|---|
| `rules/<이름>.md` 코딩 규칙 | 에이전트 지침에 `<조직 규칙>`으로 붙는다 | 전역 규칙 `~/.roo/rules/axnavi-org-<이름>.md` |
| `skills/<이름>/SKILL.md` 팀 스킬 | — | 전역 스킬 `~/.roo/skills/<이름>/` |
| `modes/<slug>.json` 사용자 정의 모드 | — | IDE 전역 모드(`custom_modes.yaml`) — 모드 선택 목록에 나온다 |
| `templates/<종류>.md` SDLC 양식 | 프로젝트 양식 다음, 내장 양식 앞 | (CLI 판정 엔진이 씀) |
| `mcp.json` 조직 MCP 서버 | 따로 허용하지 않아도 쓴다. 같은 이름의 저장소 설정보다 우선 | (CLI 판정 엔진이 씀) |
| `policy.json` 인증 경로 정책 | 허용 경로는 좁히기만. 선호 경로·게이트웨이 주소는 PC 공용 정책이 비워 둔 경우에만 | 같은 정책 |

- **받기**: `HNIX_AX_SERVER`와 `HNIX_AX_KEY`(각자의 플랫폼 키)가 있으면 대화·에이전트를 시작할 때 10분 간격으로 자동으로 받는다. 직접 받으려면 `axnavi org pull`, 상태는 `axnavi org status`나 `axnavi doctor`.
- **키는 묶음에 적지 않는다**: `mcp.json`의 인증 헤더·환경값은 `${환경변수}`로만 쓸 수 있다. 값을 적으면 플랫폼이 배포를 거절한다.
- **버전**: 편집은 초안에 하고, 배포할 때마다 버전이 하나 늘어 이력으로 남는다. 옛 버전으로 되돌리면 그 내용이 새 버전으로 다시 배포된다. 바뀐 것이 없으면 서버가 "바뀐 것 없음"(304)으로 답해 PC가 아무것도 다시 쓰지 않는다.
- **겹치기**: 한 사람에게 묶음이 여럿 해당하면 우선순위 순으로 겹친다. 같은 파일은 뒤 묶음이 이기고, MCP 서버는 이름 단위로 합치고, 허용 경로는 교집합이다.
- **지우기**: 다음 배포본에서 빠진 파일·IDE 규칙·스킬은 PC에서도 지운다. 사용자가 직접 만든 규칙·스킬은 건드리지 않는다(`axnavi-org-` 접두사와 받은 목록으로 구분).
- **사용자 정의 모드**: `{ "slug", "name", "roleDefinition", "whenToUse", "customInstructions", "groups" }` 형식(도구 묶음은 `read`·`edit`·`browser`·`command`·`mcp`, 편집은 `["edit", { "fileRegex": "…" }]` 로 파일을 좁힌다). IDE 전역 `custom_modes.yaml` 에 표시 주석과 함께 넣고, 사용자가 같은 이름으로 만든 모드가 있으면 그쪽을 둔다. IDE 가 파일을 다시 써서 표시가 없어져도 지난번에 넣은 이름으로 찾아 갈아 끼운다.
- **받아 간 기록**: 화면 아래에 누가(사용자·키) 어느 배포본을 언제 받았는지 남는다. 끄려면 PC에서 `AXNAVI_ORG_AUTO=0`, IDE 폴더에 깔지 않으려면 `AXNAVI_ORG_IDE=0`.

## 사용량 전송

`HNIX_AX_SERVER`와 `HNIX_AX_KEY`(수집 권한 키)를 설정하면 실행마다 요약(에이전트, 소요 시간, 결과, 작업번호, 세션 ID)을 플랫폼 Insight로 보낸다. 설정하지 않으면 아무것도 보내지 않는다.

- 토큰·비용은 API 키 직접 경로일 때만 싣는다. 구독 경로와 게이트웨이 경로는 각각 Claude Code 텔레메트리와 게이트웨이가 이미 세므로, 여기서 또 보내지 않는다.
- 서버에 닿지 않으면 `.axnavi/logs/insight-queue.jsonl`에 쌓았다가(최근 1,000건) 다음 실행 때 함께 보낸다.
- 브랜치 이름의 작업번호(`feature/SR-2026-0142`)를 뽑아 SR·CR별로 묶는다.

## 사내 게이트웨이와 로컬 모델

```bash
export AXNAVI_OPENAI_BASE_URL="http://ax-platform:8700/v1"
export AXNAVI_OPENAI_API_KEY="hx-<게이트웨이 키>"
export AXNAVI_OPENAI_MODEL="hnix-claude"       # 또는 hnix-local
# 단계별로 다르게: AXNAVI_OPENAI_MODEL_FAST / _STANDARD / _DEEP
```

OpenAI 호환 `/v1/chat/completions`를 스트리밍으로 부른다. 이 경로에서는 도구 실행을 AX-NAVI 코어가 직접 통제한다(역할별 도구 제한·승인·감사). 여러 에이전트를 동시에 돌리는 오케스트레이터 스킬은 이 경로에서 거절하고 이유를 말한다.

어느 경로가 쓰이는지는 [Claude 연결](/getting-started/connect.md)의 순서를 따른다. 조직 정책 파일에 게이트웨이 주소를 적어 두면 개발자는 키만 넣으면 된다.
