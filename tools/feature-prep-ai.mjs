#!/usr/bin/env node
/*
 * 기능 영상 ⑩~⑫(자동화 흐름·실행 디버거·에이전트 평가·업무 시스템 연결·음성·외부 에이전트) 준비.
 * 먼저 tools/demo-servers.mjs 와 사내 음성 인식 서버(OpenAI 호환 /v1/audio/transcriptions, 기본 http://127.0.0.1:8796/v1)를 띄운다.
 *   node tools/feature-prep-ai.mjs [--stt=http://127.0.0.1:8796/v1] [--no-baseline]
 *
 *  게이트웨이  프로바이더 '사내 음성 인식 서버' + 별칭 voice-stt(음성 인식)
 *  현업 창구   hr-help 에 말로 묻기(voice-stt)·답 읽어 주기(브라우저) 켬
 *  자동화 흐름 '서비스 요청 분류·처리'(예시 흐름 — 모델 hnix-local, 장애 담당 alert-triage)
 *  에이전트 평가 sm-helper 시험 문항 '서비스 요청 도우미 회귀' 4문항 + 기준 평가 한 번(--no-baseline 이면 생략)
 *  녹화에서 새로 만드는 것은 지운다: 업무 시스템 연결 sap_hr·incident_api, 외부 에이전트 'purchase-agent'
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPS } from "./demo-scenarios.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const log = (s) => console.log(`▶ ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const STT = arg("stt", "http://127.0.0.1:8796/v1");
const items = (j) => (Array.isArray(j) ? j : j.items ?? j.content ?? []);

async function client(who) {
  const a = APPS.platform;
  const r = await fetch(`${a.url}${a.loginApi}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a.users[who]) });
  if (!r.ok) throw new Error(`플랫폼 ${who} 로그인 실패 ${r.status}`);
  const token = (await r.json()).accessToken;
  return async (method, path, body) => {
    const res = await fetch(`${a.url}/api/v1${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const t = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${t.slice(0, 300)}`);
    return t ? JSON.parse(t) : null;
  };
}
const pl = await client("admin");

// ---------- 게이트웨이 — 사내 음성 인식
log("게이트웨이 — 사내 음성 인식 서버 · 별칭 voice-stt");
let prv = items(await pl("GET", "/gateway/providers")).find((p) => p.name === "사내 음성 인식 서버");
if (!prv) prv = await pl("POST", "/gateway/providers", { name: "사내 음성 인식 서버", type: "openai_compat", baseUrl: STT, isLocal: true, timeoutMs: 120000 });
if (!items(await pl("GET", "/gateway/models")).some((m) => m.alias === "voice-stt")) {
  await pl("POST", "/gateway/models", { alias: "voice-stt", description: "사내 음성 인식(whisper 계열)", kind: "transcription", targets: [{ providerId: prv.id, model: "whisper-small" }] });
}
ok(`프로바이더 ${STT} · 별칭 voice-stt`);

// ---------- 현업 창구 — 말로 묻기
log("현업 창구 hr-help — 말로 묻기·읽어 주기");
const d = items(await pl("GET", "/desks")).find((x) => x.slug === "hr-help");
if (!d) throw new Error("현업 창구 hr-help 가 없습니다 — demo-prep.mjs 를 먼저 돌리세요.");
await pl("PUT", `/desks/${d.id}`, {
  slug: d.slug,
  name: d.name,
  description: d.description,
  workspaceId: d.workspace_id,
  modelAlias: d.model_alias,
  collections: d.collections,
  kbTool: d.kb_tool,
  kbArgs: d.kb_args,
  runAs: d.run_as,
  greeting: d.greeting,
  instructions: d.instructions,
  escalation: d.escalation,
  replyFormat: d.reply_format,
  enabled: !!d.enabled,
  look: d.look ?? {},
  voice: { input: true, sttAlias: "voice-stt", language: "ko", autoSend: false, tts: "browser", autoRead: false },
});
ok("hr-help 음성 켬");

// ---------- 자동화 흐름
log("자동화 흐름 — 서비스 요청 분류·처리");
const flows = items(await pl("GET", "/flows"));
if (!flows.some((f) => f.name === "서비스 요청 분류·처리")) {
  const ex = await pl("GET", "/flows/example?model=hnix-local&agent=alert-triage");
  const agents = items(await pl("GET", "/agents"));
  const triage = agents.find((a) => a.name === "alert-triage");
  for (const n of ex.definition.nodes) if (n.type === "agent" && triage) n.data.agent = triage.id;
  const f = await pl("POST", "/flows", { name: ex.name, description: ex.description, definition: ex.definition, visibility: "shared" });
  ok(`만듦 ${f.id}`);
} else ok("이미 있음");

// ---------- 에이전트 평가 — sm-helper
log("에이전트 평가 — sm-helper 회귀 문항");
const agents = items(await pl("GET", "/agents"));
const sm = agents.find((a) => a.name === "sm-helper");
if (!sm) throw new Error("에이전트 sm-helper 가 없습니다.");
const SET = "서비스 요청 도우미 회귀";
let set = items(await pl("GET", "/agent-evals/sets")).find((s) => s.name === SET);
if (!set) {
  const projectLine = /01[0-9A-Z]{24}/.exec(sm.system_prompt ?? "")?.[0] ?? "";
  set = await pl("POST", "/agent-evals/sets", {
    agentId: sm.id,
    name: SET,
    description: "지시문·모델을 바꿀 때마다 돌리는 기본 문항 — 도구를 쓰는지, 지어내지 않는지",
    settings: { concurrency: 1, approvalAsPass: false, judgeModel: "hnix-local" },
    cases: [
      { id: "c1", name: "퇴사자 요청 찾기", input: "pmsx__srs 도구에 q=퇴사자 로 검색해서 나온 서비스 요청 번호와 제목을 한국어 한 줄로 알려줘", checks: [{ type: "tool_used", tool: "pmsx__srs" }, { type: "regex", pattern: "SR-\\d{4}" }, { type: "max_turns", max: 4 }] },
      { id: "c2", name: "급여 요청 찾기", input: "pmsx__srs 도구에 q=급여 로 검색해서 나온 서비스 요청 번호를 한국어로 알려줘", checks: [{ type: "tool_used", tool: "pmsx__srs" }, { type: "regex", pattern: "SR-\\d{4}" }] },
      { id: "c3", name: "범위 밖 질문은 도구 없이", input: "오늘 점심 메뉴 추천해줘", checks: [{ type: "tool_not_used", tool: "pmsx__srs" }, { type: "max_tool_calls", max: 0 }] },
      { id: "c4", name: "답 품질(모델 채점)", input: "pmsx__srs 도구에 q=퇴사자 로 검색해서 처리 방향을 한국어 세 줄로 정리해줘", checks: [{ type: "tool_used", tool: "pmsx__srs" }, { type: "judge", rubric: "한국어로 답했고, 서비스 요청 번호와 처리 방향(무엇을 확인·조치할지)이 들어 있다" }, { type: "max_ms", max: 120000 }] },
    ],
  });
  ok(`문항 4개 ${set.id}${projectLine ? "" : ""}`);
} else ok("이미 있음");
if (!process.argv.includes("--no-baseline") && !items(await pl("GET", `/agent-evals/sets/${set.id}/runs`)).length) {
  log("  기준 평가 한 번(사내 3B 모델 — 몇 분 걸립니다)");
  const run = await pl("POST", `/agent-evals/sets/${set.id}/runs?wait=true`, { name: "기준(지시문 수정 전)" });
  ok(`기준 평가 ${run.id ?? ""} ${run.status ?? ""} 통과 ${run.passed ?? "?"}/${run.total ?? "?"}`);
}

// ---------- 녹화에서 새로 만드는 것 — 지운다
log("녹화에서 새로 만드는 것 정리");
for (const c of items(await pl("GET", "/biz/connections")).filter((x) => ["sap_hr", "incident_api"].includes(x.name))) {
  await pl("DELETE", `/biz/connections/${c.id}`);
  ok(`지움: 업무 시스템 연결 ${c.name}`);
}
for (const a of items(await pl("GET", "/agents")).filter((x) => x.name === "purchase-agent")) {
  await pl("DELETE", `/agents/${a.id}`);
  ok("지움: 외부 에이전트 purchase-agent");
}
const servers = JSON.parse(readFileSync(join(HERE, ".demo-servers.json"), "utf8"));
ok(`상대 시스템: SAP ${servers.sap.url} · REST ${servers.rest.specUrl} · 에이전트 ${servers.agent.url}`);
console.log("\n준비 끝");
