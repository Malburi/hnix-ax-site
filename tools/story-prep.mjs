#!/usr/bin/env node
/*
 * 해설 시연 영상(2026-11-13 판) 준비 — 깨끗한 E2E 환경(start.ps1 -Fresh)에 시연에 쓰는 것만 만든다. 여러 번 돌려도 같은 결과.
 *   node tools/story-prep.mjs
 *
 *  레이크   문서 묶음 '운영 보고서·회의록'(ops — 분석가가 볼 수 있음, 장애 보고 PPT·회의록·운영 실적·점검표 스캔)
 *          문서 묶음 '경영 검토(제한)'(mgmt — 분석가 권한 없음, 플랫폼 검색에 안 나와야 한다)
 *  플랫폼   현업 창구 hr-help(근거: 플랫폼 '운영 매뉴얼' + 레이크 '운영 보고서·회의록', 못 찾으면 PMS-X 서비스 요청)
 *          자동화 흐름 '서비스 요청 분류·처리' + 감시 트리거 '새 서비스 요청 감시'(기준선만 잡아 둔다)
 *  결과는 tools/.story-prep.json
 * 레이크 분석(지표·검증된 질의·'장애 현황' 대시보드)은 feature-prep-analysis.mjs 를 따로 돌린다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPS } from "./demo-scenarios.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES = "C:/Users/onlys/hnix-ax-platform/e2e/docs/datalake";
const log = (s) => console.log(`▶ ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);
const items = (j) => (Array.isArray(j) ? j : j.items ?? j.content ?? j.collections ?? []);

async function token(app, who) {
  const a = APPS[app];
  const r = await fetch(`${a.url}${a.loginApi}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a.users[who]) });
  if (!r.ok) throw new Error(`${app} ${who} 로그인 실패 ${r.status}`);
  return (await r.json()).accessToken;
}
async function client(app, who) {
  const tok = await token(app, who);
  return async (method, path, body) => {
    const res = await fetch(`${APPS[app].url}/api/v1${path}`, { method, headers: { authorization: `Bearer ${tok}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const t = await res.text();
    if (!res.ok) throw new Error(`${app} ${method} ${path} → ${res.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
}
async function upload(colId, file, name, buf) {
  const tok = await token("datalake", "eng");
  const form = new FormData();
  form.append("file", new Blob([buf ?? readFileSync(join(SAMPLES, file))]), name);
  const r = await fetch(`${APPS.datalake.url}/api/v1/doc-collections/${colId}/upload`, { method: "POST", headers: { authorization: `Bearer ${tok}` }, body: form });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.status !== "ok") throw new Error(`${name} 올리기 실패 ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
const out = {};

// ---------- 레이크 문서 묶음
log("AX-DataLake — 문서 묶음");
const dladmin = await client("datalake", "admin");
const cols = items(await dladmin("GET", "/doc-collections"));
let ops = cols.find((c) => c.name === "ops-reports");
if (!ops) {
  ops = await dladmin("POST", "/doc-collections", { name: "ops-reports", label: "운영 보고서·회의록", targetSchema: "ops", targetTable: "reports", dataClass: "internal", ocr: true, description: "장애 보고서·회의록·운영 실적·점검표 — 개인정보는 가려서 넣는다" });
  for (const [f, n] of [["incident-payroll.pptx", "2026-10_장애보고_급여배치.pptx"], ["minutes-payroll.txt", "회의록_2026-11-05_급여배치.txt"], ["ops-q3.xlsx", "2026-3분기_운영실적.xlsx"], ["scan-checklist.png", "서버점검표_스캔_2026-11-04.png"]]) {
    const r = await upload(ops.id, f, n);
    ok(`${n} — 조각 ${r.chunks ?? "?"}${r.pii && Object.keys(r.pii).length ? ` · 개인정보 ${Object.entries(r.pii).map(([k, v]) => `${k} ${v}`).join("·")} 가림` : ""}`);
  }
} else ok("운영 보고서·회의록(있음)");
let mgmt = cols.find((c) => c.name === "mgmt-review");
if (!mgmt) {
  mgmt = await dladmin("POST", "/doc-collections", { name: "mgmt-review", label: "경영 검토(제한)", targetSchema: "mgmt", targetTable: "reviews", dataClass: "secret", description: "경영진 검토 문서 — 분석가에게 권한을 주지 않는다" });
  await upload(mgmt.id, null, "2027_운영조직_개편검토.md", Buffer.from("# 2027 운영 조직 개편 검토\n\n코드명 블루웨일 — 인사·급여 운영 조직을 통합하는 안. 관계자 외 열람 금지. 급여 배치 운영 인력 재배치 포함.\n"));
  ok("경영 검토(제한) — 문서 1개, 분석가 권한 없음");
} else ok("경영 검토(제한)(있음)");
out.lake = { ops: ops.id, mgmt: mgmt.id };

// ---------- 플랫폼 현업 창구
log("AX Platform — 현업 사용자 김현업 · 현업 창구 hr-help");
const pl = await client("platform", "admin");
// 창구에 묻는 현업 — 인사팀 김현업(시연 계정, 일반 사용자)
const HYUN = { loginId: "hyun.kim", password: "Hyun!2026" };
const users = items(await pl("GET", "/admin/users"));
if (!users.some((u) => (u.login_id ?? u.loginId) === HYUN.loginId)) {
  await pl("POST", "/admin/users", { loginId: HYUN.loginId, name: "김현업", password: HYUN.password, email: "hyun.kim@example.com", team: "인사팀" });
  ok("플랫폼 사용자 김현업(인사팀) 만듦");
} else ok("플랫폼 사용자 김현업(있음)");
out.hyun = HYUN;
const px = await client("pmsx", "admin");
const sm = (await px("GET", "/projects")).find((p) => p.type === "SM" && p.name.includes("인사시스템 운영"));
if (!sm) throw new Error("PMS-X SM 프로젝트 '인사시스템 운영' 이 없습니다");
const devId = (await (await client("platform", "dev"))("GET", "/auth/me")).user.id;
const manual = items(await pl("GET", "/docs/collections")).find((c) => c.name === "운영 매뉴얼");
if (!manual) throw new Error("문서함 '운영 매뉴얼' 이 없습니다 — start.ps1(seed hub)");
const lakeCols = (await pl("GET", "/docs/lake/collections")).items ?? [];
const lakeOps = lakeCols.find((c) => c.name === "ops-reports");
if (!lakeOps) throw new Error(`플랫폼에서 레이크 묶음 ops-reports 가 안 보입니다(보이는 것: ${lakeCols.map((c) => c.name).join(",") || "없음"}) — 1분 뒤 다시`);
if (lakeCols.some((c) => c.name === "mgmt-review")) throw new Error("권한 없는 mgmt-review 가 플랫폼에 보입니다");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40"><rect width="150" height="40" rx="6" fill="#ffffff"/><circle cx="20" cy="20" r="11" fill="#0f7b85"/><path d="M14 20h12M20 14v12" stroke="#ffffff" stroke-width="3"/><text x="38" y="26" font-family="Malgun Gothic, Arial" font-weight="700" font-size="15" fill="#0f7b85">○○공사 인사팀</text></svg>`;
const deskBody = {
  slug: "hr-help",
  name: "인사시스템 도움 창구",
  description: "인사·급여 시스템 사용 문의 — 매뉴얼과 운영 보고서를 근거로 먼저 답하고, 못 풀면 담당자에게",
  greeting: "안녕하세요, 인사시스템 도움 창구입니다. 사용 중 궁금한 점이나 오류를 적어 주세요.",
  modelAlias: "hnix-local",
  collections: [manual.id, lakeOps.id],
  kbTool: "pmsx__similar",
  kbArgs: { projectId: sm.projectId },
  runAs: devId,
  escalation: { kind: "pmsx", server: "pmsx", projectId: sm.projectId, type: "INQUIRY", priority: "P3" },
  look: { color: "#0f7b85", logo: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, faq: ["사원 조회에 퇴사자가 같이 나와요", "급여 계산 배치가 늦어진 원인이 뭐였나요?", "권한 신청은 어떻게 하나요?", "계정이 잠겼어요"] },
};
const desk = items(await pl("GET", "/desks")).find((d) => d.slug === "hr-help");
if (desk) await pl("PUT", `/desks/${desk.id}`, { ...deskBody, instructions: desk.instructions ?? undefined });
else await pl("POST", "/desks", deskBody);
ok(`/desk/hr-help — 근거: 운영 매뉴얼 + 레이크 '${lakeOps.label}' · 접수: PMS-X ${sm.name}`);

// ---------- 자동화 흐름 + 감시 트리거
log("AX Platform — 자동화 흐름 '서비스 요청 분류·처리' · 감시 트리거");
let flow = items(await pl("GET", "/flows")).find((f) => f.name === "서비스 요청 분류·처리");
if (!flow) {
  const ex = await pl("GET", "/flows/example?model=hnix-local&agent=alert-triage");
  const triage = items(await pl("GET", "/agents")).find((a) => a.name === "alert-triage");
  for (const n of ex.definition.nodes) if (n.type === "agent" && triage) n.data.agent = triage.id;
  flow = await pl("POST", "/flows", { name: ex.name, description: ex.description, definition: ex.definition, visibility: "shared" });
  ok(`흐름 만듦 ${flow.id}`);
} else ok("흐름 있음");
for (const t of items(await pl("GET", `/triggers?flowId=${flow.id}`)).filter((x) => x.name === "새 서비스 요청 감시")) await pl("DELETE", `/triggers/${t.id}`);
const trig = await pl("POST", "/triggers", {
  flowId: flow.id,
  name: "새 서비스 요청 감시",
  kind: "poll",
  enabled: true,
  runAs: devId,
  config: { tool: "pmsx__srs", args: { projectId: sm.projectId }, itemsPath: "items", idField: "srNo", intervalMinutes: 240, maxPerPoll: 3 },
  inputTemplate: '{\n  "title": "{{item.title}}",\n  "body": "{{item.srNo}} · 유형 {{item.type}} · 우선순위 {{item.priority}} · 현업 창구에서 접수된 서비스 요청"\n}',
});
const base = await pl("POST", `/triggers/${trig.id}/fire`, { body: {} });
ok(`감시 트리거 ${trig.id} — 기준선 ${base?.detail ?? base?.outcome ?? "?"}`);
out.flow = { id: flow.id, triggerId: trig.id };
out.sm = { projectId: sm.projectId, name: sm.name };
// PMS-X 담당 배정 칸에 넣을 운영자 이름
const me = await (await client("pmsx", "op"))("GET", "/auth/me").catch(() => null);
out.pmsxOpName = me?.name ?? me?.user?.name ?? null;
ok(`PMS-X 운영자 이름: ${out.pmsxOpName}`);

writeFileSync(join(HERE, ".story-prep.json"), JSON.stringify(out, null, 2));
console.log(`\n준비 끝 — ${join(HERE, ".story-prep.json")}`);
