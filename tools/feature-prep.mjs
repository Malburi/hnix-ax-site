#!/usr/bin/env node
/*
 * 기능 전체 영상 준비 — demo-prep.mjs 를 돌린 뒤 한 번 더 돌린다(여러 번 돌려도 된다).
 *   node tools/feature-prep.mjs
 *
 *  플랫폼   MCP 허브 승인함에 대기 건 하나(정책 '서버 색인 다시 만들기는 사람 승인' + dev1 의 호출)
 *          게이트웨이 라우트·예산·사내 개인정보 규칙, 녹화 중에 다시 올릴 문서 정리(--itsm-reset 이면 시험용 ITSM 연결도 지움)
 *  레이크   원본 연결 'ERP 계약(시연)'(SQLite, tools/.demo-erp.db) · 동기화 erp-contracts
 *  --only=platform | --only=datalake 로 한쪽만
 *  결과는 tools/.feature-prep.json
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPS } from "./demo-scenarios.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const log = (s) => console.log(`▶ ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);

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

const ONLY = process.argv.find((x) => x.startsWith("--only="))?.slice(7) ?? null;
if (!ONLY || ONLY === "platform") {
// ---------- 플랫폼 — 승인함 대기 건
log("플랫폼 — MCP 허브 승인함");
const pl = await client("platform", "admin");
const dev = await client("platform", "dev");
const POLICY = "서버 색인 다시 만들기는 사람 승인";
if (!items(await pl("GET", "/hub/policies")).some((p) => p.name === POLICY)) {
  await pl("POST", "/hub/policies", { name: POLICY, priority: 10, match: { tools: ["axnavi__index_build"] }, effect: "approve", message: "서버 색인을 다시 만들면 몇 분간 조회가 느려집니다 — 운영 담당 승인 후 실행", enabled: true });
}
const pending = items(await pl("GET", "/hub/approvals")).filter((a) => a.status === "pending");
if (!pending.length) {
  const r = await dev("POST", "/hub/call", { name: "axnavi__index_build", args: { repo: "hr-demo" } }).catch((e) => ({ error: e.message }));
  ok(`dev1 호출 → ${JSON.stringify(r).slice(0, 160)}`);
}
ok(`승인 대기 ${items(await pl("GET", "/hub/approvals")).filter((a) => a.status === "pending").length}건`);

// ---------- 플랫폼 — 게이트웨이 라우트·예산·사내 개인정보 규칙(빈 표가 아니게)
log("플랫폼 — 게이트웨이 라우트·예산·개인정보 규칙");
const routes = items(await pl("GET", "/gateway/routes"));
const addRoute = async (name, priority, match) => {
  if (!routes.some((x) => x.name === name)) await pl("POST", "/gateway/routes", { name, priority, match, action: { forceAlias: "hnix-local" }, enabled: true });
};
await addRoute("개인정보가 든 요청은 사내 모델로", 10, { piiDetected: true });
await addRoute("기밀 등급 이상은 사내 모델로", 20, { dataClassAtLeast: "confidential" });
if (!items(await pl("GET", "/gateway/budgets")).some((b) => b.name === "전사 월 예산")) {
  await pl("POST", "/gateway/budgets", { name: "전사 월 예산", scope: "global", period: "monthly", limitUsd: 300, limitTokens: 20_000_000, hardStop: false });
}
if (!items(await pl("GET", "/gateway/pii-rules")).some((p) => p.name === "사번")) {
  await pl("POST", "/gateway/pii-rules", { name: "사번", kind: "custom", pattern: "HD\\d{6}", action: "pseudonymize", direction: "both", enabled: true });
}
ok("라우트 2 · 예산 1 · 사내 규칙 '사번'");

// ---------- 플랫폼 — 녹화 중에 다시 올리는 문서는 미리 지운다(같은 내용은 두 번 못 올린다)
log("플랫폼 — 문서 RAG·매뉴얼 보강 시연 문서 정리");
const col = items(await pl("GET", "/docs/collections")).find((c) => c.name === "운영 매뉴얼");
if (col) {
  for (const d of items(await pl("GET", `/docs/collections/${col.id}/documents`)).filter((d) => ["급여 마감 점검표", "급여-마감-점검표", "회의실 예약 안내"].includes(d.title))) {
    await pl("DELETE", `/docs/documents/${d.id}`);
    ok(`지움: ${d.title}`);
  }
}

// ---------- 플랫폼 — 고객 ITSM 시험용 연결은 녹화에서 새로 만든다(--itsm-reset 일 때만 지움)
if (process.argv.includes("--itsm-reset")) {
  for (const c of items(await pl("GET", "/itsm/connections")).filter((x) => x.name === "demo-itsm")) {
    await pl("DELETE", `/itsm/connections/${c.id}`);
    ok("지움: 시험용 ITSM 연결 demo-itsm");
  }
}

}

// ---------- 레이크 — 원본 연결(SQLite 로 만든 시연용 ERP 계약 DB)과 동기화
if (!ONLY || ONLY === "datalake") {
  log("AX-DataLake — 원본 연결 'ERP 계약(시연)' · 동기화");
  const dbPath = join(HERE, ".demo-erp.db");
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("DROP TABLE IF EXISTS contracts; CREATE TABLE contracts (id INTEGER PRIMARY KEY, customer TEXT, division TEXT, amount INTEGER, status TEXT, updated_at TEXT)");
  const ins = db.prepare("INSERT INTO contracts VALUES (?, ?, ?, ?, ?, ?)");
  const divs = ["조선", "엔진", "건설기계"];
  for (let i = 1; i <= 240; i++) ins.run(i, `고객사${(i % 37) + 1}`, divs[i % 3], 50_000_000 + ((i * 7919) % 900) * 1_000_000, i % 5 === 0 ? "해지" : i % 3 === 0 ? "협상" : "체결", new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString());
  // 녹화 때 '실행'을 누르면 바뀐 행만 들어오게 — 15건을 지금 시각으로 고친다(병합·워터마크)
  db.prepare("UPDATE contracts SET status = '체결', amount = amount + 10000000, updated_at = ? WHERE id % 16 = 0").run(new Date().toISOString());
  db.close();
  const eng = await client("datalake", "eng");
  const srcs = (await eng("GET", "/sources")).sources ?? items(await eng("GET", "/sources"));
  let src = srcs.find((s) => s.name === "ERP 계약(시연)");
  if (!src) src = await (await client("datalake", "admin"))("POST", "/sources", { name: "ERP 계약(시연)", kind: "sqlite", config: { path: dbPath } });
  const syncs = (await eng("GET", "/syncs")).syncs ?? items(await eng("GET", "/syncs"));
  if (!syncs.some((s) => s.name === "erp-contracts")) {
    await eng("POST", "/syncs", { name: "erp-contracts", sourceId: src.id, sourceObject: "main.contracts", targetSchema: "erp", targetTable: "contracts", mode: "merge", watermarkColumn: "updated_at", keyColumns: ["id"], scheduleMinutes: 60, enabled: true });
  }
  ok("원본 연결 'ERP 계약(시연)' · 동기화 erp-contracts(병합, 60분) — 녹화에서 '실행'");

  // 문서(비정형) — E2E 운영 매뉴얼 폴더를 개인정보를 가려 레이크로
  const adm = await client("datalake", "admin");
  const cols = await adm("GET", "/doc-collections");
  let dc = (cols.collections ?? items(cols)).find((c) => c.name === "ops-manual");
  if (!dc) dc = await adm("POST", "/doc-collections", { name: "ops-manual", label: "운영 매뉴얼", description: "인사시스템 운영 매뉴얼·절차서(E2E)", root: "C:/Users/onlys/hnix-ax-platform/e2e/docs", targetSchema: "docs", targetTable: "ops_manual", dataClass: "internal", pii: { rrn: "mask", phone: "mask", email: "mask" }, org: "HD01" });
  const run = await adm("POST", `/doc-collections/${dc.id}/run`).catch((e) => ({ error: e.message }));
  ok(`문서 묶음 ops-manual → docs.ops_manual ${JSON.stringify(run).slice(0, 120)}`);

  // Kafka 를 다시 띄웠으면 CDC 스트림이 멈춰 있다 — 다시 시작
  for (const st of (await eng("GET", "/streams")).streams.filter((x) => x.name === "erp-orders-cdc" && x.desired !== "running")) {
    await eng("POST", `/streams/${st.id}/start`).catch(() => undefined);
    ok("CDC 스트림 erp-orders-cdc 다시 시작");
  }
}

writeFileSync(join(HERE, ".feature-prep.json"), JSON.stringify(out, null, 2));
console.log(`\n준비 끝 — ${join(HERE, ".feature-prep.json")}`);
