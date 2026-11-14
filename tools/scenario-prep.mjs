#!/usr/bin/env node
/*
 * SM 업무 흐름 시나리오 영상 준비 — demo-prep.mjs 를 돌린 E2E 환경에서, 녹화 직전에 돌린다(여러 번 돌려도 된다).
 *   node tools/scenario-prep.mjs
 *
 *  시나리오 A  시험용 고객 ITSM 연결을 새로 만들고, 처음 티켓 5건은 미리 한 번 동기화해 둔다.
 *             그 뒤 고객(김현업)이 새 티켓 "사원 조회에 퇴사자가 같이 나와요"를 등록한 상태로 둔다 — 녹화에서 '지금 동기화'.
 *  시나리오 B  현업 창구 hr-help 에 창구 모양(색·로고·자주 묻는 질문), 매뉴얼 보강 시연 문서 정리.
 *  --only=b 이면 시나리오 B 준비만(시나리오 A 의 ITSM 연결·감시 트리거는 그대로).
 *  결과는 tools/.scenario-prep.json
 *
 * 시험용 ITSM 은 Basic 인증이고 비밀번호는 플랫폼 비밀 저장소에만 있다 — 이 PC 의 E2E 플랫폼 데이터에서 읽는다
 * (PLATFORM_REPO, E2E 설정 run/platform/hnix-ax.yaml). 다른 PC 에서는 쓰지 않는다.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { APPS } from "./demo-scenarios.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLATFORM_REPO = process.env.PLATFORM_REPO ?? "C:/Users/onlys/hnix-ax-platform";
const CONFIG = join(PLATFORM_REPO, "e2e/run/platform/hnix-ax.yaml");
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

/** 플랫폼 비밀 저장소의 값 하나 — 플랫폼 소스의 core 로 같은 데이터 폴더를 연다 */
function platformSecret(name) {
  const core = pathToFileURL(join(PLATFORM_REPO, "packages/core/src/index.ts")).href;
  const code = `import { createCoreContext, loadConfig } from ${JSON.stringify(core)};
const ctx = await createCoreContext(loadConfig({ file: ${JSON.stringify(CONFIG)} }));
process.stdout.write(String((await ctx.secrets.get(${JSON.stringify(name)})) ?? ""));
await ctx.close();`;
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--input-type=module", "-e", code], { cwd: PLATFORM_REPO, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`비밀 값을 읽지 못했습니다: ${r.stderr.slice(0, 300)}`);
  return r.stdout.trim();
}

const ONLY_B = process.argv.includes("--only=b");
const out = ONLY_B && existsSync(join(HERE, ".scenario-prep.json")) ? JSON.parse(readFileSync(join(HERE, ".scenario-prep.json"), "utf8")) : {};
const pl = await client("platform", "admin");
if (!ONLY_B) {

// ---------- 시나리오 A — 고객 ITSM
log("시나리오 A — 시험용 고객 ITSM 연결과 새 티켓");
for (const c of items(await pl("GET", "/itsm/connections")).filter((x) => x.name === "demo-itsm")) {
  await pl("DELETE", `/itsm/connections/${c.id}`);
  ok("지난 시험용 연결 지움");
}
const conn = await pl("POST", "/itsm/demo", {});
await pl("POST", `/itsm/connections/${conn.id}/test`);
const first = await pl("POST", `/itsm/connections/${conn.id}/sync`);
ok(`처음 티켓 5건 미리 동기화 — ${JSON.stringify(first).slice(0, 160)}`);

const pw = platformSecret("itsm.demo_password");
const auth = `Basic ${Buffer.from(`hnix.demo:${pw}`).toString("base64")}`;
const res = await fetch(`${APPS.platform.url}/itsm-demo/api/now/table/incident`, {
  method: "POST",
  headers: { authorization: auth, "content-type": "application/json" },
  body: JSON.stringify({
    short_description: "사원 조회에 퇴사자가 같이 나와요",
    description: "인사 > 사원 조회 화면에서 이름으로 찾으면 이미 퇴사한 사람까지 함께 나옵니다. 지난주 배포 뒤부터 그렇습니다. 인사팀 조회 업무에 혼선이 있어 빠른 확인 부탁드립니다.",
    urgency: "2 - High",
    category: "software",
    caller_id: "김현업(인사팀)",
  }),
});
if (!res.ok) throw new Error(`시험용 ITSM 티켓 등록 실패 ${res.status}`);
const ticket = (await res.json()).result;
out.itsm = { connectionId: conn.id, ticket: ticket.number.value };
ok(`고객 티켓 ${ticket.number.value} 등록(아직 동기화 전)`);

// ---------- 시나리오 A — 자동화 흐름: PMS-X 새 서비스 요청을 감시해 '서비스 요청 분류·처리' 흐름을 깨운다
log("시나리오 A — 감시 트리거 → 자동화 흐름 '서비스 요청 분류·처리'");
const flow = items(await pl("GET", "/flows")).find((f) => f.name === "서비스 요청 분류·처리");
if (!flow) throw new Error("자동화 흐름 '서비스 요청 분류·처리' 가 없습니다 — feature-prep-ai.mjs 를 먼저 돌리세요");
const smProject = items(await pl("GET", "/itsm/connections")).find((c) => c.id === conn.id)?.pmsx_project;
if (!smProject) throw new Error("시험용 ITSM 연결의 PMS-X 프로젝트를 모릅니다");
const devMe = await (await client("platform", "dev"))("GET", "/auth/me");
const devId = devMe?.id ?? devMe?.user?.id ?? devMe?.sub;
if (!devId) throw new Error(`dev1 사용자 ID 를 모릅니다: ${JSON.stringify(devMe).slice(0, 200)}`);
for (const t of items(await pl("GET", `/triggers?flowId=${flow.id}`)).filter((x) => x.name === "새 서비스 요청 감시")) {
  await pl("DELETE", `/triggers/${t.id}`);
  ok("지난 감시 트리거 지움");
}
const trig = await pl("POST", "/triggers", {
  flowId: flow.id,
  name: "새 서비스 요청 감시",
  kind: "poll",
  enabled: true,
  runAs: devId,
  // 녹화에서 '지금 실행'으로 한 번 감시한다 — 평소 주기는 5분이지만 녹화 중에 저절로 돌지 않게 길게
  config: { tool: "pmsx__srs", args: { projectId: smProject }, itemsPath: "items", idField: "srNo", intervalMinutes: 240, maxPerPoll: 3 },
  inputTemplate: '{\n  "title": "{{item.title}}",\n  "body": "{{item.srNo}} · 유형 {{item.type}} · 우선순위 {{item.priority}} · 고객 ITSM 에서 이관된 서비스 요청"\n}',
});
// 지금 있는 요청은 기준선으로만 — 녹화에서 동기화로 생기는 새 요청 하나만 깨운다
const base = await pl("POST", `/triggers/${trig.id}/fire`, { body: {} });
out.flow = { id: flow.id, triggerId: trig.id };
ok(`감시 트리거 ${trig.id} — pmsx__srs(프로젝트 ${smProject}) · 실행 사용자 dev1 · 기준선: ${base?.detail ?? base?.outcome ?? "?"}`);
}

// ---------- 시나리오 B — 현업 창구 모양·매뉴얼 보강 문서
log("시나리오 B — 현업 창구 hr-help 모양");
const desk = items(await pl("GET", "/desks")).find((d) => d.slug === "hr-help");
if (!desk) throw new Error("현업 창구 hr-help 가 없습니다 — demo-prep.mjs 를 먼저 돌리세요");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40"><rect width="150" height="40" rx="6" fill="#ffffff"/><circle cx="20" cy="20" r="11" fill="#0f7b85"/><path d="M14 20h12M20 14v12" stroke="#ffffff" stroke-width="3"/><text x="38" y="26" font-family="Malgun Gothic, Arial" font-weight="700" font-size="15" fill="#0f7b85">○○공사 인사팀</text></svg>`;
await pl("PUT", `/desks/${desk.id}`, {
  slug: desk.slug, name: desk.name, description: desk.description, greeting: desk.greeting, instructions: desk.instructions, modelAlias: desk.model_alias, collections: desk.collections, kbTool: desk.kb_tool, kbArgs: desk.kb_args, escalation: desk.escalation,
  workspaceId: desk.workspace_id, runAs: desk.run_as, replyFormat: desk.reply_format, enabled: !!desk.enabled, ...(desk.voice ? { voice: desk.voice } : {}),
  look: { color: "#0f7b85", logo: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, faq: desk.look?.faq?.length ? desk.look.faq : ["사원 조회에 퇴사자가 같이 나와요", "급여 계산 배치가 실패했어요", "권한 신청은 어떻게 하나요?", "계정이 잠겼어요"] },
});
ok("색 #0f7b85 · 로고 · 자주 묻는 질문 4개");

const col = items(await pl("GET", "/docs/collections")).find((c) => c.name === "운영 매뉴얼");
if (col) {
  for (const d of items(await pl("GET", `/docs/collections/${col.id}/documents`)).filter((d) => ["회의실 예약 안내"].includes(d.title))) {
    await pl("DELETE", `/docs/documents/${d.id}`);
    ok(`지움: ${d.title}`);
  }
}

// 전화 장면에서 다시 묻는 질문 — 지난 녹화의 같은 대화는 지운다(채팅을 열면 마지막 대화가 먼저 보인다)
const dev = await client("platform", "dev");
for (const c of items(await dev("GET", "/chat/conversations")).filter((x) => x.title.startsWith("비밀번호를 여러 번 틀려서"))) {
  await dev("DELETE", `/chat/conversations/${c.id}`);
  ok(`지움: 지난 녹화 대화 ${c.title.slice(0, 20)}…`);
}

// ---------- PMS-X — 담당자 칸에 넣을 운영자 이름
const pm = await client("pmsx", "op");
out.pmsxOpName = (await pm("GET", "/auth/me").catch(() => null))?.name ?? null;
ok(`PMS-X 운영자 이름: ${out.pmsxOpName}`);

writeFileSync(join(HERE, ".scenario-prep.json"), JSON.stringify(out, null, 2));
console.log(`\n준비 끝 — ${join(HERE, ".scenario-prep.json")}`);
