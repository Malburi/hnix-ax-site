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
