# SM 운영과 AI 보조

PMS-X의 SM 운영은 SR·장애·문제·변경·배포·정기 작업·KB·SLA·월간 운영보고·고객 포털을 다룬다. SLA는 업무시간과 공휴일을 반영해 계산하고, SR마다 남은 시간과 임박·위반을 보여 준다. 여기에 경보 접수와 AI 보조 기능이 더해졌다.

## 경보 접수

모니터링 도구(Zabbix, Prometheus Alertmanager 등)가 보낸 경보를 장애나 SR로 만든다.

<figure><img src="img/pmsx-alerts.png" alt="장애 화면 상단의 경보 목록과 자동 생성된 장애"><figcaption>경보 목록. 같은 경보는 하나로 묶이고(×2) 장애·SR로 이어진다.</figcaption></figure>

```bash
POST /api/v1/projects/{projectId}/alerts          # 한 건
POST /api/v1/projects/{projectId}/alerts/batch    # 여러 건 (Alertmanager 웹훅처럼)
```

| 심각도 | 처리 |
|---|---|
| critical | 장애 1등급 |
| major | 장애 2등급 |
| minor | SR(장애 유형) P2 |
| warning | SR P3 |
| info | 기록만 |

- 같은 (프로젝트·출처·지문) 경보가 열려 있으면 새로 만들지 않고 횟수와 마지막 시각만 올린다. SR 수준으로 열린 경보가 장애 수준으로 올라오면 그때 장애를 만든다(격상).
- 해소(resolved)는 장애 복구 시각과 타임라인, SR 내부 코멘트로 남긴다. 종료와 원인 분석(RCA)은 사람이 한다.
- 별도 API 키를 쓰지 않는다. 운영 역할(PM·PL·OPERATOR)을 가진 서비스 계정으로 로그인해 보낸다.

## AI 보조 — 켤 때만

AI 기능은 기본으로 꺼져 있다. 켜면 AX Platform 게이트웨이(OpenAI 호환)로만 호출한다. 끈 상태에서는 외부 호출이 0건이다.

```yaml
pmsx:
  ai:
    enabled: ${PMSX_AI_ENABLED:false}
    base-url: ${PMSX_AI_BASE_URL:}        # 예: http://ax-platform:8700/v1
    api-key: ${PMSX_AI_API_KEY:}          # 게이트웨이 llm 키
    model: ${PMSX_AI_MODEL:hnix-smart}
    data-class: ${PMSX_AI_DATA_CLASS:internal}   # restricted 면 게이트웨이가 로컬 모델만 쓴다
```

화면에는 어떤 모델 별칭으로 만든 결과인지가 늘 표시된다.

### SR 분류·배정 추천

<figure><img src="img/pmsx-sr-triage.png" alt="SR 상세의 분류·배정 추천 패널"><figcaption>유형·우선순위·대상 화면·담당자 추천. "AI 선택" 표시와 반영 버튼.</figcaption></figure>

- PMS-X가 먼저 후보를 결정론적으로 좁힌다: 코드 목록, 화면 그래프, 유사 SR, 화면 담당자.
- 모델은 그 **후보 안에서만** 고르고 이유를 적는다. 목록 밖 값은 받아들이지 않는다.
- 운영자가 확인하고 **반영**해야 저장된다.

### 유사 사례와 KB 초안

<figure><img src="img/pmsx-kb-draft.png" alt="종료 SR에서 만든 KB 초안 대화상자"><figcaption>종료된 SR의 본문과 처리 코멘트를 요약한 KB 초안. 출처 SR이 끝에 남는다.</figcaption></figure>

처리가 끝난 SR에서 증상·원인·처리 내용·재발 방지·관련 사례로 정리한 초안을 만든다. 사실을 확인하고 등록하면 다음 SR에서 유사 사례로 추천된다.

### 버튼·함수 설명 초안과 근거 등급

<figure><img src="img/pmsx-ai-desc.png" alt="조회 버튼 설명 탭의 AI 초안과 근거 충분 등급"><figcaption>설명 탭. 근거 등급과 초안·확정 상태가 함께 보인다.</figcaption></figure>

As-Is 뷰어의 버튼·함수에 설명 초안을 만든다. 근거는 수집기가 만든 워크플로우(이벤트 → 함수 → SQL → 테이블)와 그 연결의 신뢰도다.

| 등급 | 뜻 |
|---|---|
| 녹색 · 근거 충분 | 흐름이 테이블까지 이어지고 모든 연결의 신뢰도가 0.8 이상 |
| 황색 · 근거 일부 | 확정되지 않은 저신뢰 연결이 있거나 흐름이 중간에서 끊긴다. 초안에 확인할 점이 함께 적힌다 |
| 적색 · 근거 부족 | 흐름이 없다. 초안을 믿지 말고 화면 담당자에게 확인한다 |

초안은 **확정**을 눌러야 산출물에 쓰인다. 소스가 다시 수집되어 흐름이 바뀌면 "다시 확인 필요"로 표시된다.

## 용어 사전과 관계

<figure><img src="img/pmsx-term-relations.png" alt="용어 사원의 동의어와 연결된 화면, 추천 테이블·컬럼"><figcaption>용어 "사원" — 동의어, 연결된 화면 3개, 추천 테이블과 컬럼</figcaption></figure>

- 용어마다 동의어를 둔다(예: 사원 — 직원, 임직원, 사번).
- 시스템별로 화면·테이블·컬럼과 연결한다. 이름과 컬럼 코멘트가 일치하는 대상을 추천하고, 사람이 확인한 것만 연결한다.
- SR 본문에 동의어가 쓰여도 같은 화면과 테이블로 찾아간다.
