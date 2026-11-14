/*
 * 기능 전체 영상 — 제품마다 메뉴·탭·버튼을 하나씩 실제로 써 보는 장(章)별 시나리오.
 * record-demo.mjs 가 하나씩 녹화한다(녹화 전 feature-prep.mjs 로 시연 데이터를 준비).
 *
 *   node tools/record-demo.mjs --scenarios feature-scenarios.mjs --scenario "platform-*" --out video/features
 *
 * 주소·계정은 demo-scenarios.mjs 의 APPS(E2E 환경)와 같다. 짧은 시연 영상(demo-scenarios.mjs)과 따로 둔다.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { APPS, DEMO_REPO, devDeviceIds, freeDemoDevices, ideLoginCode, rememberNewDevices, runAgent } from "./demo-scenarios.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** PMS-X WBS — 작업명으로 행 ID */
async function wbsRow(r, name) {
  return r.eval(`(() => { const i = [...document.querySelectorAll('input[data-col="name"]')].find((e) => e.value === ${JSON.stringify(name)}); return i?.closest('tr')?.dataset.rowId ?? null; })()`);
}
/** PMS-X WBS — 행의 번호 칸을 누른다(mods 2 = Ctrl 클릭) */
async function rowClick(r, name, mods = 0) {
  const id = await wbsRow(r, name);
  const p = await r.eval(`(() => { const el = document.querySelector('tr[data-row-id="${id}"] td.c-no'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
  if (!p) return;
  await r.pointAt(p);
  await r.eval(`window.__demo && window.__demo.ripple(${p.x}, ${p.y})`).catch(() => undefined);
  for (const type of ["mousePressed", "mouseReleased"]) await r.send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", clickCount: 1, modifiers: mods });
  await pause(700);
}
/** Alt+Shift+화살표 (WBS 계층 편집) — 지금 초점이 있는 칸에서 */
async function arrowKey(r, key, vk) {
  await r.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code: key, modifiers: 9, windowsVirtualKeyCode: vk });
  await r.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, modifiers: 9, windowsVirtualKeyCode: vk });
  await pause(700);
}
/** 표에서 글자가 든 행의 버튼을 누른다 */
async function rowButton(r, rowSel, text, btnSel) {
  const p = await r.eval(`(() => { const tr = [...document.querySelectorAll(${JSON.stringify(rowSel)})].find((t) => t.innerText.includes(${JSON.stringify(text)})); const b = tr && tr.querySelector(${JSON.stringify(btnSel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const x = b.getBoundingClientRect(); return { x: Math.round(x.left + x.width / 2), y: Math.round(x.top + x.height / 2) }; })()`);
  if (p) await r.clickAt(p);
  await pause(900);
}
const L = APPS.platform.url;
const prep = () => (existsSync(new URL("./.feature-prep.json", import.meta.url)) ? JSON.parse(readFileSync(new URL("./.feature-prep.json", import.meta.url), "utf8")) : {});

/* ---------- 공통 조작 ---------- */

/** Naive UI 탭 */
export async function tab(r, label, cap, sub = "", wait = 3500) {
  // 긴 목록을 한참 내려간 뒤면 위쪽 탭이 찾기 범위 밖 — 맨 위로 올려 다시 찾는다
  if (!(await r.find(label, { selector: ".n-tabs-tab", exact: true, timeout: 900 }))) await top(r);
  await r.click(label, { selector: ".n-tabs-tab", exact: true });
  if (cap) await r.caption(cap, sub);
  await pause(wait);
}

/** Naive UI 선택 칸 — 칸 안 글자(자리표시·현재 값)로 찾아 열고 항목을 고른다 */
export async function pick(r, inBox, option, opts = {}) {
  const p = await r.find(inBox, { selector: ".n-base-selection", timeout: 3000, ...(opts.nth ? { nth: opts.nth } : {}) });
  if (!p) {
    console.warn(`  ! 선택 칸 못 찾음: ${inBox}`);
    return false;
  }
  await r.clickAt(p);
  await pause(500);
  const ok = await r.click(option, { selector: ".n-base-select-option", exact: !!opts.exact, after: 500 });
  if (opts.close) await r.press("Escape");
  return ok;
}

/** 열린 창(모달·서랍)을 닫는다 */
export async function closeModal(r) {
  await r.press("Escape");
  await pause(600);
  // Escape 로 안 닫히는 창(Naive 카드 모달 일부)은 오른쪽 위 × 로
  const open = await r.eval("!![...document.querySelectorAll('.n-modal, .n-drawer, .v-overlay--active .v-card')].find((e) => e.getBoundingClientRect().width > 0)").catch(() => false);
  if (open) {
    await r.clickSel(".n-modal .n-base-close, .n-drawer .n-base-close, .v-overlay--active [aria-label='Close'], .v-overlay--active .mdi-close", 600).catch(() => undefined);
  }
}

/** 바깥 스크롤(플랫폼·레이크는 레이아웃 안쪽이 스크롤된다) */
const NV = ".n-layout-content .n-scrollbar-container";
export async function down(r, dy = 600, sel = NV) {
  await r.scroll(dy, sel);
}
export async function top(r, sel = NV) {
  await r.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.scrollTo({ top: 0, behavior: 'instant' }); window.scrollTo(0, 0); })()`).catch(() => undefined);
  await pause(400);
}

/** 글자(text)가 든 가장 작은 줄·카드 안의 버튼(button)을 누른다 — 표의 '수정'·'시험'처럼 같은 버튼이 여러 개일 때 */
export async function clickNear(r, text, button, opts = {}) {
  const p = await r.eval(`(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const sel = ${JSON.stringify(opts.buttonSel ?? "button, a, .n-button, .v-btn")};
    const all = [...document.querySelectorAll('tr, li, .n-card, .n-list-item, .v-list-item, .v-card, div, section')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && norm(e.innerText).includes(${JSON.stringify(text)}) && [...e.querySelectorAll(sel)].some((b) => norm(b.innerText) === ${JSON.stringify(button)});
    }).sort((a, b) => norm(a.innerText).length - norm(b.innerText).length);
    const box = all[0];
    if (!box) return null;
    const b = [...box.querySelectorAll(sel)].find((x) => norm(x.innerText) === ${JSON.stringify(button)});
    b.scrollIntoView({ block: 'center' });
    const q = b.getBoundingClientRect();
    return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) };
  })()`);
  if (!p) {
    console.warn(`  ! 못 찾음: "${text}" 옆 "${button}"`);
    await r.miss?.(`${text}_${button}`);
    return false;
  }
  await r.clickAt(p);
  await pause(opts.after ?? 900);
  await r.overlay();
  return true;
}

/** 체크 칸을 켠다(이미 켜져 있으면 그대로) — Naive UI n-checkbox */
export async function ensureChecked(r, text) {
  const on = await r.eval(`[...document.querySelectorAll('.n-checkbox')].some((c) => c.innerText.includes(${JSON.stringify(text)}) && c.classList.contains('n-checkbox--checked'))`);
  if (!on) await r.click(text, { selector: ".n-checkbox", after: 800 });
}

/** Vuetify 입력 칸(라벨 글자로) — PMS-X */
export async function vtype(r, label, text, delay = 40) {
  const p = await r.eval(`(() => {
    const f = [...document.querySelectorAll('.v-field')].find((x) => [...x.querySelectorAll('.v-label')].some((l) => l.innerText.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)}) && x.getBoundingClientRect().width > 0);
    const el = f && f.querySelector('input, textarea');
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const q = el.getBoundingClientRect();
    return { x: Math.round(q.left + Math.min(q.width / 2, 120)), y: Math.round(q.top + q.height / 2) };
  })()`);
  if (!p) {
    console.warn(`  ! Vuetify 칸 못 찾음: ${label}`);
    return false;
  }
  await r.clickAt(p);
  for (const ch of text) {
    await r.send("Input.insertText", { text: ch });
    await pause(delay);
  }
  await pause(300);
  return true;
}

/** 플랫폼 왼쪽 메뉴 */
export async function sideMenu(r, label, wait = 2500) {
  // 배지(승인함 대기 건수)가 붙으면 글자가 "승인함\n1" — 링크의 첫 글자 마디로 찾고, 메뉴가 스크롤돼 있으면 보이게 한 뒤 누른다
  const p = await r.eval(`(() => {
    const a = [...document.querySelectorAll('.side-menu .menu-link')].find((x) => (x.firstChild?.textContent ?? '').trim() === ${JSON.stringify(label)});
    if (!a) return null;
    a.scrollIntoView({ block: 'center' });
    const q = a.getBoundingClientRect();
    return { x: Math.round(q.left + Math.min(q.width / 2, 60)), y: Math.round(q.top + q.height / 2) };
  })()`);
  if (!p) {
    console.warn(`  ! 메뉴 못 찾음: ${label}`);
    await r.miss?.(`menu_${label}`);
    return false;
  }
  await pause(300);
  await r.clickAt(p);
  await pause(wait);
  return true;
}
/** 플랫폼 화면 위 묶음 탭(같은 묶음의 화면) */
export async function sectionTab(r, label, wait = 2500) {
  await r.click(label, { selector: "[data-test=section-tabs] a", exact: true, after: wait });
}

/** 모달 안의 버튼 */
export const modalBtn = (r, label, after = 900) => r.click(label, { selector: ".n-modal button, .n-dialog button, .n-drawer button, .n-popconfirm button, .n-popover button", exact: true, after });

/* ---------- 시나리오 ---------- */

export const SCENARIOS = {
  /* ================= AX Platform ================= */

  "platform-1": {
    title: "AX Platform ① 로그인 · 대시보드 · 테마 · 내 연결 설정 · 내 AX-NAVI 기기",
    maxGap: 3,
    async run(r) {
      await r.go(`${L}/login`);
      await r.caption("AX Platform — 공통 AI 기반", "모든 AI 호출·도구 호출·현업 문의가 지나는 곳. 고객망 안에 설치합니다");
      await pause(2500);
      await r.type("로그인 ID", "admin", { clear: true, delay: 70 });
      await r.type("비밀번호", "Admin!2026", { clear: true, delay: 50 });
      await r.caption("로그인 — 로컬 계정 또는 사내 LDAP·SSO", "역할(시스템 관리자·감사자·사용자)에 따라 보이는 메뉴가 다릅니다");
      await pause(1500);
      await r.click("로그인", { selector: "button", exact: true, after: 2500 });

      await r.caption("대시보드 — 오늘의 운영 현황", "관리자·감사자는 플랫폼 전체를, 그 밖의 사용자는 자기 사용만 봅니다");
      await pause(4000);
      await r.caption("오늘 AI 사용 — 게이트웨이 요청·토큰·사내 모델 비율·비용", "전체 AI 사용은 Claude Code·AX-NAVI 사용까지 합친 값(Insight)");
      await pause(4000);
      await down(r, 330);
      await r.caption("통제 — 승인 대기 · 정책 차단 · 개인정보 처리 · 도구 호출", "칸을 누르면 해당 화면으로 갑니다");
      await pause(4000);
      await down(r, 330);
      await r.caption("현업 창구 — 최근 7일 질문 · 해결 · 답 못 찾음 · 담당자 이관");
      await pause(3500);
      await down(r, 500);
      await r.caption("지금 확인할 일 — 승인 대기 · 연결 이상 · 매뉴얼 보강이 필요한 질문", "누르면 바로 그 화면으로 · 오른쪽은 주요 메뉴 바로 가기");
      await pause(5000);
      await top(r);

      await r.click("테마", { selector: "button" });
      await r.caption("화면 테마 — 기본(선명한 업무형) 외에 세 가지와 사용자 지정", "사람마다 저장되고, 세 웹 제품(플랫폼·PMS-X·데이터레이크)이 같은 테마를 씁니다");
      await pause(2500);
      await r.click("고대비 네이비", { selector: "button, [role=radio], label, div", after: 1500 });
      await pause(2500);
      await r.click("선명한 업무형", { selector: "button, [role=radio], label, div", after: 1200 });
      await r.press("Escape");
      await pause(1000);
      await r.click("비밀번호 바꾸기", { selector: "button" });
      await r.caption("비밀번호 바꾸기 — 본인이 직접", "사내 LDAP 계정은 사내 계정 정책을 따릅니다");
      await pause(3000);
      await closeModal(r);

      await r.go(`${L}/setup`);
      await r.caption("내 연결 설정 — 개인 PC 는 설치하고 로그인하면 끝", "키나 환경 변수를 넣지 않습니다 — 로그인하면 IDE 가 사내 모델·사용량 기록·MCP 허브·AX-NAVI 엔진을 스스로 설정");
      await pause(5000);
      const dl = await r.find("개인 PC 설치 파일", { selector: "button", timeout: 3000 });
      if (dl) await r.pointAt(dl);
      await r.caption("① 개인 PC 설치 — 서버에 올려 둔 서명된 설치 파일(HNIX-AX-PC-Setup)을 여기서 받습니다", "설치 화면에서 이 서버 주소를 물으면 넣습니다 · 새 판도 같은 방법으로 덮어 설치");
      await pause(5000);
      const open = await r.find("AX-NAVI IDE 에서 열기", { selector: "a, button", timeout: 3000 });
      if (open) await r.pointAt(open);
      await r.caption("② 이 서버에 연결 — 'AX-NAVI IDE 에서 열기' → IDE 가 '연결할까요?' → 브라우저 승인 화면에서 승인", "기기마다 전용 키가 발급되고, 기기를 끊으면 그 키도 함께 꺼집니다");
      await pause(5000);
      await r.caption("③ 확인 — 연결한 IDE 가 여기 기기로 나옵니다", "PC 에 Claude 구독(Claude Code)이 있으면 사용량 기록·MCP 허브도 IDE 가 함께 맞춥니다 — 구독 자격 증명은 서버로 오지 않습니다");
      await pause(5500);
      await r.click("고급 — 개인 PC 설치 없이", { selector: ".n-collapse-item__header", after: 1500 });
      await down(r, 400);
      await r.caption("고급 — IDE 없이 Claude Code 만 쓰는 서버·CI", "사용량 수집 키 · 사내 모델용 게이트웨이 키를 발급하면 붙여 넣을 설정에 바로 채워집니다");
      await pause(5000);
      await r.click("관리자 — 전 직원 일괄 배포", { selector: ".n-collapse-item__header", after: 1500 });
      await down(r, 600);
      await r.caption("관리자 — 전 직원 일괄 배포", "조용히 설치(/SERVER 로 주소까지) · 조직 정책 policy.json 으로 서버 주소와 허용할 AI 경로를 PC 마다 고정");
      await pause(5000);

      await r.go(`${L}/axnavi/activate`);
      await r.caption("내 AX-NAVI 기기 — 내가 승인한 PC 목록", "IDE 의 승인 코드를 넣어 기기를 승인하고, 잃어버린 PC 는 여기서 끊습니다");
      await pause(4500);
    },
  },

  "platform-2": {
    title: "AX Platform ② LLM 게이트웨이 — 개요 · 시험 호출 · 키 · 모델 별칭 · 모델 연결 · 라우트·예산 · 개인정보 · 요청 로그",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/gateway`);
      await r.caption("LLM 게이트웨이 — 사내 모든 AI 호출이 지나는 관문", "앱·IDE·에이전트는 hx- 키로 여기만 부르고, 게이트웨이가 모델을 고르고·가리고·기록합니다");
      await pause(4500);
      await r.caption("흐름 — 앱 → 개인정보 보호 → 라우트·예산 → 모델 별칭 → 모델 연결 → 기록", "상자를 누르면 그 설정 탭으로 갑니다");
      await pause(4500);
      await down(r, 300);
      await r.caption("오늘 — 요청 · 토큰 · 비용 · 개인정보 처리 · 정책 차단 · 평균 응답", "모델 연결별 정상·문제, 많이 쓴 별칭, 설정 점검표");
      await pause(5000);
      await down(r, 450);
      await r.caption("시험 호출 — 문장 하나를 실제 경로로 보내 봅니다", "전화번호를 넣어 보면 모델로 나가기 전에 어떻게 바뀌는지 보입니다");
      await r.type("css:.try-in textarea", "고객 홍길동(010-2345-6789)이 급여명세서 조회가 안 된다고 합니다. 확인할 순서를 세 줄로 알려 주세요.", { clear: true, delay: 30 });
      await r.click("보내기", { selector: ".try button", exact: true });
      await r.waitFor("!!document.querySelector('.try-out .trace')", 90000);
      await pause(800);
      await r.caption("어디로 갔나 — 사내 모델(hnix-local) · 전화번호는 [전화번호_1] 로 바뀌어 나갔습니다", "답에서는 원래 값으로 되돌립니다 · 이 호출도 요청 로그와 집계에 그대로 남습니다");
      await pause(7000);
      await top(r);

      await tab(r, "내 키", "내 키 — 앱·IDE·에이전트용 hx- 가상 키", "권한(llm·mcp·수집)·허용 모델·데이터 등급·분당 한도를 키마다. 모델 회사 키는 밖으로 나가지 않습니다");
      await r.click("키 발급", { selector: "button", exact: true });
      await r.type("내 노트북", "시연용 노트북 Claude Code", { delay: 40 });
      await r.caption("키 발급 — 이름 · 권한 · 허용 모델 · 데이터 등급 · 분당 한도");
      await pause(2500);
      await modalBtn(r, "발급", 1500);
      await r.caption("발급한 키는 이 화면에서 한 번만 보입니다", "잃어버리면 폐기하고 새로 발급합니다");
      await pause(3500);
      await closeModal(r);
      await pause(1500);

      await tab(r, "모델 별칭", "모델 별칭 — 제품은 hnix-local 같은 별칭만 압니다", "대상을 여러 개 두면 앞에서부터 시도하고 실패하면 다음으로(폴백) · 대화용·임베딩용", 4500);
      await r.click("수정", { selector: "button", exact: true });
      await r.caption("별칭 수정 — 대상 모델과 순서, 설명");
      await pause(3000);
      await closeModal(r);
      await tab(r, "모델 연결", "모델 연결 — 실제 모델이 있는 곳", "Claude API · 사내 GPU·CPU 모델 서버(vLLM·Ollama 등 OpenAI 호환) · '사내'로 표시한 곳만 기밀 데이터를 받습니다", 5000);
      await r.click("프로바이더 추가", { selector: "button" });
      await r.caption("연결 추가 — 형식 · 주소 · 위치(사내/외부) · API 키 · 시간 제한", "API 키는 암호화해 서버에만 둡니다");
      await pause(3500);
      await closeModal(r);

      await tab(r, "라우트 · 예산", "라우트 — 조건에 맞으면 다른 모델로 보내거나 막습니다", "지금 규칙: 개인정보가 든 요청 → 사내 모델 · 기밀 등급 이상 → 사내 모델", 4500);
      await r.click("규칙 추가", { selector: "button", exact: true });
      await r.caption("규칙 — 데이터 등급 · 개인정보 포함 · 요청 모델 · 워크스페이스 → 다른 모델로 / 차단");
      await pause(3500);
      await closeModal(r);
      await pick(r, "요청 모델", "hnix-smart");
      await r.clickSel(".sim .n-switch", 600);
      await r.click("어디로 가나?", { selector: "button" });
      await r.caption("시뮬레이터 — hnix-smart 로 부른 요청에 개인정보가 있으면", "규칙 '개인정보가 든 요청은 사내 모델로'가 걸려 hnix-local 로 갑니다 · 등급 때문에 막히는 대상은 빨갛게");
      await pause(5000);
      await down(r, 400);
      await r.click("예산 추가", { selector: "button" });
      await r.caption("예산 — 전체·워크스페이스·사용자·키별 월·일 한도(금액·토큰)", "이번 기간 사용과 소진율 · 넘으면 막을지, 알리기만 할지");
      await pause(3500);
      await closeModal(r);
      await top(r);

      await tab(r, "개인정보 보호", "개인정보 보호 — 모델로 나가기 전에 찾아서 가리기 · 가명 · 차단 · 탐지만", "주민번호·전화·카드·사업자번호·이메일 기본 규칙 + 사내 규칙(사번 등)");
      await r.type("css:textarea", "사번 HD123456 김민수, 주민번호 900101-1234567, 연락처 010-9876-5432, 메일 hong@corp.example", { clear: true, delay: 25 });
      await r.click("시험", { selector: "button", exact: true });
      await r.caption("규칙 시험 — 저장하지 않고 바로 확인", "사내 규칙 '사번'(HD+여섯 자리)도 함께 · 가명은 응답에서 원래 값으로 되돌립니다");
      await pause(4500);
      await r.click("사용자 정의 규칙", { selector: "button" });
      await r.caption("사내 규칙 추가 — 이름 · 정규식 · 처리 · 방향(요청·응답)");
      await pause(3000);
      await closeModal(r);

      await tab(r, "요청 로그", "요청 로그 — 본문은 저장하지 않고 누가·어느 별칭·모델·토큰·비용·지연·차단 사유만", "방금 시험 호출도 보입니다 — 개인정보 처리 여부와 폴백 기록까지", 6000);
    },
  },

  "platform-3": {
    title: "AX Platform ③ MCP 허브 — 개요 · 연결·내 도구 · 서버 · 도구 승인 · 정책 · 호출 기록 · 승인함",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/hub`);
      await r.caption("MCP 허브 — 에이전트가 쓰는 업무 도구를 한 주소로", "Claude Code·AX-NAVI·사내 에이전트·채팅이 허브 하나만 연결하면 PMS-X·AX-NAVI·레이크·문서·ITSM 도구를 함께");
      await pause(5000);
      await r.caption("흐름 — 에이전트 → 권한 확인 → 정책 검사 → 사람 승인 → 도구 서버 → 호출 기록");
      await pause(4000);
      await down(r, 450);
      await r.caption("오늘 호출 · 정책 거부 · 승인 대기 · 서버별 연결 상태와 도구 수", "많이 쓴 도구도 한글 이름으로");
      await pause(5000);
      await top(r);

      await tab(r, "연결 · 내 도구", "연결 · 내 도구 — 지금 내가 쓸 수 있는 도구를 서버별로", "도구마다 한글 제목 · 조회/쓰기 · 인자(* 필수)");
      await r.click("연결하기", { selector: ".n-collapse-item__header, div", exact: false });
      await r.caption("연결하기 — Claude Code·AX-NAVI·사내 에이전트에 붙여 넣을 설정", "주소 하나와 mcp 권한 hx- 키");
      await pause(4000);
      await r.click("연결하기", { selector: ".n-collapse-item__header, div", exact: false });
      await pause(800);
      await clickNear(r, "프로젝트 목록", "시험");
      await r.caption("도구 시험 — 인자를 넣고 실제로 불러 봅니다", "PMS-X '프로젝트 목록' — 이 사람 권한으로 보이는 프로젝트");
      await pause(2000);
      await modalBtn(r, "실행", 2500);
      await r.waitFor("!!document.querySelector('.n-modal pre, .n-modal .n-code, .n-modal code')", 20000);
      await r.caption("결과 — 실제 도구 응답 · 이 호출도 정책을 지나 기록됩니다");
      await pause(4500);
      await closeModal(r);

      await tab(r, "서버", "서버 — 도구를 내주는 곳", "PMS-X·AX-NAVI 같은 내장 연결(읽기 전용) + 외부 MCP 서버(HTTP)");
      await r.click("동기화", { selector: "button", exact: true, after: 2500 });
      await r.caption("동기화 — 도구 목록을 다시 받아 옵니다", "연결 문제는 마지막 오류와 함께 표시");
      await pause(3000);
      await r.click("서버 등록", { selector: "button" });
      await r.caption("서버 등록 — 종류(PMS-X·AX-NAVI·MCP HTTP) · 주소 · 서비스 계정", "저장하면 바로 도구 목록을 받아 옵니다");
      await pause(3500);
      await closeModal(r);

      await tab(r, "도구 승인", "도구 승인 — 외부 서버의 도구는 사람이 설명·인자를 확인하고 승인해야 쓰입니다", "서버 쪽에서 바뀌면 '스키마 변경'으로 막고 다시 승인할 때까지 기다립니다 · 도구별로 끄고 켭니다", 5000);
      await r.click("보기", { selector: "button", exact: true });
      await r.caption("스키마 보기 — 설명과 인자를 확인");
      await pause(3000);
      await closeModal(r);

      await tab(r, "정책", "정책 — 누가(역할·워크스페이스) 어떤 도구(서버·이름·쓰기)를", "허용 · 거부 · 사람 승인 — 위에서부터 처음 맞는 규칙");
      await r.click("규칙 추가", { selector: "button", exact: true });
      await r.caption("규칙 — 서버 · 도구 패턴(pmsx__* 같은) · 역할 · 쓰기 도구만 · 동작 · 안내 문구");
      await pause(4000);
      await closeModal(r);

      await tab(r, "호출 기록", "호출 기록 — 누가 · 어떤 클라이언트로 · 어떤 도구를 · 결과 · 걸린 시간", "인자는 이름만 남기고 값은 저장하지 않습니다", 6000);

      await sideMenu(r, "승인함");
      await r.caption("승인함 — 왼쪽 메뉴 맨 위, 내가 결정할 대기 건수 배지", "'사람 승인' 정책에 걸린 호출 · 런북 실행 · 자동화 흐름의 사람 확인이 한곳에 · 요청한 본인은 승인 못 합니다");
      await pause(4000);
      if (await r.click("검토", { selector: "button", exact: true, after: 1200 })) {
        await r.caption("검토 — 누가 어떤 도구를 어떤 인자로 부르려 했는지, 걸린 정책", "결정 사유는 요청자에게 보입니다");
        await r.type("결정 사유", "운영 시간 외에 실행해 주세요", { delay: 45 });
        await pause(1500);
        await modalBtn(r, "승인", 1500);
        await r.caption("승인 — 요청한 사람이 같은 인자로 다시 부르면 한 번 실행됩니다", "승인은 하루 동안 유효 · 반려하면 사유와 함께 요청자에게 · 배지 숫자도 바로 줄어듭니다");
        await pause(4500);
      }
    },
  },

  "platform-4": {
    title: "AX Platform ④ 워크스페이스 채팅 · 문서 RAG · 업무 흐름 개선",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      // ── 문서 RAG 를 먼저 — 문서를 올리고 찾는다
      await r.go(`${L}/docs`);
      await r.caption("문서 RAG — 매뉴얼·절차서·규정을 올리면 절 단위로 나눠 색인", "키워드 + 의미 검색(사내 임베딩 모델) · 채팅·현업 창구·에이전트·업무 흐름 개선이 같이 씁니다");
      await pause(4000);
      await r.click("운영 매뉴얼", { selector: ".col div", exact: true, after: 1500 });
      await r.caption("컬렉션 — 워크스페이스마다, 데이터 등급과 임베딩 모델을 정해 둡니다", "Word·PDF·한글(HWP·HWPX)·텍스트·소스 코드 · EUC-KR 파일도");
      await pause(3500);
      await r.upload(fileURLToPath(new URL("./demo-files/급여-마감-점검표.md", import.meta.url)));
      await r.caption("문서 올리기 — '급여 마감 점검표'", "절(## 제목)마다 조각으로 나누고 임베딩을 만들어 둡니다");
      await r.waitFor("document.body.innerText.includes('급여 마감 점검표')", 30000);
      await pause(3500);
      await top(r);
      await r.type("질문이나 낱말로 찾기", "급여 계산 배치가 실패하면 먼저 뭘 봐야 해?", { delay: 40 });
      await r.click("검색", { selector: "button", exact: true, after: 2500 });
      await r.caption("검색 — 방금 올린 문서의 '급여 계산 배치' 절이 위에", "키워드 몇 위 · 의미 몇 위 — 두 순위를 합쳐(RRF) 정렬합니다");
      await pause(5500);

      // ── 워크스페이스 채팅
      await r.go(`${L}/chat`);
      await r.caption("워크스페이스 채팅 — 사내 모델에 근거 문서와 내 권한의 도구를 붙여 묻습니다", "대화는 사람마다 · 왼쪽은 지난 대화 목록");
      await pause(3500);
      await r.click("새 대화", { selector: "button", exact: true, after: 1200 });
      await ensureChecked(r, "운영 매뉴얼");
      await r.caption("오른쪽 — 근거로 쓸 문서 컬렉션과, 서버별로 묶은 내 도구", "도구는 한글 이름과 설명 · 서버 단위로 한꺼번에 고르기");
      await pause(4000);
      await r.type("질문을 입력하세요", "급여 계산 배치가 실패했어요. 먼저 무엇을 확인해야 하나요?", { delay: 40 });
      await r.click("보내기", { selector: "button", exact: true });
      await r.caption("근거 문서를 찾아 사내 모델이 답합니다", "질문·답 본문은 게이트웨이 기록에 남기지 않고, 누가 어느 모델을 썼는지만");
      await r.waitFor("[...document.querySelectorAll('summary')].some((s) => s.innerText.includes('['))", 120000);
      await pause(1500);
      await r.click("[1]", { selector: "summary", after: 1200 });
      await r.caption("답 아래 근거 — 어느 문서의 어느 절인지, 펼치면 원문", "답이 쓸 만했으면 👍, 아니면 👎 — 관측 화면의 만족도로 모입니다");
      await pause(5000);
      await r.click("👍", { selector: "button", exact: true, after: 1200 });
      await pause(1500);

      // ── 업무 흐름 개선
      await r.go(`${L}/process`);
      await r.caption("업무 흐름 개선 — 업무 문서에서 As-Is 흐름과 문제점을 뽑고 To-Be 를 제안", "단계마다 문서 원문을 인용하고, 서버가 원문과 대조해 근거 등급(원문 일치·의역·근거 없음)을 매깁니다");
      await pause(4000);
      await r.click("새 분석", { selector: "button" });
      await r.caption("새 분석 — 업무 문서 컬렉션·문서 · 레거시 화면 연결(PMS-X 시스템) · 모델", "한 문서에 2~3분 — 아래는 '인사 발령 업무 절차서'로 미리 돌려 둔 결과");
      await pause(4500);
      await closeModal(r);
      await r.click("인사 발령 프로세스", { selector: "a, td", after: 1500 });
      await r.caption("As-Is 흐름 — 담당 · 단계 · 시스템 · 입력→산출 · 근거 · 레거시 화면", "PMS-X 시스템을 고르면 단계를 실제 레거시 화면(발령등록 HR0301)과 잇습니다");
      await pause(5500);
      await r.click("황", { selector: ".n-tag, span", exact: true, after: 1200 });
      await r.caption("근거 등급 — 녹: 문서 원문 그대로 · 황: 비슷함 · 적: 원문에 없음(확인 필요)", "마우스를 올리면 인용한 원문");
      await pause(3500);
      await tab(r, "문제점", "문제점 — 문서에 적힌 어려움을 근거와 함께");
      await tab(r, "To-Be (AI 제안)", "To-Be — AI 제안을 사람이 고쳐 확정합니다", "고친 뒤 'To-Be 저장'");
      await tab(r, "흐름도", "흐름도 — As-Is 와 To-Be 를 나란히", "BPMN(다른 모델링 도구로 열기)·Mermaid·보고서(MD)로 내보내기", 5000);
    },
  },

  "platform-5": {
    title: "AX Platform ⑤ 에이전트 · 트리거 · 런북",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/agents`);
      await r.caption("에이전트 — 모델은 게이트웨이, 도구는 MCP 허브로", "실행한 사람의 권한 그대로 · 승인 정책 그대로 · 단계(span)마다 기록");
      await pause(4000);
      await r.click("ITO 기본 에이전트", { selector: "button" });
      await r.caption("ITO 기본 에이전트 — 경보 1차 분석 · 서비스 요청 도우미 · 변경 영향 검토 등 미리 만든 틀", "골라서 그대로 쓰거나 고쳐 씁니다");
      await pause(4500);
      await closeModal(r);
      await r.click("새 에이전트", { selector: "button" });
      await r.caption("새 에이전트 — 이름 · 지시문 · 모델 별칭 · 쓸 도구 · 최대 턴 · 승인 정책");
      await pause(4000);
      await closeModal(r);
      await down(r, 450);
      await r.caption("트리거 — 사람 대신 에이전트를 깨웁니다", "웹훅(경보·CI) · 예약(cron) · 감시(새 서비스 요청 등) · 시간당 한도 · 같은 경보는 30분에 한 번");
      await pause(4500);
      await r.click("트리거 추가", { selector: "button" });
      await r.caption("트리거 추가 — 종류 · 입력 틀({{body.alertId}} 같은 자리) · 중복 막기 · 한도");
      await pause(4000);
      await closeModal(r);
      await r.click("기록", { selector: "button", exact: true });
      await r.caption("트리거 기록 — 언제 들어왔고 어떤 실행을 깨웠는지");
      await pause(3500);
      await closeModal(r);
      await top(r);
      await pick(r, "alert-triage", "sm-helper");
      await r.caption("sm-helper — SM 운영 도우미", "PMS-X 서비스 요청·장애를 찾아 처리 방향을 제안 · 쓸 수 있는 도구가 아래에");
      await pause(3000);
      await r.type("무엇을 할까요", "pmsx__srs 도구에 q=퇴사자 로 검색해서 나온 서비스 요청 번호와 제목, 처리 방향을 한국어 세 줄로 정리해줘", { delay: 30 });
      await r.click("실행", { selector: "button", exact: true });
      await r.caption("실행 — 모델 → 도구(pmsx__srs) → 모델", "단계마다 걸린 시간·토큰·도구 결과가 오른쪽에 쌓입니다");
      await r.waitFor("/완료|실패/.test([...document.querySelectorAll('.n-card')].map((c) => c.innerText).join(' ').slice(0, 4000))", 120000);
      await pause(6000);
      await down(r, 900);
      await r.click("보기", { selector: "button", exact: true });
      await r.caption("실행 기록 — 지난 실행을 열면 단계별 내용 그대로", "트리거로 깨운 실행은 '트리거' 표시");
      await pause(4000);

      await r.go(`${L}/runbooks`);
      await r.caption("런북 — 정해진 조치(배치 재실행·캐시 비우기·서비스 재기동)를 승인 후 실행", "에이전트도 같은 도구(runbook__이름)로 요청합니다");
      await pause(4000);
      await r.click("런북 등록", { selector: "button" });
      await r.caption("런북 등록 — 종류(HTTP·명령) · 실행 정의 · 매개변수 형식 · 위험도 · 실패 시 원복 런북", "명령은 셸 없이 인자 배열로 — 값은 정해 둔 형식(정규식)을 통과해야 합니다");
      await pause(5000);
      await closeModal(r);
      await r.click("실행…", { selector: "button", exact: true });
      await r.type("승인자가 봅니다", "INC-0241 디스크 경보 뒤 상태 확인", { delay: 40 });
      await r.caption("실행 — 사유를 적고 '점검'(승인 없이 미리 보기) 또는 '실행 요청'");
      await pause(2500);
      await modalBtn(r, "실행 요청", 2000);
      await r.caption("실행 요청 — 승인 번호가 생깁니다", "다른 관리자가 승인함에서 승인하면, 같은 값으로 다시 요청할 때 실행 · 결과·출력·소요 시간 기록");
      await pause(5000);
      await closeModal(r);
      await pause(2500);
    },
  },

  "platform-6": {
    title: "AX Platform ⑥ 현업 창구 — 답 · 담당자 접수 · 매뉴얼 보강 · 시험 질문 · 창구 설정",
    maxGap: 3,
    async run(r) {
      // ── 현업 직원 화면
      await r.login("platform", "dev");
      await r.go(`${L}/desk/hr-help`);
      await r.caption("현업 창구 — 현업 직원이 묻는 화면", "포털에 넣거나(iframe) 메신저·메일·Teams 로도 — 운영 매뉴얼과 처리 사례를 근거로 1차 응답");
      await pause(3500);
      await r.type("예: 사원 조회에", "사원 조회에 퇴사자가 같이 나와요", { delay: 55 });
      await r.click("보내기", { selector: "button" });
      await r.waitFor("document.body.innerText.includes('재직')", 120000);
      await pause(1200);
      await r.caption("근거 번호를 단 답 — 운영 매뉴얼·운영 보고서 중 어느 문서인지 함께", "해결됐으면 '해결됐어요' — 자동 해결률로 셉니다");
      await pause(5000);
      await r.click("해결됐어요", { selector: "button", exact: true, after: 2000 });
      await r.type("예: 사원 조회에", "회의실 예약은 어떻게 하나요?", { delay: 55 });
      await r.click("보내기", { selector: "button" });
      await r.waitFor("document.body.innerText.includes('찾지 못했습니다')", 120000);
      await pause(1200);
      await r.caption("근거가 없으면 지어내지 않고 — 담당자에게 넘길지 묻습니다");
      await pause(3000);
      await r.click("담당자에게 넘기기", { selector: "button" });
      await r.type("담당자에게 덧붙일 내용", "회의실 예약 방법 안내 부탁드립니다", { delay: 40 });
      await r.click("대화 기록과 함께 접수", { selector: "button" });
      await r.waitFor("/SR-\\d{4}/.test(document.body.innerText)", 40000);
      await r.caption("PMS-X 서비스 요청으로 접수 — 대화 기록과 함께, 요청 번호가 돌아옵니다", "접수처는 창구마다: PMS-X · 고객 ITSM 연결 · 웹훅 · 플랫폼 접수함");
      await pause(4500);

      // ── 관리 — 성과·대화 기록·매뉴얼 보강
      await r.login("platform", "admin");
      await r.go(`${L}/desks?supplement=1`);
      await r.click("/desk/hr-help", { selector: "code", after: 1500 });
      await r.caption("현업 창구 관리 — 창구마다 30일 문의 · 자동 해결률 · 답변률 · 담당자 접수율", "매뉴얼 보강 대기 — 답을 못 찾았거나 담당자에게 넘긴 질문 중 아직 매뉴얼에 없는 것");
      await pause(5000);
      // 맨 위(방금 접수한 대화)의 매뉴얼 보강 — 대화 안에서 창구가 답을 못 한 질문(회의실 예약)이 대상이 됩니다
      await r.click("매뉴얼 보강", { selector: "td button", exact: true, after: 1500 });
      await r.caption("매뉴얼 보강 — 담당자가 답을 적어 창구 근거 문서에 넣습니다", "질문과 그때 창구의 답이 위에 · 마크다운 ## 제목마다 한 절");
      await pause(3500);
      await r.type("css:.n-modal textarea", "## 회의실 예약\n회의실 예약은 그룹웨어 > 자원 예약 > 회의실 화면에서 날짜와 시간을 고른 뒤 [예약]을 누릅니다. 예약 변경과 취소는 같은 화면의 [내 예약]에서 합니다. 문의는 총무팀(내선 2345)입니다.\n", { clear: true, delay: 14 });
      await r.typeLabel("문서 제목", "회의실 예약 안내", { clear: true, delay: 40 });
      await pause(1200);
      await modalBtn(r, "매뉴얼에 넣고 다시 물어보기", 2000);
      await r.waitFor("document.body.innerText.includes('같은 질문을 다시 물었습니다') || document.body.innerText.includes('다시 묻기 실패')", 120000);
      await pause(1000);
      await r.caption("같은 질문을 다시 물어 봅니다 — 이제 방금 넣은 매뉴얼을 근거로 답합니다", "대화 기록·성과에는 남기지 않는 시험 · 목록에는 '보강함'");
      await pause(6500);
      await closeModal(r);
      await clickNear(r, "인사시스템 도움 창구", "시험 질문");
      await r.type("css:.n-modal textarea", "회의실 예약 취소는 어디서 해요?", { delay: 45 });
      await modalBtn(r, "물어보기", 1500);
      await r.caption("시험 질문 — 현업과 같은 근거·모델로 미리 물어 봅니다", "기록 없이 · 매뉴얼을 고친 뒤 확인할 때");
      await r.waitFor("document.querySelector('.n-modal .retry')", 120000);
      await pause(5500);
      await closeModal(r);
      await clickNear(r, "인사시스템 도움 창구", "수정");
      await r.caption("창구 설정 — 모델 · 근거(문서 컬렉션·유사 사례 도구) · 실행 계정 · 첫 안내 · 창구 규칙", "답을 못 하면 접수할 곳 · 메신저·메일 토큰 · Teams 보안 토큰 · 늦은 답장 주소");
      await pause(5500);
      await closeModal(r);

    },
  },

  "platform-7": {
    title: "AX Platform ⑦ 고객 ITSM 연동 — 처음 연결하기 · 시험용 연결 · 연결 시험 · 동기화",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/itsm`);
      await r.caption("고객 ITSM 연동 — 고객 ITSM 을 기록의 원본으로 두고 PMS-X 에서 일합니다", "새 고객 티켓 → 서비스 요청 접수 · 요청 상태 → 고객 티켓 상태·댓글 · 고객이 끝내면 '확인'으로");
      await pause(5000);
      if (await r.find("시험용 연결 만들기", { selector: "button", timeout: 1500 })) {
        await r.caption("처음 연결하기 — 고객 정보 받기 → 연결 추가 → PMS-X 잇기 → 동기화 켜기", "고객 ITSM 없이 먼저 — 플랫폼 안의 가상 ITSM(ServiceNow 형식, 티켓 5건)");
        await pause(4500);
        await r.click("시험용 연결 만들기", { selector: "button" });
        await r.click("확인", { selector: ".n-popconfirm button, .n-popover button", exact: true, after: 2500 });
      } else {
        await r.click("demo-itsm", { selector: "b", after: 1500 });
      }
      await r.click("연결 시험", { selector: "button", exact: true, after: 2500 });
      await r.caption("연결 시험 — 최근 티켓이 보이면 연결된 것");
      await pause(4000);
      await r.click("지금 동기화", { selector: "button", exact: true, after: 4000 });
      await r.caption("지금 동기화 — 고객 티켓이 PMS-X 서비스 요청으로 접수되고, 티켓에는 요청 번호 댓글", "주기(기본 5분)로 바뀐 것만 · 고객 ITSM 에서 웹훅을 걸면 바로");
      await pause(5000);
      await tab(r, "동기화 기록", "동기화 기록 — 들어온 것·나간 것·오류");
      await r.click("설정", { selector: "button", exact: true });
      await r.caption("연결 설정 — 종류(ServiceNow·Jira·일반 REST) · 담당 범위 · PMS-X 프로젝트 · 우선순위·상태 대응", "에이전트는 itsm__ticket · itsm__links · itsm__comment 도구로 봅니다");
      await pause(5500);
      await closeModal(r);
    },
  },

  "platform-8": {
    title: "AX Platform ⑧ AI 사용 현황(사용량·비용 · 품질·지연 · 외부 AI·자산) · 생산성 보고서 · 모델 평가",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/`);
      await sideMenu(r, "AI 사용 현황");
      await r.caption("AI 사용 현황 — 사용량·비용 · 품질·지연 · 외부 AI·자산을 화면 위 탭으로", "사용량·비용(Insight) — 게이트웨이 · MCP 허브 · 에이전트 · 현업 창구 · Claude Code · AX-NAVI");
      await pause(4500);
      for (const [g, cap] of [["모델", "모델별"], ["팀", "팀별 — 기본은 팀 단위, 개인은 권한자만"], ["작업번호(요청·CR)", "작업번호별 — 서비스 요청·변경 요청 하나에 AI 를 얼마나 썼나"], ["소스", "소스별 — 어디서 쓴 AI 인가"], ["도구", "도구별 — 에이전트가 많이 부른 도구"]]) {
        await r.click(g, { selector: "button", exact: true, after: 1500 });
        await r.caption(`묶어 보기 — ${cap}`, "기간 비용이 0원(사내 모델)이면 일별 그래프는 토큰으로");
        await pause(3000);
      }
      await tab(r, "최근 기록", "최근 기록 — 사건 하나하나(누가·어디서·모델·토큰·비용)");
      await tab(r, "단가표", "단가표 — 모델마다 입력·출력·캐시 단가", "사내 모델은 0원 · 단가를 바꾸면 비용을 다시 계산합니다");
      await tab(r, "수집 소스", "수집 소스 — Claude Code 기록 파일 · AX-NAVI 사용 · OTLP · 다른 서버에서 보내기", "같은 사건은 한 번만 셉니다");

      await top(r);
      await sectionTab(r, "품질 · 지연");
      await r.caption("품질 · 지연 — 운영 지표", "모델 별칭별 지연(p50·p95)·오류율 · 도구 성공률 · 정책 위반 · 에이전트 실행 · 만족도(👍·👎)");
      await pause(5000);
      await down(r, 600);
      await pause(3500);
      await down(r, 700);
      await r.caption("만족도 — 채팅·에이전트·업무 흐름 개선 결과에 남긴 의견");
      await pause(4000);

      await top(r);
      await sectionTab(r, "외부 AI · 자산");
      await r.caption("외부 AI · 자산 — 우리 제품 밖의 AI 사용까지", "사내에서 쓰는 외부 AI 서비스의 사용 현황(사용자·사용일·주요 지표)을 CSV·API 로 받아 함께 봅니다");
      await pause(4500);
      await tab(r, "AI 자산 대장", "AI 자산 대장 — 어떤 AI 를 누가 어디에 쓰는지", "모델·에이전트·외부 서비스 · 담당 · 데이터 등급 · 검토 상태");
      await tab(r, "수집 원천", "수집 원천 — 외부 AI 사용량을 받는 곳", "CSV 올리기 · 마지막 올린 때");

      await sideMenu(r, "생산성 보고서");
      await r.caption("생산성 보고서 — AI 를 쓴 요청과 안 쓴 요청의 공수·리드타임 비교", "PMS-X 서비스 요청 · Git 커밋 · 계약 기준값을 이어서 계산");
      await pause(4000);
      await r.click("계산", { selector: "button", exact: true, after: 3000 });
      await r.caption("결과 — AI 관여 여부별 · 유형별 · 해결한 요청 목록", "보고서(MD)·요청 목록(CSV)으로 내려받기 · 해석할 때 주의할 점도 함께");
      await pause(5500);
      await tab(r, "저장소·커밋", "저장소·커밋 — 커밋 메시지의 업무 번호(SR-·CR-…)와 AI 공동 작성 표시로 잇습니다", "Git 서버 웹훅으로 받음");
      await tab(r, "기준선·요청", "기준선 — 계약 기준값(유형별 요청 1건 평균 공수·리드타임)", "PMS-X 에서 서비스 요청 가져오기");

      await sideMenu(r, "평가");
      await sectionTab(r, "모델 평가");
      await r.caption("평가 › 모델 평가 — 통합ITO 평가 세트로 모델을 비교", "새 모델을 들이기 전에 · 근거 답변 · 지식 문서 초안 · 서비스 요청 분류 · 도구 호출");
      await pause(4000);
      await r.click("사례 보기", { selector: "button", exact: true });
      await r.caption("평가 세트 — 문항과 기대 답", "사내 세트를 올려 우리 업무로 평가할 수도 있습니다");
      await pause(4000);
      await closeModal(r);
      await top(r);
      await pick(r, "선택해 주세요", "hnix-local");
      for (const s of ["근거 답변 (현업 창구)", "지식 문서 초안 형식", "도구 호출 (PMS-X·문서 조회)"]) await r.click(s, { selector: ".n-checkbox", after: 400 });
      await r.type("GPU 서버", "사내 모델 분류 점검", { delay: 40 });
      await r.click("평가 시작", { selector: "button" });
      await r.caption("평가 — 사례마다 모델을 한 번씩 불러 채점합니다", "호출은 게이트웨이를 지나 Insight 에 client=eval 로 남습니다");
      await r.waitFor("[...document.querySelectorAll('div, li')].some((e) => e.innerText.length < 200 && e.innerText.trim().startsWith('완료') && e.innerText.includes('사내 모델 분류 점검'))", 300000);
      await pause(1500);
      await r.caption("결과 — 별칭별 통과율 · 점수 · 지연 · 토큰, 권장 모델", "'업무 별칭에 반영'으로 이긴 모델을 업무 별칭의 대상으로 · 사례별 모델 답과 사유");
      await pause(6000);
    },
  },

  "platform-9": {
    title: "AX Platform ⑨ AX-NAVI 조직 설정 · 사용 허가 · 사용자 · 워크스페이스 · 감사 로그 · 현장 연결 점검",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/axnavi-profiles`);
      await r.caption("AX-NAVI 조직 설정 — 규칙·SDLC 양식·스킬·MCP 서버·인증 정책을 묶어 배포", "전사 또는 팀(워크스페이스)에 · 개발자 PC 의 AX-NAVI 는 시작할 때 받아 갑니다");
      await pause(5000);
      await r.click("mcp.json", { selector: ".n-tag", after: 1200 });
      await r.caption("묶음 안의 파일 — 규칙(rules) · 양식(templates) · 스킬 · MCP · 사용자 정의 모드", "고쳐서 '초안 저장' → '배포…'(메모와 함께 버전)");
      await pause(4500);
      await r.click("대상·우선순위", { selector: "button" });
      await r.caption("대상·우선순위 — 전사·팀, 겹치면 우선순위가 높은 묶음이 이깁니다");
      await pause(3500);
      await closeModal(r);
      await down(r, 600);
      await r.click("바뀐 것", { selector: "button", exact: true });
      await r.caption("배포 이력 — 버전마다 바뀐 것 · 받아 간 기록(누가·어느 버전·언제)");
      await pause(4000);
      await closeModal(r);

      await r.go(`${L}/axnavi-seats`);
      await r.caption("AX-NAVI 사용 허가 — 누구에게 허가를 줬는지", "엔진 위치(PC 자동 설치 / 서버만) · 회수하면 그 사람의 기기가 모두 잠깁니다");
      await pause(4500);
      await r.click("기기 (", { selector: ".n-tabs-tab, [role=tab], div" });
      await r.caption("기기 — 승인된 PC · 운영체제 · 마지막 확인", "기기 하나만 폐기할 수도 있습니다");
      await pause(4000);
      await r.click("유출본 확인", { selector: ".n-tabs-tab, [role=tab], div" });
      await r.caption("유출본 확인 — 밖에서 발견된 스킬 문서를 붙여 넣으면", "기기마다 넣은 보이지 않는 표식으로 받은 사람과 기기를 찾습니다");
      await pause(4500);

      await r.go(`${L}/admin/users`);
      await r.caption("사용자 — 로컬 계정 · 사내 LDAP·SSO 계정 · 역할(시스템 관리자·감사자·사용자)", "비활성화하면 키·세션이 함께 막힙니다");
      await pause(4000);
      await r.click("사용자 추가", { selector: "button" });
      // 브라우저가 저장된 계정을 채워 넣는 칸을 비운다(영상용)
      await r.eval("document.querySelectorAll('.n-modal input').forEach((i) => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })").catch(() => undefined);
      await r.caption("사용자 추가 — 로그인 ID · 이름 · 팀 · 역할 · 처음 비밀번호");
      await pause(3500);
      await closeModal(r);

      await r.go(`${L}/admin/workspaces`);
      await r.caption("워크스페이스 — 팀·프로젝트 단위의 공간", "기본 데이터 등급 · 멤버와 역할 · 문서 컬렉션·채팅·예산이 워크스페이스에 묶입니다");
      await pause(4000);
      await r.click("멤버", { selector: "button", exact: true, after: 1500 });
      await r.caption("멤버 — 누가 어떤 역할로 들어와 있는지");
      await pause(4000);

      await r.go(`${L}/admin/audit`);
      await r.caption("감사 로그 — 로그인·설정 변경·키 발급·승인·삭제를 모두", "누가 · 언제 · 무엇을 · 결과 · IP");
      await pause(4000);
      await r.type("행위 접두어", "gateway.", { delay: 60 });
      await r.click("조회", { selector: "button", exact: true, after: 2000 });
      await r.caption("거르기 — 예: gateway. 로 게이트웨이 설정 변경만");
      await pause(4500);

      await r.go(`${L}/admin/readiness`);
      await r.caption("현장 연결 점검 — 설치 후 무엇이 남았는지 한 화면에", "기본 설치(DB·접속 주소·로그인·백업) · 모델 연결 · 도구 서버 · ITSM · Git · 자동화");
      await pause(5000);
      await r.click("연결 시험 포함 점검", { selector: "button", after: 6000 });
      await r.caption("연결 시험 포함 점검 — 모델·도구 서버·ITSM 에 실제로 붙어 봅니다", "항목마다 상태와 할 일");
      await pause(5000);
      await down(r, 700);
      await pause(4000);
    },
  },

  "platform-10": {
    title: "AX Platform ⑩ 자동화 흐름 — 캔버스 · 노드 · 버전 기록 · 사람 확인 · 실행 디버거",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/flows`);
      await r.caption("자동화 흐름 — 정해진 순서대로 실행", "에이전트가 알아서 판단하는 것과 달리, 흐름은 설계한 길만 갑니다 · 모델은 게이트웨이, 도구는 MCP 허브, 사람 확인은 승인함");
      await pause(4500);
      await clickNear(r, "서비스 요청 분류·처리", "열기", { after: 2500 });
      await r.caption("편집기 — 노드를 끌어다 놓고 선으로 잇습니다", "새 서비스 요청 → 모델이 유형 분류 → 갈래(장애·문의·기타) → 담당 에이전트 / 지식 문서 검색 → 담당자 확인 → 끝");
      await pause(5500);
      await r.click("유형 분류", { selector: ".vue-flow__node", after: 1500 });
      await r.caption("모델 질문 노드 — 게이트웨이 별칭 · 지시문 · 프롬프트 템플릿 · 결과를 담을 변수", "{{title}} 같은 자리에 앞 단계 값이 들어갑니다 · JSON 으로 받아 다음 노드에서 category.type 처럼 씁니다");
      await pause(5500);
      await r.click("유형별 갈래", { selector: ".vue-flow__node", after: 1500 });
      await r.caption("조건 분기 — 규칙(category.type = 장애 · 문의)마다 갈래, 나머지는 '그 외'", "규칙 대신 모델에게 고르게 할 수도 있습니다");
      await pause(5000);
      await r.click("장애 담당 에이전트", { selector: ".vue-flow__node", after: 1500 });
      await r.caption("에이전트 실행 노드 — 이미 만든 에이전트(alert-triage)를 흐름 한 단계로", "에이전트 안의 도구 호출도 같은 권한·정책·승인을 지납니다");
      await pause(4500);
      await r.click("담당자 확인", { selector: ".vue-flow__node", after: 1500 });
      await r.caption("사람 확인 — 승인함에 올라가 결정을 기다립니다", "승인하면 '승인' 출구로, 거부하면 '거부' 출구로 · 실행한 사람은 스스로 승인할 수 없습니다");
      await pause(5000);
      await r.caption("노드 9종 — 모델 질문 · 도구 호출 · 에이전트 실행 · 조건 분기 · 반복 · 사람 확인 · 변수 정하기 · 시작 · 끝", "저장할 때마다 검증 — 끊긴 선·빠진 값은 '고칠 곳'으로 표시");
      await pause(5000);
      await r.click("버전 기록", { selector: "button", exact: true, after: 1500 });
      await r.caption("버전 기록 — 저장할 때마다 버전이 쌓입니다", "실행은 그때의 버전으로 돌고, 옛 버전을 불러와 되돌릴 수 있습니다");
      await pause(4000);
      await closeModal(r);
      await down(r, 700);
      await r.caption("트리거 — 사람 대신 흐름을 깨웁니다", "웹훅(경보·CI) · 예약 · 감시 · 다른 곳에서는 MCP 도구 flows__run, REST POST /api/v1/flows/<id>/runs");
      await pause(4500);

      // ── 현업 담당자(dev1)가 실행 → 사람 확인 대기
      await r.login("platform", "dev");
      await r.go(`${L}/flows`);
      await clickNear(r, "서비스 요청 분류·처리", "열기", { after: 2500 });
      await r.caption("현업 담당자(dev1)가 흐름을 실행합니다 — 시험 실행", "공개된 흐름은 보기·실행만 · 고치는 것은 만든 사람과 관리자");
      await pause(3000);
      await r.clickSel("[data-test=flow-test-run]", 1500);
      await r.type("css:[data-test=flow-run-input-title] textarea", "사원 조회에 퇴사자가 같이 나와요", { delay: 45 });
      await r.type("css:[data-test=flow-run-input-body] textarea", "인사팀에서 사원 조회 화면을 열면 퇴사한 사람까지 함께 나온다고 문의했습니다. 재직자만 보이게 하는 방법을 알려 주세요.", { delay: 18 });
      await r.click("자세히 기록 (이번 실행)", { selector: ".n-checkbox", after: 600 });
      await r.caption("입력값 · '자세히 기록'을 켜면 단계마다 보낸 글·받은 답을 남깁니다", "개인정보는 게이트웨이 규칙으로 가린 뒤 보관 기한(기본 7일)까지");
      await pause(3000);
      await r.clickSel("[data-test=flow-run-start]", 1500);
      await r.waitFor("!!document.querySelector('[data-test=flow-run-result]') && /승인 대기|사람 확인 대기|승인함에서 결정/.test(document.querySelector('[data-test=flow-run-result]').innerText)", 120000);
      await pause(1200);
      await r.caption("모델이 '문의'로 분류 → 지식 문서 검색 → 담당자 확인에서 멈춤", "캔버스에 지나간 노드가 표시되고, 아래 실행 디버거에 단계가 쌓입니다");
      await pause(5500);
      await r.scroll(500, NV);
      await pause(3500);

      // ── 관리자가 승인함에서 승인
      await r.login("platform", "admin");
      await r.go(`${L}/approvals`);
      await pause(1500);
      await r.caption("관리자 — 승인함에 흐름의 사람 확인이 올라와 있습니다(왼쪽 메뉴 배지)", "흐름 이름 · 단계 · 확인할 내용(분류 결과와 처리안)");
      await pause(3500);
      if (await clickNear(r, "flows__confirm", "검토", { after: 1500 })) {
        await r.caption("검토 — 처리안을 읽고 결정합니다");
        await pause(4000);
        await r.type("결정 사유", "안내 문구 그대로 회신해 주세요", { delay: 45 });
        await modalBtn(r, "승인", 2000);
        await r.caption("승인 — 흐름이 멈춘 곳부터 자동으로 이어 갑니다");
        await pause(3500);
      }

      // ── 실행 기록 · 실행 디버거
      await r.login("platform", "dev");
      await r.go(`${L}/flows`);
      await tab(r, "실행 기록", "실행 기록 — 내가 실행한 흐름", "상태 · 판 · 단계 수 · 토큰", 3000);
      await r.waitFor("/완료/.test(document.querySelector('.n-data-table')?.innerText ?? '')", 60000).catch(() => undefined);
      await r.click("보기", { selector: "button", exact: true, after: 2500 });
      await r.caption("실행 디버거 — 단계별 폭포형 시간 막대", "모델·도구·분기·사람 확인이 한 줄씩 · 걸린 시간과 토큰");
      await pause(5000);
      if (await r.clickSel("[data-test=run-span-1]", 1500)) {
        await r.caption("모델 단계 — 보낸 메시지와 모델 답(분류 JSON)", "'자세히 기록'으로 남긴 본문 · 개인정보 가림 표시");
        await pause(5500);
      }
      if (await r.clickSel("[data-test=run-span-3]", 1500)) {
        await r.caption("도구 단계 — docs__search 에 넘긴 인자와 받은 결과");
        await pause(5000);
      }
      if (await r.clickSel("[data-test=run-span-4]", 1500)) {
        await r.caption("사람 확인 단계 — 누가 언제 승인했는지, 기다린 시간");
        await pause(4500);
      }

      // ── 에이전트 실행도 같은 디버거로
      await r.login("platform", "admin");
      await r.go(`${L}/agents`);
      await pause(1500);
      await pick(r, "alert-triage", "sm-helper");
      await r.type("무엇을 할까요", "pmsx__srs 도구에 q=퇴사자 로 검색해서 나온 서비스 요청 번호와 제목, 처리 방향을 한국어 세 줄로 정리해줘", { delay: 22 });
      await r.clickSel("[data-test=run-debug]", 600);
      await r.caption("에이전트 실행에도 '자세히 기록' — 이번 실행만 켤 수 있습니다", "에이전트 설정에서 켜 두면 모든 실행에");
      await pause(3000);
      await r.clickSel("[data-test=run-start]", 1500);
      await r.waitFor("!!document.querySelector('[data-test=run-output]')", 180000).catch(() => undefined);
      await pause(1500);
      await r.caption("실행 디버거 — 턴마다 모델 → 도구 → 모델", "실패한 단계가 있으면 '첫 오류로' 한 번에");
      await pause(4500);
      if (await r.clickSel("[data-test=run-span-1]", 1500)) {
        await r.caption("도구 호출 단계 — 모델이 고른 인자(projectId·q)와 PMS-X 가 돌려준 결과", "본문은 실행한 사람·관리자·감사자만 · 남의 본문을 열면 감사 기록");
        await pause(6000);
      }
    },
  },

  "platform-11": {
    title: "AX Platform ⑪ 에이전트 평가 — 시험 문항 · 확인 항목 · 일괄 실행 · 이전 평가와 비교",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/agents`);
      await pause(1200);
      await pick(r, "alert-triage", "sm-helper");
      await r.clickSel("[data-test=agent-eval-open]", 2500);
      await r.caption("에이전트 평가 — 고칠 때마다 같은 시험으로", "지시문·모델·도구를 바꾼 뒤 다시 돌려 이전 평가와 문항별로 비교 · 에이전트와 자동화 흐름 모두");
      await pause(4000);
      const hasSet = await r.eval("!!document.querySelector('[data-test=eval-cases]')");
      if (!hasSet) await pick(r, "평가 세트", "서비스 요청 도우미 회귀");
      await pause(1500);
      await r.caption("시험 문항 4개 — 입력 + 확인 항목", "도구를 썼는지 · SR 번호가 있는지(정규식) · 턴 수 · 범위 밖 질문엔 도구 없이 · 모델 채점");
      await pause(5500);
      await clickNear(r, "답 품질(모델 채점)", "고치기", { after: 1500 });
      await r.caption("문항 편집 — 확인 항목 9종", "포함·불포함 글자 · 정규식 · 쓴 도구·쓰지 말 도구 · 도구 호출 수 · 턴 · 시간 · 모델 채점(기준 문장)");
      await pause(6000);
      await closeModal(r);
      await tab(r, "실행 결과", "실행 결과 — 지난 평가(기준)", "통과율 · 평균 점수 · 지연 · 토큰 · 평가한 설정(지시문·모델·도구의 해시)", 3000);
      await r.click("기준", { selector: "td", after: 2500 });
      await pause(3000);
      await r.caption("문항마다 확인 항목별 결과와 이유", "'퇴사자 요청 찾기'는 답에 SR 번호가 없어 실패");
      await pause(5500);
      if (await clickNear(r, "퇴사자 요청 찾기", "디버거", { after: 2000 })) {
        await r.caption("디버거 — 그 문항에서 에이전트가 실제로 한 일", "어느 단계에서 엇나갔는지 바로 봅니다");
        await pause(5500);
        await closeModal(r);
      }
      await top(r);
      await r.clickSel("[data-test=eval-run]", 1500);
      await r.caption("평가 실행 — 문항을 차례로 돌려 채점합니다", "실행은 내 권한 · 승인이 필요한 도구는 실제로 부르지 않고 '승인 필요로 멈춤'");
      await r.waitFor("/완료|실패/.test(document.querySelector('[data-test=eval-run-detail]')?.innerText.slice(0, 40) ?? '') && !/실행 중/.test(document.querySelector('[data-test=eval-run-detail]')?.innerText.slice(0, 40) ?? '')", 400000);
      await pause(2000);
      await r.caption("새 평가 결과", "같은 설정으로 다시 돌려도 작은 모델은 답이 흔들립니다 — 그래서 문항으로 잽니다");
      await pause(5000);
      await r.click("이전과 비교", { selector: "button", exact: true, after: 2500 });
      await r.caption("비교 — 통과율 · 점수 · 지연 · 토큰의 차이, 문항마다 좋아짐·나빠짐·같음", "바뀐 설정(지시문·모델·도구)도 함께 · 밤마다 돌리려면 자동화 흐름 + 예약 트리거 + evals__run");
      await pause(7000);
    },
  },

  "platform-12": {
    title: "AX Platform ⑫ 업무 시스템 연결 · 외부 에이전트 가져오기 · 말로 묻기",
    maxGap: 3,
    browserArgs: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${fileURLToPath(new URL("./demo-files/ask-voice.wav", import.meta.url)).replace(/\\/g, "/")}`],
    async run(r) {
      const srv = JSON.parse(readFileSync(new URL("./.demo-servers.json", import.meta.url), "utf8"));
      await r.login("platform", "admin");
      await r.go(`${L}/biz`);
      await r.caption("업무 시스템 연결 — ERP·CRM·그룹웨어를 MCP 허브 도구로", "SAP · Salesforce · Microsoft 365 · 네이버웍스 · 사내 REST(OpenAPI) — 조회는 허용, 쓰기는 기본 '승인 필요'");
      await pause(5000);
      await r.click("연결 추가", { selector: "button", exact: true, after: 1200 });
      await r.click("SAP (OData)", { selector: ".n-modal .kind", after: 1200 });
      await r.caption("SAP — OData 서비스 주소 · 버전 · 인증(계정 또는 OAuth2) · 쓰기 전 CSRF 토큰");
      await r.typeLabel("연결 이름", "sap_hr", { clear: true, delay: 60 });
      await r.typeLabel("설명", "인사 OData — 사원 조회", { delay: 40 });
      await r.typeLabel("OData 서비스 주소", srv.sap.url, { delay: 15 });
      await r.typeLabel("계정", srv.sap.user, { clear: true, delay: 50 });
      await r.typeLabel("비밀번호", srv.sap.password, { clear: true, delay: 50 });
      await pause(1200);
      await r.click("연결 시험", { selector: ".n-modal button", exact: true, after: 2500 });
      await r.caption("연결 시험 — 가벼운 호출로 주소·인증·권한 확인", "비밀번호는 암호화해 저장하고 화면에 다시 보여 주지 않습니다");
      await pause(4000);
      await r.click("다음 — 도구 고르기", { selector: "button", after: 1800 });
      await r.caption("도구·정책 — 켠 도구만 허브에 등록", "조회(엔터티 목록·조회·한 건)는 허용 · 만들기·고치기·함수 호출은 '승인 필요' · 차단도 가능");
      await pause(6000);
      await modalBtn(r, "저장", 2500);
      await r.caption("등록됨 — sap_hr__query 처럼 연결 이름이 도구 앞에", "에이전트·자동화 흐름·IDE·Claude Code 가 같은 정책·승인·감사로 씁니다");
      await pause(5000);

      // 일반 REST — OpenAPI 문서를 읽어 도구로
      await r.click("연결 추가", { selector: "button", exact: true, after: 1200 });
      await r.click("일반 REST (OpenAPI)", { selector: ".n-modal .kind", after: 1200 });
      await r.typeLabel("연결 이름", "incident_api", { clear: true, delay: 60 });
      await r.typeLabel("설명", "사내 장애 접수 API", { delay: 40 });
      await r.type("문서 주소", srv.rest.specUrl, { delay: 15 });
      await r.click("문서 읽기", { selector: "button", exact: true, after: 2500 });
      await r.caption("일반 REST — OpenAPI 문서를 읽어 operation 을 고르면 도구가 됩니다", "사내 장애 접수 API — 목록·한 건·접수·상태 바꾸기 · 파일 올리기 같은 것은 빼고");
      await pause(5500);
      await r.typeLabel("API 주소", `${srv.rest.url}/api`, { clear: true, delay: 15 });
      await pick(r, "없음", "API 키 헤더", { exact: true });
      await r.typeLabel("API 키", srv.rest.apiKey, { clear: true, delay: 50 });
      await r.typeLabel("연결 시험 경로", "/health", { delay: 50 });
      await r.click("연결 시험", { selector: ".n-modal button", exact: true, after: 2500 });
      await pause(2500);
      await r.click("다음 — 도구 고르기", { selector: "button", after: 1800 });
      await r.caption("기본으로는 조회(GET) operation 만 골라 둡니다", "접수·상태 바꾸기 같은 쓰기를 고르면 '승인 필요'로 시작합니다");
      await pause(4500);
      await modalBtn(r, "저장", 2500);
      await pause(2500);
      await r.go(`${L}/hub`);
      await tab(r, "서버", "MCP 허브 — 업무 시스템 연결이 허브 서버로 보입니다", "호출 기록·승인함·정책은 다른 도구와 똑같이", 4500);

      // 외부 에이전트 가져오기
      await r.go(`${L}/agents`);
      await pause(1500);
      await r.clickSel("[data-test=agent-import]", 1500);
      await r.caption("외부 에이전트 가져오기 — 다른 팀이 만든 에이전트를 플랫폼 에이전트로", "A2A · LangGraph · OpenAI 호환 · 일반 HTTP");
      await pause(4000);
      await r.clickSel("[data-test=ext-type-langgraph]", 800);
      await r.clickSel("[data-test=ext-next]", 1200);
      await r.type("css:[data-test=ext-url] input", srv.agent.url, { delay: 25 });
      await r.typeLabel("어시스턴트(그래프) 이름 또는 ID", srv.agent.assistantId, { clear: true, delay: 60 });
      await r.caption("주소·인증 — 구매팀이 LangGraph 로 만든 '구매 담당 에이전트'", "사내 주소만 허용 · 비밀값은 시크릿 저장소에");
      await pause(3500);
      await r.clickSel("[data-test=ext-next]", 1200);
      await r.type("css:[data-test=ext-test-input] input", "인사팀 노트북 구매 요청은 지금 어느 단계야?", { clear: true, delay: 45 });
      await r.clickSel("[data-test=ext-test]", 1500);
      await r.waitFor("!!document.querySelector('[data-test=ext-test-result]')", 90000);
      await pause(1000);
      await r.caption("연결 시험 — 한 번 불러 답을 꺼낼 수 있는지 봅니다(저장하지 않음)");
      await pause(5000);
      await r.clickSel("[data-test=ext-next]", 1200);
      await r.type("css:[data-test=ext-name] input", "purchase-agent", { delay: 60 });
      await r.typeLabel("설명", "구매팀 LangGraph 에이전트 — 구매 요청 진행 상황", { delay: 35 });
      await r.click("공개 (워크스페이스)", { selector: ".n-radio-button", after: 600 });
      await pause(1500);
      await r.clickSel("[data-test=ext-save]", 2500);
      await r.caption("플랫폼 에이전트가 됐습니다 — 실행 기록 · 디버거 · 평가 · 자동화 흐름 · MCP(agents__run) 에서 그대로");
      await pause(4000);
      await r.type("무엇을 할까요", "총무팀 사무용 의자 구매 요청은 지금 어느 단계야?", { delay: 45 });
      await r.clickSel("[data-test=run-start]", 1500);
      await r.waitFor("!!document.querySelector('[data-test=run-output]')", 120000).catch(() => undefined);
      await pause(1500);
      await r.caption("외부 에이전트의 답 — 실행 디버거에는 '외부 에이전트' 단계로", "부른 사람·시간·결과가 다른 에이전트와 같은 자리에 남습니다");
      await pause(4000);
      await r.clickSel("[data-test=run-span-0]", 1500);
      await pause(4500);

      // 음성 — 게이트웨이 음성 인식 별칭 + 현업 창구 마이크
      await r.go(`${L}/gateway`);
      await tab(r, "모델 별칭", "", "", 1500);
      await r.caption("음성 — 게이트웨이에 사내 음성 인식 모델을 별칭으로", "voice-stt(종류: 음성 인식) → 사내 whisper 계열 서버 · 키·예산·감사·Insight 가 그대로");
      await pause(5000);
      await r.login("platform", "dev");
      await r.go(`${L}/desk/hr-help`);
      await pause(2000);
      await r.caption("현업 창구 — 마이크로 묻습니다", "말한 내용은 게이트웨이를 거쳐 사내 음성 인식 모델이 글로 바꿉니다");
      await pause(3500);
      await r.clickSel("[data-test=mic-button]", 500);
      await r.caption("말하는 중 — 「사원 조회 화면에 퇴사자가 같이 나와요. 어떻게 해야 하나요?」");
      await pause(7000);
      await r.clickSel("[data-test=mic-button]", 500);
      await r.waitFor("[...document.querySelectorAll('textarea')].some((t) => t.value.includes('퇴사'))", 60000).catch(() => undefined);
      await pause(1000);
      await r.caption("글로 바뀌었습니다 — 확인하고 보내기", "바로 보내기로 설정할 수도 있습니다");
      await pause(3500);
      await r.clickSel("[data-test=desk-send]", 1000);
      await r.waitFor("document.body.innerText.includes('재직')", 120000).catch(() => undefined);
      await pause(1500);
      await r.caption("매뉴얼 근거로 답합니다 — '읽어 주기'로 답을 소리로 들을 수 있습니다", "읽어 주기는 브라우저 음성 또는 게이트웨이 음성 합성 별칭");
      await pause(6000);
    },
  },

  "platform-13": {
    title: "AX Platform ⑬ 화면 정리 — 메뉴 묶음 · 승인함 · 문서 새 판으로 바꾸기 · 창구의 프로젝트 이름",
    maxGap: 3,
    async run(r) {
      await r.login("platform", "admin");
      await r.go(`${L}/`);
      await r.caption("왼쪽 메뉴 — 하는 일로 다시 묶었습니다", "관리자 27칸 → 22칸 · 일반 사용자는 13칸 · 비슷한 화면은 메뉴 한 칸 + 화면 위 묶음 탭");
      await pause(5500);
      await sideMenu(r, "AI 사용 현황");
      await r.caption("AI 사용 현황 — 예전의 Insight · 관측 · 전사 AI 관측", "화면 위 묶음 탭으로 오갑니다 · 주소는 그대로라 알림·옛 링크도 그대로");
      await pause(4000);
      await sectionTab(r, "품질 · 지연");
      await pause(2000);
      await sectionTab(r, "외부 AI · 자산");
      await pause(2000);
      await sideMenu(r, "평가");
      await r.caption("평가 — 에이전트 평가와 모델 평가를 한 칸에");
      await pause(2500);
      await sectionTab(r, "모델 평가");
      await pause(2000);
      await sideMenu(r, "AX-NAVI 관리");
      await r.caption("AX-NAVI 관리 — 사용 허가 · 조직 설정", "사용자 · 워크스페이스도 한 칸으로");
      await pause(3500);

      // 승인함
      await sideMenu(r, "승인함");
      await r.caption("승인함 — 메뉴 맨 위, 내가 결정할 대기 건수가 배지로", "예전에는 MCP 허브의 탭 안 · 도구 호출 · 런북 실행 · 자동화 흐름의 사람 확인이 모두 여기로");
      await pause(5000);
      if (await r.click("검토", { selector: "button", exact: true, after: 1500 })) {
        await r.caption("검토 — 누가 · 어떤 도구를 · 어떤 인자로", "승인·반려는 ③ MCP 허브 장에서");
        await pause(3500);
        await closeModal(r);
      }

      // 문서 새 판
      await sideMenu(r, "문서 RAG");
      await r.click("운영 매뉴얼", { selector: ".col div", exact: true, after: 1500 });
      await r.caption("문서 RAG — 고친 매뉴얼을 다시 올리면?", "예전에는 옛 판이 그대로 남아 답변 근거에 옛 내용이 섞였습니다");
      await pause(4000);
      await r.upload(fileURLToPath(new URL("./demo-files/v2/급여-마감-점검표.md", import.meta.url)));
      await r.waitFor("!!document.querySelector('.n-dialog')", 10000);
      await r.caption("같은 이름의 문서가 있습니다 — 새 판으로 바꿀까요?", "바꾸면 새 문서를 다 넣은 뒤 옛 판을 지웁니다 · 따로 추가하면 목록에 '옛 판' 표시");
      await pause(4500);
      await modalBtn(r, "새 판으로 바꾸기", 1500);
      await r.waitFor("[...document.querySelectorAll('.n-message')].some((m) => m.innerText.includes('새 판으로 바꿈'))", 60000);
      await r.caption("새 판으로 바꿈 — 옛 판 1개 정리", "같은 '급여 계산 배치' 질문에 이제 새 판(20시)만 근거로 나옵니다");
      await pause(3500);
      await top(r);
      await r.type("질문이나 낱말로 찾기", "급여 계산 배치는 몇 시에 돌아?", { delay: 40 });
      await r.click("검색", { selector: "button", exact: true, after: 2500 });
      await pause(4500);

      // 현업 창구 — 프로젝트 이름
      await sideMenu(r, "현업 창구");
      await r.caption("현업 창구 — 접수할 PMS-X 프로젝트를 ID 대신 이름으로", "편집 창에서도 목록에서 고릅니다");
      await pause(4500);
      await clickNear(r, "인사시스템 도움 창구", "수정", { after: 1500 });
      await down(r, 900, ".n-modal-body-wrapper .n-scrollbar-container");
      await pause(3500);
      await closeModal(r);

      // 일반 사용자
      await r.login("platform", "dev");
      await r.go(`${L}/`);
      await r.caption("일반 사용자 — 쓸 수 있는 메뉴만 13칸", "볼 권한이 없는 바로 가기(현업 창구)는 대시보드에서도 뺐습니다");
      await pause(5000);
      await sideMenu(r, "AI 사용 현황");
      await r.caption("묶음 탭도 권한대로 — 일반 사용자는 사용량·비용 · 품질·지연만");
      await pause(4000);
    },
  },

  /* ================= PMS-X ================= */

  "pmsx-1": {
    title: "PMS-X ① 홈 대시보드 · 통합 검색 · 알림 · 공지 · 위키 · 고객 포털",
    maxGap: 3,
    async run(r) {
      await r.go(`${P}/login`);
      await r.caption("PMS-X — SI 구축과 SM 운영을 한 시스템에서", "폐쇄망 단일 설치 · 사내 LDAP 로그인 · AI 기능은 켤 때만(사내 게이트웨이 경유)");
      await pause(3000);
      await r.login("pmsx", "admin");
      await pmsxProject(r, "SI");
      await r.go(`${P}/home`);
      await r.caption("홈 — 내 일과 프로젝트 현황", "공지 · 내 일감 · 업무별 주 단위 계획·실적 · 진척률");
      await pause(4500);
      await r.scroll(500, null);
      await pause(3000);
      await r.scroll(-500, null);
      await r.click("PM", { selector: "button", exact: true, after: 1500 });
      await r.caption("보기 바꾸기 — PM 대시보드", "공정·이슈·리스크·자원을 PM 시선으로");
      await pause(4000);
      await r.click("고객", { selector: "button", exact: true, after: 1500 });
      await r.caption("고객 대시보드 — 고객이 보는 요약");
      await pause(3500);
      await r.click("포트폴리오", { selector: "button", exact: true, after: 1500 });
      await r.caption("포트폴리오 — 여러 프로젝트를 한 화면에(경영층)");
      await pause(4000);
      await r.type("요구사항·이슈·화면", "사원", { delay: 90 });
      await r.press("Enter");
      await r.caption("통합 검색 — 요구사항·이슈·화면·테이블·컬럼을 한 번에", "결과를 누르면 그 화면으로");
      await pause(4500);
      await r.press("Escape");
      await r.click("밝은/어두운 테마 전환", { selector: "button", after: 1500 });
      await r.caption("어두운 테마 — 플랫폼·데이터레이크와 같은 테마 체계");
      await pause(2500);
      await r.click("밝은/어두운 테마 전환", { selector: "button", after: 1200 });
      await r.go(`${P}/notices`);
      await r.caption("공지 — 프로젝트 공지 · 게시 기간 · 상단 고정", "알림(종 모양)으로 새 공지·배정·검토 요청·기한을 받습니다");
      await pause(4000);
      await r.click("공지 등록", { selector: "button" });
      await r.caption("공지 등록 — 제목 · 본문 · 게시 기간 · 첨부");
      await pause(3000);
      await r.press("Escape");
      await r.go(`${P}/wiki`);
      await r.caption("위키 — 프로젝트 지식을 공간·문서로", "수정 이력 · 언급 알림 · 산출물·화면과 연결");
      await pause(3000);
      if (await r.click("기본 공간 만들기", { selector: "button", after: 2500 })) {
        await r.caption("기본 공간 — 개요·업무 규칙·운영 가이드 틀이 만들어집니다");
        await pause(4000);
      }

      // ── 고객 포털
      // 앞 사용자(관리자)의 역할 기억(auth)을 지우고 고객으로 — 고객 계정은 포털만 봅니다
      await r.eval("localStorage.removeItem('auth'); true");
      await r.login("pmsx", "customer");
      await r.eval("localStorage.removeItem('auth'); true");
      await pmsxProject(r, "SM", "customer");
      await r.go(`${P}/portal`);
      await r.caption("고객 포털 — 고객(현업)은 이 화면만 봅니다", "요청을 남기고 진행 상태를 확인 · 메뉴·내부 정보는 보이지 않습니다");
      await pause(4000);
      await r.click("새 요청", { selector: "button" });
      await vtype(r, "제목", "급여명세서 PDF 내려받기가 안 됩니다");
      await r.caption("새 요청 — 제목 · 요청 유형 · 내용 · 화면 선택(선택)", "화면을 고르면 담당자가 어느 기능인지 바로 압니다");
      await r.type("css:.v-dialog textarea", "11월 급여명세서 화면에서 PDF 버튼을 누르면 아무 반응이 없습니다.", { delay: 30 });
      await pause(1500);
      await r.click("요청 등록", { selector: ".v-dialog button", exact: true, after: 2500 });
      await r.caption("등록 — 서비스 요청 번호가 생기고, 내 요청에서 처리 상태를 봅니다", "담당자 배정·처리·완료가 되면 알림");
      await pause(4500);
    },
  },

  "pmsx-2": {
    title: "PMS-X ② As-Is 분석 — 시스템 · 수집 회차 · 분석 진척 · 화면 분석 뷰어",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "admin");
      const HR = await pmsxProject(r, "SI");
      await r.go(`${P}/asis/systems`);
      await r.caption("As-Is 분석 — 레거시 소스를 수집기로 전수 분석", "화면 → 버튼 → 함수 → SQL → 테이블 그래프를 AI 없이 결정론으로");
      await pause(4000);
      await r.click("시스템 등록", { selector: "button" });
      await r.caption("시스템 등록 — 화면·서버 기술(Nexacro·JSP·Struts·MyBatis…) · DB · 인코딩");
      await pause(3500);
      await r.press("Escape");
      await r.go(`${P}/asis/runs`);
      await r.caption("수집 회차 — 수집기가 올린 결과", "회차마다 화면·함수·SQL·테이블 수와 지난 회차 대비 바뀐 것");
      await pause(3500);
      await r.click("변경 상세", { selector: "button", after: 1500 });
      await r.caption("변경 상세 — 새로 생기고·바뀌고·없어진 화면과 함수", "바뀐 화면은 다시 분석 대상으로 돌아갑니다");
      await pause(4000);
      await r.press("Escape");
      await r.click("리포트", { selector: "button", exact: true, after: 1500 });
      await r.caption("수집 리포트 — 미매칭·경고 목록");
      await pause(3500);
      await r.press("Escape");
      await r.go(`${P}/asis/progress`);
      await r.caption("분석 진척 — 화면마다 상태 · 담당 · 검토 · 요소 · 미매칭 · 변경", "사람이 검토해 확정합니다");
      await pause(4000);
      await r.click("담당 배정", { selector: "button" });
      await r.caption("담당 배정 — 여러 화면을 골라 분석 담당을 한 번에");
      await pause(3000);
      await r.press("Escape");

      // 화면 분석 뷰어 — 인사시스템 사원관리(캡처 위 버튼마다 실제 호출 흐름이 있는 화면)
      const scr = HR ? await pmsxScreenId(r, HR, "HR0101") : null;
      await r.go(scr ? `${P}/asis/viewer/${HR}/${scr}` : `${P}/asis/viewer`);
      await pause(1500);
      await r.caption("화면 분석 뷰어 — 수집한 화면 캡처 위에 버튼·입력 요소마다 번호", "왼쪽 메뉴 트리 · 가운데 화면 · 오른쪽 분석 패널");
      await pause(4500);
      if (await r.clickSel('[data-test="hotspot-btnSave"]', 2500)) {
        await r.caption("버튼을 누르면 — 함수 → API → 컨트롤러 → 서비스 → SQL", "레거시 소스에서 찾은 실제 호출 흐름 · 추측이 아니라 소스 근거");
        await pause(5500);
        await r.wheel(520, { x: 1210, y: 640 });
        await r.caption("끝까지 따라가면 이 버튼이 쓰는 테이블까지", "요청이 들어오면 영향 범위를 바로 판단 · 구현 명세의 근거");
        await pause(5000);
        await r.wheel(-520, { x: 1210, y: 640 });
      }
      if (await r.clickSel('[data-test="hotspot-btnDelete"]', 2500)) {
        await r.caption("다른 버튼도 마찬가지 — '삭제'가 거치는 함수와 테이블");
        await pause(4500);
      }
      // 고른 버튼을 풀고 화면 단위 탭으로(화면 메모·분석 이력은 버튼을 고르지 않았을 때 보인다)
      if (scr) {
        await r.go(`${P}/asis/viewer/${HR}/${scr}`);
        await pause(1200);
      }
      for (const [b, cap, sub] of [
        ["컴포넌트 목록", "컴포넌트 목록 — 화면의 입력·버튼·그리드와 컨트롤 ID", ""],
        ["이벤트 목록", "이벤트 목록 — 버튼마다 연결된 이벤트 함수", ""],
        ["CRUD", "CRUD — 이 화면이 어떤 테이블을 등록·조회·수정·삭제하는지", ""],
        ["코드 순서도", "코드 순서도 — 이벤트부터 SQL 까지 호출 흐름", ""],
        ["통합 추적", "통합 추적 — 버튼 하나가 어느 테이블까지 닿는지", "요청의 영향 범위 · 구현 명세의 근거"],
        ["데이터 흐름도", "데이터 흐름도 — 화면 입력이 어느 테이블·컬럼으로 흘러가는지", ""],
        ["한국어 설명", "AI 설명 초안 — 함수·버튼을 한국어로", "근거 등급(녹·황·적)과 함께 · 사람이 확정"],
        ["트리거", "트리거 — 이 화면 테이블에 걸린 DB 트리거", ""],
      ]) {
        if (await r.click(b, { selector: "button", exact: true, after: 1500 })) {
          await r.caption(cap, sub);
          await pause(4000);
        }
      }
      await r.click("상하분할", { selector: "button", exact: true, after: 1500 });
      await r.caption("배치 바꾸기 — 기본 · 상하분할 · 드로어");
      await pause(3000);
      await r.click("기본", { selector: "button", exact: true, after: 1200 });
      await r.click("편집 모드", { selector: "button", exact: true, after: 1500 });
      await r.caption("편집 모드 — 요소 위치·연결을 사람이 고칩니다", "자동 수집 · 캡처 다시 찍기 · 첨부");
      await pause(4000);
      if (!(await r.click("편집 끝내기", { selector: "button", exact: true, after: 1000 }))) await r.click("편집 모드", { selector: "button", exact: true, after: 1000 });
      await r.click("화면 메모", { selector: "button", exact: true, after: 1500 });
      await r.caption("화면 메모 — 분석하며 남긴 메모와 질문(인수인계에도 쓰입니다)");
      await pause(3500);
      await r.click("분석 이력", { selector: "button", exact: true, after: 1500 });
      await r.caption("분석 이력 — 누가 언제 무엇을 확정·수정했는지");
      await pause(3500);
    },
  },

  "pmsx-3": {
    title: "PMS-X ③ As-Is 산출물 — 테이블 정의서 · DB 객체 · ERD · CRUD · 화면 이동 맵 · 영향도 · 내보내기 · 프로그램 목록",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "admin");
      const HR = await pmsxProject(r, "SI");
      await r.go(`${P}/asis/tables?systemId=${HR}`);
      await r.caption("테이블 정의서 — 소스·DB 에서 뽑은 테이블·컬럼과 그 테이블을 쓰는 화면", "산출물 양식 그대로 엑셀로");
      await pause(3500);
      await r.click("TB_EMP", { selector: "td", after: 1500 });
      await r.caption("TB_EMP — 컬럼 · 키 · 설명 · 쓰는 화면");
      await pause(4000);
      await r.press("Escape");
      await r.go(`${P}/asis/dbobjects?systemId=${HR}`);
      await r.caption("DB 객체 — 뷰 · 프로시저 · 함수 · 트리거 · 시퀀스", "어느 화면·SQL 이 부르는지");
      await pause(4500);
      await r.go(`${P}/asis/erd?systemId=${HR}`);
      await r.caption("ERD — FK 와, SQL 조인에서 추정한 관계(점선 · 신뢰도 %)", "추정 관계는 사람이 확정·기각 · 관계 추가 · 다시 배치 · PNG 저장");
      await pause(5500);
      await r.go(`${P}/asis/crud?systemId=${HR}`);
      await r.caption("CRUD 매트릭스 — 화면 × 테이블, 등록·조회·수정·삭제");
      await pause(3500);
      await r.click("요소", { selector: "button", exact: true, after: 1500 });
      await r.caption("요소 단위 — 어느 버튼이 어떤 테이블을 바꾸는지");
      await pause(4000);
      await r.go(`${P}/asis/navmap?systemId=${HR}`);
      await r.caption("화면 이동 맵 — 화면 사이의 이동·팝업·탭 호출", "화면을 누르면 분석 뷰어로 · PNG 저장");
      await pause(4500);
      await r.go(`${P}/asis/impact?systemId=${HR}`);
      await r.caption("영향도 분석 — 테이블·컬럼·함수·API·SQL 을 바꾸면 어디가 영향받나");
      await pause(1500);
      await r.type("이름으로 검색", "TB_EMP", { delay: 90 });
      await pause(1200);
      await r.click("tbl:HR.TB_EMP", { selector: ".v-list-item" });
      await r.waitFor("document.body.innerText.includes('영향 버튼')", 15000);
      await r.caption("TB_EMP 를 바꾸면 — 화면 · 버튼·요소 · API · 서버 함수 몇 개", "버튼마다 호출 경로와 최근 요청·결함·담당자까지");
      await pause(4500);
      await r.scroll(600, null);
      await pause(3000);
      await r.go(`${P}/asis/export?systemId=${HR}`);
      await r.caption("산출물 내보내기 — 화면정의서 · 프로그램 사양서 · 테이블 정의서 · CRUD · 인터페이스 목록", "XLSX·PPTX · 전체 / 확정 화면만 / 직접 선택");
      await pause(5000);
      await r.go(`${P}/asis/programs`);
      await r.caption("프로그램 목록 — 개발 대상 프로그램(신규·수정·삭제)", "엑셀 가져오기·내보내기 · 설계 일감과 연결");
      await pause(3000);
      await r.click("As-Is 화면 가져오기", { selector: "button" });
      await r.caption("As-Is 화면 가져오기 — 분석한 화면을 개발 대상 프로그램으로", "시스템을 고르고 새 행의 반영 유형(수정·신규…)을 정합니다");
      await pause(3500);
      await r.click("가져오기", { selector: ".v-dialog button", exact: true, after: 3000 });
      await r.caption("가져왔습니다 — 신규 몇 건 · 갱신 · 건너뜀(이미 가져온 화면)");
      await pause(3000);
      await r.click("닫기", { selector: ".v-dialog button", exact: true, after: 1500 });
      await r.caption("화면이 프로그램 목록으로 — 업무·유형·프로그램 ID 와 함께", "이제 프로그램마다 설계 일감을 잇고 진척을 봅니다");
      await pause(5000);
    },
  },

  "pmsx-4": {
    title: "PMS-X ④ 일정 · 자원 — WBS · 칸반 · 베이스라인 · 주간보고 · 인력 풀 · 인력 편성 · 작업 배분 · 작업일지 · MM 실적",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "admin");
      await pmsxProject(r, "SI");
      await r.go(`${P}/schedule/wbs`);
      await r.caption("WBS · 간트 — 계획·실적·SPI·공정준수율", "표에서 바로 고치고, 막대를 끌어 일정을 바꿉니다 · 크리티컬 패스");
      await pause(5000);
      await r.click("월", { selector: "button", exact: true, after: 1500 });
      await r.caption("간트 배율 — 일·주·월");
      await pause(3000);
      await r.go(`${P}/schedule/kanban`);
      await r.caption("칸반 — 같은 WBS 작업을 상태별로", "카드를 끌어 상태를 바꾸고 · 내 일감만 보기 · 워크플로우 설정");
      await pause(4500);
      await r.go(`${P}/schedule/baseline`);
      await r.caption("베이스라인 비교 — 처음 계획과 지금 계획", "시작·종료가 며칠 밀렸는지 · 바뀐 작업만 보기");
      await pause(4500);
      await r.go(`${P}/schedule/weekly`);
      await r.caption("주간보고 — WBS 실적에서 자동으로");
      await pause(2000);
      await r.click("주", { selector: ".v-list-item, .v-card, div", after: 1500 });
      await r.caption("이번 주 보고 — 계획·실적·진척, 금주 실적·차주 계획, 주요 이슈·리스크가 채워져 있습니다", "고쳐서 저장 · 제출 · 엑셀로");
      await pause(5500);
      await r.click("주간보고 생성", { selector: "button", after: 1500 });
      await r.caption("주간보고 생성 — 기준 주를 고르면 그 주 실적으로 새 보고서", "한 주에 하나 — 이미 만든 주는 목록에서 열어 고칩니다");
      await pause(3500);
      await r.click("취소", { selector: ".v-dialog button", exact: true, after: 1000 });
      await r.go(`${P}/resource/pool`);
      await r.caption("인력 풀 — 소속 · 업체 · 등급 · 보유 기술 · 투입 프로젝트");
      await pause(3500);
      await r.click("스킬 매트릭스", { selector: "button", after: 1500 });
      await r.caption("스킬 매트릭스 — 누가 어떤 기술을 얼마나");
      await pause(4000);
      await r.go(`${P}/resource/plan`);
      await r.caption("인력 편성 — 사람 × 월 MM, 투입 기간과 함께", "엑셀로 가져오기·내보내기 · 자세한 편성은 ⑨장");
      await pause(3500);
      await r.click("가용량 히트맵", { selector: "button", after: 1500 });
      await r.caption("가용량 히트맵 — 과투입·여유 인력을 색으로");
      await pause(4000);
      await r.go(`${P}/resource/assign`);
      await r.caption("작업 배분 — 주 단위로 사람에게 일감 배정", "다른 프로젝트 배정까지 합친 주간 배정률 · 한 사람에게 몰리면 바로 보입니다");
      await pause(4000);
      await r.go(`${P}/resource/timesheet`);
      await r.caption("작업일지 — 요일별 시간 입력 → 제출 → 승인", "작업 대상은 WBS 작업·서비스 요청");
      await pause(3500);
      await r.click("승인함", { selector: "button", exact: true, after: 1500 });
      await r.caption("작업일지 승인함 — PM 이 제출된 일지를 승인·반려");
      await pause(3500);
      await r.go(`${P}/resource/mm`);
      await r.caption("MM 실적 — 월별 계획 대비 실적 · 실적률", "업체 정산 근거 · 엑셀 내보내기");
      await pause(4500);
    },
  },

  "pmsx-5": {
    title: "PMS-X ⑤ 산출물 · 품질 — 산출물 · 요구사항 · 추적표 · 감리 대응 · 이슈 · 리스크 · 변경요청 · 테스트 · 결함 · 회의록",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "admin");
      await pmsxProject(r, "SI");
      await r.go(`${P}/deliverable/list`);
      await r.caption("산출물 — 방법론 단계별 산출물 · 담당 · 기한 · 상태 · 파일", "검토 요청 → 승인 · 버전 이력");
      await pause(4000);
      await r.click("이력", { selector: "button", exact: true, after: 1500 });
      await r.caption("이력 — 버전과 검토 의견");
      await pause(3500);
      await r.press("Escape");
      await r.go(`${P}/deliverable/requirements`);
      await r.caption("요구사항 — ID · 분류 · 우선순위 · 상태", "엑셀로 가져오고 내보내기");
      await pause(4000);
      await r.go(`${P}/deliverable/trace`);
      await r.caption("요구사항 추적표 — 요구사항 → 화면 → 테스트 → 결함 → 변경요청", "빠진 연결은 '누락'으로");
      await pause(4500);
      await r.go(`${P}/deliverable/audit`);
      await r.caption("감리 대응 — 점검 항목별 대응 산출물과 준비 상태");
      await pause(4000);
      await r.go(`${P}/quality/issues`);
      await r.caption("이슈 — 우선순위 · 상태 · 기한 · 에스컬레이션");
      await pause(3500);
      await r.go(`${P}/quality/risks`);
      await r.caption("리스크 — 발생 가능성 × 영향 매트릭스", "칸을 누르면 그 점수의 리스크 · 현실이 되면 '이슈로 전환'");
      await pause(5000);
      await r.go(`${P}/quality/change-requests`);
      await r.caption("변경요청 — 요청 → 영향 검토 → 승인·반려", "상세 패널에서 일정·공수 영향");
      await pause(4500);
      await r.go(`${P}/quality/tests`);
      await r.caption("테스트 — 시나리오·케이스, 회차별 결과");
      await pause(3000);
      await r.click("회차 결과", { selector: "button", after: 1500 });
      await r.caption("회차 결과 — 통과·실패·보류, 실패는 결함으로");
      await pause(4000);
      await r.go(`${P}/quality/defects`);
      await r.caption("결함 — 심각도 · 상태 · 담당");
      await pause(3000);
      await r.click("품질 리포트", { selector: "button", after: 2000 });
      await r.caption("품질 리포트 — 결함 추이 · 심각도 분포 · 모듈별");
      await pause(4500);
      await r.press("Escape");
      await r.go(`${P}/quality/meetings`);
      await r.caption("회의록 — 회의록 · 미완료 액션아이템 · 의사결정 로그");
      await pause(3000);
      await r.click("미완료 액션아이템", { selector: "button", after: 1500 });
      await pause(3000);
      await r.click("의사결정 로그", { selector: "button", after: 1500 });
      await r.caption("의사결정 로그 — 누가 언제 무엇을 정했는지");
      await pause(4000);
    },
  },

  "pmsx-6": {
    title: "PMS-X ⑥ SM 운영 — 서비스 요청(AI 분류) · 장애 · 문제 · 변경 · 정기 작업",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "op");
      await pmsxProject(r, "SM", "op");
      await r.go(`${P}/sm/srs`);
      await r.caption("서비스 요청 — 접수 · 배정 · 처리 · 확인", "처리 기한까지 남은 시간은 1분마다 갱신 · 진행 중만 · 내 담당만");
      await pause(4000);
      await vtype(r, "조회", "퇴사자가 함께", 70);
      await r.press("Enter");
      await pause(1500);
      await r.click("SR-0004", { selector: "td", after: 1500 });
      await r.caption("요청 상세 — 현업 요청 \"사원 조회 시 퇴사자가 함께 보여요\"", "처리 절차 체크 · 댓글(내부/공개) · 이력 · 첨부");
      await pause(3500);
      await r.click("AI 분류 추천", { selector: "button" });
      await r.caption("AI 분류·배정 추천 — 사내 모델이 유형·우선순위·대상 화면·담당자를 제안", "비슷한 요청·화면 그래프를 근거로 · 반영은 사람이");
      await r.waitFor("[...document.querySelectorAll('button')].some((b) => /반영|적용/.test(b.innerText))", 60000);
      await pause(5000);
      await r.click("구현 명세", { selector: "button", after: 2000 });
      await r.caption("구현 명세 — 요구 + 대상 버튼 흐름 + 영향 테이블·컬럼 + 소스 위치 + 테스트 케이스", "AX-NAVI·개발자에게 넘기는 작업 지시서(MD·JSON)");
      await pause(5000);
      await r.press("Escape");
      await r.go(`${P}/sm/incidents`);
      await r.caption("장애 — 모니터링 경보가 장애로 자동 생성", "같은 경보는 하나로 묶고, 처리 절차 체크 · 열린 경보만");
      await pause(4500);
      await r.click("장애보고서", { selector: "button", after: 2000 });
      await r.caption("장애보고서 — 경과·원인·조치·재발 방지를 양식대로");
      await pause(4500);
      await r.press("Escape");
      await r.go(`${P}/sm/problems`);
      await r.caption("문제 — 반복 장애의 근본 원인 · 알려진 오류", "장애에서 '문제로 등록'");
      await pause(4500);
      await r.go(`${P}/sm/changes`);
      await r.caption("변경 — 유형 · 위험도 · 배포 예정 · 승인", "변경 영향은 As-Is 그래프로");
      await pause(3500);
      await r.click("캘린더", { selector: "button", exact: true, after: 1500 });
      await r.caption("변경 캘린더 — 배포가 겹치는 날을 한눈에");
      await pause(4000);
      await r.go(`${P}/sm/routine`);
      await r.caption("정기 작업 — 백업 확인·보안 점검·월마감 배치 확인을 달력으로", "때가 되면 담당에게 알림 · 결과 기록");
      await pause(4500);
    },
  },

  "pmsx-7": {
    title: "PMS-X ⑦ SM 운영 — 자산 · 지식 문서 · 처리 기한 · 보고서 · 작업 템플릿 · 인수인계 퀴즈",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "admin");
      await pmsxProject(r, "SM");
      await r.go(`${P}/sm/assets`);
      await r.caption("자산 — 서버·인증서·라이선스·계정", "만료일과 D-day · 30일 이내 만료만 보기 · 만료 전에 알림");
      await pause(4500);
      await r.go(`${P}/sm/kb`);
      await r.caption("지식 문서 — 끝난 요청에서 AI 가 초안(증상·원인·조치·재발 방지)", "출처 요청 표시 · 현업 창구가 근거로 씁니다");
      await pause(4500);
      await r.go(`${P}/sm/sla`);
      await r.caption("처리 기한 — 월별 응답·해결 준수율", "임박·위반 요청 · 업무시간·휴일을 빼고 계산");
      await pause(5000);
      await r.go(`${P}/sm/reports`);
      await r.caption("운영 보고서 — 월간 실적을 자동으로");
      await pause(2500);
      await r.caption("10월 운영보고 — 요청 접수·처리, 처리 기한 준수율, 장애·변경 건수가 자동으로", "기한을 넘긴 요청은 사유를 적어 저장 · 엑셀로 내보내기");
      await pause(5000);
      await r.click("보고서 생성", { selector: "button", after: 1500 });
      await r.caption("보고서 생성 — 기준 달을 고르면 그달 실적으로 새 보고서", "한 달에 하나 — 이미 만든 달은 위 목록에서 열어 고칩니다");
      await pause(3500);
      await r.click("취소", { selector: ".v-dialog button", exact: true, after: 1000 });
      await r.go(`${P}/sm/work-templates`);
      await r.caption("작업 템플릿 — 유형별 처리 절차(체크리스트)", "서비스 요청 · 장애 · 변경 — 요청이 생기면 자동으로 붙습니다");
      await pause(4500);
      await r.go(`${P}/sm/handover-quiz`);
      await r.caption("인수인계 퀴즈 — As-Is 분석·요청 이력·업무 절차·처리 기한에서 자동 출제", "SI → SM 인수인계 이해도를 점수로");
      await r.waitFor("[...document.querySelectorAll('[data-test=quiz-item]')].length > 0", 15000);
      await pause(2000);
      await r.click("응시", { selector: "button", exact: true, after: 2000 });
      await r.caption("응시 — 문제를 풀고 제출");
      await pause(3500);
      await r.scroll(500, null);
      await pause(2500);
      await r.press("Escape");
      await r.click("결과", { selector: "button", exact: true, after: 2000 });
      await r.caption("결과 — 사람별 점수와 틀린 문제(인수인계 빈틈)");
      await pause(4500);
    },
  },

  "pmsx-8": {
    title: "PMS-X ⑧ 관리 — 프로젝트 · 사용자 · 방법론 · 공통코드·용어 사전 · 엑셀 템플릿 · 처리 기한 정책 · 알림 · 감사 로그 · 시스템",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "admin");
      await pmsxProject(r, "SM");
      await r.go(`${P}/admin/projects`);
      await r.caption("프로젝트 — SI·SM 프로젝트와 참여 인원", "프로젝트 역할 · 투입 기간 · 투입 체크리스트(보안서약·계정·교육)");
      await pause(4500);
      await r.click("투입 체크리스트", { selector: "button", after: 1500 });
      await r.caption("투입 체크리스트 — 사람마다 투입 전 준비 항목");
      await pause(3500);
      await r.press("Escape");
      await r.go(`${P}/admin/users`);
      await r.caption("사용자 — 계정 · 소속 · 인증(로컬·LDAP) · 시스템 역할 · 잠금", "비밀번호 초기화 · 계정 잠금 · 엑셀 내보내기");
      await pause(4500);
      await r.go(`${P}/admin/methodologies`);
      await r.caption("방법론 템플릿 — 단계·산출물 틀", "프로젝트를 만들 때 WBS·산출물 목록이 이 틀로 채워집니다");
      await pause(4500);
      await r.go(`${P}/admin/codes`);
      await r.caption("공통코드 — 그룹과 코드, 엑셀로 일괄");
      await pause(3500);
      await r.click("용어 사전", { selector: "button", exact: true, after: 1500 });
      await r.caption("용어 사전 — 업무 용어 · 동의어 · 연결된 화면·테이블", "검색·AI 설명이 같은 용어를 씁니다");
      await pause(4500);
      await r.go(`${P}/admin/excel-templates`);
      await r.caption("엑셀 템플릿 — 고객 산출물 양식에 데이터를 채워 내보내기", "데이터셋 · 시트 · 시작 행 · 열 매핑");
      await pause(4500);
      await r.go(`${P}/admin/sla-policies`);
      await r.caption("처리 기한 정책 — 유형·우선순위별 응답·해결 목표와 업무시간", "위에서부터 처음 맞는 정책");
      await pause(4500);
      await r.go(`${P}/admin/notifications`);
      await r.caption("알림 설정 — 화면 · 메일 · 메신저 웹훅", "작업 배정 · 검토 요청 · 승인·반려 · 기한 임박·지남 · 결함 배정 · 언급 …");
      await pause(4500);
      await r.go(`${P}/admin/audit-logs`);
      await r.caption("감사 로그 — 누가 · 언제 · 무엇을 · IP", "엑셀로 내보내기");
      await pause(4000);
      await r.go(`${P}/admin/system`);
      await r.caption("시스템 — 연동 시스템과 설정", "AI 기능은 여기서 켜야만 동작합니다(기본 꺼짐 · 외부 호출 0건)");
      await pause(4500);
    },
  },

  "pmsx-9": {
    title: "PMS-X ⑨ 인력 편성 · WBS 작성 — 인원·투입 기간·월 MM 한 표 · 기간·선행 바로 입력 · 엑셀 붙여넣기 · 여러 행 편집 · 작업 배분",
    maxGap: 3,
    async run(r) {
      await r.login("pmsx", "admin");
      await pmsxProject(r, "SI");
      // 인력 편성
      await r.go(`${P}/resource/plan`);
      await r.caption("인력 편성 — 인원 · 역할 · 투입 기간 · 월 MM 을 한 표에서", "관리 메뉴로 가지 않고 여기서 인원을 추가 · 수정 · 제외합니다");
      await pause(4500);
      await r.click("인원 추가", { selector: "button", after: 1800 });
      await r.caption("인원 추가 — 투입일 · 철수일은 프로젝트 기간으로 미리 채워집니다", "저장하면 그 기간의 영업일로 월 MM 이 자동으로 채워집니다");
      await pause(4500);
      await r.click("취소", { selector: ".v-dialog button", exact: true, after: 1000 });
      await rowButton(r, "[data-test=mm-grid] tbody tr", "윤데이터", "[data-test^=plan-fill-]");
      await r.caption("투입 기간으로 MM 채우기 — 그 달 영업일 중 투입한 날의 비율", "주말 · 공휴일을 빼고 0.1 MM 단위 · 9월은 7일 투입이라 0.8");
      await pause(5000);
      await r.click("초기화", { selector: "button", exact: true, after: 1200 });
      // WBS — 엑셀처럼
      await r.go(`${P}/schedule/wbs`, "document.querySelectorAll('tr[data-row-id]').length > 3");
      await r.caption("WBS — 기간(영업일) · 선행 칸이 표에 바로", "칸을 고치고 Enter 로 아래 칸으로 · 엑셀처럼");
      await pause(4000);
      const db = await wbsRow(r, "데이터베이스 설계");
      await r.type(`css:tr[data-row-id="${db}"] [data-col="duration"]`, "3", { clear: true, delay: 120 });
      await r.press("Enter");
      await r.caption("기간 10 → 3 — 종료일이 영업일로 다시 계산되고 간트 막대도 줄어듭니다", "시작일을 옮기면 기간을 지킨 채 종료일이 따라갑니다");
      await pause(4500);
      const ext = await wbsRow(r, "외부 인터페이스 정의");
      await r.type(`css:tr[data-row-id="${ext}"] [data-col="deps"]`, "2.3.1, 2.3.2SS+1", { clear: true, delay: 90 });
      await r.press("Enter");
      await r.caption("선행 — WBS 번호로 바로 입력", "2.3.1 은 끝나면 시작 · 2.3.2SS+1 은 시작 1일 뒤 시작 · 순환이 생기면 막습니다");
      await pause(5000);
      // 여러 행 선택 → 내어쓰기 → 들여쓰기(Alt+Shift+화살표)
      await rowClick(r, "인사 화면 설계");
      await rowClick(r, "급여 화면 설계", 2);
      await r.caption("여러 행 — Ctrl · Shift 클릭으로 고르고", "내어쓰기 · 들여쓰기 · 위아래 이동 · 삭제 · 담당자 지정을 한 번에");
      await pause(3000);
      await arrowKey(r, "ArrowLeft", 37);
      await r.caption("Alt+Shift+← 내어쓰기", "번호가 바로 다시 매겨집니다");
      await pause(3000);
      await arrowKey(r, "ArrowRight", 39);
      await r.caption("Alt+Shift+→ 들여쓰기 — 다시 '화면·인터페이스 설계' 아래로");
      await pause(3000);
      // 담당자 칸
      await r.clickSel(`tr[data-row-id="${db}"] .who-btn`, 1500);
      await r.caption("담당자 칸을 누르면 프로젝트 인원 중에서 고릅니다", "여러 행을 고른 채 누르면 한꺼번에 지정");
      await pause(4000);
      await r.click("취소", { selector: ".v-dialog button", exact: true, after: 1000 });
      // 엑셀·메모장 붙여넣기
      await r.clickSel(`tr[data-row-id="${ext}"] [data-col="name"]`, 800);
      await r.eval(`(() => { const el = document.activeElement; const dt = new DataTransfer(); dt.setData('text/plain', ${JSON.stringify("설계 검토\n\t설계 검토 회의\t2026-12-11\t\t2\n\t검토 결과 반영\t\t\t3")});
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })()`);
      await pause(800);
      await r.caption("엑셀 · 메모장 목록 붙여넣기 — 여러 줄이 작업 행으로", "앞의 탭 · 공백은 하위 작업, 날짜 칸은 시작 · 종료, 숫자 칸은 기간");
      await pause(5500);
      // 표·간트 경계
      const sp = await r.eval(`(() => { const b = document.querySelector('[data-test=wbs-splitter]').getBoundingClientRect(); return { x: Math.round(b.left + 3), y: Math.round(b.top + 160) }; })()`);
      await r.pointAt(sp);
      await r.send("Input.dispatchMouseEvent", { type: "mousePressed", x: sp.x, y: sp.y, button: "left", clickCount: 1 });
      for (let i = 1; i <= 12; i++) {
        await r.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: sp.x + i * 14, y: sp.y, button: "left", buttons: 1 });
        await r.eval(`window.__demo && window.__demo.move(${sp.x + i * 14}, ${sp.y})`).catch(() => undefined);
        await pause(60);
      }
      await r.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: sp.x + 168, y: sp.y, button: "left", clickCount: 1 });
      await r.caption("표 · 간트 경계를 끌어 폭 조절 — 브라우저가 기억합니다", "가로로 넘겨도 번호 · 작업명은 고정");
      await pause(4000);
      await r.click("초기화", { selector: "button", exact: true, after: 1200 });
      await r.caption("저장 전까지는 화면 안의 사본 — 초기화로 되돌리거나 저장");
      await pause(3000);
      // 작업 배분
      await r.go(`${P}/resource/assign`);
      await r.caption("작업 배분 — WBS 작업과 화면 분석을 탭으로", "WBS 작업은 모두 배정됨(마일스톤은 배정 대상이 아님) · 주간 배정률은 다른 프로젝트 배정까지 합쳐서");
      await pause(5000);
      await r.click("화면 분석", { selector: ".v-tab", after: 1500 });
      await r.caption("화면 분석 — 아직 담당이 없는 As-Is 화면", "끌어서 사람 행에 놓거나 배정 버튼(Enter)");
      await pause(3000);
      await r.clickSel("[data-test=work-list] .work button", 1500);
      await r.click("담당자", { selector: ".v-dialog .v-field", after: 1200 });
      await r.click("박개발", { selector: ".v-overlay--active .v-list-item", after: 1500 });
      await r.caption("배정하기 전에 — 작업 기간 중 배정률이 100% 를 넘으면 경고", "배정률 슬라이더로 반만 맡길 수도 있습니다");
      await pause(5000);
      await r.click("취소", { selector: ".v-dialog button", exact: true, after: 1000 });
    },
  },

  /* ================= AX-DataLake ================= */

  "datalake-1": {
    title: "AX-DataLake ① 한눈에 보기 · 카탈로그 · SQL 작업창 · AI 질문 · 계보",
    maxGap: 3,
    async run(r) {
      await r.login("datalake", "eng");
      await r.go(`${D}/`, DL_READY);
      await r.caption("AX-DataLake — 사내 레이크하우스", "공개 표준 Parquet(DuckLake) · 고객망 안에 설치 · 테이블·문서·업무 객체를 한 곳에");
      await pause(4500);
      await r.caption("한눈에 보기 — 볼 수 있는 테이블 · 최근 수집 · 저장 용량 · 실시간 수집 · 내 최근 조회 · 테이블 등급", "관리자에게는 '파일 정리'(작은 파일 합치기·지난 스냅샷 정리)도");
      await pause(5000);

      await r.go(`${D}/catalog`, DL_READY);
      await r.caption("카탈로그 — 테이블을 이름·설명·태그로 찾습니다", "스키마별 · 담당 · 데이터 등급 · 행 수");
      await pause(3000);
      await r.type("이름·설명·태그로 찾기", "주문", { delay: 90 });
      await pause(2500);
      await r.go(`${D}/catalog/erp/orders`, DL_READY);
      await r.caption("테이블 — erp.orders (업무 DB 의 변경을 CDC 로 받는 테이블)", "설명 · 담당 · 태그 · 등급");
      await pause(3500);
      await tab(r, "미리 보기", "미리 보기 — 내 권한으로 보이는 행만(가림·행 제한 적용)");
      await r.click("열 (", { selector: ".n-tabs-tab" });
      await r.caption("열 — 이름 · 형식 · 설명 · 개인정보 표시");
      await pause(3500);
      await r.click("시점 이력", { selector: ".n-tabs-tab" });
      await r.caption("시점 이력 — 커밋마다 스냅샷", "그 시점으로 되돌려 조회 · 두 시점 사이 바뀐 행");
      await pause(3500);
      await tab(r, "바뀐 행", "바뀐 행 — 두 시점 사이 생기고·바뀌고·없어진 행만");
      await r.click("AI 설명 초안", { selector: "button" });
      await r.caption("AI 설명 초안 — 사내 모델이 테이블·열 설명을 제안", "모델에는 구조만 보내고 값은 보내지 않습니다 · 고른 것만 반영");
      await r.waitFor("document.querySelector('.n-modal, .n-drawer') && !/생각|작성 중|불러오는/.test(document.querySelector('.n-modal, .n-drawer').innerText)", 90000);
      await pause(4500);
      await closeModal(r);
      await r.click("설명 고치기", { selector: "button" });
      await r.caption("설명 고치기 — 무엇인지·어디서 오는지 · 담당 · 태그");
      await pause(3000);
      await closeModal(r);
      await r.click("SQL 로 열기", { selector: "button", after: 2000 });
      await r.caption("SQL 로 열기 — 작업창에 이 테이블 조회가 준비됩니다");
      await pause(2000);
      await r.click("실행 (Ctrl+Enter)", { selector: "button" });
      await r.waitFor("!!document.querySelector('.n-data-table, table')", 20000);
      await r.caption("SQL 작업창 — DuckDB SQL · 결과 표 · CSV 받기", "같은 거버넌스(가림·행 제한)가 SQL 에도");
      await pause(4000);
      for (const [b, cap] of [["시점 조회", "틀 — 시점 조회(AT 스냅샷·시각)"], ["JSON 열 꺼내기", "틀 — JSON 열 꺼내기"], ["시간대별 집계", "틀 — 시간대별 집계"]]) {
        await r.click(b, { selector: "button", exact: true, after: 1200 });
        await r.caption(cap, "자주 쓰는 SQL 을 눌러 넣고 고쳐 씁니다");
        await pause(2500);
      }
      await r.click("실행 기록", { selector: "button", exact: true, after: 1500 });
      await r.caption("실행 기록 — 내가 돌린 SQL · 걸린 시간 · 행 수");
      await pause(3500);
      await closeModal(r);
      await r.type("말로 물어보세요", "계열사별 수주 금액 합계", { delay: 70 });
      await r.click("AI 에게 묻기", { selector: "button" });
      await r.caption("AI 질문 — 말로 물으면 사내 모델이 SQL 을 씁니다", "테이블 구조만 보내고 값은 보내지 않습니다 · 만든 SQL 은 고쳐서 다시 실행");
      await r.waitFor("!!document.querySelector('.n-data-table, table')", 60000);
      await pause(5500);

      await r.go(`${D}/lineage?node=lake:erp.orders`, DL_READY);
      await r.caption("계보 — 데이터가 어디서 와서 어디로 가나", "Kafka 토픽 · 원본 DB · 파일 → 레이크 테이블 → 뷰·내보내기 · 원본이 바뀌면 영향 범위");
      await pause(4500);
      await r.caption("오른쪽 — 고른 테이블의 원본 · 만든 동기화·스트림 · 영향 범위(이 테이블을 쓰는 곳) · 최근 실행", "노드를 누르면 그 노드 기준으로 · 노드 찾기 · 맞춤");
      await pause(5000);
    },
  },

  "datalake-2": {
    title: "AX-DataLake ② 수집 — 파일 · 원본 연결·동기화 · 문서 수집 · Kafka 실시간",
    maxGap: 3,
    async run(r) {
      const prep = JSON.parse(readFileSync(new URL("./.demo-prep.json", import.meta.url), "utf8"));
      const producer = spawn(process.execPath, [fileURLToPath(new URL("./demo-kafka-producer.mjs", import.meta.url)), prep.alertTopic, "--rate", "8", "--seconds", "900"], { stdio: "ignore" });
      try {
        await r.login("datalake", "eng");
        await r.go(`${D}/ingest`, DL_READY);
        await r.caption("파일 수집 — CSV·Excel·Parquet·JSON 을 끌어다 놓으면 레이크 테이블로", "형식·열 이름을 미리 보고 · 새로 만들기 / 붙이기 / 바꾸기");
        await pause(3500);
        await r.upload(fileURLToPath(new URL("./demo-files/월별-수주.csv", import.meta.url)));
        await r.waitFor("document.body.innerText.includes('레이크에 넣기')", 15000);
        await r.caption("미리 보기 — 열과 형식을 확인합니다", "월별·계열사·사업부별 수주 건수와 금액");
        await pause(3000);
        await r.typeLabel("스키마", "sales", { clear: true, delay: 60 });
        await r.typeLabel("테이블", "monthly_orders", { clear: true, delay: 50 });
        await r.click("통째로 바꾸기", { selector: "label, .n-radio-button", exact: true, after: 600 });
        await r.click("레이크에 넣기", { selector: "button", after: 3500 });
        await r.caption("레이크에 넣었습니다 — sales.monthly_orders", "아래 기록에 시각·파일·행 수·결과");
        await pause(4000);

        await r.go(`${D}/sources`, DL_READY);
        await r.caption("원본 연결 — 업무 DB·Snowflake·REST API·폴더를 읽기 전용으로", "오라클·SQL Server·Snowflake·SQLite · Jira·ServiceNow 미리 채우기");
        await pause(4000);
        await r.click("연결 시험", { selector: "button", exact: true, after: 2000 });
        await r.caption("연결 시험 — 원본에 붙어 테이블 목록을 받아 봅니다", "연결 추가는 관리자만 · 비밀번호·토큰은 암호화해 서버에만");
        await pause(4000);
        await closeModal(r);
        await clickNear(r, "erp-contracts", "지금 실행", { after: 3000 });
        await r.caption("동기화 실행 — ERP 계약을 erp.contracts 로(병합)", "갱신 시각(워터마크) 이후 바뀐 행만 · 키(id)로 덮어씀 · 60분마다");
        await pause(5000);
        await r.click("동기화 만들기", { selector: "button" });
        await r.caption("동기화 만들기 — 원본 테이블 또는 원본 SQL → 레이크 테이블", "전체 / 증분 / 병합 · 워터마크 열 · 키 열 · 주기");
        await pause(4500);
        await closeModal(r);

        await r.go(`${D}/documents`, DL_READY);
        await r.caption("문서 수집 — Word·PDF·한글 문서를 개인정보를 가려 레이크로", "공유 폴더를 주기로 읽거나 올리고 · 조각 테이블로 · 등급·행 제한(org)");
        await pause(4500);
        await r.type("예: 사원 조회에", "사원 조회에 퇴사자가 같이 나와요", { delay: 60 });
        await r.click("찾기", { selector: "button", exact: true, after: 3000 });
        await r.caption("찾기 — 레이크에 들어간 문서 조각을 의미로 검색", "에이전트는 MCP 로 같은 검색을 씁니다");
        await pause(5000);
        await r.caption("문서 묶음 — 원본 폴더 · 레이크 테이블 · 등급 · 개인정보 처리 · 주기", "묶음 만들기는 관리자 · 문서는 이름·주민번호·전화를 가린 조각으로 들어갑니다");
        await pause(4000);

        await r.go(`${D}/streams`, DL_READY);
        await r.caption("실시간 수집 — Kafka 토픽을 레이크 테이블로", "erp-orders-cdc 는 Debezium CDC — 업무 DB 변경(생성·수정·삭제)을 키로 반영 중");
        await pause(4000);
        await r.click("스트림 만들기", { selector: "button" });
        await r.caption("새 스트림 — 모니터링 경보 토픽(파티션 3)을 ops.alert_events 로");
        await r.typeLabel("이름", "monitoring-alerts");
        await r.typeLabel("브로커", "localhost:9092", { tag: true });
        await r.typeLabel("토픽", prep.alertTopic, { delay: 20 });
        await r.typeLabel("스키마", "ops", { clear: true });
        await r.typeLabel("테이블", "alert_events");
        await r.typeLabel("묶음(밀리초)", "2000", { clear: true });
        await r.caption("JSON · 붙이기 · 2초마다 한 묶음 커밋", "출처 열(수신 시각·파티션·오프셋)로 정확히 한 번");
        await pause(2500);
        await r.click("저장", { selector: ".n-drawer button, .n-modal button, button", exact: true, after: 1500 });
        await clickNear(r, "monitoring-alerts", "시작", { after: 800 });
        await r.eval("document.querySelectorAll('.n-scrollbar-container, .n-data-table-base-table-body').forEach((e) => { e.scrollLeft = 0; }), true");
        await r.caption("시작 — 생산기가 초당 8건씩 경보를 보내는 중", "5초마다 누적 행 · 분당 · 밀린 메시지(lag)");
        await pause(14000);
        await r.go(`${D}/sql`, DL_READY);
        await r.type("css:.editor textarea", "SELECT severity, count(*) AS n FROM ops.alert_events GROUP BY 1 ORDER BY 2 DESC", { clear: true, delay: 10 });
        await r.click("실행 (Ctrl+Enter)", { selector: "button" });
        await r.waitFor("!!document.querySelector('.n-data-table, table')", 20000);
        await r.caption("들어온 경보를 바로 SQL 로 — 등급별 건수", "Kafka → 2초 묶음 → Parquet · 몇 초 뒤면 건수가 늘어 있습니다");
        await pause(5000);
        await r.go(`${D}/streams`, DL_READY);
        await clickNear(r, "monitoring-alerts", "멈추기", { after: 1500 });
        await r.caption("멈추기 · 확인(밀린 메시지·건너뜀 원인) · 삭제", "멈춘 자리(오프셋)부터 다시 시작합니다");
        await pause(4000);
      } finally {
        producer.kill();
      }
    },
  },

  "datalake-3": {
    title: "AX-DataLake ③ 온톨로지 · 거버넌스 · 내 API 키 · 사용자 · 감사 기록",
    maxGap: 3,
    async run(r) {
      await r.login("datalake", "ana");
      await r.go(`${D}/ontology?type=incident`, DL_READY);
      await r.caption("온톨로지 — 테이블이 아니라 업무 객체로 찾습니다", "장애 · 서비스 · 구성 요소 · 변경 · 문제 · 서비스 요청 · 담당자");
      await pause(4000);
      await r.type("이름·키로 찾기", "디스크");
      await r.press("Enter");
      await pause(1200);
      await r.click("INC-0241", { selector: ".res" });
      await r.caption("장애 INC-0241 — 속성과 관계, 관계마다 이어진 객체 수");
      await pause(3500);
      await r.click("직전 72시간 변경", { selector: "button" });
      await r.caption("같은 구성 요소에서 장애 직전 72시간 안에 끝난 변경", "SQL 없이 한 번에 — 원인 후보");
      await pause(4000);
      await r.click("관계 그래프", { selector: ".n-tabs-tab" });
      await r.click("2단계", { after: 1500 });
      await r.caption("관계 그래프 2단계 — 서비스 · 구성 요소 · 담당자 · 변경", "담당자 이름은 그래프에서도 가려집니다");
      await pause(4500);
      await r.click("속성·관계", { selector: ".n-tabs-tab" });
      await r.click("진단 에이전트 요청", { selector: "button" });
      await r.type("css:.n-modal textarea", "직전 변경과의 관계를 진단해 주세요", { delay: 35 });
      await r.click("요청", { selector: ".n-modal button", exact: true });
      await r.caption("액션 — 진단 에이전트 요청은 승인 대기", "요청한 사람은 스스로 승인할 수 없습니다");
      await pause(3500);
      await r.go(`${D}/catalog/hr/staff?tab=preview`, DL_READY);
      await r.caption("분석가(소속 HD01)의 인사 테이블", "이름·주민번호·전화는 가려지고, 자기 소속 행만 보입니다");
      await pause(4500);

      await r.login("datalake", "eng");
      await r.go(`${D}/ontology?tab=runs`, DL_READY);
      await r.caption("실행 요청 — 엔지니어가 승인", "분석가 화면 요청 · 에이전트(MCP) 요청이 같은 승인함에");
      await pause(2500);
      await r.click("승인·실행", { selector: "button", after: 2000 });
      await r.caption("승인 → 플랫폼 경보 진단 에이전트 웹훅으로 전달", "보낸 객체는 요청자가 본 모습 그대로 — 가린 값은 가린 채");
      await pause(4000);
      await r.click("정의", { selector: ".n-tabs-tab", exact: true, after: 1500 });
      await r.caption("정의 — 객체 유형 · 관계 · 액션을 테이블 위에 선언", "유형 추가(키·표시 열) · 관계 추가(조인 조건) · 액션 추가(웹훅·입력 칸) · 업종 묶음 설치");
      await pause(5500);

      await r.go(`${D}/governance`, DL_READY);
      await r.caption("거버넌스 — 조회 권한 · 열 가림 · 행 제한", "SQL·카탈로그·AI 질문·MCP·API 키 어디로 봐도 같은 규칙");
      await pause(4000);
      await r.click("열 가림", { selector: ".n-tabs-tab", after: 1200 });
      await r.caption("열 가림 — 이름·주민번호·전화처럼 열마다 가리는 방법", "역할별 예외");
      await pause(3500);
      await r.click("행 제한", { selector: ".n-tabs-tab", after: 1200 });
      await r.caption("행 제한 — 소속(org) 같은 사용자 속성으로 볼 수 있는 행만");
      await pause(3500);
      await r.click("개인정보 열 찾기", { selector: ".n-tabs-tab", after: 1200 });
      await r.click("모든 테이블 점검", { selector: "button", after: 3500 });
      await r.caption("개인정보 열 찾기 — 값의 모양으로 주민번호·전화·이메일 열을 찾아", "가리기 규칙을 바로 걸 수 있게 제안합니다");
      await pause(4500);

      await r.go(`${D}/keys`, DL_READY);
      await r.caption("내 API 키 — BI 도구·스크립트·에이전트가 레이크를 부를 때", "키는 만든 사람의 권한 그대로 · 범위·만료");
      await pause(3000);
      await r.type("월간 보고 BI", "월간 보고 BI", { delay: 60 });
      await r.click("만들기", { selector: "button", exact: true, after: 1500 });
      await r.caption("키는 지금 한 번만 보입니다");
      await pause(3500);

      await r.login("datalake", "admin");
      await r.go(`${D}/admin/users`, DL_READY);
      await r.caption("사용자 — 역할(관리자·엔지니어·분석가) · 소속 · 상태", "플랫폼 계정·사내 LDAP 와 같은 사람");
      await pause(3500);
      await r.click("사용자 만들기", { selector: "button" });
      await r.eval("document.querySelectorAll('.n-modal input').forEach((i) => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })").catch(() => undefined);
      await r.caption("사용자 만들기 — 로그인 ID · 이름 · 소속(행 제한에 쓰임) · 역할");
      await pause(3000);
      await closeModal(r);
      await r.go(`${D}/admin/audit`, DL_READY);
      await r.caption("감사 기록 — 누가 무엇을 조회·수집·변경·승인했는지", "SQL 조회까지 남습니다");
      await pause(3500);
      await r.type("동작 앞부분", "sync.", { delay: 70 });
      await r.click("보기", { selector: "button", exact: true, after: 2000 });
      await r.caption("거르기 — sync. 로 동기화 기록만");
      await pause(4000);
    },
  },

  "datalake-4": {
    title: "AX-DataLake ④ 보고서형 엑셀 · 비정형 문서 · 문서 → 표(AI)",
    maxGap: 3,
    // 준비: node tools/feature-prep-office.mjs (문서 묶음 office-docs · '계약 요약' 정의를 돌려 둠)
    async run(r) {
      await r.login("datalake", "eng");
      await r.go(`${D}/ingest`, DL_READY);
      await r.caption("보고서형 엑셀 — 사람이 보기 좋게 꾸민 그대로 올립니다", "제목 줄 · 두 줄 머리글(가로 병합) · 세로 병합 · 합계 행이 있는 시트 — XLSX·XLS");
      await pause(3500);
      await r.upload(fileURLToPath(new URL("./demo-files/office/2026-3분기_운영실적.xlsx", import.meta.url)));
      await r.waitFor("document.body.innerText.includes('레이크에 넣기')", 20000);
      await r.caption("머리글 4~5행을 자동으로 찾아 '요청 처리 건수_9월' 처럼 잇고, 합계 행은 뺍니다", "세로로 합친 '경영지원' 은 행마다 채움 · 백분율은 숫자 · 머리글 줄은 번호로 정할 수도");
      await pause(6000);
      await r.click("시트마다 테이블", { selector: "label, .n-radio-button", exact: true, after: 2000 });
      await r.caption("시트 고르기 — 한 시트 · 모든 시트를 한 테이블로 · 시트마다 테이블", "두 시트가 ops.q3_서비스별_실적 · ops.q3_주요_장애 로");
      await pause(3500);
      await r.typeLabel("스키마", "ops", { clear: true, delay: 60 });
      await r.typeLabel("테이블 앞이름", "q3", { clear: true, delay: 60 });
      await r.click("통째로 바꾸기", { selector: "label, .n-radio-button", exact: true, after: 600 });
      await r.click("레이크에 넣기", { selector: "button", after: 3000 });
      await r.caption("넣었습니다 — 시트 두 장이 테이블 두 개로", "수집 기록·계보도 테이블마다");
      await pause(3500);
      await r.go(`${D}/sql`, DL_READY);
      await r.type("css:.editor textarea", `SELECT "본부", sum("요청 처리 건수_9월") AS "9월 건수", round(avg("처리 기한 준수율_9월") * 100, 1) AS "9월 준수율" FROM ops."q3_서비스별_실적" GROUP BY 1 ORDER BY 1`, { clear: true, delay: 8 });
      await r.click("실행 (Ctrl+Enter)", { selector: "button" });
      await r.waitFor("!!document.querySelector('.n-data-table, table')", 20000);
      await r.caption("바로 SQL 로 — 본부별 9월 요청 건수와 처리 기한 준수율", "합계 행이 빠져 두 번 더해지지 않습니다");
      await pause(5000);

      await r.go(`${D}/documents`, DL_READY);
      await r.caption("문서 수집 — 견적서 PDF · 계약서 Word · 장애 보고 PPT · 실적 엑셀 · 점검표 스캔 · 회의록", "묶음 '운영·영업 문서'(대외비) — 레이크에 쓰기 전에 개인정보를 가립니다");
      await pause(4000);
      await clickNear(r, "운영·영업 문서", "파일 목록", { after: 2000 });
      await r.caption("파일 목록 — 문서마다 조각 · 표 · 글자 인식(확신도) · 찾아서 가린 개인정보", "스캔 점검표는 이 서버 안에서 글자 인식 · PPT 는 발표자 메모까지 · 엑셀은 시트마다 표");
      await pause(6000);
      await closeModal(r);
      await pick(r, "운영 매뉴얼", "운영·영업 문서");
      await r.type("예: 사원 조회에", "급여 배치가 늦어진 원인", { delay: 70 });
      await r.click("찾기", { selector: "button", exact: true, after: 3000 });
      await r.caption("찾기 — 형식이 달라도 한 번에", "장애 보고 PPT 의 '슬라이드 3. 원인 분석' 이 근거로 · 전화번호는 가린 채(010-****-2323)");
      await pause(5500);

      await r.go(`${D}/extracts`, DL_READY);
      await r.caption("문서 → 표(AI) — 문서 안의 값을 뽑아 레이크 테이블의 행으로", "모델에는 개인정보를 가린 본문만 · 기본은 사람이 확인한 뒤 반영");
      await pause(4000);
      await r.click("새 추출", { selector: "button", exact: true, after: 1200 });
      await r.typeLabel("이름(영문)", "quote-demo", { delay: 50 });
      await r.typeLabel("표시 이름", "견적서 요약", { delay: 60 });
      await pick(r, "운영 매뉴얼", "운영·영업 문서");
      await r.typeLabel("대상 스키마", "extract", { clear: true, delay: 50 });
      await r.typeLabel("대상 테이블", "quote_head", { delay: 50 });
      await r.click("견적서 요약", { selector: ".n-modal button", exact: true, after: 1000 });
      await r.typeLabel("경로 걸러내기", "*견적서*", { delay: 60 });
      await r.caption("뽑을 항목 — 거래처 · 견적일 · 합계금액 · 유효기한(이름 · 타입 · 모델에게 주는 설명)", "예시로 채우기 · 문서 하나에 한 행 / 여러 행(품목 표)");
      await pause(5000);
      await r.click("저장", { selector: ".n-modal button", exact: true, after: 2000 });
      await clickNear(r, "quote-demo", "실행", { after: 1500 });
      await r.caption("실행 — 사내 모델(hnix-local)이 견적서 PDF 를 읽고 값을 뽑습니다", "대외비 묶음이라 게이트웨이가 등급에 맞는 모델만 씁니다");
      await r.waitFor("(() => { const row = [...document.querySelectorAll('tr')].find((t) => t.innerText.includes('quote-demo')); return !!row && !row.innerText.includes('뽑는 중') && row.innerText.includes('검토 대기'); })()", 120000);
      await pause(1500);
      await clickNear(r, "quote-demo", "검토 대기 1건 보기", { after: 2000 });
      await r.caption("검토 대기 — 거래처 (주)한빛상사 · 견적일 2026-11-07 · 합계 103,950,000 · 유효기한 2026-12-06", "원문과 맞으면 승인 — 승인한 문서만 extract.quote_head 에 들어갑니다");
      await pause(5500);
      await r.click("승인", { selector: "button", exact: true, after: 2500 });
      await r.caption("승인 → 테이블에 한 행", "_path(원본 문서) · _approved_by(승인한 사람) · _model 이 함께 남습니다");
      await pause(3500);

      await clickNear(r, "contract-demo", "검토 대기 1건 보기", { after: 2000 });
      await r.caption("계약 요약 — 작은 사내 모델이 '갑' 으로만 적힌 상대방을 놓치고, 대응 시작(1시간)과 복구 기한(4시간)을 헷갈렸습니다", "그래서 기본값이 '확인 후 반영' 입니다");
      await pause(6000);
      // 정의 줄에도 '고치기' 가 있어 검토 목록의 계약서 줄 것을 누른다
      await clickNear(r, "유지보수계약서", "고치기", { after: 1500 });
      await r.type("css:.edit-row .edit-cell:nth-child(2) input", "(주)바다물산", { clear: true, delay: 70 });
      await r.type("css:.edit-row .edit-cell:nth-child(6) input", "true", { clear: true, delay: 70 });
      await r.type("css:.edit-row .edit-cell:nth-child(7) input", "4시간", { clear: true, delay: 70 });
      await r.caption("고쳐서 승인 — 계약서 원문(제3조 '4시간 안에 복구')대로 바로잡습니다");
      await pause(3500);
      await r.click("고쳐서 승인", { selector: ".n-modal button", exact: true, after: 2500 });
      await r.go(`${D}/sql`, DL_READY);
      await r.type("css:.editor textarea", `SELECT "계약상대", "시작일", "종료일", "월금액", "자동연장", "복구시간", _path, _approved_by FROM extract.contracts`, { clear: true, delay: 8 });
      await r.click("실행 (Ctrl+Enter)", { selector: "button" });
      await r.waitFor("!!document.querySelector('.n-data-table, table')", 20000);
      await r.caption("추출 테이블도 보통 레이크 테이블 — SQL · BI · 권한 · 가림 · 행 제한이 그대로", "누가 승인했는지와 원본 문서가 행마다");
      await pause(5000);

      await r.go(`${D}/lineage?node=lake:extract.contracts`, DL_READY);
      await r.caption("계보 — 올린 문서 → 조각 테이블(개인정보 가림) → AI 추출 테이블", "엑셀 시트마다 테이블도 각각 원본 파일에서");
      await pause(5500);
    },
  },

  "datalake-5": {
    title: "AX-DataLake ⑤ 분석 — 차트 · 대시보드 · AI 분석 · 지표·차원 · 객체 분석",
    maxGap: 3,
    // 준비: node tools/feature-prep-analysis.mjs (지표·차원·검증된 질의, '장애 현황' 대시보드 게시·분석가 공유)
    async run(r) {
      await r.login("datalake", "eng");
      const sql = "SELECT opened_at AS 발생, priority AS 등급, system AS 시스템, minutes_to_resolve AS 해결분 FROM ops.incident";
      await r.go(`${D}/sql?view=chart&sql=${encodeURIComponent(sql)}`, DL_READY);
      await r.waitFor("!!document.querySelector('.vega svg')", 30000);
      await r.caption("SQL 결과 → 차트 탭 — 결과 모양을 보고 차트를 고릅니다", "900행이라 처음부터 '묶어서 보기' — 서버가 원래 SQL 을 감싸 월·등급별로 다시 묶습니다(권한·가림·행 제한 그대로)");
      await pause(6000);
      await pick(r, "월 단위", "주 단위", { exact: true });
      await pause(2500);
      await pick(r, "합계", "평균", { exact: true });
      await r.waitFor("document.body.innerText.includes('해결분 평균')", 15000);
      await r.caption("시간 단위·집계 바꾸기 — 등급별 주 평균 해결 시간", "막대·선·면적·원·산점도·히트맵·숫자·표·피벗 · PNG·엑셀");
      await pause(5000);
      await r.click("분석으로 저장", { selector: "button", exact: true, after: 1200 });
      await r.type("예: 지역별 수주 금액", "등급별 월 평균 해결 시간", { delay: 50 });
      await r.caption("분석으로 저장 — 결과가 아니라 SQL·차트를 저장", "열 때마다 여는 사람 권한으로 다시 조회 · 사람·역할·소속에 공유");
      await pause(3000);
      await r.click("저장", { selector: ".n-modal button", exact: true, after: 2000 });

      await r.go(`${D}/dashboards`, DL_READY);
      await r.caption("대시보드 — 차트·숫자·표·피벗·글·객체 목록을 한 화면에", "초안 → 게시 · 게시한 판만 공유한 사람에게 보입니다");
      await pause(3500);
      await r.click("장애 현황", { selector: ".card", after: 1500 });
      await r.waitFor("document.querySelectorAll('.tile .vega svg').length >= 2", 30000);
      await r.caption("장애 현황 — 건수 · 평균 해결 시간 · 일별 등급별 · 시스템별 · 시스템 × 등급 피벗", "같은 사람·같은 조회는 5분 동안 결과를 다시 써 엔진 줄을 줄입니다");
      await pause(6000);
      await pick(r, "전체", "HR", { exact: true });
      await pause(2500);
      await r.caption("필터 — 업무 시스템 HR 만", "타일 SQL 의 {{system}} 자리에 값이 들어갑니다(검사해서 리터럴로)");
      await pause(4500);
      await down(r, 700);
      await r.caption("객체 목록 타일 — 최근 P1 장애, 여기서 바로 '진단 메모 남기기' 액션", "승인이 필요한 액션은 승인 흐름 그대로");
      await pause(5000);
      await top(r);
      await r.type("이 대시보드에 물어보기", "시스템별 장애 건수", { delay: 60 });
      await r.click("묻기", { selector: "button", exact: true });
      await r.waitFor("document.body.innerText.includes('검증된 질의') || document.body.innerText.includes('AI 초안')", 90000);
      await pause(1500);
      await r.caption("대시보드에 바로 묻기 — 사람이 확인한 질의와 같은 질문이라 모델 없이 그 SQL 로", "'타일로 추가'로 대시보드에 붙입니다");
      await pause(5500);

      await r.go(`${D}/analyze`, DL_READY);
      await r.caption("AI 분석 — 말로 묻고 표·차트·설명으로 받기", "정의된 지표·차원과 테이블 구조를 근거로(값은 모델에 보내지 않음)");
      await pause(3000);
      await r.type("예: 지난달", "등급별 평균 해결 시간", { delay: 60 });
      await r.click("묻기", { selector: "button", exact: true });
      await r.waitFor("document.querySelectorAll('.exp').length >= 1 || document.querySelectorAll('.turn .n-alert').length >= 1", 120000);
      await pause(1500);
      await r.caption("사내 모델(게이트웨이)이 지표 '평균 해결 시간'을 그대로 써서 SQL + 차트", "차트가 결과 열과 안 맞으면 결과 모양으로 고칩니다 · 분석으로 저장 · 대시보드에 추가");
      await pause(6000);
      await r.type("예: 지난달", "시스템별로 나눠서", { delay: 60 });
      await r.click("묻기", { selector: "button", exact: true });
      await r.waitFor("document.querySelectorAll('.exp').length >= 2 || document.querySelectorAll('.turn .n-alert').length >= 1", 120000);
      await pause(1500);
      await r.caption("이어 묻기 — 앞 SQL 을 맥락으로", "MCP 도구 datalake__ask 로 에이전트도 같은 길로");
      await pause(5500);

      await r.go(`${D}/semantic`, DL_READY);
      await r.caption("지표·차원 — AI 분석이 먼저 쓰는 정의(엔지니어)", "표를 고르면 규칙 + AI 초안 · 저장할 때 실제로 한 번 돌려 확인");
      await pause(4500);
      await r.click("검증된 질의", { selector: ".n-tabs-tab", after: 1500 });
      await r.caption("검증된 질의 — 사람이 확인한 질문과 SQL", "같은 질문에는 모델 대신 이것을 그대로 · 비슷한 질문에는 예시로");
      await pause(4500);

      await r.go(`${D}/object-analysis?type=incident`, DL_READY);
      await pause(1500);
      await pick(r, "(없음)", "등급 (severity)");
      await r.click("보기", { selector: "button", exact: true, after: 3000 });
      await r.caption("객체 분석 — 온톨로지 장애를 등급별로 세고, 목록에서 바로 액션", "조건으로 묶음을 고르고 기간별로도 · 목록을 대시보드에 붙이면 작은 업무 화면");
      await pause(6000);

      await r.login("datalake", "ana");
      await r.go(`${D}/dashboards`, DL_READY);
      await r.click("장애 현황", { selector: ".card", after: 1500 });
      await r.waitFor("document.querySelectorAll('.tile .vega svg').length >= 2", 30000);
      await r.caption("분석가(HD01)가 연 같은 대시보드 — 자기 계열사 행만", "고치기·공유 단추 없이 게시본만 · 대외비 이상 표는 넓은 공유를 관리자만");
      await pause(6000);
    },
  },
};

/* ================= AX-NAVI IDE ================= */

/** IDE 명령 팔레트로 AX-NAVI 명령을 부른다 */
async function palette(r, text) {
  await r.key("p", { ctrl: true, shift: true });
  await pause(700);
  for (const ch of text) {
    await r.send("Input.insertText", { text: ch });
    await pause(35);
  }
  await pause(900);
  await r.press("Enter");
  await pause(1500);
}

/**
 * 녹화마다 IDE 를 새 임시 프로필로 띄우므로 dev1 의 기기가 쌓인다(한 사람 3대까지) — 지난 녹화의 기기를 본인 화면 API 로 끊는다.
 * dev1 토큰을 돌려준다.
 */
function freeDevices() {
  // 녹화가 승인했던 기기만 끊는다 — 사용자 본인 IDE 기기는 그대로(demo-scenarios.mjs 의 freeDemoDevices)
  return freeDemoDevices();
}

/** IDE 로그인 — 승인 코드를 읽어 플랫폼 API 로 바로 승인(앞 장에서 화면으로 보여 줬으므로) */
export async function ideQuickLogin(r) {
  let code = null;
  for (let t = 0; t < 120 && !code; t++) {
    code = ideLoginCode(r.profile);
    if (!code) await pause(1000);
  }
  if (!code) throw new Error("IDE 승인 코드를 못 읽었습니다");
  const a = APPS.platform;
  const tok = await freeDevices();
  const before = await devDeviceIds();
  const res = await fetch(`${a.url}/api/v1/axnavi/device/approve`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok}` }, body: JSON.stringify({ userCode: code, approve: true }) });
  if (!res.ok) throw new Error(`기기 승인 실패 ${res.status}`);
  await rememberNewDevices(before);
  const status = () => r.eval(`[...document.querySelectorAll('.statusbar-item')].map((e) => e.innerText).join(' | ')`).catch(() => "");
  for (let t = 0; t < 40 && !/AX-NAVI · /.test(await status()); t++) await pause(1000);
  await pause(3000);
}

/** 채팅에 스킬을 넣고 끝날 때까지 */
async function skill(r, input, cap, sub, done, doneSub = "") {
  await r.webClick("새 작업", { selector: "button, vscode-button, [aria-label], [title]", timeout: 2000 }).catch(() => undefined);
  await r.webType("textarea", input);
  await r.caption(cap, sub);
  await r.press("Enter");
  await runAgent(r, {}, 240);
  await r.caption(done, doneSub);
  await pause(6000);
}

const IDE_FILE = `${DEMO_REPO}/src/main/java/com/hd/hr/EmpDao.java`;

Object.assign(SCENARIOS, {
  "axnavi-1": {
    title: "AX-NAVI IDE ① 로그인(기기 승인) · 첫 화면 · 모드 · 스킬 목록 · 사용 허가 · 환경 점검 · AI 연결 · 인덱스",
    ide: DEMO_REPO,
    ideEnv: { AXNAVI_SELFTEST: "login" },
    maxGap: 1.5,
    async run(r, A) {
      const statusText = () => r.eval(`[...document.querySelectorAll('.statusbar-item')].map((e) => e.innerText).join(' | ')`).catch(() => "");
      await freeDevices();
      await pause(3000);
      await r.clickAt({ x: 1290, y: 400 });
      await r.caption("AX-NAVI IDE — 레거시 개발용 AI IDE", "VS Code 처럼 설치 · 이름·데이터 폴더가 따로라 VS Code 와 함께 써도 서로 영향 없음 · 폐쇄망 빌드");
      await pause(4500);
      const lock = await r.find("AX-NAVI 로그인", { selector: ".statusbar-item", timeout: 3000 });
      if (lock) await r.pointAt(lock);
      await r.caption("설치만 해서는 잠겨 있습니다 — 허가된 사람·기기에서만", "로그인 전에는 AI·스킬·판정 엔진이 모두 잠김");
      await pause(3500);
      let code = null;
      for (let t = 0; t < 120 && !code; t++) {
        code = ideLoginCode(r.profile);
        if (!code) await pause(1000);
      }
      if (!code) throw new Error("승인 코드를 못 읽었습니다");
      await r.caption(`로그인 — 이 기기의 승인 코드 ${code}`, "IDE 가 플랫폼 승인 화면을 엽니다 — 평소 쓰는 플랫폼 계정으로");
      await pause(4000);
      const before = await devDeviceIds();
      await r.browser(async (b) => {
        await b.login("platform", "dev");
        await b.go(`${A.platform.url}/axnavi/activate?code=${code}`);
        await b.caption("플랫폼 승인 화면 — 승인 코드 · 기기 이름 · 등록한 기기 수", "허가(좌석)를 받은 사람만, 한 사람당 기기 3대까지");
        await pause(4500);
        await b.click("이 기기 승인", { selector: "button" });
        await b.caption("승인했습니다 — IDE 로 돌아갑니다");
        await pause(2500);
      });
      await rememberNewDevices(before);
      for (let t = 0; t < 40 && !/AX-NAVI · /.test(await statusText()); t++) await pause(1000);
      await r.caption("잠금이 풀렸습니다 — 스킬 26개와 판정 엔진을 플랫폼에서 받습니다", "CLI 를 따로 깔지 않아도 IDE 하나로 · 스킬은 기기 표식을 넣은 암호화 캐시로만");
      await pause(6000);
      await r.caption("오른쪽 AX-NAVI 채팅 — 첫 화면에서 나침이가 인사하고 최근 작업을 보여 줍니다", "아래 Findings 와 상세 칸 · 상태 표시줄에 판정");
      await pause(5000);
      if (await r.webClick("", { selector: "[data-testid=mode-selector-trigger]", timeout: 3000 })) {
        await r.caption("모드 — Architect · Code · Ask · Debug · Orchestrator", "설계만 / 코드 수정 / 질문만 / 디버그 / 큰 일을 나눠 맡기기");
        await pause(4500);
        await r.press("Escape");
      }
      await r.webType("textarea", "/");
      await r.caption("슬래시 명령 — AX-NAVI 스킬 26개", "/find · /flow · /impact · /modify(안전 수정) · /sql · /scaffold · /security-scan · /plan-migration · /sdlc-docs · /spec-gate · /wiki …");
      await pause(5000);
      for (let i = 0; i < 3; i++) {
        await r.wheel(400, { x: 1290, y: 600 });
        await pause(1500);
      }
      await r.press("Escape");
      await r.key("a", { ctrl: true });
      await r.key("Backspace");
      await palette(r, "AX-NAVI: 사용 허가 상태");
      await r.caption("사용 허가 상태 — 누구로 로그인했는지 · 허가 · 엔진 위치 · 받은 스킬 버전");
      await pause(4500);
      await r.press("Escape");
      await palette(r, "AX-NAVI: 환경 점검");
      await r.caption("환경 점검(doctor) — 엔진 · 색인 · AI 연결 · 과금 경로를 한 번에", "아래 터미널에 항목별 결과");
      await pause(9000);
      await palette(r, "AX-NAVI: AI 연결 설정");
      await r.caption("AI 연결 — Claude 구독 · API 키 · 사내 게이트웨이 · PC 의 로컬 모델", "조직 정책이 허용한 연결만 · 자격 증명은 PC 밖으로 나가지 않습니다");
      await pause(5500);
      await r.press("Escape");
      await palette(r, "AX-NAVI: 인덱스 갱신");
      await r.caption("코드 인덱스 — AI 없이 만든 전수 색인(화면 → 버튼 → 함수 → SQL → 테이블)", "바뀐 파일만 갱신 · 에이전트가 MCP 도구로 바로 조회 · Struts·MyBatis·JSP·Nexacro·EUC-KR");
      await pause(7000);
    },
  },

  "axnavi-2": {
    title: "AX-NAVI IDE ② 스킬 — /flow 처리 흐름 · /impact 영향도",
    ide: DEMO_REPO,
    ideEnv: { AXNAVI_SELFTEST: "login" },
    maxGap: 1.2,
    async run(r) {
      await ideQuickLogin(r);
      await r.clickAt({ x: 1290, y: 400 });
      await r.caption("스킬 — 레거시 개발 일을 명령 하나로", "에이전트가 전수 색인을 MCP 도구로 조회 — 읽기 전용 조회는 승인 없이 바로");
      await pause(3500);
      await skill(r, "/flow 사원 목록 조회 버튼을 누르면 어디까지 가는지", "/flow — 처리 흐름 추적", "버튼 → 화면 JS → 컨트롤러 → 서비스 → DAO → SQL → 테이블", "흐름을 단계별로 — 파일·줄 위치와 함께", "grep 으로 추측하지 않고 색인으로 · 같은 질문에는 같은 근거");
      await skill(r, "/impact TB_EMP 테이블의 RETIRE_YN 컬럼", "/impact — 영향도 분석", "이 컬럼을 바꾸면 어떤 SQL·함수·화면이 영향을 받나", "영향 범위와 위험도 — 직접·간접 영향 · 함께 고칠 곳 · 테스트할 화면");
    },
  },

  "axnavi-3": {
    title: "AX-NAVI IDE ③ 스킬 — /sql SQL 리뷰 · /find 기능 위치",
    ide: DEMO_REPO,
    ideEnv: { AXNAVI_SELFTEST: "login" },
    maxGap: 1.2,
    async run(r) {
      await ideQuickLogin(r);
      await r.clickAt({ x: 1290, y: 400 });
      await r.caption("스킬 — SQL 리뷰와 기능 위치 찾기", "레거시 SQL(MyBatis·iBatis)과 화면을 색인으로");
      await pause(3000);
      await skill(r, "/sql EmpDao 의 사원 목록 조회 SQL", "/sql — SQL 리뷰", "사용처 · 성능(인덱스) · 보안(문자열 결합) · 트랜잭션", "SQL 리뷰 결과 — 어디서 쓰는지와 고칠 점");
      await skill(r, "/find 사원 등록 기능", "/find — 기능 위치 찾기", "화면 → JS → 컨트롤러 → SQL → 테이블", "관련 파일·클래스·SQL 목록 — 수정 전에 어디를 봐야 하는지");
    },
  },

  "axnavi-4": {
    title: "AX-NAVI IDE ④ 변경 리뷰 · Findings · AI 로 고치기 · 보안 점검(OWASP) · 단계 게이트",
    ide: DEMO_REPO,
    ideEnv: { AXNAVI_SELFTEST: "login" },
    maxGap: 1.2,
    async run(r) {
      const before = readFileSync(IDE_FILE);
      try {
        await ideQuickLogin(r);
        await r.clickSel('[aria-label*="변경 리뷰"]');
        await r.caption("변경 리뷰 — 상태 표시줄 한 번으로 GO / HOLD / STOP", "CI 머지 게이트와 같은 판정 엔진 · 모델 없이 규칙과 색인으로 · 작업 트리·스테이지·범위 지정");
        await pause(9000);
        await r.caption("STOP — SQL 문자열 결합(인젝션 가능) 치명 1건", "영향 범위 — 호출자 · 테이블 · 화면 이벤트");
        await pause(3500);
        await palette(r, "AX-NAVI: Findings 심각도별로 묶기");
        await r.caption("Findings — 심각도별·파일별로 묶기 · 심각도 필터", "문제 탭에도 같은 지적");
        await pause(3500);
        await r.click("SQL 문자열 결합", { selector: ".monaco-list-row, .label-name, span" });
        await r.caption("지적 상세 — OWASP A03 · CWE-89 · 위치 · 영향 · 권장 조치", "파일로 이동 / AX-NAVI 로 수정 / 닫기");
        await pause(5000);
        await r.webClick("AX-NAVI 로 수정");
        await r.caption("AX-NAVI 로 수정 — 지적을 그대로 에이전트에 넘깁니다");
        await pause(2500);
        await runAgent(r, {
          1: ["파일 읽기·수정은 개발자가 승인합니다", "에이전트가 무엇을 하려는지 보고 승인"],
          2: ["수정안 — 문자열 결합을 바인드 변수(PreparedStatement)로", "바뀐 부분을 diff 로 보고 저장 · 체크포인트로 되돌릴 수 있습니다"],
        });
        await r.caption("수정 끝 — 다시 리뷰합니다");
        await pause(2000);
        await r.clickSel('[aria-label*="리뷰"]');
        await pause(9000);
        await r.caption("다시 리뷰 — 치명 지적이 사라졌습니다");
        await pause(4500);
        await palette(r, "AX-NAVI: 보안 점검");
        await r.caption("보안 점검(OWASP) — 저장소 전체 또는 폴더(탐색기에서 오른쪽 클릭)", "심각도 · 위치 · 원인 · 영향으로 정리해 Findings 에");
        await pause(12000);
        await palette(r, "AX-NAVI: 단계 게이트");
        await r.caption("단계 게이트 — 요구 → 설계 → 개발 → 테스트 단계를 넘어가도 되는지", "단계마다 산출물(조직 양식) · ADR · 리뷰 · 보안 점검 통과 여부");
        await pause(9000);
        await r.caption("같은 판정 엔진이 머지 요청의 CI 에서도 — IDE 에서 본 판정과 CI 판정이 같습니다", "axnavi review --diff · 종료 코드로 GO/HOLD/STOP");
        await pause(4500);
      } finally {
        writeFileSync(IDE_FILE, before);
      }
    },
  },
});

const D = APPS.datalake.url;
const DL_READY = "document.readyState === 'complete' && !!document.querySelector('.n-layout-header')";

/* ---------- PMS-X 프로젝트 고르기 — SI·SM 을 화면 주소와 함께 쓰기 위해 localStorage 에 둔다. SI 면 인사(HR) 시스템 ID 를 돌려준다 ---------- */
const P = APPS.pmsx.url;
export async function pmsxProject(r, type, who = "admin") {
  return r.eval(`(async () => {
    const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(APPS.pmsx.users[who] ?? APPS.pmsx.users.admin)}) }).then((x) => x.json()).then((j) => j.accessToken);
    const h = { authorization: 'Bearer ' + t };
    const p = (await fetch('/api/v1/projects', { headers: h }).then((x) => x.json())).find((x) => x.type === ${JSON.stringify(type)});
    if (!p) return null;
    localStorage.setItem('project', JSON.stringify({ currentProjectId: p.projectId }));
    if (${JSON.stringify(type)} !== 'SI') return p.projectId;
    const ss = await fetch('/api/v1/projects/' + p.projectId + '/systems', { headers: h }).then((x) => x.json());
    return ((ss.content ?? ss).find((s) => s.code === 'HR') ?? {}).systemId ?? null;
  })()`);
}

/* ---------- PMS-X As-Is 화면 ID — 시스템 메뉴 트리에서 화면 코드(HR0101 등)로 찾는다(시연 데이터를 새로 만들면 ID 가 바뀐다) ---------- */
export async function pmsxScreenId(r, systemId, screenCode, who = "admin") {
  return r.eval(`(async () => {
    const t = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify(APPS.pmsx.users[who] ?? APPS.pmsx.users.admin)}) }).then((x) => x.json()).then((j) => j.accessToken);
    const tree = await fetch('/api/v1/systems/${systemId}/menu-tree', { headers: { authorization: 'Bearer ' + t } }).then((x) => x.json());
    const walk = (ns) => { for (const n of ns ?? []) { if (n.screen?.screenCode === ${JSON.stringify(screenCode)}) return n.screen.screenId; const f = walk(n.children); if (f) return f; } return null; };
    return walk(tree);
  })()`);
}
