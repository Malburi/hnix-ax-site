# 오프라인판 빌드

GitHub Pages(docsify)와 같은 문서를 인터넷 없이 열리는 정적 HTML 로 만든다.

```bash
cd tools
npm install
npm run offline
```

- `../offline/` — `index.html` 을 더블클릭해 연다. 스타일·mermaid·이미지·검색 색인이 폴더 안에 있다.
- `../download/hnix-ax-offline.zip` — 위 폴더를 묶은 것. 온라인 사이트 홈에서 내려받는다.

문서(`*.md`)나 `_sidebar.md`·`index.html` 의 스타일을 바꾸면 다시 빌드해 zip 을 커밋한다.
웹 글꼴(Google Fonts)은 인터넷이 있어야 받으므로 오프라인판은 같은 계열의 시스템 글꼴(맑은 고딕 등)로 보인다.

# 시연 영상과 생태계 그림

E2E 환경(`hnix-ax-platform/e2e/start.ps1`)을 띄운 상태에서 한다. 필요: Edge, ffmpeg, (그림) Python Playwright, (AX-DataLake 실시간 장면) Kafka 브로커 `localhost:9092` — Kafka 4.x 는 JDK 17 이상.

```bash
node tools/demo-prep.mjs                      # 시연 데이터 — 현업 창구 hr-help · 업무 흐름 개선 결과 · 인수인계 퀴즈 · Kafka 토픽·CDC 스트림 → tools/.demo-prep.json
node tools/record-demo.mjs --scenario all     # video/platform·pmsx·axnavi·datalake.mp4
node tools/make-tour.mjs                      # video/tour.mp4 와 포스터(*.jpg)
python tools/make_ecosystem.py                # download/hnix-ax-ecosystem.drawio
python tools/render_drawio.py download/hnix-ax-ecosystem.drawio img/ecosystem 4   # img/ecosystem-p1~4.png
```

- 시나리오(누를 곳·자막)는 `demo-scenarios.mjs`. `--dry` 로 녹화 없이 돌려 보고, `--probe <주소> --app <제품>` 으로 화면의 버튼 글자를 본다.
- AX-NAVI 영상은 IDE 를 임시 프로필로 한 번 더 띄워 찍는다(`ide-session.mjs`). 연습 저장소 파일은 녹화 뒤 되돌린다.
- `demo-kafka-producer.mjs <토픽> [--rate 8] [--seconds 300]` — 모니터링 경보 JSON 을 쉬지 않고 보낸다. AX-DataLake 시나리오가 녹화하는 동안 띄우고 끝나면 끈다. kafkajs 는 AX-DataLake 저장소(`DATALAKE_REPO`)의 것을 빌려 쓴다.
- AX-DataLake 영상을 다시 찍을 때마다 `demo-prep.mjs` 를 먼저 돌린다 — 지난 스트림·테이블을 지우고 새 이름의 토픽을 만든다(Windows Kafka 는 토픽을 지우면 브로커가 멈춘다).
- 공개 영상에 비교 대상(타사) 제품 이름이 나오는 화면은 넣지 않는다.

## SM 업무 흐름 시나리오

요청 한 건을 여러 제품에 걸쳐 끝까지 처리하는 영상 — `demo/scenarios.md`. 시나리오는 `scenario-scenarios.mjs`, 영상은 `video/scenarios/sm-a.mp4`·`sm-b.mp4`.

```bash
node tools/scenario-prep.mjs     # 시험용 고객 ITSM 연결·새 티켓, 현업 창구 모양, 지난 녹화 흔적 정리 → tools/.scenario-prep.json
node tools/record-demo.mjs --scenarios scenario-scenarios.mjs --scenario sm-a --out video/scenarios
node tools/record-demo.mjs --scenarios scenario-scenarios.mjs --scenario sm-b --out video/scenarios
```

- 녹화마다 `scenario-prep.mjs` 를 먼저 돌린다. 시험용 ITSM 티켓은 플랫폼 메모리에만 있어, 플랫폼을 다시 띄우면 처음 5건으로 돌아간다(목록이 깔끔해진다).
- 시나리오 A 는 자동화 흐름 '서비스 요청 분류·처리'(`feature-prep-ai.mjs` 가 만든다)와 감시 트리거 '새 서비스 요청 감시'(`scenario-prep.mjs` 가 만들고 기준선을 잡는다)를 쓴다. 중간의 AX-NAVI IDE 장면은 `r.browser(fn, { ide, ideEnv }, prepare)` 로 웹 영상 안에 IDE 를 띄워 찍는다(로그인은 `prepare` 에서 — 영상에 넣지 않음). 연습 저장소 `EmpDao.java` 는 녹화 뒤 되돌린다.
- 시나리오 B 의 '말로 묻기'는 사내 음성 인식 서버(OpenAI 호환 `/v1/audio/transcriptions`, 기본 `http://127.0.0.1:8796/v1`)가 떠 있어야 글로 바뀐다. 없으면 자주 묻는 질문 버튼으로 대신한다.
- IDE 녹화 공통: 녹화가 승인한 기기만 `tools/.demo-devices.json` 에 적어 두고 그것만 끊는다(사용자 본인 IDE 기기는 건드리지 않음). IDE 가 로그인하며 이 PC 의 Claude Code 설정(`~/.claude.json` 의 MCP `hnix-ax`, `~/.claude/settings.json` 의 사용량 전송)에 써 넣는 녹화용 키는 녹화가 끝나면 되돌린다. 임시 프로필은 `window.dialogStyle: custom` 이라 확인 대화상자가 화면 안에 그려진다(OS 대화상자는 녹화를 멈춘다).
- 영상은 CRF 27 로 나온다. 오프라인 zip(GitHub 100MB 한도) 때문에 올리기 전에 CRF 32 로 다시 압축한다: `ffmpeg -i x.mp4 -c:v libx264 -preset slow -crf 32 -pix_fmt yuv420p -movflags +faststart -an y.mp4`.
- 시험용 ITSM 비밀번호는 플랫폼 비밀 저장소에만 있어 이 PC 의 E2E 데이터에서 읽는다(`PLATFORM_REPO`).
- 포스터: `ffmpeg -ss 4 -i sm-a.mp4 -frames:v 1 -q:v 4 sm-a.jpg`(B 는 9초).

## 기능 전체 영상(장별)

메뉴·탭·버튼을 하나씩 실제로 써 보는 영상 — `demo/features.md`. 시나리오는 `feature-scenarios.mjs`, 영상은 `video/features/<제품>-<장>.mp4`.

```bash
node tools/demo-prep.mjs                     # (레이크 실시간 장면은 Kafka 필요)
node tools/feature-prep.mjs                  # 승인함 대기 건·라우트·예산·사내 개인정보 규칙·원본 연결·문서 묶음 (--only=platform|datalake, --itsm-reset)
node tools/record-demo.mjs --scenarios feature-scenarios.mjs --scenario "pmsx-*" --out video/features
node tools/make-features.mjs                 # 길이·포스터·demo/features.md 장 목록
```

- 메모리가 적은 PC 에서는 장을 하나씩 찍는다(`--scenario platform-3`). 헤드리스 Edge 는 장마다 띄우고 닫는다.
- `--shots <폴더>` 를 주면 버튼·칸을 못 찾은 순간의 화면을 남긴다(시나리오 고칠 때).
- 같은 달·같은 주에 이미 만든 보고서(PMS-X 주간·월간 보고)는 다시 만들지 않고 연 화면을 보여 준다.
