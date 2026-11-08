#!/usr/bin/env node
/*
 * 기능 전체 영상 쪽 만들기 — video/features/*.mp4 의 길이를 재고 포스터를 떠서 demo/features.md 의 장 목록을 채운다.
 *   node tools/make-features.mjs
 * 영상은 record-demo.mjs --scenarios feature-scenarios.mjs --out video/features 로 찍는다.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIOS } from "./feature-scenarios.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VID = join(ROOT, "video", "features");
const FF = process.env.FFMPEG ?? "ffmpeg";
const PROBE = process.env.FFPROBE ?? "ffprobe";

const PRODUCTS = [
  { key: "platform", name: "AX Platform", lead: "공통 AI 기반 — 모든 AI 호출·도구 호출·현업 문의가 지나는 곳." },
  { key: "pmsx", name: "PMS-X", lead: "SI 구축 관리와 SM 운영 — As-Is 분석, 일정·자원, 산출물·품질, 서비스 요청·장애·처리 기한." },
  { key: "axnavi", name: "AX-NAVI IDE", lead: "레거시 개발용 AI IDE — 로그인(기기 승인), 스킬, 변경 리뷰·보안 점검·단계 게이트." },
  { key: "datalake", name: "AX-DataLake", lead: "사내 레이크하우스 — 수집(파일·원본·문서·Kafka), 카탈로그·SQL·AI 질문, 온톨로지·거버넌스, 보고서형 엑셀·비정형 문서·문서 → 표(AI)." },
];

/** 장마다 무엇을 보여 주는지 — 화면에서 실제로 누르는 순서대로 */
const DESC = {
  "platform-1": ["로그인(로컬·사내 LDAP·SSO) → **대시보드**: 오늘 AI 사용·비용, 통제(승인 대기·정책 차단·개인정보), 현업 창구, 지금 확인할 일, 바로 가기", "**화면 테마** 바꾸기 · **비밀번호 바꾸기**", "**내 연결 설정** — 상황(구독·클라우드 계약·API 키·없음)별 안내, 필요한 키 한 번에 발급, 관리자용 전 직원 배포", "**내 AX-NAVI 기기** — 승인한 PC 목록과 끊기"],
  "platform-2": ["**개요** — 흐름 그림, 오늘 요청·토큰·비용·개인정보·차단·응답 시간, 모델 연결 상태, 설정 점검표", "**시험 호출** — 전화번호가 든 문장을 보내 사내 모델로 가고 `[전화번호_1]`로 가려져 나가는 것을 확인", "**내 키** 발급(권한·허용 모델·등급·분당 한도) · **모델 별칭** 수정(대상·폴백) · **모델 연결** 추가", "**라우트·예산** — 규칙, 시뮬레이터(개인정보가 있으면 사내 모델로), 예산 · **개인정보 보호** — 규칙 시험(사내 규칙 '사번' 포함) · **요청 로그**"],
  "platform-3": ["**개요** — 흐름 그림, 오늘 호출·거부·승인 대기, 서버별 상태와 도구 수", "**연결 · 내 도구** — 연결 설정 붙여 넣기, 도구를 서버별 한글 이름으로, '프로젝트 목록' 도구 시험", "**서버** 동기화·등록 · **도구 승인**(스키마 확인) · **정책** 규칙 · **호출 기록**", "**승인함**(왼쪽 메뉴 맨 위, 대기 건수 배지) — 사람 승인 정책에 걸린 호출을 검토·승인"],
  "platform-4": ["**문서 RAG** — 컬렉션, 문서 올리기(급여 마감 점검표), 키워드+의미 검색 순위", "**워크스페이스 채팅** — 근거 컬렉션과 서버별 도구 고르기, 질문 → 근거 절과 함께 답, 👍", "**업무 흐름 개선** — 새 분석, As-Is 흐름(근거 등급·레거시 화면), Pain point, To-Be, 설계도(BPMN·Mermaid)"],
  "platform-5": ["**에이전트** — ITO 기본 에이전트 틀, 새 에이전트, **트리거**(웹훅·예약·감시)와 트리거 기록", "sm-helper 실행 — 모델 → PMS-X 도구 → 모델 단계와 시간, 지난 실행 기록", "**런북** — 등록(HTTP·명령·매개변수 형식·위험도·원복), 실행 요청 → 다른 관리자 승인"],
  "platform-6": ["**현업 창구(현업 직원 화면)** — 매뉴얼 근거 답 · 모르는 질문은 담당자에게 넘겨 PMS-X 서비스 요청으로 접수", "**현업 창구 관리** — 창구별 성과, **매뉴얼 보강**(답을 적어 넣고 같은 질문을 다시 물어 이제 답하는지 확인), 시험 질문, 창구 설정"],
  "platform-7": ["**처음 연결하기** 안내 → **시험용 연결 만들기**(플랫폼 안의 가상 ServiceNow, 티켓 5건)", "**연결 시험** → **지금 동기화**(고객 티켓 → PMS-X 서비스 요청, 티켓에 요청 번호 댓글) → 동기화 기록 · 연결 설정"],
  "platform-8": ["**AI 사용 현황 › 사용량·비용**(Insight) — 모델·팀·작업번호·소스·도구별 묶어 보기, 최근 기록, 단가표, 수집 소스", "**품질·지연** — 모델 지연·오류, 도구 성공률, 정책 위반, 에이전트, 만족도 · **외부 AI·자산**(외부 AI 사용·AI 자산 대장·수집 원천)", "**생산성 보고서** 계산·저장소·기준선", "**평가 › 모델 평가** — 정답 세트 사례, 사내 모델 두 개(hnix-local·hnix-smart)를 네 세트로 실제 비교 → 권장 모델과 '업무 별칭에 반영'"],
  "platform-9": ["**AX-NAVI 조직 설정** — 묶음 파일, 대상·우선순위, 배포 이력 · **사용 허가** — 허가·기기·유출본 확인", "**사용자** · **워크스페이스**(멤버) · **감사 로그**(거르기)", "**현장 연결 점검** — 연결 시험 포함 점검"],
  "platform-10": ["**자동화 흐름** — 예시 흐름 '서비스 요청 분류·처리' 편집기: 모델 질문 · 조건 분기 · 에이전트 실행 · 사람 확인 노드 설정, **판 기록**, 트리거", "현업 담당자(dev1)가 **시험 실행**(자세히 기록) → 담당자 확인에서 멈춤 → 관리자가 **승인함**에서 승인 → 자동으로 이어 감", "**실행 디버거** — 폭포형 단계, 모델 단계의 보낸 글·답, 도구 인자·결과, 사람 확인 · 에이전트 실행도 같은 디버거로"],
  "platform-11": ["**에이전트 평가** — sm-helper 시험 문항 4개(도구 사용·SR 번호 정규식·턴·범위 밖 질문·모델 채점), 문항 편집", "지난 평가 결과와 문항별 이유, 문항의 **디버거**", "**평가 실행** → **이전과 비교**(통과율·점수·지연·토큰, 문항마다 좋아짐·나빠짐) — 사내 3B 모델의 답 흔들림이 그대로 드러남"],
  "platform-12": ["**업무 시스템 연결** — SAP(OData) 연결: 주소·계정 → 연결 시험 → 도구·기본 정책(조회 허용·쓰기 승인 필요) → 허브 등록", "**일반 REST** — OpenAPI 문서를 읽어 operation 고르기, API 키 헤더 → 연결 시험 → 저장 · MCP 허브 서버 목록", "**외부 에이전트 가져오기** — LangGraph 서버(구매 담당 에이전트) → 연결 시험 → 공개 → 실행과 디버거의 '외부 에이전트' 단계", "**음성** — 게이트웨이 음성 인식 별칭(voice-stt), 현업 창구에서 마이크로 묻기 → 사내 음성 인식(whisper) → 매뉴얼 근거 답"],
  "platform-13": ["**왼쪽 메뉴 묶음** — 관리자 27칸 → 22칸, 비슷한 화면은 메뉴 한 칸 + 화면 위 묶음 탭(AI 사용 현황 · 평가 · AX-NAVI 관리)", "**승인함** — 메뉴 맨 위, 내가 결정할 대기 건수 배지 · 도구 호출·런북·흐름의 사람 확인을 한곳에", "**문서 새 판으로 바꾸기** — 고친 급여 마감 점검표를 다시 올리면 묻고 옛 판을 정리, 검색은 새 판만 · 따로 둔 옛 판에는 '옛 판' 표시", "**현업 창구** — 접수할 PMS-X 프로젝트를 이름으로 · **일반 사용자**는 쓸 수 있는 메뉴 13칸만"],
  "pmsx-1": ["**홈** — 내 일·프로젝트 현황, PM·고객·포트폴리오 대시보드", "**통합 검색**(요구사항·이슈·화면·테이블·컬럼) · 어두운 테마 · **공지** · **위키**(기본 공간)", "**고객 포털** — 고객 계정으로 새 요청 등록 → 내 요청"],
  "pmsx-2": ["**시스템 관리** · **수집 회차**(변경 상세·리포트) · **분석 진척**(담당 배정)", "**화면 분석 뷰어** — 컴포넌트·이벤트 목록, CRUD, 코드 순서도, 통합 추적, 데이터 흐름도, AI 한국어 설명, 트리거, 배치 바꾸기, 편집 모드, 화면 메모, 분석 이력"],
  "pmsx-3": ["**테이블 정의서**(TB_EMP) · **DB 객체** · **ERD**(추정 관계) · **CRUD 매트릭스**(화면·요소)", "**화면 이동 맵** · **영향도 분석**(TB_EMP 를 바꾸면) · **산출물 내보내기**(XLSX·PPTX) · **프로그램 목록**"],
  "pmsx-4": ["**WBS·간트**(배율) · **칸반** · **베이스라인 비교** · **주간보고 생성**", "**인력 풀**(스킬 매트릭스) · **인력 편성**(가용량 히트맵) · **작업 배분** · **작업일지**(승인함) · **MM 실적**"],
  "pmsx-5": ["**산출물**(이력) · **요구사항** · **추적표**(누락) · **감리 대응**", "**이슈** · **리스크**(매트릭스) · **변경요청** · **테스트**(회차 결과) · **결함**(품질 리포트) · **회의록**(액션아이템·의사결정 로그)"],
  "pmsx-6": ["**서비스 요청** — 상세, **AI 분류·배정 추천**(사내 모델), **구현 명세**", "**장애**(경보 자동 생성·장애보고서) · **문제** · **변경**(캘린더) · **정기 작업**"],
  "pmsx-7": ["**자산**(만료 D-day) · **지식 문서**(AI 초안) · **처리 기한**(월별 준수율)", "**운영 보고서 생성** · **작업 템플릿** · **인수인계 퀴즈**(응시·결과)"],
  "pmsx-8": ["**프로젝트**(투입 체크리스트) · **사용자** · **방법론 템플릿** · **공통코드·용어 사전**", "**엑셀 템플릿** · **처리 기한 정책** · **알림 설정** · **감사 로그** · **시스템**"],
  "pmsx-9": ["**인력 편성** — 인원 추가(투입 기간은 프로젝트 기간으로) · 투입 기간으로 월 MM 채우기(영업일 비율)", "**WBS 작성** — 기간(영업일)·선행(`2.3.1, 2.3.2SS+1`) 칸 바로 입력, Enter 로 아래 칸, Ctrl·Shift 클릭 여러 행 + Alt+Shift+화살표 계층 편집, 담당자 칸, 엑셀·메모장 붙여넣기, 표·간트 경계 조절", "**작업 배분** — WBS 작업·화면 분석 탭, 다른 프로젝트까지 합친 주간 배정률, 배정 전 과배정 경고"],
  "axnavi-1": ["잠긴 IDE → 승인 코드 → 플랫폼에서 **이 기기 승인** → 스킬·엔진 받기", "첫 화면(나침이) · **모드** · `/` **스킬 26개** 목록", "**사용 허가 상태** · **환경 점검** · **AI 연결 설정** · **인덱스 갱신**"],
  "axnavi-2": ["`/flow` — 버튼 하나의 처리 흐름을 화면부터 테이블까지", "`/impact` — 컬럼을 바꾸면 어디가 영향받는지와 위험도 — 에이전트가 전수 색인을 MCP 도구로 조회"],
  "axnavi-3": ["`/sql` — SQL 사용처·성능·보안 리뷰", "`/find` — 기능 위치(화면 → 컨트롤러 → SQL → 테이블)"],
  "axnavi-4": ["**변경 리뷰** STOP → **Findings**(묶기·필터) → 상세 → **AX-NAVI 로 수정**(읽기·저장 승인) → 다시 리뷰", "**보안 점검(OWASP)** · **단계 게이트 점검**"],
  "datalake-1": ["**한눈에 보기**(지금 정리) · **카탈로그** — 미리 보기·열·시점 이력·바뀐 행, AI 설명 초안, 설명 고치기", "**SQL 작업창** — 틀(시점 조회·JSON·시간대별), 실행 기록, **AI 질문** · **계보**"],
  "datalake-2": ["**파일 수집** — CSV 를 끌어다 sales.monthly_orders 로", "**원본 연결** — 연결 추가, 동기화 실행(병합·워터마크), 동기화 만들기", "**문서(비정형)** — 의미 검색, 문서 묶음 · **실시간 수집** — Kafka 스트림을 화면에서 만들고 시작 → SQL 로 건수 → 멈추기"],
  "datalake-4": ["**보고서형 엑셀** — 제목 줄·두 줄 머리글·병합·합계 행을 알아서 펴고, 시트마다 테이블로 → SQL 로 본부별 집계", "**문서(비정형)** — 견적서 PDF·계약서 Word·장애 보고 PPT·실적 엑셀·점검표 스캔·회의록을 개인정보를 가려 넣은 파일 목록, 형식 섞어 찾기", "**문서 → 표(AI)** — 견적서 요약 정의 → 사내 모델 추출 → 검토 → 승인, 모델이 틀린 계약 요약은 **고쳐서 승인** → 추출 테이블 SQL · 계보"],
  "datalake-3": ["**온톨로지** — 장애 → 직전 72시간 변경 → 관계 그래프 → 진단 에이전트 요청 → 엔지니어 승인 → 정의(유형·관계·액션)", "분석가 화면의 가림·행 제한 · **거버넌스**(조회 권한·열 가림·행 제한·개인정보 열 찾기)", "**내 API 키** · **사용자** · **감사 기록**"],
};

const seconds = (f) => Number(spawnSync(PROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim());
const mmss = (s) => (s >= 60 ? `${Math.floor(s / 60)}분 ${String(Math.round(s % 60)).padStart(2, "0")}초` : `${Math.round(s)}초`);

let total = 0;
const parts = [];
for (const p of PRODUCTS) {
  const keys = Object.keys(SCENARIOS).filter((k) => k.startsWith(`${p.key}-`) && existsSync(join(VID, `${k}.mp4`)));
  if (!keys.length) continue;
  const lens = keys.map((k) => seconds(join(VID, `${k}.mp4`)));
  const sum = lens.reduce((a, b) => a + b, 0);
  total += sum;
  parts.push(`## ${p.name} — ${keys.length}장 · ${mmss(sum)}\n\n${p.lead}\n`);
  keys.forEach((k, i) => {
    spawnSync(FF, ["-y", "-loglevel", "error", "-ss", "4", "-i", join(VID, `${k}.mp4`), "-frames:v", "1", "-vf", "scale=960:-1", "-q:v", "4", join(VID, `${k}.jpg`)]);
    // "AX Platform ① 로그인 …" → "로그인 …"(제품 이름과 장 번호는 위 제목에 있다)
    const title = SCENARIOS[k].title.replace(/^.*?[①-⑳]\s*/, "");
    parts.push(`### ${i + 1}. ${title} (${mmss(lens[i])})\n\n<video controls preload="none" poster="video/features/${k}.jpg" src="video/features/${k}.mp4" style="width:100%;border-radius:10px"></video>\n\n${(DESC[k] ?? []).map((d) => `- ${d}`).join("\n")}\n`);
  });
}
const page = join(ROOT, "demo", "features.md");
const head = readFileSync(page, "utf8").split("<!-- CHAPTERS -->")[0];
const toc = PRODUCTS.filter((p) => parts.some((x) => x.startsWith(`## ${p.name}`))).map((p) => `[${p.name}](#${p.name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-")})`).join(" · ");
writeFileSync(page, `${head}<!-- CHAPTERS -->\n모두 ${mmss(total)}. ${toc}\n\n${parts.join("\n")}\n## 다시 찍기\n\n제품 화면을 고친 뒤 이 영상을 새로 찍는 방법 — E2E 환경과(AX-DataLake 실시간 장면은) Kafka 브로커를 띄운 상태에서:\n\n\`\`\`powershell\nnode tools/demo-prep.mjs        # 현업 창구·업무 흐름 개선·퀴즈·Kafka 토픽\nnode tools/feature-prep.mjs     # 승인함 대기 건·라우트·예산·사내 개인정보 규칙·원본 연결(ERP 계약)\nnode tools/demo-servers.mjs     # (⑩~⑫) 시험용 SAP·사내 REST·구매 담당 에이전트 — 따로 띄워 둔다\n# (⑫ 음성) OpenAI 호환 음성 인식 서버를 http://127.0.0.1:8796/v1 에 띄운다(예: faster-whisper small)\nnode tools/feature-prep-ai.mjs  # 음성 인식 별칭·창구 음성·예시 흐름·평가 문항과 기준 평가, 녹화에서 새로 만들 것 정리\nnode tools/feature-prep-office.mjs  # (레이크 ④) 문서 묶음 office-docs · '계약 요약' 추출을 돌려 둠\nnode tools/record-demo.mjs --scenarios feature-scenarios.mjs --scenario "platform-*" --out video/features\nnode tools/make-features.mjs    # 길이·포스터·이 쪽의 장 목록\n\`\`\`\n\n시나리오는 \`tools/feature-scenarios.mjs\`(장마다 누를 곳과 자막). 화면 문구가 바뀌면 시나리오의 글자도 고친다. \`--dry\` 로 녹화 없이 돌려 보고, \`--shots <폴더>\` 를 주면 못 찾은 곳의 화면을 남긴다.\n`);
console.log(`-> ${page} (${mmss(total)})`);
