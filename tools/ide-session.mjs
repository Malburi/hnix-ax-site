/*
 * AX-NAVI IDE 를 임시 프로필로 따로 띄워 DevTools 로 붙는다 — 사용자의 IDE·설정은 건드리지 않는다.
 * 사내 게이트웨이 연결은 E2E 와 같은 환경 변수로(AXNAVI_OPENAI_*), 키는 e2e/run/secrets.json 에서 읽는다.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// 설치본 대신 막 빌드한 IDE 로 찍을 때는 AXNAVI_IDE_EXE 로 실행 파일을 준다
const IDE = process.env.AXNAVI_IDE_EXE || "C:/Users/onlys/AppData/Local/Programs/AX-NAVI IDE/AX-NAVI IDE.exe";
const E2E = "C:/Users/onlys/hnix-ax-platform/e2e";

/** env — 시나리오가 더 줄 환경 변수(예: AXNAVI_SELFTEST=login 이면 로그인 승인 주소를 브라우저 대신 출력 창에) */
export async function launchIde({ folder, env: extra = {}, port = 9560 + Math.floor(Math.random() * 300) }) {
  if (!existsSync(IDE)) throw new Error(`AX-NAVI IDE 가 없습니다: ${IDE}`);
  const secrets = JSON.parse(readFileSync(join(E2E, "run", "secrets.json"), "utf8"));
  const cfg = JSON.parse(readFileSync(join(E2E, "e2e.config.json"), "utf8"));
  const profile = mkdtempSync(join(tmpdir(), "hnix-ide-demo-"));
  // 플랫폼 MCP 허브 등록(사용자 프로필의 설정 파일을 복사 — 원본은 그대로)
  const mcp = join(process.env.APPDATA, "AX-NAVI IDE", "User", "globalStorage", "hnix.axnavi", "settings", "mcp_settings.json");
  if (existsSync(mcp)) {
    const to = join(profile, "User", "globalStorage", "hnix.axnavi", "settings", "mcp_settings.json");
    mkdirSync(dirname(to), { recursive: true });
    cpSync(mcp, to);
  }
  mkdirSync(join(profile, "User"), { recursive: true });
  const env = {
    ...process.env,
    HNIX_AX_SERVER: cfg.platform.url,
    HNIX_AX_KEY: secrets.ideIngest,
    AXNAVI_OPENAI_BASE_URL: `${cfg.platform.url}/v1`,
    AXNAVI_OPENAI_API_KEY: secrets.ideLlm,
    AXNAVI_OPENAI_MODEL: "hnix-local",
    ...extra,
  };
  const proc = spawn(IDE, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--locale=ko", "--disable-workspace-trust", "--skip-welcome", "--new-window", folder], { env, stdio: "ignore", detached: false });
  let target;
  for (let i = 0; i < 120 && !target; i++) {
    await new Promise((r) => setTimeout(r, 500));
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === "page" && /workbench/.test(t.url)), () => null);
  }
  if (!target) throw new Error("IDE DevTools 에 붙지 못했습니다.");
  return { port, profile, proc, target };
}
