// 각 활동 HTML 마지막에 "🔭 확장 탐구" 화면을 추가한다 (멱등 — 이미 있으면 교체).
// 실행: node scripts/add-extension-screens.mjs
//
// 확장의 두 방향
//  ↔ 수평 확장: 다른 분야·실생활·다른 수학 영역과 잇기
//  ↕ 수직 확장: 더 근본적인 이유·일반화·상위 개념으로 파고들기
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "docs", "activities");

const MARK_START = "<!-- EXT:START -->";
const MARK_END = "<!-- EXT:END -->";
const JS_START = "/* EXTJS:START */";
const JS_END = "/* EXTJS:END */";

// h: 수평 확장, v: 수직 확장, q: 도전 질문, extra: 화면에 덧붙일 HTML(선택)
const EXT = {
  "gongtong2-00-distance-two-points.html": {
    h: "내비게이션이 알려 주는 거리는 직선거리가 아니라 <b>도로를 따라간 거리</b>입니다. 도시처럼 길이 격자로 난 곳에서는 <b>|Δx| + |Δy|</b>(택시 거리)가 더 현실적이에요. 배달 경로·지하철 환승 계산이 이 거리를 씁니다.",
    v: "거리를 3차원으로 늘리면 √(Δx² + Δy² + Δz²), n차원이면 제곱합의 제곱근으로 <b>그대로 일반화</b>됩니다. 수학에서는 ‘거리’를 ① 항상 0 이상 ② 같은 점끼리만 0 ③ 삼각부등식(돌아가면 멀다) 을 만족하는 것으로 <b>정의</b>하고, 이 조건만 지키면 무엇이든 거리로 인정합니다.",
    q: "유클리드 거리에서 ‘한 점에서 거리가 3인 점의 모임’은 원입니다. 그렇다면 <b>택시 거리</b>에서 같은 모임은 어떤 모양일까요? 아래에서 직접 확인해 보세요!",
    extra: `    <div style="margin:14px 0 4px"><b>🚕 직접 해보기 — 택시 기하학</b></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <button class="modebtn on" id="extTaxiCmp" style="border:1px solid var(--line);background:var(--blue);color:#fff;font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:600">두 거리 비교</button>
      <button class="modebtn" id="extTaxiCir" style="border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:600">거리가 3인 점들 = ‘원’</button>
    </div>
    <div class="lab">
      <svg id="extTaxi" viewBox="0 0 400 400"></svg>
      <div class="controls">
        <div class="readout" id="extTaxiRead"></div>
        <div class="hint">파란 점 A, B 를 드래그해 보세요. 주황은 <b>도로를 따라간 길(택시)</b>, 파랑은 <b>직선거리</b>입니다.</div>
      </div>
    </div>`,
    js: `  // 확장: 택시 기하학
  (function () {
    var svg = document.getElementById("extTaxi");
    if (!svg) return;
    var P = Plane(svg, -6, 6);
    var mode = "cmp", A = { x: -3, y: -2 }, B = { x: 2, y: 3 };
    function draw() {
      P.clear(); P.grid();
      if (mode === "cmp") {
        P.seg(A.x, A.y, B.x, A.y, "#f59e0b", 3.5);
        P.seg(B.x, A.y, B.x, B.y, "#f59e0b", 3.5);
        P.seg(A.x, A.y, B.x, B.y, "#2563eb", 3);
        P.handle(A.x, A.y, "#2563eb", "A"); P.handle(B.x, B.y, "#2563eb", "B");
        P.dot(A.x, A.y, "#2563eb", "A", 4); P.dot(B.x, B.y, "#2563eb", "B", 4);
        var dx = Math.abs(B.x - A.x), dy = Math.abs(B.y - A.y);
        document.getElementById("extTaxiRead").innerHTML =
          "<span style='color:#2563eb'><b>유클리드</b></span> √(" + dx + "² + " + dy + "²) = <b>" + fmt(Math.hypot(dx, dy)) + "</b><br>" +
          "<span style='color:#d97706'><b>택시</b></span> " + dx + " + " + dy + " = <b>" + (dx + dy) + "</b><br>" +
          "<span class='hint'>택시 거리는 어떤 계단 경로로 가도 <b>항상 같습니다</b>.</span>";
      } else {
        var circle = [];
        for (var i = 0; i < 120; i++) {
          var t = i / 120 * 2 * Math.PI;
          circle.push({ x: 3 * Math.cos(t), y: 3 * Math.sin(t) });
        }
        P.poly(circle, "#2563eb");
        P.poly([{ x: 3, y: 0 }, { x: 0, y: 3 }, { x: -3, y: 0 }, { x: 0, y: -3 }], "#f59e0b");
        P.dot(0, 0, "#27272a", null, 4);
        document.getElementById("extTaxiRead").innerHTML =
          "원점에서 거리가 <b>3</b>인 점들<br>" +
          "<span style='color:#2563eb'><b>유클리드 → 원</b></span><br>" +
          "<span style='color:#d97706'><b>택시 → 마름모!</b></span><br>" +
          "<span class='hint'>‘거리’의 정의가 바뀌면 ‘원’의 모양도 바뀝니다.</span>";
      }
    }
    P.onDrag(function (n, pt) { if (n === "A") A = pt; else B = pt; draw(); });
    var bC = document.getElementById("extTaxiCmp"), bR = document.getElementById("extTaxiCir");
    function pick(m) {
      mode = m;
      var on = m === "cmp" ? bC : bR, off = m === "cmp" ? bR : bC;
      on.style.background = "#2563eb"; on.style.color = "#fff";
      off.style.background = "#fff"; off.style.color = "#27272a";
      draw();
    }
    bC.onclick = function () { pick("cmp"); };
    bR.onclick = function () { pick("cir"); };
    draw();
  })();`,
  },
  "gongtong2-01-segment-division.html": {
    h: "컴퓨터 그래픽에서 두 색을 섞는 <b>그라데이션</b>, 애니메이션에서 두 자세 사이를 채우는 <b>트위닝</b>은 모두 내분입니다. 색 A와 색 B를 m:n으로 내분하면 중간 색이 나오죠. 게임·영상의 부드러운 움직임이 여기서 나옵니다.",
    v: "내분점 공식 P = (n·A + m·B)/(m+n) 은 <b>가중평균</b>입니다. 점을 3개로 늘리면 삼각형 안의 모든 점을 (αA + βB + γC), α+β+γ=1 로 나타낼 수 있어요(무게중심 좌표). 이 아이디어가 3D 그래픽의 <b>삼각형 색칠·질감 입히기</b>의 핵심입니다.",
    q: "사진 편집의 ‘크로스페이드’(A가 서서히 B로 바뀜)를 내분으로 설명해 보세요. 시간 t가 0→1로 갈 때 화면은 A와 B를 어떤 비로 내분한 것일까요?",
  },
  "gongtong2-02b-line-equation.html": {
    h: "데이터 점들이 흩어져 있을 때 ‘가장 잘 맞는 직선’을 긋는 것이 <b>회귀분석(추세선)</b>입니다. 키와 몸무게, 공부 시간과 성적처럼 두 양의 관계를 직선으로 요약하죠. 엑셀의 추세선, AI의 선형회귀가 모두 이것입니다.",
    v: "ax + by + c = 0 을 <b>(a, b)·(x, y) = −c</b> 로 보면, (a, b)는 그 직선에 <b>수직인 벡터(법선벡터)</b>입니다. 직선을 ‘기울기’가 아니라 ‘어느 방향에 수직인가’로 보는 관점이며, 3차원에서 평면 ax+by+cz+d=0 으로 그대로 이어집니다.",
    q: "세 점 A, B, C 가 <b>한 직선 위에 있을 조건</b>을 기울기로 써 보세요. 만약 두 점의 x좌표가 같다면 그 조건은 어떻게 바꿔야 할까요?",
  },
  "gongtong2-02-parallel-perpendicular.html": {
    h: "도로·건물 설계, 컴퓨터 화면의 좌표계는 모두 수직인 두 축 위에 세워집니다. 게임에서 캐릭터를 90° 돌리는 것도 ‘수직 방향 찾기’이고, 로봇 팔의 자세 제어도 마찬가지예요.",
    v: "기울기 곱이 −1 이라는 조건은, 방향벡터 (1, m₁)과 (1, m₂)의 <b>내적이 0</b>이라는 말과 같습니다: 1·1 + m₁m₂ = 0. ‘수직 = 내적 0’ 은 3차원·n차원에서도 그대로 성립하는 <b>더 근본적인 정의</b>입니다.",
    q: "y축에 평행한 직선(x = k)은 기울기가 없습니다. 그렇다면 이 직선과 수직인 직선은 무엇이고, ‘기울기의 곱 = −1’ 규칙은 왜 여기서 쓸 수 없을까요?",
  },
  "gongtong2-03-point-line-distance.html": {
    h: "인공지능이 두 그룹을 가르는 경계선을 그을 때, <b>경계에서 가장 가까운 점까지의 거리(마진)</b>를 최대로 만듭니다(서포트 벡터 머신). 공장의 불량품 검출, 스팸 분류도 ‘선에서 얼마나 떨어졌나’로 판단해요.",
    v: "거리 공식은 사실 <b>벡터의 사영</b>입니다. 직선 위 한 점에서 목표점까지의 벡터를, 직선의 법선벡터 (a, b) 방향으로 사영한 길이가 곧 거리죠. 그래서 3차원에서 점과 평면 사이 거리는 |ax₀+by₀+cz₀+d| / √(a²+b²+c²) 로 똑같은 꼴이 됩니다.",
    q: "두 평행선 3x − 4y + 1 = 0 과 3x − 4y − 9 = 0 사이의 거리는 얼마일까요? (힌트: 한 직선 위의 아무 점이나 잡아 다른 직선까지의 거리를 재면 됩니다.)",
  },
  "gongtong2-04-circle-equation.html": {
    h: "GPS는 위성 3개로부터의 <b>거리</b>를 재어 위치를 찾습니다. 각 위성을 중심으로 한 구(원)를 그리면 교점이 내 위치죠. 지진의 진원 찾기, 와이파이 실내 측위도 같은 원리입니다(삼변측량).",
    v: "원은 ‘중심에서 거리가 일정한 점의 모임’입니다. 이 정의를 3차원으로 올리면 <b>구</b>, n차원으로 올리면 <b>초구</b>가 되고 식은 (x₁−a₁)² + ⋯ + (xₙ−aₙ)² = r² 로 똑같습니다. 차원이 올라가도 <b>정의는 그대로</b>인 것이 수학의 힘이에요.",
    q: "한 직선 위에 있지 않은 세 점을 지나는 원은 <b>단 하나</b> 존재합니다(삼각형의 외접원). 왜 그럴까요? (힌트: 두 점에서 같은 거리인 점들의 자취 = 수직이등분선)",
  },
  "gongtong2-05-circle-line.html": {
    h: "게임과 3D 영화의 <b>광선 추적</b>은 ‘빛(직선)이 물체(구)와 만나는가’를 매 픽셀마다 계산합니다. 총알이 목표에 맞았는지, 캐릭터가 벽에 부딪혔는지 판정하는 <b>충돌 검사</b>도 정확히 이 문제예요.",
    v: "‘d와 r의 대소’와 ‘판별식 D의 부호’가 왜 항상 같은 답을 줄까요? 직선을 원에 대입해 얻은 이차방정식의 D를 정리하면 D = 4(r² − d²)·(1+m²) 꼴이 나옵니다. <b>기하(거리)와 대수(판별식)가 한 식 안에서 만나는</b> 순간입니다.",
    q: "원과 <b>원</b>의 위치 관계도 같은 방법으로 분류할 수 있을까요? 두 원의 중심 거리 d와 두 반지름 r₁, r₂ 로 (외부·외접·두 점·내접·내부) 다섯 경우를 나눠 보세요.",
  },
  "gongtong2-05b-circle-tangent.html": {
    h: "고속도로의 곡선 구간은 직선 구간과 <b>접하도록</b> 설계해야 차가 급격히 꺾이지 않습니다. 렌즈의 빛 반사, 위성이 지구를 스치는 궤도, 톱니바퀴의 맞물림도 접선 개념 위에 있습니다.",
    v: "접선은 ‘한 점에서만 만나는 직선’이지만, 더 근본적으로는 <b>그 점에서 곡선이 향하는 방향</b>입니다. 이 관점을 일반 곡선으로 넓힌 것이 미분(순간변화율)이고, y = f(x) 의 접선 기울기가 곧 f′(x) 예요. 지금 배운 원의 접선은 <b>미적분의 예고편</b>입니다.",
    q: "타원 x²/a² + y²/b² = 1 위의 점 (x₁, y₁) 에서의 접선은 <b>x₁x/a² + y₁y/b² = 1</b> 입니다. 원의 접선 x₁x + y₁y = r² 과 모양이 닮았죠? 왜 이런 규칙성이 생길지 추측해 보세요.",
  },
  "gongtong2-06-translation.html": {
    h: "게임 캐릭터가 걷고, 지도가 스크롤되고, 슬라이드가 넘어가는 모든 움직임이 평행이동입니다. 이미지 편집의 ‘레이어 옮기기’, 프레젠테이션의 애니메이션도 좌표에 벡터를 더하는 일이에요.",
    v: "평행이동은 <b>벡터 덧셈</b>입니다. (a₁,b₁)만큼 옮기고 다시 (a₂,b₂)만큼 옮기면 (a₁+a₂, b₁+b₂)만큼 옮긴 것과 같고, 반대로 옮기면 원래대로 돌아오죠. 이렇게 ‘합성이 되고, 항등원과 역원이 있는’ 구조를 수학에서는 <b>군(group)</b>이라 부릅니다.",
    q: "도형을 (3, −2)만큼 옮긴 뒤 다시 (−3, 2)만큼 옮기면 어떻게 될까요? 이것을 식 f(x−a, y−b) 로 두 번 적용해 확인해 보세요.",
  },
  "gongtong2-07-reflection.html": {
    h: "이슬람 건축의 문양, 에셔의 판화, 나비의 날개, 사람 얼굴 — 아름답다고 느끼는 많은 것에 대칭이 있습니다. 거울·반사 조명, 이미지 편집의 ‘좌우 뒤집기’도 대칭이동이에요.",
    v: "대칭이동을 <b>두 번</b> 하면 제자리로 돌아옵니다(자기 자신이 역원). 또 서로 다른 두 대칭을 이어서 하면 <b>회전이나 평행이동</b>이 나와요. 이렇게 이동들을 ‘합성’해 분류하는 것이 <b>변환군</b>이고, 결정 구조·타일링 분류의 언어가 됩니다.",
    q: "직선 y = x 에 대해 대칭이동한 뒤, 이어서 원점에 대해 대칭이동하면 결과는 <b>어떤 한 번의 이동</b>과 같을까요? 아래에서 두 대칭을 골라 직접 합성해 보세요.",
    extra: `    <div style="margin:14px 0 4px"><b>🔁 직접 해보기 — 대칭을 두 번 하면?</b></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;font-size:13px">
      <span style="color:#52525b">1차</span>
      <select id="extF1" style="border:1px solid var(--line);border-radius:8px;padding:5px 8px;font:inherit;font-size:13px">
        <option value="x">x축</option><option value="y">y축</option>
        <option value="o">원점</option><option value="d">y=x</option>
      </select>
      <span style="color:#52525b">→ 2차</span>
      <select id="extF2" style="border:1px solid var(--line);border-radius:8px;padding:5px 8px;font:inherit;font-size:13px">
        <option value="x">x축</option><option value="y" selected>y축</option>
        <option value="o">원점</option><option value="d">y=x</option>
      </select>
    </div>
    <div class="lab">
      <svg id="extRefl" viewBox="0 0 400 400"></svg>
      <div class="controls">
        <div class="readout" id="extReflRead"></div>
        <div class="hint">회색=원래, 연한 파랑=1차 대칭 후, 진한 파랑=2차까지 마친 결과.</div>
      </div>
    </div>`,
    js: `  // 확장: 두 대칭의 합성
  (function () {
    var svg = document.getElementById("extRefl");
    if (!svg) return;
    var P = Plane(svg, -6, 6);
    var shape = [{x:1,y:1},{x:1,y:4},{x:3,y:4},{x:3,y:3},{x:2,y:3},{x:2,y:1}];
    var ops = {
      x: { n: "x축", f: function (p) { return { x: p.x, y: -p.y }; } },
      y: { n: "y축", f: function (p) { return { x: -p.x, y: p.y }; } },
      o: { n: "원점", f: function (p) { return { x: -p.x, y: -p.y }; } },
      d: { n: "y=x", f: function (p) { return { x: p.y, y: p.x }; } }
    };
    var known = [
      { n: "제자리(항등)", f: function (p) { return { x: p.x, y: p.y }; } },
      { n: "x축 대칭", f: ops.x.f }, { n: "y축 대칭", f: ops.y.f },
      { n: "원점 대칭", f: ops.o.f }, { n: "y=x 대칭", f: ops.d.f },
      { n: "y=−x 대칭", f: function (p) { return { x: -p.y, y: -p.x }; } },
      { n: "원점 중심 90° 회전(반시계)", f: function (p) { return { x: -p.y, y: p.x }; } },
      { n: "원점 중심 90° 회전(시계)", f: function (p) { return { x: p.y, y: -p.x }; } }
    ];
    function identify(g) {
      var probes = [{x:2,y:3},{x:1,y:5},{x:-4,y:2}];
      for (var i = 0; i < known.length; i++) {
        var ok = true;
        for (var j = 0; j < probes.length; j++) {
          var a = g(probes[j]), b = known[i].f(probes[j]);
          if (Math.abs(a.x - b.x) > 1e-9 || Math.abs(a.y - b.y) > 1e-9) { ok = false; break; }
        }
        if (ok) return known[i].n;
      }
      return "(네 가지 대칭으로는 표현되지 않는 이동)";
    }
    var sel1 = document.getElementById("extF1"), sel2 = document.getElementById("extF2");
    function draw() {
      var k1 = sel1.value, k2 = sel2.value;
      var f1 = ops[k1].f, f2 = ops[k2].f;
      var g = function (p) { return f2(f1(p)); };
      P.clear(); P.grid();
      P.seg(-6, -6, 6, 6, "#e5e7eb", 1.5, "5 5");
      P.poly(shape, "#94a3b8", 2, "rgba(148,163,184,0.10)");
      P.poly(shape.map(f1), "#93c5fd", 2, "rgba(147,197,253,0.12)");
      P.poly(shape.map(g), "#2563eb", 2.8, "rgba(37,99,235,0.10)");
      document.getElementById("extReflRead").innerHTML =
        "<b>" + ops[k1].n + "</b> 대칭 → <b>" + ops[k2].n + "</b> 대칭<br>" +
        "= <b style='color:#2563eb'>" + identify(g) + "</b><br>" +
        "<span class='hint'>두 대칭을 이으면 <b>회전</b>이 나오기도 합니다!</span>";
    }
    sel1.onchange = draw; sel2.onchange = draw;
    draw();
  })();`,
  },
  "gongtong2-08-sets-subset.html": {
    h: "검색창에 태그를 걸어 좁혀 가는 일, 데이터베이스의 조건 검색, 생물의 분류 체계(종 ⊂ 속 ⊂ 과)가 모두 집합과 포함관계입니다. 파일 폴더 구조도 포함관계의 그림이죠.",
    v: "집합 A의 모든 부분집합을 모은 것을 <b>멱집합</b> P(A)라 하고 원소는 2ⁿ개입니다. 칸토어는 <b>어떤 집합이든 자기 멱집합보다 작다</b>는 것을 증명했어요. 이 말은 ‘무한에도 더 큰 무한이 있다’는 뜻이고, 여기서 현대 집합론이 시작됩니다.",
    q: "원소가 3개인 집합의 부분집합은 8개입니다. 그렇다면 <b>부분집합들의 집합</b>(멱집합)의 부분집합은 몇 개일까요? 2^(2³) 을 계산해 보세요.",
  },
  "gongtong2-09-intersection-union.html": {
    h: "검색엔진의 AND/OR 조건, 쇼핑몰의 다중 필터, ‘축구도 하고 농구도 하는 학생 수’ 조사가 모두 교집합·합집합입니다. 유전 형질 분석에서 두 형질을 함께 가진 개체를 세는 일도 같은 계산이에요.",
    v: "n(A∪B) = n(A)+n(B)−n(A∩B) 를 3개로 늘리면 −(쌍의 교집합) +(셋의 교집합) 이 되고, n개로 가면 <b>더하고 빼기를 번갈아</b> 하는 규칙이 됩니다(포함·배제 원리). 확률·경우의 수·정수론에서 두루 쓰이는 강력한 도구예요.",
    q: "1부터 100까지의 자연수 중 <b>2의 배수 또는 3의 배수</b>는 몇 개일까요? 포함·배제로 계산해 보세요. (2의 배수 50, 3의 배수 33, 6의 배수 16)",
  },
  "gongtong2-10-complement-difference.html": {
    h: "컴퓨터의 논리 회로는 AND·OR·NOT 세 가지로 모든 계산을 만듭니다. 드모르간 법칙은 회로를 <b>더 적은 부품으로</b> 바꾸는 규칙으로 실제 반도체 설계에 쓰여요. 스팸 필터의 ‘~를 제외하고’도 차집합입니다.",
    v: "집합의 (∪, ∩, ᶜ) 와 명제의 (또는, 그리고, 부정), 회로의 (OR, AND, NOT)은 <b>완전히 같은 규칙</b>을 따릅니다. 이렇게 겉모습이 달라도 구조가 같은 것을 수학에서는 ‘동형’이라 하고, 이 공통 구조를 <b>불 대수</b>라 부릅니다.",
    q: "집합 {1,2,3,4,5}의 부분집합을 5자리 이진수로 나타내면(속하면 1) 여집합은 어떤 연산이 될까요? 교집합·합집합은요? (컴퓨터가 집합을 다루는 실제 방법입니다)",
  },
  "gongtong2-11-proposition-condition.html": {
    h: "프로그램의 <code>if</code> 조건, 계약서의 ‘~인 경우에 한하여’, 법률 조항이 모두 명제와 조건입니다. 조건을 잘못 쓰면 프로그램에 버그가 생기고 계약에 분쟁이 생기죠.",
    v: "‘모든’과 ‘어떤’은 기호로 ∀, ∃ 라 쓰고, 이것을 다루는 논리를 <b>술어논리</b>라 합니다. 조건 p 에 진리집합 P 를 대응시키는 순간 <b>논리 문제가 집합 문제로 번역</b>되는데, 이 다리가 수학 전체를 지탱합니다.",
    q: "‘모든 학생이 숙제를 했다’가 거짓임을 보이려면 몇 명을 확인해야 할까요? 반대로 ‘어떤 학생이 숙제를 했다’가 거짓임을 보이려면요? 두 경우의 <b>확인 비용</b>이 왜 다른지 설명해 보세요.",
  },
  "gongtong2-12-proposition-relations.html": {
    h: "의학 검사에서 ‘병이 있으면 양성’과 ‘양성이면 병이 있다’는 완전히 다른 말입니다(민감도와 정밀도). 이 둘을 혼동하면 오진이 생기죠. 재판의 알리바이 추론, 뉴스의 인과 주장 검증에도 그대로 쓰입니다.",
    v: "수학의 <b>모든 정의</b>는 필요충분조건(⟺)입니다. ‘짝수란 2로 나누어떨어지는 수’처럼요. 반면 정리는 보통 한쪽 방향(⟹)이고, 역이 성립하는지는 <b>따로 증명</b>해야 합니다. 이 구분이 수학적 엄밀함의 핵심이에요.",
    q: "‘비가 오면 땅이 젖는다’의 역·이·대우를 각각 쓰고 참·거짓을 판단해 보세요. 우리가 일상에서 자주 저지르는 <b>역을 참으로 착각하는 오류</b>의 예도 하나 들어 보세요.",
  },
  "gongtong2-13-proof.html": {
    h: "은행 앱이 안전한 이유는 ‘큰 수를 소인수분해하기 어렵다’는 사실에 기대고, 자율주행 소프트웨어는 ‘절대 충돌하지 않음’을 <b>증명</b>해 검증합니다. 증명은 교과서 안의 일이 아니라 실제 안전을 떠받치는 기술이에요.",
    v: "귀류법·대우 증명 다음에는 <b>수학적 귀납법</b>(무한히 많은 명제를 한 번에 증명)이 기다립니다. 더 나아가 괴델은 ‘참이지만 증명할 수 없는 명제가 존재한다’는 것을 증명했어요(불완전성 정리) — 증명 자체를 수학의 대상으로 삼은 것입니다.",
    q: "<b>소수는 무한히 많다</b>를 귀류법으로 증명해 보세요. (힌트: 소수가 p₁, …, pₙ 뿐이라 하고 N = p₁p₂⋯pₙ + 1 을 생각하면 어떤 모순이 생길까요?)",
  },
  "gongtong2-16b-logic-detective.html": {
    h: "이런 추론을 자동으로 해 주는 프로그램을 <b>SAT 솔버</b>라 합니다. 스도쿠 풀이, 시간표 짜기, 반도체 회로 검증, 항공기 스케줄링이 모두 ‘조건을 모두 만족하는 조합 찾기’로 바뀌어 컴퓨터가 풉니다.",
    v: "우리가 한 일은 ① 자연어를 명제로 번역 ② 대우로 정규화 ③ 연쇄로 정렬 ④ 제약으로 좁히기 였습니다. 이 절차를 기계가 하도록 형식화한 것이 <b>자동 정리 증명</b>이고, 오늘날 AI의 논리 추론 엔진으로 이어집니다.",
    q: "만약 용의자 중 <b>한 명이 거짓말</b>을 하고 있다면 어떻게 될까요? 누가 거짓말쟁이인지 모른다고 할 때, 가능한 경우를 어떻게 체계적으로 따져볼 수 있을지 방법을 설계해 보세요.",
  },
  "gongtong2-14-function.html": {
    h: "프로그래밍의 함수, 자판기(버튼 → 음료), 바코드(상품 → 번호)가 모두 함수입니다. 특히 <b>일대일대응</b>이어야 되돌릴 수 있어서, 암호·압축·주민번호 체계 설계에서 결정적으로 중요해요.",
    v: "함수는 ‘두 집합 사이의 특별한 대응’이고, 더 근본적으로는 <b>관계</b>의 특수한 경우입니다. 칸토어는 함수(일대일대응)를 이용해 <b>무한집합의 크기를 비교</b>했어요 — 자연수와 짝수는 크기가 같고, 실수는 더 크다는 놀라운 결론이 여기서 나옵니다.",
    q: "자연수 전체 {1,2,3,…} 와 짝수 전체 {2,4,6,…} 사이에 일대일대응 f(n) = 2n 을 만들 수 있습니다. ‘부분이 전체와 크기가 같다’는 이 결과를 어떻게 받아들여야 할까요?",
  },
  "gongtong2-15-composite.html": {
    h: "사진 앱의 필터를 여러 개 겹치는 일, 데이터 처리 파이프라인(정제 → 변환 → 요약), 원화→달러→엔화 이중 환전이 모두 합성입니다. 함수형 프로그래밍은 아예 ‘함수를 이어 붙이는 것’으로 프로그램을 짜요.",
    v: "합성은 교환법칙은 없지만 <b>결합법칙은 성립</b>합니다. ‘결합법칙이 성립하고 항등원이 있는 연산’ 구조를 수학에서는 모노이드·군이라 부르고, 대칭·암호·물리 법칙을 기술하는 언어가 됩니다. 미적분의 <b>연쇄법칙</b>도 합성함수의 미분이에요.",
    q: "두 번 적용하면 제자리로 돌아오는 함수(f∘f = 항등)를 <b>대합</b>이라 합니다. f(x) = −x, f(x) = 1/x 가 그렇죠. 또 다른 예를 찾아보고, 대합과 ‘대칭이동’의 공통점을 말해 보세요.",
  },
  "gongtong2-16-inverse.html": {
    h: "암호화와 복호화, 로그와 지수, 섭씨↔화씨 변환이 모두 역함수 관계입니다. 현대 암호는 ‘계산은 쉬운데 <b>역은 사실상 불가능한</b>’ 함수(일방향 함수)를 일부러 골라 쓰는데, 이것이 인터넷 보안의 토대예요.",
    v: "역함수가 존재할 조건은 <b>일대일대응</b>입니다. 함수를 ‘정보를 잃지 않는 변환’으로 보면, 역함수가 있다는 것은 <b>정보가 보존된다</b>는 뜻이죠. 압축·암호·물리 법칙의 가역성 논의가 모두 이 관점 위에 있습니다.",
    q: "자기 자신이 역함수인 함수(f⁻¹ = f)의 그래프는 y = x 에 대해 대칭이어야 합니다. f(x) = 1/x, f(x) = −x 로 확인해 보고, 이런 함수를 하나 더 만들어 보세요.",
  },
  "gongtong2-20-rational-function.html": {
    h: "볼록렌즈의 공식 1/f = 1/a + 1/b, 병렬 저항 계산, 효소 반응 속도(미카엘리스–멘텐), 약물 농도 변화가 모두 유리함수입니다. ‘한쪽이 커질수록 다른 쪽이 어떤 값에 다가가는’ 현상은 대부분 이 모양이에요.",
    v: "점근선은 ‘x가 한없이 커질 때 y가 다가가는 값’ — 바로 <b>극한</b>의 개념입니다. 미적분에서 배울 lim 의 첫 만남이죠. 한편 y = (ax+b)/(cx+d) 를 복소수까지 넓히면 <b>뫼비우스 변환</b>이 되어, 원을 원으로 보내는 아름다운 성질을 갖습니다.",
    q: "y = 1/x 에서 x 를 100, 10000, 1000000 으로 키우면 y 는 어떻게 될까요? ‘0에 다가가지만 절대 0이 되지 않는다’를 <b>점근선</b>과 연결해 설명해 보세요.",
  },
  "gongtong2-21-irrational-function.html": {
    h: "진자의 주기 T = 2π√(L/g), 높이 h 에서 볼 수 있는 최대 거리 d = 3.6√h, 지진 해일의 속도 v = √(9.8h), 자유낙하 시간 — 자연에는 <b>제곱근 관계</b>가 가득합니다. 높이 두 배로 올라도 시야는 √2배만 넓어지죠.",
    v: "√x 는 사실 <b>x의 1/2제곱</b>입니다. 지수를 정수에서 분수로 넓히면 무리함수는 거듭제곱함수 y = x^(1/2) 의 한 경우가 되고, 지수함수·로그함수로 자연스럽게 이어집니다. ‘역함수 관점’으로 보면 제곱의 되돌리기이기도 하죠.",
    q: "y = √x 의 그래프는 오른쪽으로 갈수록 <b>완만</b>해집니다. x가 1→4로 4배 커질 때 y는 몇 배가 되나요? 4→9 일 때는요? 이 ‘점점 둔해지는’ 성질이 왜 생기는지 설명해 보세요.",
  },
};

function buildSection(e) {
  return `${MARK_START}
  <section class="screen">
    <div class="kicker">확장 탐구</div>
    <h1>🔭 더 넓게, 더 깊게</h1>
    <p>배운 것을 <b>옆으로</b>(다른 분야와 잇기) 그리고 <b>아래로</b>(더 근본적인 이유로) 넓혀 봅시다.
       정답을 맞히는 시간이 아니라 <b>생각을 키우는</b> 시간이에요.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:12px 0">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:13px 15px">
        <b style="color:#059669">↔ 수평 확장 · 어디에 쓰일까</b>
        <p style="margin:6px 0 0;font-size:14px;color:#3f3f46">${e.h}</p>
      </div>
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:13px 15px">
        <b style="color:#7c3aed">↕ 수직 확장 · 더 근본으로</b>
        <p style="margin:6px 0 0;font-size:14px;color:#3f3f46">${e.v}</p>
      </div>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;margin:12px 0">
      <b>🧗 도전 질문</b><br>${e.q}
    </div>${e.extra ? "\n" + e.extra : ""}
    <p style="font-size:12px;color:#52525b">막히면 <b>‘AI 질문’ 탭</b>에서 힌트를 얻어도 좋아요. 생각한 내용은 아래 ‘내 생각 적기’에 자유롭게 남겨 보세요.</p>
  </section>
  ${MARK_END}`;
}

let changed = 0, missing = 0;
for (const [file, e] of Object.entries(EXT)) {
  const path = join(dir, file);
  if (!existsSync(path)) { console.log(`⬜ 파일 없음: ${file}`); missing++; continue; }
  let html = readFileSync(path, "utf8");

  // 이미 넣은 확장 화면이 있으면 통째로 걷어내고 새로 넣는다(멱등)
  const startIdx = html.indexOf(MARK_START);
  if (startIdx !== -1) {
    const endIdx = html.indexOf(MARK_END);
    if (endIdx === -1) { console.error(`✗ 마커 손상: ${file}`); continue; }
    html = html.slice(0, startIdx) + html.slice(endIdx + MARK_END.length);
  }

  // 이미 넣은 확장 JS 도 걷어낸다
  const jsStart = html.indexOf(JS_START);
  if (jsStart !== -1) {
    const jsEnd = html.indexOf(JS_END);
    if (jsEnd === -1) { console.error(`✗ JS 마커 손상: ${file}`); continue; }
    html = html.slice(0, jsStart) + html.slice(jsEnd + JS_END.length);
  }

  // 네비게이션 바로 앞에 삽입 = 마지막 화면
  const navIdx = html.indexOf('<div class="nav">');
  if (navIdx === -1) { console.error(`✗ nav 를 찾지 못함: ${file}`); continue; }
  html = html.slice(0, navIdx) + buildSection(e) + "\n\n  " + html.slice(navIdx);

  // 조작형이 있으면 활동 스크립트의 go(0) 직전에 끼워 넣는다
  // (같은 IIFE 안이라 그 파일의 Plane/fmt 같은 헬퍼를 그대로 쓸 수 있다)
  if (e.js) {
    const goIdx = html.indexOf("go(0);");
    if (goIdx === -1) { console.error(`✗ go(0) 를 찾지 못함: ${file}`); continue; }
    html = html.slice(0, goIdx) + JS_START + "\n" + e.js + "\n  " + JS_END + "\n\n  " + html.slice(goIdx);
  }

  writeFileSync(path, html, "utf8");
  console.log(`✔ 확장 탐구 추가: ${file}`);
  changed++;
}

console.log(`\n완료: ${changed}개 파일에 확장 탐구 화면 추가${missing ? `, ${missing}개 파일 없음` : ""}.`);
