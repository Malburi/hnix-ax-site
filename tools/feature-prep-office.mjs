// 기능 영상 AX-DataLake ④(엑셀 · 비정형 문서 · 문서 → 표 AI) 준비 — E2E 환경(start.ps1)이 떠 있을 때
//   node tools/feature-prep-office.mjs
// - 문서 묶음 office-docs(운영·영업 문서, 대외비, 글자 인식)에 demo-files/office 의 여섯 문서를 올린다
// - '계약 요약' 추출 정의를 만들어 한 번 돌려 둔다(영상에서 모델이 틀린 칸을 고쳐 승인한다)
// - 영상에서 새로 만들 '견적서 요약' 정의와 지난 녹화의 결과·E2E 점검 묶음(e2e-office)은 지워 화면을 깨끗이
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const D = "http://127.0.0.1:8790";
const FILES = fileURLToPath(new URL("./demo-files/office", import.meta.url));
const log = (s) => console.log(`  · ${s}`);

async function login(loginId) {
  const r = await fetch(`${D}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loginId, password: "Lake!2026" }) });
  if (!r.ok) throw new Error(`AX-DataLake ${loginId} 로그인 실패(${r.status})`);
  return (await r.json()).accessToken;
}
function client(token) {
  return async (method, path, body, ok = []) => {
    const r = await fetch(`${D}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) },
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (!r.ok && !ok.includes(r.status)) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}

const admin = client(await login("admin"));
const eng = client(await login("eng"));

// 지난 녹화·점검의 정의를 지운다(테이블은 남는다)
const { extracts } = await eng("GET", "/doc-extracts");
for (const x of extracts.filter((e) => ["quote-demo", "contract-demo", "e2e-quote"].includes(e.name))) {
  await eng("DELETE", `/doc-extracts/${x.id}`);
  log(`추출 정의 ${x.name} 지움`);
}
const { collections } = await admin("GET", "/doc-collections");
for (const c of collections.filter((c) => ["e2e-office", "office-docs"].includes(c.name))) {
  await admin("DELETE", `/doc-collections/${c.id}`);
  log(`문서 묶음 ${c.name} 지움`);
}

// 문서 묶음 — 올린 파일만(폴더 없음)
const col = await admin("POST", "/doc-collections", {
  name: "office-docs",
  label: "운영·영업 문서",
  description: "견적서 PDF · 계약서 Word · 장애 보고 PPT · 운영 실적 엑셀 · 점검표 스캔 · 회의록 (가상 회사·가짜 개인정보)",
  targetSchema: "docs",
  targetTable: "office_docs",
  dataClass: "confidential",
  ocr: true,
});
for (const f of readdirSync(FILES)) {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(join(FILES, f))]), f);
  const r = await eng("POST", `/doc-collections/${col.id}/upload`, form);
  log(`${f} → ${r.status} · 조각 ${r.chunks} · 개인정보 ${JSON.stringify(r.pii)}`);
}

// 계약 요약 — 돌려서 검토 대기로 둔다
const contract = await eng("POST", "/doc-extracts", {
  name: "contract-demo",
  label: "계약 요약",
  collectionId: col.id,
  targetSchema: "extract",
  targetTable: "contracts",
  pathFilter: "*계약서*",
  fields: [
    { name: "계약상대", type: "text", description: "계약 상대 회사(갑)" },
    { name: "시작일", type: "date", description: "계약 기간 시작" },
    { name: "종료일", type: "date", description: "계약 기간 끝" },
    { name: "월금액", type: "number", description: "월 유지보수 대가, 숫자만" },
    { name: "자동연장", type: "boolean", description: "자동 연장 조항이 있으면 true" },
    { name: "복구시간", type: "text", description: "1등급 장애 복구 기한" },
  ],
});
const run = await eng("POST", `/doc-extracts/${contract.id}/run`, { wait: true, full: true });
const items = (await eng("GET", `/doc-extracts/${contract.id}/items?status=pending`)).items;
log(`계약 요약 — ${JSON.stringify(run.stats)} · 검토 대기 ${JSON.stringify(items.map((i) => i.rows))}`);
console.log("✓ feature-prep-office");
