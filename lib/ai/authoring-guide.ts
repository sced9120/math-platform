// 자동 생성 — scripts/build-authoring-guide.mjs 로 다시 만든다. 직접 고치지 말 것.
// 아카이브 활동 29개에서 뽑은 '집 규칙'이다.

export const HOUSE_CLASSES = ["wrap","steps","dot","screen","kicker","card","callout","hint","nav","q","tag","readout","lab","controls","formula","slider","sheet","muted"];

export const PLANE_METHODS = ["clear()","grid()","seg(x1,y1,x2,y2,color,w,dash)","circle(cx,cy,r,color,w,fill)","dot(x,y,color,label,r)","handle(x,y,color,name)","onDrag(cb)"];

export const SAMPLE_SCREEN = "<section class=\"screen on\" data-key=\"s1\" data-part=\"g0\" data-prompt=\"직선을 움직여 세 가지 위치 관계를 모두 만들어 보았습니다. 각 경우에 기울기 m 과 y절편 k 를 어떻게 잡았는지 예를 들어 적어 보세요.\">\n    <div class=\"kicker\">공통수학2 · 도형의 방정식</div>\n    <!--TEACH:START-->\n    <div class=\"teach\"><span class=\"t-show\">🖥 보여주며 조작</span><span class=\"t-sheet\">📄 학습지 2-02 [생각 틔우기] Q1 세 경우를 직접 만들기</span></div>\n<!--TEACH:END-->\n    <h1>원과 직선의 위치 관계</h1>\n    <p>원과 직선은 <b>두 점에서 만나거나</b>, <b>한 점에서 접하거나</b>, <b>만나지 않습니다.</b>\n       직선을 움직여(기울기 m, y절편 k) 세 경우를 모두 만들어 보세요. 원은 중심 O, 반지름 r 입니다.</p>\n    <div class=\"lab\">\n      <svg id=\"g0s0\" viewBox=\"0 0 400 400\"></svg>\n      <div class=\"controls\">\n        <div class=\"slider\"><label>반지름 r <span><b id=\"g0s0r\">3</b></span></label><input id=\"s0rr\" type=\"range\" min=\"1\" max=\"5\" step=\"0.5\" value=\"3\"></div>\n        <div class=\"slider\"><label>기울기 m <span><b id=\"s0m\">0.5</b></span></label><input id=\"s0mr\" type=\"range\" min=\"-3\" max=\"3\" step=\"0.25\" value=\"0.5\"></div>\n        <div class=\"slider\"><label>y절편 k <span><b id=\"s0k\">-4</b></span></label><input id=\"s0kr\" type=\"range\" min=\"-7\" max=\"7\" step=\"0.5\" value=\"-4\"></div>\n        <div class=\"readout\" id=\"s0read\"></div>\n      </div>\n    </div>\n  </section>";

export const ARCHIVE_COUNT = 29;
