# 음성 — 말로 묻고 소리로 듣기

현업 창구와 워크스페이스 채팅에 **마이크 단추**가 있다. 말로 물으면 사내 음성 인식 모델이 글로 바꾸고, 답은 소리로 읽어 준다. 음성도 모델 호출이라 **게이트웨이를 지난다**(키·예산·감사·Insight).

<video controls preload="metadata" poster="video/features/platform-12.jpg" src="video/features/platform-12.mp4#t=236" style="width:100%;border-radius:10px"></video>

<figure><img src="img/platform-voice.png" alt="현업 창구 — 말로 묻기"><figcaption>현업 창구 — 말로 묻기</figcaption></figure>

## 게이트웨이 — 음성 인식·음성 합성 별칭

게이트웨이에 OpenAI 호환 경로 두 개를 더했다.

| 경로 | 하는 일 |
|---|---|
| `POST /v1/audio/transcriptions` | 음성 인식(multipart — file·model·language·prompt·response_format) |
| `POST /v1/audio/speech` | 음성 합성(글 → 소리) |

모델 별칭의 종류에 **음성 인식**(`transcription`)·**음성 합성**(`speech`)이 있다. 사내에 띄운 whisper 계열 음성 인식 서버(OpenAI 호환)를 프로바이더로 등록하고 별칭(예: `voice-stt`)을 만들면 된다. Insight 에는 `gen_ai.audio` 로 음성 길이(초)가 남는다.

```yaml
voice:
  maxMb: 25          # 음성 인식 파일 상한
  maxSeconds: 300    # 길이를 알 수 있는 파일·화면 녹음의 상한
  recordSeconds: 60  # 화면에서 한 번에 녹음하는 최대 길이
```

## 현업 창구에서 켜기

창구 설정의 **음성**에서 켠다.

- **말로 묻기 (입력창 옆 마이크)** — 음성 인식 별칭, 언어(기본 ko), 받은 글을 바로 보내기(끄면 글로 바뀐 것을 확인하고 보낸다)
- **답 읽어 주기** — 끔 · 브라우저 음성(Windows 의 한국어 음성, 서버를 거치지 않음) · 게이트웨이 음성 합성 별칭, 답이 오면 자동으로 읽기

## 브라우저 마이크 권한

브라우저는 **HTTPS 이거나 localhost** 일 때만 마이크를 쓰게 한다. 사내 HTTP 주소(`http://ax.corp.local:8700`)로 열면 마이크 단추를 눌렀을 때 "이 주소(HTTP)에서는 브라우저가 마이크를 막습니다" 안내가 뜬다. 다음 중 하나를 한다.

- 플랫폼 앞에 HTTPS(사내 인증서)를 둔다 — 권장
- 브라우저 정책으로 그 주소를 안전한 출처로 지정한다(Edge·Chrome `OverrideSecurityRestrictionsOnInsecureOrigin`)

플랫폼의 보안 머리글은 `Permissions-Policy: microphone=(self)`, CSP 에 `media-src 'self' blob:` 이다.

## 알아 둘 것

- 음성 길이(초)는 Insight 에 기록하지만 예산 금액 계산에는 아직 넣지 않는다.
- 작은 음성 인식 모델은 업무 용어(사원·퇴사자 등)를 틀리기 쉽다. 음성 인식 서버에 용어 힌트(prompt)를 주면 낫다.
