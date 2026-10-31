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
node tools/demo-prep.mjs                      # 시연 데이터 — 현업 창구 hr-help · Process Studio 결과 · 인수인계 퀴즈 · Kafka 토픽·CDC 스트림 → tools/.demo-prep.json
node tools/record-demo.mjs --scenario all     # video/platform·pmsx·axnavi·datalake.mp4
node tools/make-tour.mjs                      # video/tour.mp4 와 포스터(*.jpg)
python tools/make_ecosystem.py                # download/hnix-ax-ecosystem.drawio
python tools/render_drawio.py download/hnix-ax-ecosystem.drawio img/ecosystem 4   # img/ecosystem-p1~4.png
```

- 시나리오(누를 곳·자막)는 `demo-scenarios.mjs`. `--dry` 로 녹화 없이 돌려 보고, `--probe <주소> --app <제품>` 으로 화면의 버튼 글자를 본다.
- AX-NAVI 영상은 IDE 를 임시 프로필로 한 번 더 띄워 찍는다(`ide-session.mjs`). 연습 저장소 파일은 녹화 뒤 되돌린다.
- `demo-kafka-producer.mjs <토픽> [--rate 8] [--seconds 300]` — 모니터링 경보 JSON 을 쉬지 않고 보낸다. AX-DataLake 시나리오가 녹화하는 동안 띄우고 끝나면 끈다. kafkajs 는 AX-DataLake 저장소(`DATALAKE_REPO`)의 것을 빌려 쓴다.
- AX-DataLake 영상을 다시 찍을 때마다 `demo-prep.mjs` 를 먼저 돌린다 — 지난 스트림·테이블을 지우고 새 이름의 토픽을 만든다(Windows Kafka 는 토픽을 지우면 브로커가 멈춘다).
- 공개 영상에 비교 대상(타사) 제품 이름이 나오는 화면(플랫폼 대시보드 카드)은 넣지 않는다.
