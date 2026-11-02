#!/usr/bin/env node
/*
 * 시연 녹화 준비 — E2E 환경(start.ps1 + 자동 점검 한 번)과 Kafka 브로커가 떠 있는 상태에서 한 번 돌린다.
 *   node tools/demo-prep.mjs [--kafka localhost:9092]
 *
 *  플랫폼   현업 창구 'hr-help'(인사시스템 도움 창구 — 운영 매뉴얼 근거, 못 찾으면 PMS-X 요청)
 *          업무 흐름 개선 '인사 발령 프로세스' 분석(To-Be 까지 나온 것 하나 — 3B 모델이라 몇 번 돌릴 수 있다, 한 번에 2~3분)
 *  레이크   Kafka 토픽 — 실시간 시연용 모니터링 경보 토픽(새 이름), Debezium CDC 시연(주문 토픽 → erp.orders)
 *          지난 시연의 'monitoring-alerts' 스트림·ops.alert_events 테이블은 지운다(화면에서 새로 만든다)
 *  결과는 tools/.demo-prep.json — 시나리오가 토픽 이름을 읽는다.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { APPS, DATALAKE_REPO } from "./demo-scenarios.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { kafka: { type: "string", default: "localhost:9092" } } });
const { Kafka, logLevel } = createRequire(join(DATALAKE_REPO, "package.json"))("kafkajs");
const log = (s) => console.log(`▶ ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function client(app, who) {
  const a = APPS[app];
  const r = await fetch(`${a.url}${a.loginApi}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a.users[who]) });
  if (!r.ok) throw new Error(`${app} ${who} 로그인 실패 ${r.status}`);
  const token = (await r.json()).accessToken;
  return async (method, path, body) => {
    const res = await fetch(`${a.url}/api/v1${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const t = await res.text();
    if (!res.ok) throw new Error(`${app} ${method} ${path} → ${res.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
}
const items = (j) => (Array.isArray(j) ? j : j.items ?? j.content ?? []);
const out = {};

// ---------- 플랫폼
log("플랫폼 — 현업 창구 · 업무 흐름 개선");
const pl = await client("platform", "admin");
const px = await client("pmsx", "admin");
const sm = (await px("GET", "/projects")).find((p) => p.type === "SM");
const devId = (await (await client("platform", "dev"))("GET", "/auth/me")).user.id;
const col = items(await pl("GET", "/docs/collections")).find((c) => c.name === "운영 매뉴얼");
if (!col) throw new Error("문서 컬렉션 '운영 매뉴얼'이 없습니다 — start.ps1(seed hub)을 먼저");
const docs = items(await pl("GET", `/docs/collections/${col.id}/documents`));
if (!docs.some((d) => /운영-매뉴얼/.test(d.title ?? ""))) throw new Error("운영 매뉴얼 문서가 없습니다 — e2e.config.json docs 에 ops-manual-hr.md 를 넣고 start.ps1");
if (!items(await pl("GET", "/desks")).some((d) => d.slug === "hr-help")) {
  await pl("POST", "/desks", { slug: "hr-help", name: "인사시스템 도움 창구", modelAlias: "hnix-local", collections: [col.id], kbTool: "pmsx__similar", kbArgs: { projectId: sm.projectId }, runAs: devId, escalation: { kind: "pmsx", server: "pmsx", projectId: sm.projectId, type: "INQUIRY", priority: "P3" } });
}
ok("현업 창구 /desk/hr-help — 인사시스템 도움 창구");
if (!(await px("GET", `/projects/${sm.projectId}/handover/quizzes`)).some((q) => q.title === "인사시스템 인수인계 퀴즈")) {
  await px("POST", `/projects/${sm.projectId}/handover/quizzes`, { title: "인사시스템 인수인계 퀴즈", count: 5 });
}
ok("PMS-X 인수인계 퀴즈 — 인사시스템 인수인계 퀴즈(SM)");

const doc = docs.find((d) => /발령/.test(d.title ?? ""));
const has = () => pl("GET", "/process/analyses").then((j) => items(j).filter((a) => a.title === "인사 발령 프로세스"));
let good = null;
for (const a of await has()) {
  const full = await pl("GET", `/process/analyses/${a.id}`);
  if (full.status === "succeeded" && full.result?.toBe?.length && !good) good = full;
  else await pl("DELETE", `/process/analyses/${a.id}`);
}
for (let i = 1; !good && i <= 4; i++) {
  console.log(`  · 업무 흐름 개선 분석 ${i}번째(2~3분)…`);
  const { id } = await pl("POST", "/process/analyses", { title: "인사 발령 프로세스", collectionId: col.id, documentIds: [doc.id], modelAlias: "hnix-local" });
  let full;
  for (let t = 0; t < 120; t++) {
    await sleep(3000);
    full = await pl("GET", `/process/analyses/${id}`);
    if (!["running", "pending", "queued"].includes(full.status)) break;
  }
  if (full.status === "succeeded" && full.result?.toBe?.length) good = full;
  else await pl("DELETE", `/process/analyses/${id}`);
}
if (good) ok(`업무 흐름 개선 — As-Is ${good.result.asIs.length} · Pain point ${good.result.painPoints?.length ?? 0} · To-Be ${good.result.toBe.length}`);
else console.log("  ! To-Be 까지 나온 분석을 얻지 못했습니다 — 시연에서는 As-Is·Pain point 까지만 보입니다");

// ---------- 레이크
log(`AX-DataLake — Kafka(${values.kafka}) 실시간 · CDC`);
const eng = await client("datalake", "eng");
const streams = (await eng("GET", "/streams")).streams;
for (const s of streams.filter((x) => x.name === "monitoring-alerts")) {
  if (s.desired === "running") await eng("POST", `/streams/${s.id}/stop`);
  await eng("DELETE", `/streams/${s.id}`);
}
await eng("POST", "/work", { sql: "DROP TABLE IF EXISTS ops.alert_events" });
const kafka = new Kafka({ clientId: "hnix-demo-prep", brokers: [values.kafka], logLevel: logLevel.NOTHING });
const adm = kafka.admin();
await adm.connect();
// Windows 의 Kafka 는 토픽을 지우면 브로커가 멈춘다 — 늘 새 이름으로
out.alertTopic = `ito.monitoring.alerts.${Date.now()}`;
const topics = [{ topic: out.alertTopic, numPartitions: 3 }];
const cdc = streams.find((x) => x.name === "erp-orders-cdc");
if (!cdc) {
  out.cdcTopic = `erp.public.orders.${Date.now()}`;
  topics.push({ topic: out.cdcTopic, numPartitions: 2 });
}
await adm.createTopics({ topics, waitForLeaders: true });
await adm.disconnect();
ok(`토픽 ${out.alertTopic} (파티션 3) — 시나리오가 화면에서 스트림을 만들고 생산기를 띄운다`);
if (!cdc) {
  const p = kafka.producer();
  await p.connect();
  // Debezium 처럼 기본 키를 메시지 키로 — 같은 주문의 변경은 같은 파티션에 순서대로
  const ev = (op, before, after) => ({ key: String((after ?? before).order_id), value: JSON.stringify({ payload: { op, before, after, source: { db: "erp", table: "orders" }, ts_ms: Date.now() } }) });
  const msgs = [];
  for (let i = 1; i <= 300; i++) msgs.push(ev("c", null, { order_id: i, customer: `고객사${i % 40}`, amount: 100000 + i * 3700, status: "접수" }));
  for (let i = 1; i <= 120; i++) msgs.push(ev("u", { order_id: i }, { order_id: i, customer: `고객사${i % 40}`, amount: 100000 + i * 3700, status: "결제 완료" }));
  for (let i = 290; i <= 300; i++) msgs.push(ev("d", { order_id: i }, null));
  await p.send({ topic: out.cdcTopic, messages: msgs });
  await p.disconnect();
  const s = await eng("POST", "/streams", { name: "erp-orders-cdc", kind: "kafka", config: { kafka: { brokers: [values.kafka], topic: out.cdcTopic, fromBeginning: true }, format: "debezium", mode: "cdc", keyColumns: ["order_id"], target: { schema: "erp", table: "orders" }, flush: { maxRows: 1000, maxMs: 2000 } } });
  await eng("POST", `/streams/${s.id}/start`);
  for (let t = 0; t < 30; t++) {
    await sleep(2000);
    const r = await eng("POST", "/query", { sql: "SELECT count(*) AS n FROM erp.orders" }).catch(() => null);
    if (r && Number(r.rows?.[0]?.[0] ?? 0) >= 289) break;
  }
}
const n = await eng("POST", "/query", { sql: "SELECT status, count(*) FROM erp.orders GROUP BY 1 ORDER BY 1" }).catch((e) => ({ error: e.message }));
ok(`CDC erp-orders-cdc → erp.orders ${JSON.stringify(n.rows ?? n)}`);

writeFileSync(join(HERE, ".demo-prep.json"), JSON.stringify(out, null, 2));
console.log(`\n준비 끝 — ${join(HERE, ".demo-prep.json")}`);
