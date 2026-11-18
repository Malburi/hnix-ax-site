/*
 * 해설 시연 영상 ② 새 판 — AX-DataLake 회사 데이터 기반(2026-11-18). story-scenarios.mjs 와 같은 방식:
 * 해설 음성을 먼저 만들고(presentations/hnix-ax-demo-1113: narr.json d01~d10 → tts.mjs → durations.json), 장면마다 해설 길이만큼 머문다.
 * 녹화 대상은 여러 대 구성 레이크 — 노드 A(수집, :18791) · 노드 B(조회, :18792), 준비는 presentations/hnix-ax-demo-1113/lake/lake-prep.mjs
 *
 *   set STORY_DIR=<presentations\hnix-ax-demo-1113>
 *   node tools/record-demo.mjs --scenarios lake-scenarios.mjs --scenario lake --out <STORY_DIR>
 *   (STORY_DIR 에서) node mix.mjs lake
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { APPS } from "./demo-scenarios.mjs";
import { down, top } from "./feature-scenarios.mjs";

const V = (process.env.STORY_DIR ?? "").replace(/\\/g, "/").replace(/\/$/, "");
if (!V) throw new Error("STORY_DIR 에 영상 작업 폴더(durations.json·card.html)를 지정하세요");
const DUR = JSON.parse(readFileSync(`${V}/durations.json`, "utf8"));
const LA = "http://127.0.0.1:18791";
const LB = "http://127.0.0.1:18792";
const PW = "Multi!2026";
APPS.lakeA = { url: LA, loginApi: "/api/v1/auth/login", users: { admin: { loginId: "admin", password: PW } } };
APPS.lakeB = { url: LB, loginApi: "/api/v1/auth/login", users: { seoul: { loginId: "ana.seoul", password: PW } } };
const DASH = process.env.LAKE_DASH ?? "dsh_5653f41237934251ac71";
/** Kafka 주문 생산기(영상 작업 폴더 lake/order-producer.mjs, 브로커 127.0.0.1:19092) */
const PRODUCER = `${V}/lake/order-producer.mjs`;
const DL_READY = "document.readyState === 'complete' && !!document.querySelector('.n-layout-header')";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const card = (id) => `${pathToFileURL(`${V}/card.html`).href}?c=${id}`;

let marks = [];
let ffs = [];
/** 장면 시작 — 자막을 바꾸고 시각을 적는다. 돌려준 함수를 부르면 해설이 끝날 때까지 기다린다 */
async function beat(r, id, cap = "", sub = "") {
  await r.caption(cap, sub);
  const t = now();
  marks.push({ id, wall: t });
  const end = t + (DUR[id] ?? 5) + 0.9;
  return async (extra = 0) => {
    const left = end + extra - now();
    if (left > 0) await pause(left * 1000);
  };
}
/** 기다리는 구간 — 영상에서는 keep 초로 빨리 감는다(해설이 흐르지 않을 때만) */
async function ff(r, wait, keep = 2) {
  const t0 = now();
  const res = await wait();
  const t1 = now();
  if (t1 - t0 > keep + 1) ffs.push([t0, t1, keep]);
  return res;
}
/** 빨리 감기를 프레임·장면 시각에 반영하고 timeline-<편>.json 을 쓴다(story-scenarios 와 같은 계산) */
async function finish(r, part) {
  await r.pointAt({ x: 1380, y: 860 });
  await pause(700);
  ffs.sort((x, y) => x[0] - y[0]);
  const map = (t) => {
    let shift = 0;
    for (const [a, b, keep] of ffs) {
      if (t <= a) break;
      if (t < b) return t - shift - (t - a) + (t - a) * (keep / (b - a));
      shift += b - a - keep;
    }
    return t - shift;
  };
  for (const f of r.frames ?? []) f.t = map(f.t);
  const kept = [];
  for (const f of r.frames ?? []) {
    if (kept.length && f.t - kept[kept.length - 1].t < 0.034) kept[kept.length - 1] = { t: kept[kept.length - 1].t, data: f.data };
    else kept.push(f);
  }
  console.log(`  프레임 ${r.frames.length} → ${kept.length}`);
  r.frames.splice(0, r.frames.length, ...kept);
  const ts = (r.frames ?? []).map((f) => f.t);
  const at = [0];
  for (let i = 0; i < ts.length - 1; i++) at.push(at[i] + Number(Math.max(0.034, Math.min(ts[i + 1] - ts[i], 600)).toFixed(3)));
  const video = (wall) => {
    const w = map(wall);
    let k = -1;
    for (let i = 0; i < ts.length && ts[i] <= w; i++) k = i;
    if (k < 0) return 0;
    const gap = k + 1 < ts.length ? ts[k + 1] - ts[k] : Infinity;
    return at[k] + Math.max(0, Math.min(w - ts[k], gap));
  };
  writeFileSync(`${V}/timeline-${part}.json`, JSON.stringify({ marks: marks.map((m) => ({ ...m, video: Number(video(m.wall).toFixed(2)) })), ff: ffs }, null, 1));
  console.log(`  timeline-${part}.json — 장면 ${marks.length} · 빨리 감기 ${ffs.length}곳`);
}
const tabClick = (r, text) => r.click(text, { selector: ".n-tabs-tab", after: 1200 });

export const SCENARIOS = {
  lake: {
    title: "AX-DataLake — 회사 데이터를 모으고 권한대로 쓰기",
    maxGap: 600,
    async run(r) {
      marks = [];
      ffs = [];
      // 녹화 내내 Kafka 로 주문 이벤트를 보낸다(초당 10건) — 실시간 수집 장면과 대시보드 '실시간 주문' 칸이 늘어난다
      const producer = spawn(process.execPath, [PRODUCER, "--rate", "10", "--seconds", "900"], { stdio: "ignore" });
      try {
        await this.scenes(r);
      } finally {
        producer.kill();
      }
    },
    async scenes(r) {
      await r.go(card("lake-intro"));
      let w = await beat(r, "d01");
      await w();

      // ── 노드 A · 관리자(데이터 엔지니어)
      await r.login("lakeA", "admin");
      await r.go(`${LA}/sources`, DL_READY);
      await pause(1200);
      w = await beat(r, "d02", "노드 A · 원본 연결 — 고객 업무 DB(ERP)에 읽기 전용으로", "주문은 1분마다 바뀐 것만 · 상품 마스터는 한 시간마다 통째로");
      await pause(9000);
      await r.pointAt({ x: 1200, y: 500 }).catch(() => undefined);
      await w();

      // ── Kafka 실시간 수집(생산기는 녹화 내내 초당 10건) — 화면은 5초마다 저절로 새로 고침
      await r.go(`${LA}/streams`, DL_READY);
      await pause(1500);
      w = await beat(r, "d02k", "노드 A · 실시간 수집 — Kafka 토픽 erp-orders-live → sales.order_events", "주문 이벤트 초당 10건, 들어오는 대로 · Debezium 이면 업무 DB 변경(생성 · 수정 · 삭제) 그대로");
      await w();

      await r.go(`${LA}/catalog/sales/orders`, DL_READY);
      await pause(1500);
      w = await beat(r, "d03", "카탈로그 — sales.orders 100만 건 · 열마다 설명 · 가림 표시", "바뀔 때마다 시점이 남아 지난 시점도 조회");
      await pause(10000);
      await tabClick(r, "시점 이력");
      await w();

      await r.go(`${LA}/lineage`, DL_READY);
      await pause(2500);
      w = await beat(r, "d04", "계보 — 업무 DB → 레이크 테이블 → 누가 얼마나 조회했나", "원본을 바꿀 때 영향받는 곳");
      // 노드를 누르지 않는다 — 그래프가 자리를 잡는 동안 눌러 다른 노드가 강조된 적이 있다. 처음 화면에 원본 → 테이블 → 조회가 다 보인다
      await w();

      await r.go(`${LA}/governance`, DL_READY);
      await pause(1500);
      w = await beat(r, "d05", "거버넌스 — 조회 권한 · 열 가림 · 소속별 행 제한", "화면 · SQL · API · AI 에이전트 어디서 읽어도 같은 규칙");
      await pause(5000);
      await tabClick(r, "열 가림");
      await pause(5500);
      await tabClick(r, "행 제한");
      await w();

      await r.go(`${LA}/dashboards/${DASH}`, DL_READY);
      await ff(r, () => r.waitFor("document.querySelectorAll('canvas').length >= 2", 60000));
      // 캐시(5분)에 남은 값 대신 지금 값으로 — 실시간 주문 칸이 늘어난 건수를 보이고 '방금 조회 재사용' 표시가 붙지 않게
      await r.click("새로 고침", { selector: "button", exact: true, after: 500 });
      await pause(3500);
      await pause(1500);
      w = await beat(r, "d06", "노드 A · 관리자 — 대시보드 '주문 현황'", "100만 건을 월별 · 지역별 · 상품별로");
      await w();

      // ── 노드 B · 서울 영업 분석가
      await r.login("lakeB", "seoul");
      await r.go(`${LB}/dashboards/${DASH}`, DL_READY);
      await ff(r, () => r.waitFor("document.querySelectorAll('canvas').length >= 2", 60000));
      // 캐시(5분)에 남은 값 대신 지금 값으로 — 실시간 주문 칸이 늘어난 건수를 보이고 '방금 조회 재사용' 표시가 붙지 않게
      await r.click("새로 고침", { selector: "button", exact: true, after: 500 });
      await pause(3500);
      await pause(1500);
      w = await beat(r, "d07", "노드 B(다른 서버) · 서울 영업 분석가 — 같은 대시보드", "서울 주문만 · 고객 이름 · 전화는 가림 · 설정은 노드 A 에서만");
      await pause(9000);
      await down(r, 700);
      await w();
      await top(r);

      await r.go(`${LB}/analyze`, DL_READY);
      await pause(1200);
      await r.type("css:input[placeholder^='예:']", "월별 매출 추이", { delay: 70 });
      await r.click("묻기", { selector: "button", exact: true });
      await ff(r, () => r.waitFor("!!document.querySelector('canvas')", 90000));
      await pause(1200);
      w = await beat(r, "d08", "노드 B · AI 분석 — 확인된 질문은 모델 없이 같은 SQL 로", "결과에도 가림 · 행 제한 적용 · 새 질문은 지표 정의를 근거로 사내 모델이");
      await w();

      await r.go(card("lake-multi"));
      w = await beat(r, "d09");
      await w();

      await r.go(card("lake-end"));
      w = await beat(r, "d10");
      await w(1);
      await finish(r, "lake");
    },
  },
};
