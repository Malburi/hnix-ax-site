# AX-NAVI

AX-NAVI는 개발자용 AI 에이전트다. 낯선 레거시 코드베이스를 스크립트로 전수 색인해 지도를 만들고, 그 위에서 기능 찾기·흐름 추적·영향 분석·안전 변경·신규 기능·마이그레이션 계획·SQL 리뷰를 수행한다. 추측 대신 근거를 남기는 것이 설계 원칙이다.

> 기본 사용법(설치, 대화형 모드, 스킬·에이전트, 인덱스)은 [AX-NAVI 문서](https://malburi.github.io/AX-NAVI-CLI/)에 있다. 이 절은 HNIX AX 제품군과 함께 쓸 때 더해진 기능을 다룬다.

<div class="home-grid">
  <a class="home-card" href="#/axnavi/review">
    <span class="eyebrow">CI 게이트</span>
    <strong>변경 리뷰와 보안 점검</strong>
    <span class="desc">AI 없이 같은 변경에 늘 같은 판정. GO / HOLD / STOP과 종료 코드로 머지 요청을 막는다.</span>
  </a>
  <a class="home-card" href="#/axnavi/sdlc">
    <span class="eyebrow">산출물</span>
    <strong>SDLC 산출물과 단계 게이트</strong>
    <span class="desc">조직 양식으로 산출물을 만들고, 요구 → 설계 → 개발 → 테스트 단계 전환을 판정한다.</span>
  </a>
  <a class="home-card" href="#/axnavi/integration">
    <span class="eyebrow">연동</span>
    <strong>플랫폼 연동</strong>
    <span class="desc">외부 MCP 서버, 사용량 전송, 사내 게이트웨이와 로컬 모델.</span>
  </a>
  <a class="home-card" href="#/getting-started/connect">
    <span class="eyebrow">인증</span>
    <strong>구독·키·게이트웨이</strong>
    <span class="desc">요금제를 보지 않고 세 경로 중 쓸 수 있는 것을 고른다. 조직 정책으로 허용 경로를 정한다.</span>
  </a>
</div>

## 명령 한눈에

```text
axnavi                          대화형 모드
axnavi ask <요청>               한 번 묻고 답받기 (읽기 전용)
axnavi doctor                   실행 환경 진단 (실행 경로 · 과금 · 조직 정책)

axnavi index build|status|refresh   코드베이스 색인 (AI 불필요)

axnavi review [--diff A..B]     변경 리뷰 GO/HOLD/STOP (AI 불필요 · 종료 코드 0/3/4)
axnavi scan security [경로...]  저장소 보안 점검 (AI 불필요)

axnavi doc new <종류|all>       SDLC 산출물 양식
axnavi doc list                 산출물 현황
axnavi adr new "<제목>"          아키텍처 결정 기록
axnavi gate <req|design|dev|test>  단계 게이트 (AI 불필요 · 종료 코드 0/3/4)
```

## 무엇을 근거로 판단하나

| 판단 | 근거 | AI 호출 |
|---|---|---|
| 기능 위치, 호출 관계, SQL·테이블 사용처 | 전수 색인(심볼, 호출 그래프, SQL, 트랜잭션, 엔드포인트, 화면 이벤트) | 없음 |
| 변경 리뷰 판정 | 색인 + 보안 규칙 + 실행한 검증 명령 결과 | 없음 |
| 단계 게이트 | 산출물 필수 절 작성 여부, 승인 상태, ADR, 리뷰·보안 점검 결과 | 없음 |
| 설명, 수정 제안, 산출물 서술 | 위 근거를 붙여 모델이 작성 | 있음 |

같은 입력에는 늘 같은 판정이 나오므로 머지 요청 게이트로 쓸 수 있다.

## 지원하는 레거시

Struts 1과 자체 프레임워크, Spring(MyBatis·iBatis), JSP, Nexacro·XPlatform·MiPlatform, WebSquare, Vue·React, ASP.NET·WinForms, EUC-KR 소스. 인코딩은 도구가 도는 동안만 UTF-8로 바꾸고 끝나면 되돌린다.
