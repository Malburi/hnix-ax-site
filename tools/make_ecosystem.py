"""HNIX AX AI 생태계 draw.io — 소개 사이트·시연회용.
쪽 1 한눈에 보기 · 쪽 2 운영 워크플로우(장애 하나가 지식이 되기까지) · 쪽 3 개발·전환 워크플로우 · 쪽 4 AI 거버넌스(통제 지점 넷)
사용: python tools/make_ecosystem.py  → download/hnix-ax-ecosystem.drawio
그림(PNG)은 python tools/render_drawio.py download/hnix-ax-ecosystem.drawio img/ecosystem 4
"""
import os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "download", "hnix-ax-ecosystem.drawio"))

C = {
    "navi": ("#1B3893", "#E8EDFA"),
    "pmsx": ("#139D43", "#E7F6EC"),
    "plat": ("#5B3FA0", "#EFEBFA"),
    "lake": ("#126E82", "#E4F3F6"),
    "model": ("#B26A00", "#FFF4E0"),
    "ext": ("#666666", "#F5F5F5"),
    "people": ("#8A3B12", "#FBEDE5"),
}
LEGEND = ("<font color='#5B3FA0'>■</font> AX Platform　<font color='#139D43'>■</font> PMS-X　<font color='#1B3893'>■</font> AX-NAVI　"
          "<font color='#126E82'>■</font> AX-DataLake　<font color='#B26A00'>■</font> 모델　<font color='#8A3B12'>■</font> 사람　<font color='#666666'>■</font> 고객 시스템")


class Page:
    def __init__(self, name, pid, width=1800, height=1100):
        self.name, self.pid, self.cells, self.n, self.width, self.height = name, pid, [], 0, width, height

    def _id(self):
        self.n += 1
        return f"{self.pid}-{self.n}"

    def group(self, x, y, w, h, title, kind, font=15):
        stroke, fill = C[kind]
        cid = self._id()
        style = (f"rounded=1;arcSize=3;whiteSpace=wrap;html=1;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;"
                 f"fontStyle=1;fontSize={font};strokeColor={stroke};fillColor={fill};strokeWidth=2;fontColor={stroke};")
        self.cells.append((cid, "vertex", style, title, (x, y, w, h)))
        return cid

    def box(self, x, y, w, h, text, kind, shape="box", size=13):
        stroke, fill = C[kind]
        cid = self._id()
        lines = text.split("\n")
        html = f"<b>{escape(lines[0])}</b>" + "".join(f"<br><font style='font-size:11px' color='#333333'>{escape(l)}</font>" for l in lines[1:])
        base = f"whiteSpace=wrap;html=1;strokeColor={stroke};fillColor=#FFFFFF;fontSize={size};fontColor=#1B2340;"
        if shape == "db":
            style = "shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;" + base
        elif shape == "actor":
            style = "rounded=1;arcSize=40;" + base.replace("fillColor=#FFFFFF", f"fillColor={fill}")
        elif shape == "step":
            style = "rounded=1;arcSize=10;strokeWidth=2;" + base
        else:
            style = "rounded=1;arcSize=8;" + base
        self.cells.append((cid, "vertex", style, html, (x, y, w, h)))
        return cid

    def band(self, x, y, w, h, title, kind):
        stroke, fill = C[kind]
        cid = self._id()
        style = (f"rounded=0;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth=1;fontStyle=1;fontSize=13;"
                 f"fontColor={stroke};align=left;verticalAlign=middle;spacingLeft=10;")
        self.cells.append((cid, "vertex", style, title, (x, y, w, h)))
        return cid

    def text(self, x, y, w, h, html, size=12, align="left"):
        cid = self._id()
        style = f"text;html=1;whiteSpace=wrap;align={align};verticalAlign=top;fontSize={size};fontColor=#1B2340;"
        self.cells.append((cid, "vertex", style, html, (x, y, w, h)))
        return cid

    def edge(self, s, t, label="", kind="ext", dashed=False, points=(), exit=None, entry=None, both=False, width=1.6):
        color = C[kind][0]
        cid = self._id()
        style = (f"edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor={color};strokeWidth={width};fontSize=11;"
                 f"fontColor={color};labelBackgroundColor=#FFFFFF;endArrow=block;endFill=1;")
        if both:
            style += "startArrow=block;startFill=1;"
        if dashed:
            style += "dashed=1;"
        if exit:
            style += f"exitX={exit[0]};exitY={exit[1]};exitDx=0;exitDy=0;"
        if entry:
            style += f"entryX={entry[0]};entryY={entry[1]};entryDx=0;entryDy=0;"
        self.cells.append((cid, "edge", style, escape(label), (s, t, list(points))))
        return cid

    def xml(self):
        out = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
        for cid, kind, style, value, geo in self.cells:
            v = escape(value, {'"': "&quot;"})
            if kind == "vertex":
                x, y, w, h = geo
                out.append(f'<mxCell id="{cid}" value="{v}" style="{style}" vertex="1" parent="1">'
                           f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
            else:
                s, t, pts = geo
                arr = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in pts)
                ptxml = f'<Array as="points">{arr}</Array>' if pts else ""
                out.append(f'<mxCell id="{cid}" value="{v}" style="{style}" edge="1" parent="1" source="{s}" target="{t}">'
                           f'<mxGeometry relative="1" as="geometry">{ptxml}</mxGeometry></mxCell>')
        return (f'<diagram name="{escape(self.name)}" id="{self.pid}">'
                f'<mxGraphModel dx="{self.width}" dy="{self.height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
                f'fold="1" page="1" pageScale="1" pageWidth="{self.width}" pageHeight="{self.height}" math="0" shadow="0">'
                f"<root>{''.join(out)}</root></mxGraphModel></diagram>")


# =====================================================================
# 쪽 1 — 한눈에 보기
# =====================================================================
p = Page("1. AI 생태계 한눈에", "eco", height=1130)
p.text(20, 6, 1200, 50, "<b style='font-size:24px'>HNIX AX — 통합 ITO AI 생태계</b>"
       "<br><font color='#555555'>사람 여섯 역할이 제품 넷을 쓰고, 모든 AI 호출·도구 호출·데이터 조회가 한 기반(게이트웨이·허브·거버넌스)을 지난다. 고객망 안에 설치</font>", 13)
p.text(1250, 14, 540, 40, LEGEND, 11)

# 사람
p.group(20, 80, 220, 880, "사람", "people")
who = {}
for i, (k, t) in enumerate([
    ("biz", "현업 · 고객\n현업 창구 · 고객 포털\n문의 · 요청 · 승인"),
    ("ops", "운영자 (L1 · L2)\nPMS-X SM · 런북 · 승인함\n장애 · SR · 조치"),
    ("dev", "개발자\nAX-NAVI IDE · CI\n분석 · 수정 · 리뷰"),
    ("pm", "PM · PMO\nPMS-X 프로젝트 관리\n공정 · 품질 · 보고"),
    ("ana", "데이터 분석가\nAX-DataLake · AI 질문\n지표 · 원인 분석"),
    ("adm", "관리자 · 보안\n게이트웨이·허브 정책\n키 · 감사 · 관측"),
]):
    who[k] = p.box(35, 120 + i * 140, 190, 100, t, "people", shape="actor")

# 제품 넷
g_pl = p.group(270, 80, 640, 420, "AX Platform — 공통 AI 기반  :8700", "plat")
pl = {}
for k, (x, y, t) in {
    "gw": (285, 120, "LLM 게이트웨이\n가상 키 · 예산 · PII 가명화\n등급별 라우팅(기밀 → 사내 모델)"),
    "hub": (595, 120, "MCP 허브 · 승인함\n정책 allow/deny/approve\n인자 점검 · 호출 감사"),
    "agent": (285, 220, "에이전트 · 트리거\n경보 웹훅 · 예약 · 감시\nITO 템플릿 · A2A"),
    "desk": (595, 220, "현업 창구\n매뉴얼·KB 근거 답변\n못 찾으면 SR 접수"),
    "rb": (285, 320, "런북\n요청 → 다른 사람 승인\n→ 실행 · 기록"),
    "ins": (595, 320, "Insight · 생산성\n주체별 사용량 · 커밋↔SR\n전사 AI 관측"),
    "rag": (285, 420, "문서 RAG · 모델 평가\nFTS + 벡터 · 정답 세트"),
    "org": (595, 420, "조직 설정 · 현장 점검\nAX-NAVI 정책 배포 · 연결 시험"),
}.items():
    pl[k] = p.box(x, y, 300, 90 if k not in ("rag", "org") else 66, t, "plat")

g_px = p.group(940, 80, 600, 420, "PMS-X — 관리 · 운영  :8080", "pmsx")
px = {}
for k, (x, y, t) in {
    "asis": (955, 120, "As-Is 분석\n화면→버튼→함수→SQL→테이블\n순서도 · 통합 추적 · ERD"),
    "pm": (1250, 120, "프로젝트 관리\nWBS · 공정준수율 · 칸반\n테스트·결함 · 산출물"),
    "sm": (955, 220, "SM 운영\nSR · SLA · 장애 · 문제 · 변경\n경보 → 장애·SR 자동 생성"),
    "ho": (1250, 220, "인수인계 · 구현 명세\nSI→SM 마법사 · 갭 · 퀴즈\nSR → 명세 MD·JSON"),
    "ai": (955, 320, "AI 보조(켤 때만)\nSR 분류·배정 추천 · KB 초안\n설명 초안(근거 등급)"),
    "tpl": (1250, 320, "업무 템플릿 · 보고\n처리 절차 체크 · 월간 보고\n고객 포털"),
}.items():
    px[k] = p.box(x, y, 275, 90, t, "pmsx")
px_db = p.box(955, 420, 570, 66, "PMS-X DB — Oracle · Tibero · PostgreSQL · SQL Server", "pmsx", shape="db")

g_nv = p.group(270, 530, 640, 420, "AX-NAVI — 개발 (IDE · CLI)", "navi")
nv = {}
for k, (x, y, t) in {
    "ide": (285, 570, "AX-NAVI IDE\n채팅 에이전트 · / 스킬\nArchitect · Code · Debug"),
    "rev": (595, 570, "변경 리뷰 · 보안 점검\nGO / HOLD / STOP\nOWASP Findings · AI로 고치기"),
    "sdlc": (285, 670, "SDLC 산출물 · 단계 게이트\n요구 → 설계 → 개발 → 테스트"),
    "cli": (595, 670, "CLI 판정 엔진 · CI 게이트\nindex · review · gate\n모델 없이 폐쇄망 CI"),
    "mod": (285, 770, "현대화 · 테스트\nJava 21 · Oracle→PG 변환\n테스트 생성 · 커버리지"),
    "idx": (595, 770, "전수 색인(AI 없음)\n호출 그래프 · SQL · 트랜잭션"),
}.items():
    nv[k] = p.box(x, y, 300, 90, t, "navi", shape="db" if k == "idx" else "box")
nv_cc = p.box(285, 870, 610, 66, "Claude Code — 개발자 본인 구독 로그인(자격은 PC 밖으로 안 나감) · 조직 키는 게이트웨이로", "navi")

g_dl = p.group(940, 530, 600, 420, "AX-DataLake — 데이터  :8790", "lake")
dl = {}
for k, (x, y, t) in {
    "ing": (955, 570, "수집 · 커넥터\nOracle · SQL Server · PG · MySQL\nSnowflake · REST · 폴더/S3 · Kafka"),
    "gov": (1250, 570, "거버넌스\nSQL 구조 검사 · 권한\n개인정보 가림 · 소속 행 제한"),
    "onto": (955, 670, "온톨로지 · 액션\n장애 → 직전 72시간 변경\n메모 · 진단 요청(승인 뒤)"),
    "lin": (1250, 670, "계보 · 영향 범위\n원본 → 테이블 → 객체 → 소비"),
    "ask": (955, 770, "AI 질문 · MCP\n자연어 → SQL(구조만 전송)\n에이전트도 같은 규칙"),
    "lake": (1250, 770, "레이크 저장\nParquet + DuckLake\n시점 조회 · 바뀐 행"),
}.items():
    dl[k] = p.box(x, y, 275, 90, t, "lake", shape="db" if k == "lake" else "box")
dl_note = p.box(955, 870, 570, 66, "사람·에이전트·AI 질문 — 모두 같은 권한·가림·행 제한, 누가 어느 길로 읽었는지 기록", "lake")

# 고객 시스템
p.group(1570, 80, 210, 880, "고객 시스템", "ext")
ext = {}
for i, (k, t) in enumerate([
    ("mon", "모니터링\nZabbix · Prometheus\n관제 경보"),
    ("itsm", "ITSM · 메신저\nServiceNow · Jira\nTeams · Slack"),
    ("db", "업무 DB · DW\nERP · MES · HR\nSnowflake"),
    ("kafka", "Kafka · 이벤트\nDebezium CDC\n로그 수집"),
    ("git", "Git · CI\nGitLab 머지 요청\n커밋 훅"),
    ("a2a", "외부 에이전트\n타사 에이전트 플랫폼\nA2A"),
]):
    ext[k] = p.box(1585, 120 + i * 140, 180, 100, t, "ext")

# 모델
g_m = p.group(270, 980, 1270, 130, "모델 — 게이트웨이 뒤, 별칭으로만", "model")
m1 = p.box(290, 1020, 390, 72, "Claude (조직 API 키)\n계량 · 예산 · PII 가명화 후 전송", "model")
m2 = p.box(710, 1020, 390, 72, "사내 GPU 모델\nvLLM · Ollama — 기밀 등급은 여기만", "model")
m3 = p.box(1130, 1020, 390, 72, "Claude 개인 구독\n개발자 본인 claude CLI — 서버 중계 없음", "model")

# 제품 사이 — 그룹 사이 빈 통로로만 지난다
p.edge(g_pl, g_px, "pmsx__*", "plat", both=True, exit=(1, 0.45), entry=(0, 0.45))
p.edge(g_pl, g_nv, "axnavi__*", "plat", both=True, exit=(0.5, 1), entry=(0.5, 0))
p.edge(g_pl, g_dl, "datalake__*", "plat", both=True, exit=(1, 0.95), entry=(0.5, 0), points=[(925, 479), (925, 515), (1240, 515)])
p.edge(g_pl, g_m, "모든 모델 호출", "model", exit=(0, 0.2), entry=(0, 0.5), points=[(255, 164), (255, 1045)])
p.edge(g_nv, m3, "개인 구독(본인 PC)", "navi", exit=(0.5, 1), entry=(0.5, 0), points=[(590, 965), (1325, 965)])
# 고객 시스템
p.edge(ext["mon"], g_px, "경보", "ext", exit=(0, 0.5), entry=(1, 0.214))
p.edge(ext["itsm"], g_px, "ITSM", "ext", both=True, dashed=True, exit=(0, 0.5), entry=(1, 0.548))
p.edge(ext["db"], g_dl, "동기화", "ext", exit=(0, 0.5), entry=(1, 0.119), points=[(1555, 450), (1555, 580)])
p.edge(ext["kafka"], g_dl, "", "ext", exit=(0, 0.5), entry=(1, 0.262), points=[(1560, 590), (1560, 640)])
p.edge(ext["git"], g_nv, "머지 요청 게이트", "ext", exit=(0, 0.5), entry=(0.28, 1), points=[(1550, 770), (1550, 972), (449, 972)])
p.edge(ext["a2a"], g_pl, "A2A", "ext", both=True, dashed=True, exit=(1, 0.5), entry=(0.25, 0), points=[(1792, 910), (1792, 66), (430, 66)])

# =====================================================================
# 쪽 2 — 운영 워크플로우
# =====================================================================
q = Page("2. 운영 워크플로우 — 장애 하나가 지식이 되기까지", "ops", height=1050)
q.text(20, 6, 1400, 50, "<b style='font-size:24px'>운영 워크플로우 — 새벽 경보 하나가 지식이 되기까지</b>"
       "<br><font color='#555555'>번호는 통합 점검(E2E) 단계. 사람은 판단·승인만, 찾고·모으고·기록하는 일은 에이전트와 제품이 한다</font>", 13)
q.text(1250, 14, 540, 40, LEGEND, 11)
LANES = [("고객 · 현업", "ext", 70, 120), ("AX Platform", "plat", 190, 150), ("모델", "model", 340, 90),
         ("AX-DataLake", "lake", 430, 150), ("PMS-X", "pmsx", 580, 150), ("AX-NAVI · 개발자", "navi", 730, 150)]
lane = {}
for name, kind, y, h in LANES:
    q.band(20, y, 1760, h, name, kind)
    lane[kind] = (y, h)
X0, CW, W = 150, 182, 168


def node(kind, col, text, w=W, h=None, dx=0):
    y, lh = lane[kind]
    hh = h or (lh - 24)
    return q.box(X0 + col * CW + dx, y + (lh - hh) / 2, w, hh, text, kind, shape="step")


def cx(col, f=0.5):
    return X0 + col * CW + W * f


def cy(kind):
    y, h = lane[kind]
    return y + h / 2


a_mon = node("ext", 0, "모니터링 경보\n02:13 결제 DB 응답 지연\ncritical", h=90)
a_biz = node("ext", 3, "현업 문의\n\"결제가 느려요\"\n창구에 한 줄", h=90)
s10 = node("plat", 0, "⑩ 트리거\n경보 웹훅이 경보 진단\n에이전트를 깨움(사람 없이)")
gwy = node("plat", 1, "게이트웨이\nPII 가명화 · 등급 라우팅\n본문 저장 안 함")
s11 = node("plat", 3, "⑪ 현업 창구\n매뉴얼·KB 근거로 답\n같은 장애면 SR에 연결")
s4 = node("plat", 4, "④⑫ 승인함 · 런북\n진단 요청·조치 요청\n다른 사람이 승인 → 실행")
s13 = node("plat", 6, "⑬ 생산성\n커밋 ↔ SR 연결\nAI 관여 표시")
s9 = node("plat", 7, "⑨⑮ Insight\n주체별 AI 사용·비용\n월간 보고 · 전사 AI 관측", w=W + CW)
mdl = node("model", 1, "사내 모델 · Claude\n별칭으로만", w=140, h=66, dx=70)
s20 = node("lake", 2, "⑳ 온톨로지\n장애 → 같은 구성 요소의\n직전 72시간 변경 2건")
s19 = node("lake", 7, "⑲ 운영 데이터\n장애·변경·SR 적재\nAI 질문 · 계열사별 추세")
lin = node("lake", 8, "계보 · 영향 범위\n원본이 바뀌면\n어디까지 가나")
s1 = node("pmsx", 0, "① 경보 접수\n장애·SR 자동 생성\n같은 경보는 하나로")
s2 = node("pmsx", 1, "② 분류·배정 추천\n유형·우선순위·담당자\n사람이 확정")
s5 = node("pmsx", 3, "⑤⑥ 화면 분석 · 명세\n버튼→SQL→테이블 영향\n구현 명세 MD·JSON")
s8 = node("pmsx", 7, "⑧ SR 종료 → KB\n증상·원인·조치·재발 방지\n사람이 확인 후 등록")
s7 = node("navi", 4, "⑦ 영향 분석 · 수정\n색인 근거 /impact\n리뷰 STOP → 수정 → GO")
s7b = node("navi", 5, "CI 게이트\n머지 요청에 review·gate\n종료 코드로 차단")

q.edge(a_mon, s10, "웹훅", "ext")
q.edge(a_mon, s1, "웹훅", "ext", exit=(0, 0.5), entry=(0, 0.5), points=[(142, cy("ext")), (142, cy("pmsx"))])
q.edge(s10, s20, "허브 datalake__*", "plat", exit=(0.5, 1), entry=(0, 0.5), points=[(cx(0), cy("lake"))])
q.edge(s20, s4, "진단 요청 → 승인 대기", "lake", exit=(1, 0.5), entry=(0.5, 1), points=[(cx(4), cy("lake"))])
q.edge(s1, s2, "", "pmsx")
q.edge(s2, gwy, "AI 추천", "pmsx", exit=(0.2, 0), entry=(0.2, 1))
q.edge(gwy, mdl, "", "model", both=True, exit=(0.8, 1), entry=(0.5, 0), points=[(cx(1, 0.8), 350)])
q.edge(a_biz, s11, "", "ext")
q.edge(s11, s2, "SR 접수", "plat", dashed=True, exit=(0.5, 1), entry=(0.8, 0), points=[(cx(3), 574), (cx(1, 0.8), 574)])
q.edge(s2, s5, "", "pmsx")
q.edge(s5, s7, "명세 전달", "pmsx", dashed=True, exit=(0.5, 1), entry=(0, 0.5), points=[(cx(3), cy("navi"))])
q.edge(s7, s7b, "", "navi")
q.edge(s7b, s13, "커밋 훅", "navi", exit=(1, 0.3), entry=(0.5, 1), points=[(cx(6), lane["navi"][0] + 50)])
q.edge(s7b, s8, "배포 · SR 종료", "navi", exit=(1, 0.75), entry=(0.5, 1), points=[(cx(7), lane["navi"][0] + 106)])
q.edge(s8, s19, "적재", "pmsx")
q.edge(s19, s9, "", "lake", exit=(0.5, 0), entry=(0.25, 1))
q.edge(s19, lin, "", "lake")
q.edge(s4, s9, "모든 실행·승인 기록", "plat", dashed=True, exit=(0.5, 0), entry=(0.5, 0), points=[(cx(4), 196), (cx(7) + CW / 2, 196)])

q.text(20, 895, 1760, 130,
       "<b>사람이 하는 일</b> — ② 배정 확정 · ④ 진단·조치 승인(요청자는 스스로 승인 불가) · ⑦ 수정과 리뷰 판단 · ⑧ KB 확정. "
       "<b>제품이 하는 일</b> — 경보를 장애로 묶고, 에이전트가 레이크 온톨로지에서 직전 변경을 찾고, 영향 범위를 색인으로 보이고, 커밋을 SR에 잇고, 사용량을 모은다.<br><br>"
       "<b>지키는 것</b> — 모델 호출은 게이트웨이(기밀은 사내 모델만) · 도구 호출은 허브(정책·승인·감사) · 데이터는 레이크 거버넌스(가림·행 제한) — 에이전트도 사람과 같은 규칙", 12)

# =====================================================================
# 쪽 3 — 개발 · 전환 워크플로우
# =====================================================================
r = Page("3. 개발 · 전환 워크플로우 — SI에서 SM으로, 레거시에서 현대화로", "dev", height=900)
r.text(20, 6, 1500, 50, "<b style='font-size:24px'>개발 · 전환 워크플로우 — 낯선 레거시를 넘겨받아 안전하게 고치기까지</b>"
       "<br><font color='#555555'>분석은 AI 없이 전수로(결정론), 판단은 근거와 함께, 변경은 게이트를 지나서</font>", 13)
r.text(1250, 14, 540, 40, LEGEND, 11)
L3 = [("PMS-X", "pmsx", 80, 170), ("AX-NAVI", "navi", 260, 170), ("AX-DataLake", "lake", 440, 150), ("AX Platform", "plat", 600, 150)]
lane3 = {}
for name, kind, y, h in L3:
    r.band(20, y, 1760, h, name, kind)
    lane3[kind] = (y, h)


def node3(kind, col, text, w=190, h=None):
    y, lh = lane3[kind]
    hh = h or (lh - 30)
    return r.box(150 + col * 205, y + (lh - hh) / 2, w, hh, text, kind, shape="step")


d1 = node3("pmsx", 0, "1 수집\n고객망 PC의 collector\n소스·DB 메타·화면 캡처")
d2 = node3("pmsx", 1, "2 As-Is 분석\n화면→버튼→함수→SQL\n→테이블 그래프 · ERD")
d3 = node3("pmsx", 2, "3 인수인계\n갭 리포트 · 준비도\n질문 목록 · 퀴즈")
d4 = node3("navi", 1, "4 전수 색인\n호출 그래프 · SQL 사용처\n트랜잭션 · 데드 코드")
d5 = node3("navi", 3, "5 SDLC 산출물\n요구 → 설계 → 개발 → 테스트\n단계 게이트")
d6 = node3("navi", 4, "6 수정 · 현대화\nJava 21 · jakarta\nOracle → PG 자동 변환")
d7 = node3("navi", 5, "7 리뷰 · 테스트\nGO/HOLD/STOP · OWASP\n테스트 생성 · 커버리지")
d8 = node3("pmsx", 6, "8 산출물 현행화\n구현 명세 · 프로그램 대장\n위키 · 추적성")
d9 = node3("lake", 2, "레거시 데이터\n원본 DB 읽기 전용 동기화\nOracle · SQL Server")
d10 = node3("lake", 5, "계보 · 영향 범위\n테이블이 바뀌면\n파생·객체·소비 경로까지")
d11 = node3("plat", 3, "공통 기반\n게이트웨이(모델) · 허브(도구)\n조직 설정 배포")
d12 = node3("plat", 6, "생산성 · 관측\n커밋 ↔ SR · AI 관여\n현대화 진척")
r.edge(d1, d2, "결과 zip", "pmsx")
r.edge(d2, d3, "", "pmsx")
r.edge(d2, d4, "같은 저장소", "pmsx", dashed=True, exit=(0.5, 1), entry=(0.5, 0))
r.edge(d3, d5, "구현 명세", "pmsx", dashed=True, exit=(0.5, 1), entry=(0, 0.3), points=[(632, 325)])
r.edge(d4, d5, "", "navi")
r.edge(d5, d6, "", "navi")
r.edge(d6, d7, "", "navi")
r.edge(d7, d8, "자동 현행화", "navi", exit=(0.5, 0), entry=(0.5, 1))
r.edge(d9, d6, "데이터 영향", "lake", dashed=True, exit=(1, 0.3), entry=(0.3, 1), points=[(1017, 487)])
r.edge(d6, d10, "스키마 변경", "navi", dashed=True, exit=(0.7, 1), entry=(0.3, 0), points=[(1117, 440)])
r.edge(d11, d5, "모델 · 도구", "plat", dashed=True, exit=(0.5, 0), entry=(0.5, 1))
r.edge(d7, d12, "커밋 훅", "navi", exit=(1, 0.7), entry=(0.5, 0), points=[(1395, 395), (1395, 615)])
r.text(20, 770, 1760, 110,
       "<b>왜 다른가</b> — 코드 이해는 사람이 고른 파일을 AI가 요약하는 것이 아니라 스크립트가 전수로 뽑은 그래프에서 시작한다(분석에 모델 호출 0회). "
       "판정은 근거 파일을 요구하고, 변경은 리뷰·게이트를 지나며, 산출물은 코드에서 다시 만든다. 데이터 쪽 영향은 레이크 계보가, 인수인계 이해도는 퀴즈가 확인한다.", 12)

# =====================================================================
# 쪽 4 — AI 거버넌스 — 통제 지점 넷
# =====================================================================
g = Page("4. AI 거버넌스 — 통제 지점 넷", "gov", height=820)
g.text(20, 6, 1500, 50, "<b style='font-size:24px'>AI 거버넌스 — 무엇이 AI를 쓰든, 지나는 문은 넷</b>"
       "<br><font color='#555555'>사람·에이전트·IDE·외부 에이전트가 모두 같은 통제 지점을 지난다. 문 밖으로 새는 길(본문 저장·자격 증명 전달)은 만들지 않는다</font>", 13)
callers = [("현업·운영자\n웹 화면", "people"), ("개발자\nAX-NAVI IDE · Claude Code", "navi"), ("플랫폼 에이전트\n트리거·템플릿", "plat"),
           ("PMS-X AI 보조\n켤 때만", "pmsx"), ("외부 에이전트\nA2A · MCP 클라이언트", "ext")]
cs = [g.box(60 + i * 340, 90, 300, 70, t, k, shape="actor") for i, (t, k) in enumerate(callers)]
g.band(20, 200, 1760, 330, "통제 지점", "plat")
gates = [
    ("① 모델 — LLM 게이트웨이", "가상 키 · 분당 한도 · 예산\n한국형 PII 가명화 · 마스킹\n데이터 등급 restricted → 사내 모델만\n요청·응답 본문은 저장하지 않음", "plat"),
    ("② 도구 — MCP 허브", "정책 allow / deny / approve\n인자 점검 · 스키마 drift 차단\n승인함(같은 인자 1회, 본인 승인 불가)\n호출 감사(인자 이름·크기만)", "plat"),
    ("③ 데이터 — 레이크 거버넌스", "SQL 구조 검사 · 테이블 권한\n개인정보 형식별 부분 가림\n소속 행 제한 · 액션 승인\n누가 어느 길로 읽었나 기록", "lake"),
    ("④ 사용 — Insight · 감사", "호출 주체별 토큰·비용\n정책 위반 · 도구 성공률\n전사 AI 관측(대장에 없는 AI)\n감사 로그 · 월간 보고", "plat"),
]
gs = [g.box(60 + i * 430, 250, 390, 250, f"{t}\n{d}", k, size=15) for i, (t, d, k) in enumerate(gates)]
res = [("모델\nClaude 조직 키 · 사내 GPU", "model"), ("업무 시스템 도구\npmsx__ · axnavi__ · datalake__ · ITSM", "ext"),
       ("데이터\n레이크 · 원본 DB(읽기 전용)", "lake"), ("보고\n경영·보안 담당", "people")]
rs = [g.box(105 + i * 430, 580, 300, 70, t, k) for i, (t, k) in enumerate(res)]
for i in range(4):
    g.edge(gs[i], rs[i], "", "ext", exit=(0.5, 1), entry=(0.5, 0))
for c in cs:
    g.edge(c, gs[0], "", "ext", dashed=True, exit=(0.5, 1), entry=(0.5, 0))
g.edge(cs[2], gs[1], "", "plat", dashed=True, exit=(0.5, 1), entry=(0.5, 0))
g.edge(cs[4], gs[1], "", "ext", dashed=True, exit=(0.5, 1), entry=(0.5, 0))
g.edge(gs[1], gs[2], "datalake__*", "plat")
g.edge(gs[0], gs[3], "계량", "plat", dashed=True, exit=(0.5, 1), entry=(0.5, 1), points=[(255, 540), (1795 - 300, 540)])
g.text(20, 690, 1760, 110,
       "<b>원칙</b> — 구독 자격 증명은 개발자 PC를 떠나지 않는다(서버는 조직 API 키) · 기밀 데이터는 사내 모델로만 · 에이전트는 키 주인의 권한을 넘지 못한다 · "
       "쓰기·조치는 사람이 승인한 뒤 한 번만 · 모든 제품이 폐쇄망 설치본 하나로 고객망 안에 선다", 12)

xml = ('<mxfile host="hnix-ax" modified="2026-10-31T00:00:00Z" agent="make_ecosystem.py" version="24.7.0" type="device">'
       + p.xml() + q.xml() + r.xml() + g.xml() + "</mxfile>")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(xml)
print("->", OUT)
