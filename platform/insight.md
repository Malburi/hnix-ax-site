# Insight — AI 사용 현황

누가, 어떤 도구로, 어떤 모델을, 얼마나 썼는지를 한 기준으로 모은다. 사용량 기록은 OpenTelemetry GenAI 규약을 따른 공통 형식으로 저장하고, 같은 호출은 여러 경로로 들어와도 한 번만 센다.

## 들어오는 곳

| 출처 | 방법 | 비고 |
|---|---|---|
| LLM 게이트웨이 | 자동 | 로컬 모델은 0원으로 집계 |
| Claude Code (구독·키 모두) | 텔레메트리(OTLP/HTTP JSON) → `/v1/logs` | 모델 호출·실패·도구 호출. 본문은 오지 않는다 |
| Claude Code 세션 기록 | `hnix-ax collect` 또는 서버 폴더 스캔 | 서브에이전트 포함, 요청 ID로 중복 제거 |
| AX-NAVI | 실행 요약 전송(`HNIX_AX_SERVER`·`HNIX_AX_KEY`) | 에이전트·소요 시간·결과·작업번호 |
| 에이전트 실행기·MCP 허브 | 자동 | 실행과 도구 호출 |

## Claude Code 텔레메트리

구독 사용자도 각자 자기 자격으로 Anthropic에 요청하고, 플랫폼에는 사용량만 보낸다. 자격 증명은 서버로 오지 않는다.

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://ax-platform:8700",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer hx-<수집 키>"
  }
}
```

- 개인은 `~/.claude/settings.json`의 `env`에 넣는다. **내 연결 설정** 화면이 키까지 채워 준다.
- 전 직원에게는 같은 내용을 Claude Code **관리 설정(managed settings)**으로 배포하고, 키만 조직 수집 키(`ingest_org`)로 바꾼다. 관리 설정의 OTel 값은 개발자가 바꿀 수 없다.
- 옮기는 것은 `api_request`(토큰·캐시·비용), `api_error`, `tool_result`뿐이다. 프롬프트·응답 본문은 Claude Code가 기본으로 가리고, 플랫폼도 저장하지 않는다.
- `request_id`가 세션 기록의 요청 ID와 같아서, 텔레메트리와 세션 기록 수집을 함께 써도 두 번 세지 않는다.
- 전송 형식은 `http/json`만 받는다. `http/protobuf`나 `grpc`로 보내면 바꾸라는 안내와 함께 거절한다.

## 보는 것

- 기간(7·30·90일)과 프로젝트·모델·출처로 거른 비용, 토큰, 요청 수, 캐시 적중률, 사용자 수.
- 일별 비용을 모델·출처·프로젝트별로 쌓아 본다.
- 항목별 집계: 모델, 프로젝트, 팀, 사용자, 작업번호(SR·CR), 출처, 도구.
- CSV 내보내기, 단가표(캐시 쓰기 5분·1시간 단가 구분), 단가를 바꾼 뒤 비용 다시 계산.

## 누가 무엇을 보나

| 역할 | 범위 |
|---|---|
| 관리자·감사자 | 전체, 사용자별 포함 |
| 일반 사용자 | 본인 기록과 팀 단위 집계만 |

브랜치 이름에 작업번호(`feature/SR-2026-0142`)를 쓰면 AI 사용량이 SR·CR별로 묶인다.
