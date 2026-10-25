# 빠른 시작

세 제품을 한 PC에 띄워 서로 연결하는 순서다. 각 제품은 따로 띄워도 된다.

> 저장소 접근 권한이 필요하다. 폐쇄망 설치는 각 제품의 오프라인 패키지를 쓴다([설치와 운영](/platform/operations.md)).

## 1. AX Platform

```bash
cd hnix-ax-platform
npm install
npm run cli -- user create --login admin --name 관리자 --password '<비밀번호>' --admin
npm run web:build && npm run serve        # http://127.0.0.1:8700
```

브라우저로 접속해 관리자로 로그인한 뒤, **LLM 게이트웨이**에서 두 가지를 등록한다.

1. **프로바이더**: 사내 로컬 모델(형식 "OpenAI 호환", 주소 예: `http://127.0.0.1:11434/v1`, 사내 로컬 켬)과 필요하면 Claude(형식 "Anthropic", 조직 API 키).
2. **모델 별칭**: 도구들이 부를 이름. 예: `hnix-local` → 로컬 대화 모델, `hnix-embed-local` → 로컬 임베딩 모델, `hnix-claude` → Claude.

> 로컬 모델이 없으면 Ollama로 시작할 수 있다: `ollama pull qwen2.5:3b`, `ollama pull nomic-embed-text`. 작은 모델은 도구를 여러 개 쓰는 에이전트에서 불안정하므로 시연용으로만 쓴다.

## 2. PMS-X

```powershell
# 시연용 오프라인 패키지 (샘플 시스템 3종 + SM 프로젝트 + SR 데모 데이터)
pmsx-<버전>\bin\start-demo.bat          # http://localhost:8080
```

AI 보조 기능을 쓰려면 게이트웨이에서 `llm` 권한 키를 발급하고 환경변수를 넣어 다시 띄운다.

```powershell
$env:PMSX_AI_ENABLED = "true"
$env:PMSX_AI_BASE_URL = "http://127.0.0.1:8700/v1"
$env:PMSX_AI_API_KEY = "hx-..."          # 게이트웨이 키
$env:PMSX_AI_MODEL = "hnix-local"
```

AI를 켜지 않으면 PMS-X는 외부로 아무것도 호출하지 않는다.

## 3. AX-NAVI

설치는 [AX-NAVI 문서](https://malburi.github.io/AX-NAVI-CLI/#/getting-started/install)를 따른다. 설치 뒤 프로젝트 폴더에서:

```bash
axnavi index build      # 코드 전수 색인 (AI 불필요)
axnavi doctor           # 실행 경로와 과금 확인
axnavi                  # 대화형 모드
```

Claude 연결은 개발자마다 다르다. 구독·좌석·API 키·게이트웨이 중 무엇으로 쓸지는 [Claude 연결](/getting-started/connect.md)을 본다. 플랫폼의 **내 연결 설정** 화면에서 내 상황을 고르면 붙여 넣을 설정이 나온다.

## 4. 서로 잇기

| 연결 | 하는 곳 | 방법 |
|---|---|---|
| 허브 → PMS-X | 플랫폼 › MCP 허브 › 서버 | 종류 "PMS-X", 주소와 서비스 계정. PMS-X에는 운영 역할을 가진 일반 계정을 만든다 |
| 허브 → AX-NAVI | 같은 곳 | 종류 "AX-NAVI", 설치 폴더와 색인된 저장소 경로 |
| AX-NAVI → 허브 | 개발자 PC `.axnavi/mcp.json` | [플랫폼 연동](/axnavi/integration.md) |
| Claude Code → Insight | 개발자 PC 설정 | [Insight](/platform/insight.md)의 텔레메트리 설정 |
| 모니터링 → PMS-X | 모니터링 도구의 웹훅 | [SM 운영과 AI 보조](/pmsx/sm-ai.md)의 경보 접수 |

## 잘 됐는지 확인

- 플랫폼 › MCP 허브 › 도구 승인에 `pmsx__*`, `axnavi__*` 도구가 보인다.
- PMS-X SR 상세에서 **분류·배정 추천**을 누르면 몇 초 안에 추천이 나온다.
- `axnavi doctor`의 **과금** 줄이 의도한 경로를 가리킨다.
- 플랫폼 › Insight에 `pmsx`, `axnavi` 호출이 쌓인다.
