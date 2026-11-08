#!/usr/bin/env node
/*
 * 기능 영상 AX-DataLake ⑤ 분석 준비 — E2E 레이크(ops.incident 장애 900건, ITO 온톨로지)에
 * 지표·차원·검증된 질의와 '장애 현황' 대시보드(게시·분석가 역할에 공유)를 만든다. 여러 번 돌려도 같은 결과.
 *
 *   node tools/feature-prep-analysis.mjs
 */
import { APPS } from "./demo-scenarios.mjs";

const D = APPS.datalake;
async function login(who) {
  const r = await fetch(`${D.url}${D.loginApi}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(D.users[who]) });
  if (!r.ok) throw new Error(`레이크 로그인 실패(${who}) ${r.status}`);
  return (await r.json()).accessToken;
}
const api = (tok) => async (method, path, body) => {
  const r = await fetch(`${D.url}/api/v1${path}`, { method, headers: { authorization: `Bearer ${tok}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};

const eng = api(await login("eng"));
const admin = api(await login("admin"));

await eng("PUT", "/semantic/metrics", { name: "incident_count", label: "장애 건수", schema: "ops", table: "incident", expr: "count(*)", timeColumn: "opened_at", synonyms: ["장애 수", "건수"] });
await eng("PUT", "/semantic/metrics", { name: "incident_mttr", label: "평균 해결 시간(분)", schema: "ops", table: "incident", expr: "avg(minutes_to_resolve)", timeColumn: "opened_at", synonyms: ["MTTR", "해결 시간"] });
await eng("PUT", "/semantic/dimensions", { name: "incident_system", label: "업무 시스템", schema: "ops", table: "incident", expr: "system", synonyms: ["시스템"] });
await eng("PUT", "/semantic/dimensions", { name: "incident_priority", label: "등급", schema: "ops", table: "incident", expr: "priority", synonyms: ["우선순위"] });
const sem = await eng("GET", "/semantic");
if (!sem.verified.some((v) => v.question === "시스템별 장애 건수")) {
  await eng("POST", "/semantic/verified", { question: "시스템별 장애 건수", sql: 'SELECT system AS "시스템", count(*) AS "건수" FROM ops.incident GROUP BY 1 ORDER BY 2 DESC', chart: { kind: "bar", x: "시스템", y: ["건수"] } });
}

const SRC = "SELECT * FROM ops.incident WHERE ({{system}} IS NULL OR system = {{system}}) AND ({{priority}} IS NULL OR priority = {{priority}})";
const agg = (groupBy, measures, extra = {}) => ({ groupBy, measures, ...extra });
const tiles = [
  { id: "cnt", kind: "chart", title: "장애 건수", sql: SRC, chart: { kind: "number", y: ["건수"], aggregate: agg([], [{ column: null, agg: "count" }]) }, w: 3, h: 2 },
  { id: "mttr", kind: "chart", title: "평균 해결 시간(분)", sql: SRC, chart: { kind: "number", y: ["minutes_to_resolve 평균"], aggregate: agg([], [{ column: "minutes_to_resolve", agg: "avg" }]) }, w: 3, h: 2 },
  { id: "p1", kind: "chart", title: "P1 장애", sql: `${SRC} AND priority = 'P1'`, chart: { kind: "number", y: ["건수"], aggregate: agg([], [{ column: null, agg: "count" }]) }, w: 3, h: 2 },
  { id: "memo", kind: "text", title: "읽는 법", text: "# 통합 ITO 장애\n- ITSM 에서 매일 적재(ops.incident)\n- 보는 사람의 계열사 행만 보입니다", w: 3, h: 2 },
  { id: "daily", kind: "chart", title: "일별 장애 — 등급별", sql: SRC, chart: { kind: "area", x: "opened_at", y: ["건수"], series: "priority", stack: true, aggregate: agg(["opened_at", "priority"], [{ column: null, agg: "count" }], { time: { column: "opened_at", unit: "day" } }) }, w: 8, h: 4 },
  { id: "sys", kind: "chart", title: "시스템별 장애", sql: SRC, chart: { kind: "bar", x: "system", y: ["건수"], horizontal: true, aggregate: agg(["system"], [{ column: null, agg: "count" }]) }, w: 4, h: 4 },
  { id: "pivot", kind: "chart", title: "시스템 × 등급", sql: SRC, chart: { kind: "pivot", aggregate: agg(["system"], [{ column: null, agg: "count" }], { pivot: "priority" }) }, w: 6, h: 4 },
  { id: "objs", kind: "objects", title: "최근 P1 장애 — 바로 진단 요청", objects: { type: "incident", where: [{ column: "severity", op: "=", value: "P1" }], limit: 8 }, w: 6, h: 4 },
];

// E2E 자동 점검(㉔)이 만든 'E2E 장애 현황' 은 영상에서 헷갈리므로 지운다(점검을 다시 돌리면 다시 생긴다)
for (const d of (await eng("GET", "/dashboards")).dashboards.filter((x) => x.name.startsWith("E2E "))) await admin("DELETE", `/dashboards/${d.id}`);
const list = (await eng("GET", "/dashboards")).dashboards;
let id = list.find((d) => d.name === "장애 현황")?.id;
if (!id) id = (await eng("POST", "/dashboards", { name: "장애 현황" })).id;
await eng("PUT", `/dashboards/${id}`, {
  name: "장애 현황",
  description: "통합 ITO 장애 — 시스템·등급 필터, 보는 사람의 계열사 행만",
  filters: [
    { name: "system", label: "업무 시스템", type: "select", options: ["HR", "ERP", "MES", "GW", "SCM"] },
    { name: "priority", label: "등급", type: "select", options: ["P1", "P2", "P3", "P4"] },
  ],
  tiles,
});
await eng("POST", `/dashboards/${id}/publish`);
await admin("PUT", `/dashboards/${id}/shares`, [{ principalType: "role", principal: "ANALYST", permission: "view" }]);
// 타일 하나라도 실패하면 영상이 빈 칸이 된다 — 미리 돌려 본다
const run = await eng("POST", `/dashboards/${id}/run`, { refresh: true });
const bad = run.tiles.filter((t) => !t.ok);
if (bad.length) throw new Error(`타일 실패: ${bad.map((t) => `${t.id} ${t.error}`).join(" / ")}`);
console.log(`대시보드 '장애 현황' ${id} — 타일 ${tiles.length} 모두 OK, 게시·분석가 공유`);
