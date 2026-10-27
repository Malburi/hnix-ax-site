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
