/*
 * AX-NAVI IDE 를 임시 프로필로 따로 띄워 DevTools 로 붙는다 — 사용자의 IDE·설정은 건드리지 않는다.
 * 사내 게이트웨이 연결은 E2E 와 같은 환경 변수로(AXNAVI_OPENAI_*), 키는 e2e/run/secrets.json 에서 읽는다.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";

// 설치본 대신 막 빌드한 IDE 로 찍을 때는 AXNAVI_IDE_EXE 로 실행 파일을 준다
const IDE = process.env.AXNAVI_IDE_EXE || "C:/Users/onlys/AppData/Local/Programs/AX-NAVI IDE/AX-NAVI IDE.exe";
const E2E = "C:/Users/onlys/hnix-ax-platform/e2e";

/*
 * IDE 는 로그인하면 이 PC 의 Claude Code 설정(~/.claude.json 의 MCP 'hnix-ax', ~/.claude/settings.json 의 사용량 전송 env)에
 * 그 기기의 키를 써 넣는다. 녹화용 임시 기기의 키가 사용자 설정에 남지 않게, 띄울 때 그 값만 기억해 두고 닫을 때 되돌린다.
 * (Claude CLI 가 그사이 .claude.json 에 쓴 다른 상태는 건드리지 않는다)
 */
const CLAUDE_STATE = join(homedir(), ".claude.json");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
function guardClaudeConfig() {
  const state = readJson(CLAUDE_STATE);
  const settings = readJson(CLAUDE_SETTINGS);
  const hub = state?.mcpServers?.["hnix-ax"];
  const env = { ...(settings?.env ?? {}) };
  return () => {
    const s = readJson(CLAUDE_STATE);
    if (s) {
      const servers = { ...(s.mcpServers ?? {}) };
      if (hub === undefined) delete servers["hnix-ax"];
      else servers["hnix-ax"] = hub;
      writeFileSync(CLAUDE_STATE, JSON.stringify({ ...s, mcpServers: servers }, null, 2));
    }
    const t = readJson(CLAUDE_SETTINGS);
    if (t && settings) writeFileSync(CLAUDE_SETTINGS, JSON.stringify({ ...t, env }, null, 2));
  };
}

/** env — 시나리오가 더 줄 환경 변수(예: AXNAVI_SELFTEST=login 이면 로그인 승인 주소를 브라우저 대신 출력 창에) */
export async function launchIde({ folder, env: extra = {}, port = 9560 + Math.floor(Math.random() * 300) }) {
  if (!existsSync(IDE)) throw new Error(`AX-NAVI IDE 가 없습니다: ${IDE}`);
  const restoreClaude = guardClaudeConfig();
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
  // 확인 대화상자를 OS 창이 아니라 화면 안에 — OS 대화상자는 화면 스크립트(DevTools)를 막고 녹화에도 안 찍힌다.
  // 작업 폴더 신뢰도 미리 꺼 둔다(값이 없으면 AX-NAVI 가 넣고 창을 다시 읽어 녹화가 끊긴다)
  writeFileSync(join(profile, "User", "settings.json"), JSON.stringify({ "window.dialogStyle": "custom", "security.workspace.trust.enabled": false }, null, 2));
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
  if (!target) {
    proc.kill();
    restoreClaude();
    throw new Error("IDE DevTools 에 붙지 못했습니다.");
  }
  return { port, profile, proc, target, restoreClaude };
}
