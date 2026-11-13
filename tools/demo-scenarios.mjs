/*
 * 시연 영상 시나리오 — record-demo.mjs 가 하나씩 녹화한다.
 * 주소·계정은 E2E 환경(hnix-ax-platform/e2e/e2e.config.json)과 같다.
 * r 의 조작: login · go · caption · click(글자) · clickSel · type · press · scroll · wheel · find · clickAt
 */
export const APPS = {
  platform: { url: "http://127.0.0.1:8710", loginApi: "/api/v1/auth/login", users: { admin: { loginId: "admin", password: "Admin!2026" }, dev: { loginId: "dev1", password: "Dev1!2026" } } },
  pmsx: { url: "http://127.0.0.1:8080", loginApi: "/api/v1/auth/login", users: { op: { loginId: "op.seo", password: "pmsx1234!" }, admin: { loginId: "admin", password: "pmsx1234!" }, customer: { loginId: "customer", password: "pmsx1234!" } } },
  datalake: { url: "http://127.0.0.1:8790", loginApi: "/api/v1/auth/login", users: { ana: { loginId: "ana01", password: "Lake!2026" }, eng: { loginId: "eng", password: "Lake!2026" }, admin: { loginId: "admin", password: "Lake!2026" } } },
};

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export const DEMO_REPO = "C:/Users/onlys/axnavi-ide-demo";
/** kafkajs 를 빌려 쓰는 AX-DataLake 저장소(시연 준비·생산기) */
export const DATALAKE_REPO = "C:/Users/onlys/ax-datalake";
const DL_READY = "document.readyState === 'complete' && !!document.querySelector('.n-layout-header')";

/*
 * 녹화용 IDE 기기 — 녹화가 승인한 기기 ID 만 tools/.demo-devices.json 에 적어 두고 그것만 끊는다.
 * 기기 이름은 PC 이름이라 사용자 본인 IDE 와 구별되지 않으므로, dev1 의 기기를 통째로 끊지 않는다(한 사람 2대 한도).
 */
const DEMO_DEVICES = new URL("./.demo-devices.json", import.meta.url);
async function devApi() {
  const a = APPS.platform;
  const tok = (await (await fetch(`${a.url}${a.loginApi}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a.users.dev) })).json()).accessToken;
  const h = { authorization: `Bearer ${tok}` };
  const list = async () => ((await (await fetch(`${a.url}/api/v1/axnavi/my/devices`, { headers: h })).json()).items ?? []).filter((x) => x.status === "active");
  return { tok, h, list };
}
const remembered = () => (existsSync(DEMO_DEVICES) ? JSON.parse(readFileSync(DEMO_DEVICES, "utf8")) : []);
/** 지금 dev1 의 활성 기기 ID — 승인 전에 찍어 두고 rememberNewDevices 에 넘긴다 */
export async function devDeviceIds() {
  return (await (await devApi()).list()).map((d) => d.id);
}
/** 승인 뒤 새로 생긴 기기를 녹화용으로 적어 둔다 — IDE 가 승인을 받아 로그인을 마쳐야 기기가 활성이 되므로 나타날 때까지 기다린다 */
export async function rememberNewDevices(before, waitMs = 60000) {
  const api = await devApi();
  for (let t = 0; t <= waitMs; t += 2000) {
    const fresh = (await api.list()).map((d) => d.id).filter((id) => !before.includes(id));
    if (fresh.length) {
      writeFileSync(DEMO_DEVICES, JSON.stringify([...new Set([...remembered(), ...fresh])]));
      return fresh;
    }
    await pause(2000);
  }
  console.warn("  ! 새로 승인한 녹화용 기기가 목록에 나타나지 않았습니다 — 다음 녹화 전에 확인하세요");
  return [];
}
/** 녹화가 승인했던 기기만 끊는다 — dev1 토큰을 돌려준다 */
export async function freeDemoDevices() {
  const { tok, h, list } = await devApi();
  const mine = remembered();
  for (const d of (await list()).filter((x) => mine.includes(x.id))) await fetch(`${APPS.platform.url}/api/v1/axnavi/my/devices/${d.id}`, { method: "DELETE", headers: h });
  const left = await list();
  if (left.length >= 2) throw new Error(`dev1 에 녹화용이 아닌 기기가 ${left.length}대 있어 새 기기를 승인할 수 없습니다 — 사용자 기기는 끊지 않습니다`);
  return tok;
}

/** AX-NAVI IDE 임시 프로필의 출력 창 로그에서 기기 승인 코드를 찾는다 */
export function ideLoginCode(profile) {
  const walk = (d) => {
    try {
      return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    } catch {
      return [];
    }
  };
  for (const f of walk(join(profile, "logs")).filter((f) => /AX-NAVI\.log$/.test(f))) {
    const m = /기기 승인 대기 — 코드 ([A-Z]{4}-[A-Z]{4})/.exec(readFileSync(f, "utf8"));
    if (m) return m[1];
  }
  return null;
}

/** 화면 언어(한국어·영어)에 상관없이 채팅 버튼을 글자로 — 정확히 같은 글자만('자동 승인' 같은 다른 칸을 누르지 않게) */
export async function chatButton(r, ...labels) {
  for (const l of labels) {
    const p = await r.webFind(l, { selector: "button, vscode-button", exact: true, timeout: 400 });
    if (p) return p;
  }
  return null;
}

/**
 * 에이전트 작업이 끝날 때까지 승인 요청을 처리한다 — '작업 완료'가 하나 더 늘면 끝.
 * 명령 실행은 연습 저장소의 AX-NAVI 스크립트·색인 조회일 때만 승인하고, 그 밖은 거절한다.
 * captions[n] — n 번째 승인 직전에 띄울 자막
 */
export async function runAgent(r, captions = {}, limitSec = 180) {
  const done = (t) => (t.match(/Task Completed|작업 완료/g) || []).length;
  const start = done(await r.webText());
  let approvals = 0;
  for (let t = 0; t < limitSec; t += 3) {
    const text = await r.webText();
    if (done(text) > start) return true;
    const run = await chatButton(r, "명령", "실행", "Run");
    if (run) {
      const chat = text.split("\n---\n")[0].slice(-800);
      const safe = /axnavi|_workspace|\.claude[\/]/i.test(chat) && !/\b(rm|del|curl|wget|Invoke-WebRequest|git\s+push)\b/i.test(chat);
      console.log(`  명령 실행 요청 — ${safe ? "승인" : "거절"}: ${chat.slice(-300).replace(/\s+/g, " ")}`);
      await pause(1500);
      if (safe) await r.clickAt(run);
      else {
        const deny = await chatButton(r, "거부", "Deny");
        if (deny) await r.clickAt(deny);
      }
      await pause(3000);
      continue;
    }
    const btn = (await chatButton(r, "승인", "Approve")) ?? (await chatButton(r, "저장", "Save"));
    if (btn) {
      approvals++;
      if (captions[approvals]) await r.caption(...captions[approvals]);
      await pause(1800);
      await r.clickAt(btn);
    }
    await pause(3000);
  }
  console.warn("  ! 에이전트 작업이 제한 시간 안에 끝나지 않았습니다");
  // 원인을 볼 수 있게 — 채팅 마지막 글과 그 순간 화면(--shots)
  const tail = (await r.webText().catch(() => "")).split("\n---\n")[0].slice(-700).replace(/\s+/g, " ");
  console.warn(`    채팅 끝: ${tail}`);
  await r.miss("에이전트-시간초과").catch(() => undefined);
  return false;
}

export const SCENARIOS = {
  axnavi: {
    title: "AX-NAVI IDE — 로그인(기기 승인) · 스킬 · 변경 리뷰 · AI 로 수정",
    ide: DEMO_REPO,
    // 로그인 승인 주소를 PC 브라우저 대신 출력 창에 남긴다 — 승인은 영상 안의 브라우저 장면에서 한다
    ideEnv: { AXNAVI_SELFTEST: "login" },
    // 모델이 생각하는 동안 멈춘 화면은 1.2초까지만(영상 시간 압축)
    maxGap: 1.2,
    async run(r, A) {
      const file = `${DEMO_REPO}/src/main/java/com/hd/hr/EmpDao.java`;
      const before = readFileSync(file);
      const statusText = () => r.eval(`[...document.querySelectorAll('.statusbar-item')].map((e) => e.innerText).join(' | ')`).catch(() => "");
      try {
        // ── 1. 잠긴 설치본 → 로그인(기기 승인)
        await pause(3000);
        await r.clickAt({ x: 1290, y: 400 });
        await r.caption("AX-NAVI IDE — 허가된 사람·기기에서만 동작합니다", "로그인 전에는 AI·스킬·엔진이 모두 잠김 — 채팅 위 로그인 안내, 상태 표시줄 'AX-NAVI 로그인'");
        await pause(4000);
        const lock = await r.find("AX-NAVI 로그인", { selector: ".statusbar-item", timeout: 3000 });
        if (lock) await r.pointAt(lock);
        // 승인 코드 — IDE 출력 창 로그("기기 승인 대기 — 코드 XXXX-XXXX")에서 읽는다
        let code = null;
        for (let t = 0; t < 120 && !code; t++) {
          code = ideLoginCode(r.profile);
          if (!code) await pause(1000);
        }

        if (!code) throw new Error("IDE 화면에서 승인 코드를 읽지 못했습니다");
        await r.caption(`로그인 — 이 기기의 승인 코드 ${code}`, "IDE 가 플랫폼 승인 화면을 엽니다. 평소 쓰는 플랫폼 계정(사내 LDAP)으로 로그인해 승인합니다");
        await pause(4500);
        await freeDemoDevices();
        const before = await devDeviceIds();
        await r.browser(async (b) => {
          await b.login("platform", "dev");
          await b.go(`${A.platform.url}/axnavi/activate?code=${code}`);
          await b.caption("플랫폼 승인 화면 — 승인 코드·기기 이름·등록한 기기 수를 확인합니다", "허가(좌석)를 받은 사람만, 한 사람당 기기 3대까지 — 관리자가 언제든 회수");
          await pause(5000);
          await b.click("이 기기 승인", { selector: "button" });
          await b.caption("승인했습니다 — IDE 로 돌아갑니다");
          await pause(3000);
        });
        await rememberNewDevices(before);
        // 1.2.6 — 로그인하면 상태 표시줄의 'AX-NAVI 로그인'이 계정 이름 항목으로 바뀐다
        for (let t = 0; t < 40; t++) {
          const s = await statusText();
          if (s && !/AX-NAVI 로그인/.test(s)) break;
          await pause(1000);
        }
        await r.caption("잠금이 풀렸습니다 — 스킬 26개와 판정 엔진을 플랫폼에서 받아 옵니다", "상태 표시줄에 계정과 '리뷰' · 스킬은 기기 표식을 넣은 암호화 캐시로만 남습니다");
        await pause(6000);

        // ── 승인 모드(1.2.6) — 묻지 않고 할 수 있는 범위를 네 단계로
        for (let t = 0; t < 30 && !(await r.webFind("", { selector: "textarea", timeout: 1000 })); t++) await pause(1000);
        if (await r.webClick("", { selector: "[data-testid=auto-approve-dropdown-trigger]", after: 600 })) {
          await r.caption("승인 모드 — 매번 확인 · 읽기까지 자동 · 수정까지 자동 · 모두 자동", "기본은 '매번 확인' — 파일 수정·명령은 개발자가 보고 승인 · '모두 자동'은 경고와 함께");
          await pause(5000);
          await r.webClick("", { selector: "[data-testid=auto-approve-dropdown-trigger]", after: 600 });
        }

        // ── 2. 스킬 — /find
        // 로그인 직후에는 채팅 웹뷰가 다시 그려지는 중일 수 있다 — 입력 칸이 뜰 때까지
        for (let t = 0; t < 30 && !(await r.webFind("", { selector: "textarea", timeout: 1000 })); t++) await pause(1000);
        await r.webType("textarea", "/find 사원 목록 조회 기능");
        await r.caption("스킬 — /find 로 기능 위치 찾기", "에이전트가 전수 색인을 MCP 도구(QueryIndex)로 조회합니다 — 읽기 전용 조회는 승인 없이 바로");
        await r.press("Enter");
        await runAgent(r, {}, 150);
        await r.caption("화면 → JS → 컨트롤러 → SQL → 테이블까지 파일 위치와 함께", "grep 으로 추측하지 않고 색인으로 — 같은 질문에는 같은 근거");
        await pause(6000);

        // ── 3. 변경 리뷰 → AI 로 수정 → 다시 리뷰
        // 1.2.6 — 상태 표시줄 항목 글자가 '리뷰'(계정 항목과 구별)
        const reviewItem = await r.find("리뷰", { selector: ".statusbar-item", timeout: 3000 });
        if (reviewItem) await r.clickAt(reviewItem);
        else await r.clickSel('[aria-label*="리뷰"]');
        await r.caption("변경 리뷰 — 상태 표시줄 한 번으로 GO / HOLD / STOP", "CI 와 같은 판정 엔진 — 모델 없이 규칙과 색인으로");
        await pause(9000);
        await r.caption("STOP — SQL 문자열 결합(인젝션 가능) 치명 1건, 머지 차단");
        await pause(3000);
        await r.click("SQL 문자열 결합", { selector: ".monaco-list-row, .label-name, span" });
        await r.caption("지적 상세 — OWASP A03 · CWE-89 · 위치 · 영향 · 권장 조치");
        await pause(4500);
        await r.webClick("AX-NAVI 로 수정");
        await r.caption("AX-NAVI 로 수정 — 지적을 그대로 에이전트에 넘깁니다", "에이전트는 개발자 본인 Claude 구독(로그인)으로 — 자격 증명은 PC 밖으로 안 나갑니다");
        await pause(3000);
        await runAgent(r, {
          1: ["파일 읽기·수정은 개발자가 승인합니다", "에이전트가 무엇을 하려는지 보고 승인"],
          2: ["수정안 — 문자열 결합을 바인드 변수(PreparedStatement)로", "바뀐 부분을 diff 로 보고 저장"],
        });
        await r.caption("수정이 끝났습니다 — 다시 리뷰합니다");
        await pause(2500);
        const reviewAgain = await r.find("리뷰", { selector: ".statusbar-item", timeout: 3000 });
        if (reviewAgain) await r.clickAt(reviewAgain);
        else await r.clickSel('[aria-label*="리뷰"]');
        await pause(9000);
        await r.caption("다시 리뷰 — 치명 지적이 사라졌습니다", "같은 판정이 머지 요청의 CI 게이트에서도 돌아갑니다");
        await pause(6000);

        // ── 4. 관리자 — 허가와 기기
        await r.browser(async (b) => {
          await b.login("platform", "admin");
          await b.go(`${A.platform.url}/axnavi-seats`);
          await b.caption("관리자 — AX-NAVI 사용 허가", "누구에게 허가를 줬는지 · 엔진 위치(PC 자동 설치 / 서버만) · 회수하면 그 사람의 기기가 모두 잠깁니다");
          await pause(5500);
          await b.click("기기 (", { selector: ".n-tabs-tab, [role=tab], div" });
          await b.caption("기기 — 방금 승인한 PC 가 보입니다", "기기 이름·운영체제·마지막 확인 시각 · 기기 하나만 폐기할 수도 있습니다");
          await pause(5000);
          await b.click("유출본 확인", { selector: ".n-tabs-tab, [role=tab], div" });
          await b.caption("유출본 확인 — 밖에서 발견된 스킬 문서를 붙여 넣으면", "기기마다 넣은 보이지 않는 표식으로 받은 사람과 기기를 찾습니다");
          await pause(5000);
        });
      } finally {
        writeFileSync(file, before);
      }
    },
  },
  pmsx: {
    title: "PMS-X — SM 운영 · AI 보조 · As-Is 분석 · WBS",
    maxGap: 3,
    async run(r, A) {
      const P = A.pmsx.url;
      // ── SM 운영(운영자)
      await r.login("pmsx", "op");
      // 첫 SM 프로젝트는 고객 파일럿(LMS)일 수 있다 — 이름으로 '인사시스템 운영'을 고른다
      await r.eval(`(async () => {
        const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(A.pmsx.users.op)}) }).then((x) => x.json()).then((j) => j.accessToken);
        const sm = (await fetch('/api/v1/projects', { headers: { authorization: 'Bearer ' + t } }).then((x) => x.json())).find((p) => p.type === 'SM' && p.name.includes('인사시스템 운영'));
        localStorage.setItem('project', JSON.stringify({ currentProjectId: sm.projectId }));
        return true;
      })()`);
      // ── SM 프로젝트 홈(1.3.11) — 처리 기한 준수율·처리 중 요청·장애 카드
      await r.go(`${P}/home`);
      await r.caption("PMS-X — 운영자(서운영)의 SM 프로젝트 홈", "이번 달 처리 기한 준수율 · 진행 중 요청 · 기한 임박·초과 · 진행 중 장애");
      await pause(4000);
      await r.scroll(450, null);
      await r.caption("처리 기한 준수율 추이와 처리 중인 서비스 요청", "최근 6개월 월별 준수율 · 눌러서 바로 요청으로");
      await pause(3500);
      await r.go(`${P}/sm/srs`);
      await r.caption("서비스 요청 — 접수·배정·처리, 처리 기한까지 남은 시간은 1분마다 갱신", "기한을 넘긴 요청은 아이콘과 '기한 초과'로 · '진행 중만'·'내 담당만' 걸러 보기");
      await r.waitFor("[...document.querySelectorAll('td')].some((t) => t.innerText.includes('SR-00'))", 15000);
      await pause(3500);
      // 요청이 많아 목록 첫 쪽에 없을 수 있다 — 검색 칸(Vuetify '조회')에 번호·글자를 쳐서 찾는다(서버 검색)
      const search = async (text) => {
        const q = await r.eval(`(() => { const f = [...document.querySelectorAll('.v-field')].find((x) => [...x.querySelectorAll('.v-label')].some((l) => l.innerText.trim() === '조회')); const el = f && f.querySelector('input'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: Math.round(b.left + 60), y: Math.round(b.top + b.height / 2) }; })()`);
        if (!q) return;
        await r.clickAt(q);
        for (const [type, key, code, vk, modifiers] of [["keyDown", "a", "KeyA", 65, 2], ["keyUp", "a", "KeyA", 65, 2], ["keyDown", "Backspace", "Backspace", 8, 0], ["keyUp", "Backspace", "Backspace", 8, 0]]) await r.send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk, modifiers });
        for (const ch of text) {
          await r.send("Input.insertText", { text: ch });
          await pause(70);
        }
        await r.press("Enter");
        await pause(1500);
      };
      await search("SR-0034");
      await r.click("SR-0034", { selector: "td" });
      await r.caption("경보가 장애·서비스 요청으로 자동 생성됐습니다", "모니터링 웹훅 → 같은 경보는 하나로 묶고, 처리 절차 체크가 붙습니다");
      await pause(4000);
      await search("퇴사자가 함께");
      await r.click("SR-0004", { selector: "td" });
      await r.caption("현업 서비스 요청 — \"사원 조회 시 퇴사자가 함께 보여요\"");
      await pause(2500);
      await r.click("AI 분류 추천", { selector: "button" });
      await r.caption("AI 분류·배정 추천 — 사내 모델이 유형·우선순위·대상 화면·담당자를 제안", "비슷한 요청·화면 그래프를 근거로, 반영은 사람이 합니다(게이트웨이 경유)");
      await r.waitFor("[...document.querySelectorAll('button')].some((b) => /반영|적용/.test(b.innerText))", 40000);
      await pause(4500);
      await r.go(`${P}/sm/kb`);
      await r.caption("지식 문서 — 끝난 요청에서 AI 가 초안(증상·원인·조치·재발 방지), 출처 요청 표시");
      await pause(3000);

      // ── As-Is 분석·WBS(관리자, SI 프로젝트)
      await r.login("pmsx", "admin");
      const ids = await r.eval(`(async () => {
        const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(A.pmsx.users.admin)}) }).then((x) => x.json()).then((j) => j.accessToken);
        const h = { authorization: 'Bearer ' + t };
        const si = (await fetch('/api/v1/projects', { headers: h }).then((x) => x.json())).find((p) => p.type === 'SI');
        const ss = await fetch('/api/v1/projects/' + si.projectId + '/systems', { headers: h }).then((x) => x.json());
        localStorage.setItem('project', JSON.stringify({ currentProjectId: si.projectId }));
        return { hr: (ss.content ?? ss).find((s) => s.code === 'HR').systemId };
      })()`);
      const HR = ids.hr;
      await r.go(`${P}/asis/systems`);
      await r.caption("As-Is 분석 — 인사·급여·교육 시스템을 소스 수집기로 전수 분석", "화면 → 버튼 → 함수 → SQL → 테이블 그래프 · AI 없이 결정론으로");
      await pause(3500);
      await r.go(`${P}/asis/progress?systemId=${HR}`);
      await r.caption("분석 진척 — 화면마다 상태·담당·요소 수·미매칭", "사람이 검토해 확정하고, 바뀐 화면은 다시 분석 대상으로");
      await pause(3500);
      await r.go(`${P}/asis/viewer/${HR}`);
      await r.caption("화면 분석 뷰어 — 캡처한 화면 위에 버튼·입력 요소와 연결", "버튼을 누르면 어느 함수·SQL·테이블까지 닿는지");
      await pause(3000);
      await r.click("코드 순서도", { selector: "button" });
      await r.caption("코드 순서도 — 이벤트부터 SQL 까지 호출 흐름");
      await pause(3000);
      await r.click("통합 추적", { selector: "button" });
      await r.caption("통합 추적 — 버튼 하나가 어느 테이블까지 닿는지", "요청의 영향 범위 · 구현 명세의 근거가 됩니다");
      await pause(3500);
      await r.click("한국어 설명", { selector: "button" });
      await r.caption("AI 설명 초안 — 근거 등급(녹·황·적)과 함께, 사람이 확정");
      await pause(3500);
      await r.go(`${P}/asis/tables?systemId=${HR}`);
      await r.caption("테이블 정의서 — 소스·DB 에서 뽑은 테이블·컬럼과 그 테이블을 쓰는 화면", "산출물 양식 그대로 엑셀로 내보냅니다");
      await pause(2500);
      await r.click("TB_EMP", { selector: "td" });
      await pause(3000);
      await r.go(`${P}/asis/erd?systemId=${HR}`);
      await r.caption("ERD — FK 와, SQL 조인에서 추정한 관계(점선 · 신뢰도 %)", "추정 관계는 사람이 확정하거나 기각합니다");
      await pause(4500);
      await r.go(`${P}/asis/crud?systemId=${HR}`);
      await r.caption("CRUD 매트릭스 — 화면 × 테이블, 등록·조회·수정·삭제", "버튼 단위로 보면 어느 버튼이 어떤 테이블을 바꾸는지");
      await pause(3500);
      await r.click("요소", { selector: "button", exact: true });
      await pause(3000);
      await r.go(`${P}/asis/navmap?systemId=${HR}`);
      await r.caption("화면 이동 맵 — 화면 사이의 이동·팝업·탭 호출", "화면을 누르면 분석 뷰어로");
      await pause(4000);
      await r.go(`${P}/asis/impact?systemId=${HR}`);
      await r.caption("영향도 분석 — 테이블·컬럼·함수·API·SQL 을 바꾸면 어디가 영향받나");
      await pause(1500);
      await r.type("이름으로 검색", "TB_EMP", { delay: 90 });
      await pause(1200);
      await r.click("tbl:HR.TB_EMP", { selector: ".v-list-item", exact: false });
      await r.waitFor("document.body.innerText.includes('영향 버튼')", 15000);
      await r.caption("TB_EMP 를 바꾸면 — 화면 5 · 버튼·요소 18 · API 13 · 서버 함수 26", "버튼마다 호출 경로와 최근 요청·결함·담당자까지");
      await pause(3500);
      await r.scroll(600, null);
      await pause(3000);
      await r.go(`${P}/schedule/wbs`);
      await r.caption("WBS · 간트 — 계획·실적·SPI·공정준수율, 베이스라인과 크리티컬 패스", "표에서 바로 고치고, 간트 막대를 끌어 일정을 바꿉니다");
      await pause(4000);
      // 보기 배치·간트 확대(1.3.9~1.3.10)
      await r.click("간트 크게", { selector: "button" });
      await r.caption("보기 — 나란히 · 표 크게 · 간트 크게, '크게 보기'는 화면 전체로", "간트 크게는 번호·작업명만 남기고 나머지 폭을 간트에");
      await pause(3000);
      await r.click("월", { selector: "button", exact: true });
      await r.caption("간트 확대·축소 — 단위 일·주·월·분기, Ctrl+휠, 전체 보기, 기준일로");
      await pause(2500);
      await r.click("전체 보기", { selector: "button" });
      await pause(2500);
      await r.click("기준일로", { selector: "button" });
      await pause(2000);
      await r.click("나란히", { selector: "button" });
      await pause(1500);
      await r.go(`${P}/schedule/kanban`);
      await r.caption("칸반 — 같은 WBS 작업을 상태별로");
      await pause(3000);
      // 퀴즈는 운영(SM) 프로젝트에 있다 — demo-prep 이 '인사시스템 인수인계 퀴즈'를 만들어 둔다
      await r.eval(`(async () => {
        const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(A.pmsx.users.admin)}) }).then((x) => x.json()).then((j) => j.accessToken);
        const sm = (await fetch('/api/v1/projects', { headers: { authorization: 'Bearer ' + t } }).then((x) => x.json())).find((p) => p.type === 'SM' && p.name.includes('인사시스템 운영'));
        localStorage.setItem('project', JSON.stringify({ currentProjectId: sm.projectId }));
        return true;
      })()`);
      await r.go(`${P}/sm/handover-quiz`);
      await r.caption("인수인계 퀴즈 — As-Is 분석·요청 이력·업무 절차·처리 기한에서 자동 출제", "SI → SM 인수인계 이해도를 점수로");
      await r.waitFor("[...document.querySelectorAll('[data-test=quiz-item]')].some((e) => e.innerText.includes('인사시스템 인수인계 퀴즈'))", 15000);
      await pause(1500);
      await r.eval(`[...document.querySelectorAll('[data-test=quiz-item]')].find((e) => e.innerText.includes('인사시스템 인수인계 퀴즈')).querySelector('button').click()`);
      await pause(3500);
      await r.scroll(500, null);
      await pause(3000);
    },
  },

  platform: {
    title: "AX Platform — 채팅 · 문서 검색 · 업무 흐름 개선 · 에이전트 · 승인함 · 현업 창구",
    maxGap: 3,
    async run(r, A) {
      const L = A.platform.url;
      await r.login("platform", "admin");
      await r.go(`${L}/`);
      await r.caption("AX Platform — 모든 AI 호출과 도구 호출이 지나는 공통 기반", "대시보드 — 오늘 AI 요청(어제 이 시각보다), 승인 대기, 매뉴얼 보강 대기, 지금 확인할 일");
      await pause(4500);
      await r.go(`${L}/gateway`);
      await r.caption("LLM 게이트웨이 — 앱 → 개인정보 보호 → 경로 규칙·예산 → 모델 → 기록", "제품·사람마다 키, 허용 모델·데이터 등급·분당 한도 · 오늘 현황 · 모델 연결 상태 · 설정 점검");
      await pause(3500);
      await r.click("모델 별칭", { selector: ".n-tabs-tab" });
      await r.caption("모델 별칭 — 제품은 hnix-local 같은 별칭만 압니다", "모델 연결(사내 GPU·CPU 모델, 조직 키)로 경로 규칙·대체 모델 · 기밀 등급은 사내 모델만");
      await pause(3000);

      // ── 워크스페이스 채팅: 근거 문서 + 사내 모델
      await r.go(`${L}/chat`);
      await r.caption("워크스페이스 채팅 — 사내 모델에 근거 문서와 내 권한의 도구를 붙여 묻습니다");
      await pause(1500);
      // 지난 대화가 먼저 열린다 — 새 대화로
      await r.click("새 대화", { selector: "button", exact: true });
      await pause(800);
      // 이미 켜져 있으면 그대로(누르면 꺼진다)
      if (!(await r.eval("[...document.querySelectorAll('.n-checkbox')].some((c) => c.innerText.includes('운영 매뉴얼') && c.classList.contains('n-checkbox--checked'))"))) await r.click("운영 매뉴얼", { selector: ".n-checkbox" });
      await pause(800);
      await r.type("질문을 입력하세요", "사원 조회 화면에 퇴사자가 같이 나온다는 문의가 왔어요. 원인과 현업 안내 방법을 알려 주세요.", { delay: 40 });
      await r.click("보내기", { selector: "button" });
      await r.caption("근거 문서함 '운영 매뉴얼'을 찾아 답합니다", "질문·답 본문은 저장하지 않고, 누가 어느 모델을 썼는지만 기록");
      await r.waitFor("[...document.querySelectorAll('summary')].length > 0", 90000);
      await pause(1500);
      await r.caption("답 아래에 근거 — 어느 문서의 어느 절인지", "운영 매뉴얼 › 1. 사원 조회에 퇴사자가 함께 나올 때");
      await pause(5000);

      // ── 문서 검색
      await r.go(`${L}/docs`);
      await r.caption("문서 검색 — 매뉴얼·절차서를 문서함에 올리면 절 단위 조각으로 나눠 색인", "키워드 + 의미 색인(사내 모델) · 채팅·현업 창구·에이전트가 같이 씁니다");
      await pause(2500);
      await r.type("질문이나 낱말로 찾기", "급여 배치가 실패하면 뭘 먼저 봐야 해?", { delay: 45 });
      await r.click("검색", { selector: "button", exact: true });
      await pause(4500);

      // ── 업무 흐름 개선
      await r.go(`${L}/process`);
      await r.caption("업무 흐름 개선 — 업무 문서에서 As-Is 흐름·문제점을 뽑고 To-Be 를 제안");
      await pause(1500);
      await r.click("새 분석", { selector: "button" });
      await r.caption("분석할 업무 문서와 모델을 고르면 시작 — 한 문서에 2~3분", "아래는 '인사 발령 업무 절차서'로 미리 돌려 둔 결과");
      await pause(3500);
      await r.click("취소", { selector: ".n-modal button, .n-card button", exact: true });
      await r.click("인사 발령 프로세스", { selector: "a, td" });
      await pause(1500);
      await r.caption("As-Is 흐름 — 담당 · 단계 · 시스템 · 입력→산출", "단계마다 문서 원문을 인용하고, 서버가 원문과 대조해 근거 등급(녹·황·적)");
      await pause(5000);
      await r.click("문제점", { selector: ".n-tabs-tab" });
      await r.caption("문제점 — 문서에 적힌 어려움을 근거와 함께");
      await pause(4000);
      await r.click("To-Be (AI 제안)", { selector: ".n-tabs-tab" });
      await r.caption("To-Be — AI 제안, 사람이 고쳐 확정합니다");
      await pause(4000);
      await r.click("설계도(BPMN)", { selector: ".n-tabs-tab" });
      await r.caption("설계도 — As-Is 와 To-Be 를 나란히, BPMN·Mermaid 로 내보내기");
      await pause(4500);

      // ── 에이전트
      await r.go(`${L}/agents`);
      await r.caption("에이전트 — 모델은 게이트웨이, 도구는 MCP 허브로", "실행자 권한 그대로 · 승인 정책 · 단계(span) 기록");
      await pause(1500);
      await r.clickSel(".n-base-selection");
      await r.click("sm-helper", { selector: ".n-base-select-option" });
      // 요청 상세(pmsx__sr)는 '요청 상세 조회는 승인 후' 정책에 걸린다 — 실행이 승인 대기로 멈추고 승인함으로 간다(아래 승인함 장면의 첫 줄).
      // 3B 모델은 도구 결과(JSON)를 요약하게 하면 엉뚱한 설명을 쓰기 쉬워 답 대신 통제 흐름을 보인다(2026-11-10)
      await r.type("무엇을 할까요", "pmsx__sr 도구로 서비스 요청 SR-0004 의 상세를 조회해서, 증상과 처리 방향을 한국어 두 줄로 알려줘", { delay: 35 });
      await r.click("실행", { selector: "button", exact: true });
      await r.caption("에이전트가 PMS-X 도구(pmsx__sr)를 부릅니다", "모델 → 도구 · 단계마다 시간·결과를 기록");
      // 실행 기록 표에도 '완료'·'승인 대기'가 있어 글자로 기다리면 바로 넘어간다 — 결과 카드의 표식으로
      await r.waitFor("!!document.querySelector('[data-test=run-resume], [data-test=run-output]')", 120000);
      await pause(1000);
      await r.caption("요청 상세 조회는 정책상 사람 승인 — 실행이 '승인 대기'로 멈춥니다", "요청이 승인함으로 가고, 승인되면 '이어서 실행' · 에이전트는 실행한 사람의 권한 그대로");
      await pause(6000);
      const trig = await r.find("트리거 — 사람 대신 깨우기", { selector: "div, span" });
      if (trig) await r.pointAt(trig);
      await r.caption("트리거 — 경보 웹훅 · 예약 · 감시가 사람 대신 에이전트를 깨웁니다");
      await pause(3500);

      // ── 자동화 흐름 · 에이전트 평가 · 업무 시스템 연결(2026-11 판)
      const flowId = await (async () => {
        const tok = (await (await fetch(`${L}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(A.platform.users.admin) })).json()).accessToken;
        const j = await (await fetch(`${L}/api/v1/flows`, { headers: { authorization: `Bearer ${tok}` } })).json();
        return (j.items ?? j).find((f) => f.name === "서비스 요청 분류·처리")?.id ?? null;
      })().catch(() => null);
      await r.go(flowId ? `${L}/flows?flow=${flowId}` : `${L}/flows`);
      await pause(1500);
      await r.caption("자동화 흐름 — 정해진 순서대로 실행합니다", "모델 질문 · 도구 호출 · 에이전트 · 조건 분기 · 반복 · 사람 확인 노드를 캔버스에 · 트리거·MCP(flows__run)로 실행");
      await pause(5500);
      await r.caption("새 서비스 요청 → 유형 분류(사내 모델) → 갈래 → 장애 담당 에이전트 / 지식 문서 검색 → 담당자 확인(승인함)", "실행마다 실행 디버거에 단계별 시간·토큰 · 버전 기록으로 되돌리기");
      await pause(5000);
      await r.go(`${L}/agent-eval`);
      await pause(1500);
      await r.caption("에이전트 평가 — 시험 문항으로 에이전트와 흐름을 채점하고 지난 평가와 문항별로 비교", "지시문·모델을 바꾸기 전에 회귀를 잡습니다");
      await pause(4500);
      await r.go(`${L}/biz`);
      await pause(1500);
      await r.caption("업무 시스템 연결 — SAP · Salesforce · Microsoft 365 · 네이버웍스 · 사내 REST 를 MCP 허브 도구로", "종류 고르기 → 주소·인증 → 연결 시험 → 도구 고르기 · 조회는 허용, 쓰기는 기본 '승인 필요'");
      await pause(5000);

      // ── MCP 허브
      await r.go(`${L}/hub`);
      await r.caption("MCP 허브 — 에이전트가 쓰는 업무 도구를 한 주소로", "에이전트 → 권한 확인 → 정책 검사 → 사람 승인 → 도구 서버 → 호출 기록");
      await pause(3500);
      await r.click("서버", { selector: ".n-tabs-tab", exact: true });
      await r.caption("MCP 허브 — PMS-X · AX-NAVI · AX-DataLake 도구를 한곳에", "새 도구는 관리자가 승인해야 쓰이고, 도구마다 허용 · 거부 · 승인 후 실행");
      await pause(3500);
      // ── 승인함(0.9.1 — 도구 이름·입력값 요약을 읽기 쉽게)
      await r.go(`${L}/approvals`);
      await r.caption("승인함 — 사람 승인이 필요한 도구 호출·런북·자동화 흐름이 한곳에", "누가 · 어느 도구를 · 어떤 입력값으로 — 도구 이름과 입력값 요약을 읽기 쉽게");
      await pause(3000);
      // 맨 위 줄은 방금 에이전트가 멈춘 관리자 본인의 요청 — 본인 요청에는 검토 버튼이 없다
      const mine = await r.find("관리자", { selector: "td", exact: true, timeout: 2000 });
      if (mine) await r.pointAt(mine);
      await r.caption("맨 위가 방금 에이전트가 멈춘 요청 — 요청한 본인에게는 검토 버튼이 없습니다", "본인 요청은 다른 책임자가 승인합니다");
      await pause(4000);
      await r.click("검토", { selector: "button", exact: true });
      // 목록이 다시 그려지는 순간에 누르면 창이 안 열린다 — 한 번 더
      if (!(await r.waitFor("!!document.querySelector('.n-modal')", 3000))) await r.click("검토", { selector: "button", exact: true });
      await r.caption("검토 — 어떤 정책 때문에 승인이 필요한지와 입력값을 보고 승인·반려", "승인은 같은 입력값으로 한 번만 쓰입니다");
      await pause(4500);
      await r.press("Escape");
      await pause(800);

      // ── 현업 창구
      await r.go(`${L}/desk/hr-help`);
      await r.caption("현업 창구 — 현업 직원이 묻는 화면(포털·메신저에 붙임)", "운영 매뉴얼·처리 사례 근거로 1차 응답");
      await pause(2000);
      await r.type("예: 사원 조회에", "사원 조회에 퇴사자가 같이 나와요", { delay: 60 });
      await r.click("보내기", { selector: "button" });
      await r.waitFor("document.body.innerText.includes('재직')", 90000);
      await pause(1200);
      await r.caption("매뉴얼 근거로 답합니다 — 근거 문서가 함께 보입니다");
      await pause(5000);
      await r.type("예: 사원 조회에", "회의실 예약은 어떻게 하나요?", { delay: 60 });
      await r.click("보내기", { selector: "button" });
      // 3B 모델은 '찾지 못했습니다' 대신 '근거를 확인하지 못한 답'을 붙이기도 한다 — 답이 끝날 때까지
      await r.waitFor("!!document.querySelector('.bubble.wait')", 10000);
      // 답을 쓰는 동안(busy)에는 아래 '이 답으로 해결됐나요?' 줄이 숨는다 — 다시 보이면 끝
      await r.waitFor("!document.querySelector('.bubble.wait') && !!document.querySelector('.actions')", 90000);
      await pause(1200);
      await r.caption("매뉴얼에 없는 질문 — 지어내지 않고, 담당자에게 넘길 수 있습니다");
      await pause(2500);
      await r.click("담당자에게 넘기기", { selector: "button" });
      await r.type("담당자에게 덧붙일 내용", "회의실 예약 시스템 사용법 안내 부탁드립니다", { delay: 40 });
      await r.click("대화 기록과 함께 접수", { selector: "button" });
      // 오른쪽 '내 최근 문의'에도 SR 번호가 있어 접수 안내(desk-ticket)가 뜰 때까지
      await r.waitFor("!!document.querySelector('[data-test=desk-ticket]')", 30000);
      await r.caption("PMS-X 서비스 요청으로 접수 — 대화 기록과 함께, 요청 번호가 돌아옵니다");
      await pause(4500);

      // ── 런북·AI 사용 현황
      await r.go(`${L}/runbooks`);
      await r.caption("런북 — 정해진 조치를 요청 → 다른 사람이 승인 → 실행·기록");
      await pause(3000);
      await r.go(`${L}/insight`);
      await r.click("소스", { selector: "button", exact: true });
      await r.caption("AI 사용 현황 — 사용량·비용을 호출 주체별로(게이트웨이·허브·에이전트·현업 창구·AX-NAVI)", "품질·지연, 외부 AI·자산 탭까지 — 기간·프로젝트·모델별");
      await pause(3500);
    },
  },
  datalake: {
    title: "AX-DataLake — Kafka 실시간 · CDC · 온톨로지 · 거버넌스 · 계보",
    maxGap: 3,
    async run(r, A) {
      const D = A.datalake.url;
      const prep = JSON.parse(readFileSync(new URL("./.demo-prep.json", import.meta.url), "utf8"));
      // 녹화하는 동안 모니터링 경보를 Kafka 로 쉬지 않고 보낸다(초당 8건)
      const producer = spawn(process.execPath, [fileURLToPath(new URL("./demo-kafka-producer.mjs", import.meta.url)), prep.alertTopic, "--rate", "8", "--seconds", "600"], { stdio: "ignore" });
      try {
        // ── Kafka 실시간 수집(엔지니어)
        await r.login("datalake", "eng");
        await r.go(`${D}/streams`, DL_READY);
        await r.caption("실시간 수집 — Kafka 토픽을 레이크 테이블로", "위의 erp-orders-cdc 는 Debezium CDC — 업무 DB 변경(생성·수정·삭제)을 그대로 반영 중");
        await pause(4000);
        await r.click("스트림 만들기", { selector: "button" });
        await r.caption("새 스트림 — 모니터링 경보 토픽(파티션 3)을 ops.alert_events 로");
        await r.typeLabel("이름", "monitoring-alerts");
        await r.typeLabel("브로커", "localhost:9092", { tag: true });
        await r.typeLabel("토픽", prep.alertTopic, { delay: 25 });
        await r.typeLabel("스키마", "ops", { clear: true });
        await r.typeLabel("테이블", "alert_events");
        await r.typeLabel("묶음(밀리초)", "2000", { clear: true });
        await r.caption("JSON · 붙이기 · 2초마다 한 묶음 커밋", "출처 열(수신 시각·파티션·오프셋)을 붙여 정확히 한 번을 확인합니다");
        await pause(2500);
        await r.click("저장", { selector: ".n-drawer button, .n-modal button, button", exact: true });
        await pause(1500);
        await r.click("시작", { selector: "button", exact: true });
        // 오른쪽 끝 '시작' 버튼을 누르느라 표가 가로로 밀린다 — 스트림 이름이 보이게 되돌린다
        await pause(800);
        await r.eval("document.querySelectorAll('.n-scrollbar-container, .n-data-table-base-table-body').forEach((e) => { e.scrollLeft = 0; }), true");
        await r.caption("시작 — 생산기가 초당 8건씩 경보를 보내고 있습니다", "5초마다 누적 행 · 분당 · 밀린 메시지(lag)가 갱신됩니다");
        await pause(12000);
        await r.caption("누적 행이 계속 늘고, 밀린 메시지는 0 근처 — 따라잡고 있습니다");
        await pause(9000);

        await r.go(`${D}/sql`, DL_READY);
        const run = async (sql, cap, sub = "") => {
          await r.type("css:.editor textarea", sql, { clear: true, delay: 12 });
          await r.click("실행 (Ctrl+Enter)", { selector: "button" });
          await r.waitFor("!!document.querySelector('.n-data-table, table')", 20000);
          if (cap) await r.caption(cap, sub);
          await pause(3500);
        };
        await run("SELECT severity, count(*) AS n FROM ops.alert_events GROUP BY 1 ORDER BY 2 DESC", "들어온 경보를 바로 SQL 로 — 등급별 건수", "Kafka → 2초 묶음 → 공개 표준 Parquet(DuckLake)");
        await pause(3000);
        await run("SELECT severity, count(*) AS n FROM ops.alert_events GROUP BY 1 ORDER BY 2 DESC", "몇 초 뒤 다시 — 건수가 늘었습니다");
        await run("SELECT alert_id, host, severity, message, _partition, _offset, _ingested_at FROM ops.alert_events ORDER BY _ingested_at DESC LIMIT 8", "출처 열 — 파티션·오프셋을 테이블과 같은 트랜잭션에 기록", "재시작·장애에도 빠짐·중복 없이(정확히 한 번)");
        await run("SELECT status, count(*) AS n FROM erp.orders GROUP BY 1 ORDER BY 1", "CDC — 주문 300건 생성 · 120건 결제 완료로 수정 · 11건 삭제", "업무 DB 의 변경이 레이크 테이블에 그대로(키로 반영)");
        await pause(1500);
        await r.go(`${D}/catalog/ops/alert_events?tab=history`, DL_READY);
        await r.caption("시점 이력 — 커밋마다 스냅샷", "그 시점으로 되돌려 조회하고, 두 시점 사이 바뀐 행만 뽑습니다");
        await pause(4500);

        // ── 거버넌스·온톨로지(분석가)
        await r.login("datalake", "ana");
        // 분석가 첫 화면(0.5.x) — 질문하기 · 내 대시보드 · 최근 분석
        await r.go(`${D}/`, DL_READY);
        await r.caption("분석가 첫 화면 — 데이터에 무엇이든 물어보기 · 내 대시보드 · 최근 분석", "말로 물으면 분석가 권한으로 조회해 표·차트로 답합니다");
        await pause(4000);
        await r.click("장애 현황", { selector: "a", exact: true });
        await r.waitFor("document.querySelectorAll('canvas, svg').length > 2", 15000);
        await r.caption("공유받은 대시보드 '장애 현황' — 엔지니어가 만들어 분석가에게 공유", "엔지니어가 게시한 판을 분석가가 바로 봅니다 · 필터 · 예약 보내기");
        await pause(4500);
        await r.go(`${D}/catalog/hr/staff?tab=preview`, DL_READY);
        await r.caption("분석가(소속 HD01)로 들어왔습니다", "인사 테이블 — 이름·주민번호·전화는 가려지고, HD01 행만 보입니다");
        await pause(4500);
        await r.go(`${D}/ontology?type=incident`, DL_READY);
        await r.caption("객체 탐색(온톨로지) — 테이블이 아니라 업무 객체로 찾습니다", "장애 · 서비스 · 구성 요소 · 변경 · 문제 · 서비스 요청 · 담당자");
        await pause(2500);
        await r.type("이름·키로 찾기", "디스크");
        await r.press("Enter");
        await pause(1200);
        await r.click("INC-0241", { selector: ".res" });
        await r.caption("장애 INC-0241 — 속성과 관계", "관계마다 이어진 객체 수 — 누르면 따라갑니다");
        await pause(3000);
        await r.click("직전 72시간 변경", { selector: "button" });
        await r.caption("같은 구성 요소에서 장애 직전 72시간 안에 끝난 변경", "SQL 없이 한 번에 — 원인 후보를 바로 봅니다");
        await pause(3500);
        await r.click("관계 그래프", { selector: ".n-tabs-tab" });
        await pause(1500);
        await r.click("2단계");
        await r.caption("관계 그래프 2단계 — 서비스 · 구성 요소 · 담당자 · 변경이 한 화면에", "담당자 이름은 그래프에서도 가려집니다");
        await pause(4500);
        await r.click("속성·관계", { selector: ".n-tabs-tab" });
        await r.click("진단 에이전트 요청", { selector: "button" });
        await r.type("css:.n-modal textarea", "직전 변경과의 관계를 진단해 주세요", { delay: 35 });
        await r.click("요청", { selector: ".n-modal button", exact: true });
        await r.caption("진단 에이전트 요청 — 웹훅 액션은 승인 대기", "요청한 사람은 스스로 승인할 수 없습니다");
        await pause(3000);

        await r.login("datalake", "eng");
        await r.go(`${D}/ontology?tab=runs`, DL_READY);
        await r.caption("엔지니어가 실행 요청을 승인", "분석가 화면 요청 · 에이전트(MCP) 요청이 같은 승인함에");
        await pause(2500);
        await r.click("승인·실행", { selector: "button" });
        await r.caption("승인 → 플랫폼 경보 진단 에이전트 웹훅으로 전달(202)", "보낸 객체는 요청자가 본 모습 그대로 — 가린 값은 가린 채");
        await pause(3500);

        await r.go(`${D}/lineage?node=lake:ops.alert_events`, DL_READY);
        await r.caption("계보 — Kafka 토픽 → 테이블 → 소비 경로", "원본이 바뀌면 영향 범위를 바로 봅니다");
        await pause(4500);

        await r.login("datalake", "ana");
        await r.go(`${D}/sql`, DL_READY);
        await r.caption("SQL 작업창 — 말로 쓰면 사내 모델이 SQL 초안을 만듭니다", "모델에는 테이블 구조만 보내고 값은 보내지 않습니다");
        // 3B 모델은 "시스템별 P1 장애 건수" 에 SQL 문법 오류를 낸다(2026-11-11) — 이 말투는 매번 맞다
        await r.type("말로 쓰면 SQL 초안", "P1 장애를 시스템별로 세어 줘", { delay: 70 });
        await r.click("SQL 초안 만들기", { selector: "button" });
        await r.waitFor("!!document.querySelector('.n-data-table, table')", 40000);
        await pause(2500);
        await r.caption("만든 SQL 도 같은 거버넌스 — 분석가 소속 행만 집계됩니다");
        await pause(4500);
      } finally {
        producer.kill();
      }
    },
  },
};
