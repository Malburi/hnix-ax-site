"""AX-NAVI CLI 시연 녹화용 터미널 다리 — 진짜 PowerShell(pty)을 띄우고 브라우저(xterm.js)에 그대로 보여 준다.

  python tools/cli-bridge.py --port 8798 --cwd W:\\hr-system --env KEY=VALUE ...

  GET  /            xterm 화면(열 때마다 지금까지 출력을 처음부터 다시 그린다 — 브라우저로 다른 화면에 다녀와도 그대로)
  GET  /out?from=N  N 번째 글자부터의 출력 {"at": 끝 위치, "data": 글자}
  GET  /state       {"prompts": 프롬프트 수, "idle": 마지막 출력 뒤 초, "tail": 끝 2000자(색 코드 뺌)}
  POST /type        {"text": "...", "delay": 0.05} — 사람이 치듯 한 글자씩(엔터는 \\r)
  POST /quit        끝내기
cli_shot.py(그림)와 같은 방식 — 출력은 손대지 않고 실제 CLI 가 낸 그대로다.
"""
import argparse
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from winpty import PtyProcess

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=8798)
ap.add_argument("--cwd", required=True)
ap.add_argument("--cols", type=int, default=118)
ap.add_argument("--rows", type=int, default=34)
ap.add_argument("--title", default="Windows PowerShell")
ap.add_argument("--env", action="append", default=[])
ap.add_argument("--path-prepend", default="")
a = ap.parse_args()

import os  # noqa: E402

env = dict(os.environ)
for k in ("NO_COLOR", "FORCE_COLOR", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
    env.pop(k, None)
for kv in a.env:
    k, _, v = kv.partition("=")
    env[k] = v
if a.path_prepend:
    key = next((k for k in env if k.upper() == "PATH"), "PATH")
    env[key] = a.path_prepend + os.pathsep + env.get(key, "")
env.update({"TERM": "xterm-256color", "COLORTERM": "truecolor"})

proc = PtyProcess.spawn("powershell.exe -NoLogo -NoProfile", cwd=a.cwd, env=env, dimensions=(a.rows, a.cols))
buf: list[str] = []
lock = threading.Lock()
last = [time.time()]
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)|\x1b[()][0-9A-Za-z]|\x1b[=>]")
# 프롬프트 끝 공백은 pty 출력에서 빠질 때가 있다(커서 이동으로 그린다)
PROMPT = re.compile(r"PS [A-Z]:\\[^>\r\n]*>")


def reader():
    while proc.isalive():
        try:
            s = proc.read(65536)
        except Exception:
            break
        if s:
            with lock:
                buf.append(s)
                last[0] = time.time()


threading.Thread(target=reader, daemon=True).start()

PAGE = """<!doctype html><html><head><meta charset="utf-8"><title>AX-NAVI CLI</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
<script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
<style>
html,body{margin:0;height:100%;background:#1b2433;font-family:'Segoe UI','Malgun Gothic',sans-serif;overflow:hidden}
.win{position:absolute;left:50%;top:22px;transform:translateX(-50%);background:#0c0c0c;border-radius:10px;overflow:hidden;border:1px solid #39465a;box-shadow:0 18px 50px rgba(0,0,0,.45)}
.bar{height:36px;background:#202020;display:flex;align-items:center;gap:8px;padding:0 12px;color:#ddd;font-size:13px}
.tab{background:#0c0c0c;padding:8px 16px;border-radius:7px 7px 0 0;margin-top:7px;display:flex;gap:9px;align-items:center}
.tab i{width:14px;height:14px;border-radius:3px;background:#2d6fd6;display:inline-block}
.sp{flex:1}.dots{letter-spacing:16px;color:#aaa}
#t{padding:10px 12px 12px}
</style></head><body><div class="win" id="w"><div class="bar"><div class="tab"><i></i>__TITLE__</div><div class="sp"></div><span class="dots">─ □ ✕</span></div><div id="t"></div></div>
<script>
const term=new Terminal({cols:__COLS__,rows:__ROWS__,fontFamily:"'D2Coding','Cascadia Mono','Consolas','Malgun Gothic',monospace",fontSize:18,lineHeight:1.12,scrollback:5000,
 theme:{background:'#0c0c0c',foreground:'#cccccc',cursor:'#cccccc',black:'#0c0c0c',red:'#e74856',green:'#16c60c',yellow:'#f9f1a5',blue:'#3b78ff',magenta:'#b4009e',cyan:'#61d6d6',white:'#f2f2f2',
 brightBlack:'#767676',brightRed:'#e74856',brightGreen:'#16c60c',brightYellow:'#f9f1a5',brightBlue:'#3b78ff',brightMagenta:'#b4009e',brightCyan:'#61d6d6',brightWhite:'#f2f2f2'},allowProposedApi:true,cursorBlink:false});
term.open(document.getElementById('t'));
let at=0, busy=false;
async function poll(){ if(busy) return; busy=true; try{ const r=await fetch('/out?from='+at); const j=await r.json(); if(j.data){ await new Promise(ok=>term.write(j.data,ok)); } at=j.at; }catch(e){} busy=false; }
setInterval(poll,60); poll();
window.__term=term;
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, code, body, ctype="application/json; charset=utf-8"):
        b = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/":
            return self.send(200, PAGE.replace("__COLS__", str(a.cols)).replace("__ROWS__", str(a.rows)).replace("__TITLE__", a.title), "text/html; charset=utf-8")
        with lock:
            text = "".join(buf)
            idle = time.time() - last[0]
        if u.path == "/out":
            n = int(parse_qs(u.query).get("from", ["0"])[0])
            return self.send(200, json.dumps({"at": len(text), "data": text[n:]}))
        if u.path == "/state":
            plain = ANSI.sub("", text)
            return self.send(200, json.dumps({"prompts": len(PROMPT.findall(plain)), "idle": round(idle, 2), "tail": plain[-2000:], "alive": proc.isalive()}, ensure_ascii=False))
        self.send(404, "{}")

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get("content-length", "0") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        if u.path == "/type":
            delay = float(body.get("delay", 0.05))
            for ch in body.get("text", ""):
                proc.write(ch)
                time.sleep(delay if ch not in "\r\n" else 0.15)
            return self.send(200, "{}")
        if u.path == "/quit":
            self.send(200, "{}")
            try:
                proc.terminate(force=True)
            except Exception:
                pass
            threading.Thread(target=srv.shutdown, daemon=True).start()
            return
        self.send(404, "{}")


srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
print(f"bridge http://127.0.0.1:{a.port}/", flush=True)
srv.serve_forever()
