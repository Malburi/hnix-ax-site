#!/usr/bin/env node
/*
 * 기능 영상 ⑩~⑫ 의 상대 시스템 — 녹화하는 동안 띄워 둔다(Ctrl+C 로 끝).
 *   node tools/demo-servers.mjs
 *
 *  SAP(OData v2, HR 서비스 ZHR_SRV)   플랫폼 저장소 testkit 의 시험용 SAP — 계정 hr.svc / sap-pw
 *  사내 장애 접수 REST(OpenAPI 3)       testkit 의 시험용 REST — API 키 api-key-1, 문서 /openapi.json
 *  구매 담당 에이전트(LangGraph 형식)   POST /runs/wait — 사내 모델(Ollama qwen2.5:3b)이 구매 요청 현황을 근거로 답
 *
 * 주소는 tools/.demo-servers.json 에 적는다(feature-prep·시나리오가 읽음).
 */
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLATFORM = process.env.HNIX_AX_PLATFORM_REPO ?? "C:/Users/onlys/hnix-ax-platform";
const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const AGENT_PORT = Number(process.env.DEMO_AGENT_PORT ?? 8797);

const { startFakeSap, startFakeOpenApi } = await import(pathToFileURL(join(PLATFORM, "packages/testkit/src/fake-biz.ts")).href);
const sap = await startFakeSap();
const rest = await startFakeOpenApi();

// 구매 담당 에이전트 — 다른 팀이 LangGraph 로 만든 에이전트를 흉내 낸다
const ORDERS = [
  { no: "PR-2611-014", item: "노트북 20대(신규 입사자)", dept: "인사팀", amount: "3,200만 원", status: "결재 대기 — 구매팀장" },
  { no: "PR-2611-009", item: "사무용 의자 12개", dept: "총무팀", amount: "540만 원", status: "발주 완료 — 11/12 입고 예정" },
  { no: "PR-2610-031", item: "그룹웨어 라이선스 50석 갱신", dept: "정보기획팀", amount: "1,850만 원", status: "계약 검토 중 — 법무 확인" },
  { no: "PR-2610-027", item: "회의실 모니터 4대", dept: "총무팀", amount: "620만 원", status: "입고 완료" },
];
const SYSTEM = "너는 구매팀의 '구매 담당 에이전트'다. 주어진 구매 요청 한 건만 근거로, 한글 한국어 한두 문장으로 진행 상황을 답한다. 요청 번호·품목·진행 상태를 넣는다. 한자·영어 문장·표는 쓰지 않는다.";
const row = (o) => `${o.no} | ${o.item} | ${o.dept} | ${o.amount} | ${o.status}`;

/** 1단계(조회): 질문 낱말이 가장 많이 겹치는 구매 요청 한 건 */
function lookup(question) {
  const words = question.split(/[\s,.?!·]+/).map((w) => w.replace(/(은|는|이|가|을|를|의|요청|구매)$/u, "")).filter((w) => w.length >= 2);
  const scored = ORDERS.map((o) => ({ o, s: words.filter((w) => row(o).includes(w)).length })).sort((a, b) => b.s - a.s);
  return scored[0].s > 0 ? scored[0].o : null;
}

/** 2단계(답): 사내 모델이 그 한 건을 문장으로 — 엇나가면 정해진 문장으로 */
async function ask(question) {
  const o = lookup(question);
  if (!o) return "말씀하신 구매 요청을 현황에서 찾지 못했습니다. 요청 번호나 품목을 알려 주세요.";
  const fallback = `${o.no} ${o.item}(${o.dept}, ${o.amount})은 지금 '${o.status}' 단계입니다.`;
  try {
    const r = await fetch(`${OLLAMA}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "qwen2.5:3b", temperature: 0, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `구매 요청: ${row(o)}\n질문: ${question}` }] }),
    });
    const a = String((await r.json()).choices?.[0]?.message?.content ?? "").trim();
    // 작은 모델이 표를 옮기거나 한자를 섞으면 정해진 문장으로
    return !a || a.includes("|") || /[㐀-鿿]/.test(a) || !a.includes(o.no) ? fallback : a;
  } catch {
    return fallback;
  }
}

const agent = createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  const send = (s, b) => {
    res.writeHead(s, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(b));
  };
  const path = (req.url ?? "").split("?")[0];
  if (req.method === "GET" && (path === "/ok" || path === "/info")) return send(200, { ok: true, name: "구매 담당 에이전트" });
  if (req.method === "POST" && path === "/threads") return send(200, { thread_id: JSON.parse(raw || "{}").thread_id ?? "t1" });
  if (req.method === "POST" && /\/runs\/wait$/.test(path)) {
    const body = JSON.parse(raw || "{}");
    const msgs = body.input?.messages ?? [];
    const q = String(msgs[msgs.length - 1]?.content ?? "");
    console.log(`  구매 에이전트 ← ${q.slice(0, 80)}`);
    const a = await ask(q);
    return send(200, { messages: [...msgs.map((m) => ({ type: "human", content: m.content })), { type: "ai", content: a }] });
  }
  send(404, { detail: "Not Found" });
});
await new Promise((r) => agent.listen(AGENT_PORT, "127.0.0.1", r));

const info = { sap: { url: sap.v2, user: "hr.svc", password: "sap-pw" }, rest: { url: rest.url, specUrl: rest.specUrl, apiKey: "api-key-1" }, agent: { url: `http://127.0.0.1:${AGENT_PORT}`, assistantId: "purchase" } };
writeFileSync(join(HERE, ".demo-servers.json"), JSON.stringify(info, null, 2));
console.log("시연 상대 시스템 준비됨", JSON.stringify(info));
