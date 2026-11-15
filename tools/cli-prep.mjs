#!/usr/bin/env node
/*
 * AX-NAVI CLI 시연 준비 — PMS-X 표본 '인사시스템'(가상 레거시) 사본을 git 저장소로 만들고,
 * 개발자가 사원 목록에 정렬을 넣다가 MyBatis ${} 로 정렬 컬럼을 그대로 붙인 변경을 작업 트리에 둔다(axnavi review 가 잡을 것).
 *
 *   node tools/cli-prep.mjs <작업 폴더>        예: W:\hr-system — 있으면 지우고 다시 만든다
 *   SAMPLE=<표본 폴더> 로 표본 위치를 바꿀 수 있다(기본: PMS-X 저장소의 samples\hr-legacy)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const dest = process.argv[2];
if (!dest) throw new Error("작업 폴더를 주세요");
// 표본은 PMS-X 저장소의 samples/hr-legacy — 시연 키트 설정(e2e.config.json)의 PMS-X 패키지 위치(<pmsx>/deploy/out/…)에서 찾는다
const E2E_CONFIG = process.env.E2E_CONFIG ?? "C:/Users/onlys/hnix-ax-platform/e2e/e2e.config.json";
const SAMPLE = process.env.SAMPLE ?? resolve(dirname(JSON.parse(readFileSync(E2E_CONFIG, "utf8")).pmsx.package), "../../samples/hr-legacy");
if (!existsSync(join(SAMPLE, "src"))) throw new Error(`표본이 없습니다: ${SAMPLE}`);
rmSync(dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
mkdirSync(dest, { recursive: true });
// cpSync 는 한글 경로(바탕 화면)에서 Node 24 가 죽는다 — 직접 복사
const copy = (from, to) => {
  if (statSync(from).isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const n of readdirSync(from)) copy(join(from, n), join(to, n));
  } else copyFileSync(from, to);
};
for (const n of ["src", "db", "README.md"]) copy(join(SAMPLE, n), join(dest, n));
writeFileSync(join(dest, ".gitignore"), "_workspace/\n.axnavi/\n");

const git = (...a) => {
  const r = spawnSync("git", ["-c", "user.name=이개발", "-c", "user.email=dev1@example.com", "-c", "core.autocrlf=false", ...a], { cwd: dest, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
git("init", "-q", "-b", "main");
git("add", "-A");
git("commit", "-qm", "인사시스템 운영 기준");

// 정렬 기능 추가 — 화면에서 고른 컬럼을 ${} 로 그대로 붙였다(SQL 인젝션)
const f = join(dest, "src/main/resources/mapper/hr/EmpMapper.xml");
const before = readFileSync(f, "utf8");
const old = "         ORDER BY E.EMP_NO\n    </select>";
const eol = before.includes("\r\n") ? "\r\n" : "\n";
const src = before.replace(/\r\n/g, "\n");
if (!src.includes(old)) throw new Error("EmpMapper.xml 정렬 자리를 찾지 못했습니다");
const now = src.replace(
  old,
  [
    "        <choose>",
    "            <when test=\"sortCol != null and sortCol != ''\">",
    "         ORDER BY ${sortCol} ${sortDir}",
    "            </when>",
    "            <otherwise>",
    "         ORDER BY E.EMP_NO",
    "            </otherwise>",
    "        </choose>",
    "    </select>",
  ].join("\n"),
);
writeFileSync(f, now.replace(/\n/g, eol));
const vo = join(dest, "src/main/java/kr/go/hr/emp/service/EmpVO.java");
const v = readFileSync(vo, "utf8");
if (!v.includes("sortCol")) {
  const i = v.lastIndexOf("}");
  const add = `${eol}    /** 목록 정렬 — 화면에서 고른 컬럼과 방향 */${eol}    private String sortCol;${eol}    private String sortDir;${eol}    public String getSortCol() { return sortCol; }${eol}    public void setSortCol(String sortCol) { this.sortCol = sortCol; }${eol}    public String getSortDir() { return sortDir; }${eol}    public void setSortDir(String sortDir) { this.sortDir = sortDir; }${eol}`;
  writeFileSync(vo, v.slice(0, i) + add + v.slice(i));
}
console.log(git("status", "--short").trim());
console.log("준비:", dest);
