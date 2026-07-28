// 공통수학2 콘텐츠 목록 (한 곳에서 관리)
//  - scripts/build-gongtong2.mjs        : 이 목록대로 DB(교과/단원/활동)를 만든다
//  - scripts/build-archive-index.mjs    : 이 목록대로 공개 아카이브 목차를 만든다
// 활동을 추가·수정할 때는 이 파일만 고치면 두 곳이 함께 따라온다.

export const SUBJECT = { title: "공통수학2", grade: 1, order_index: 0 };

// 교과서(전인태) 대단원 = 단원
export const UNITS = [
  { key: "I",   title: "Ⅰ. 도형의 방정식", order_index: 0 },
  { key: "II",  title: "Ⅱ. 집합과 명제",   order_index: 1 },
  { key: "III", title: "Ⅲ. 함수와 그래프", order_index: 2 },
];

// unit: 소속 단원 key, order: 단원 안에서의 순서
export const REG = [
  // ── Ⅰ. 도형의 방정식 ──────────────────────────────────────────
  { unit: "I", order: 0, desc: "수직선 |b−a| → 피타고라스 → 삼각형 모양 자동 판정 → 수직이등분선 발견", title: "두 점 사이의 거리", file: "gongtong2-00-distance-two-points.html", height: 980,
    rp: "두 점 사이의 거리 공식이 피타고라스 정리에서 어떻게 나오는지 자신의 말로 설명하고, 세 점 A(0,0), B(4,0), C(0,3)으로 만든 삼각형의 세 변의 길이를 구해 어떤 삼각형인지 판정하세요." },
  { unit: "I", order: 1, desc: "1차원에서 2차원으로 확장. 지레의 원리와 삼각형 무게중심까지", title: "선분의 내분", file: "gongtong2-01-segment-division.html", height: 980,
    rp: "[심화 과제] 세 꼭짓점 A(0,0)·200g, B(6,0)·300g, C(0,8)·400g 의 전체 무게중심 G 좌표를 풀이과정과 함께 구하고, 무게가 클수록 G 가 어느 쪽으로 끌리는지 내분(가중평균) 관점에서 설명하세요." },
  { unit: "I", order: 2, desc: "한 점+기울기 / 두 점 중 무엇이 직선을 정하는지 직접 조작", title: "직선의 방정식", file: "gongtong2-02b-line-equation.html", height: 980,
    rp: "두 점 (1, 2), (3, 8)을 지나는 직선의 방정식을 기울기부터 차례로 구해 보고, 왜 '한 점 + 기울기'만으로 직선이 하나로 정해지는지 설명하세요." },
  { unit: "I", order: 3, desc: "기울기 두 개를 움직여 평행·일치·수직을 실시간 판정", title: "두 직선의 평행과 수직", file: "gongtong2-02-parallel-perpendicular.html", height: 980,
    rp: "직접 두 직선을 움직여 본 뒤, 두 직선이 (1) 평행할 조건과 (2) 수직일 조건을 기울기 m₁, m₂ 로 각각 정리하고, 왜 수직이면 기울기의 곱이 −1 이 되는지 자신의 말로 설명하세요." },
  { unit: "I", order: 4, desc: "수선이 가장 짧은 이유를 눈으로. 거리 공식이 실시간 계산", title: "점과 직선 사이의 거리", file: "gongtong2-03-point-line-distance.html", height: 980,
    rp: "점 (2,3) 과 직선 3x−4y+1=0 사이의 거리를 공식으로 구하고, 이 거리가 '점에서 직선에 내린 수선의 길이'와 같은 이유를 설명하세요." },
  { unit: "I", order: 5, desc: "중심 드래그·일반형↔표준형 변환·아폴로니오스의 원", title: "원의 방정식", file: "gongtong2-04-circle-equation.html", height: 980,
    rp: "중심 (a,b), 반지름 r 인 원의 방정식이 (x−a)²+(y−b)²=r² 인 이유를 거리로 설명하고, x²+y²+Ax+By+C=0 꼴을 완전제곱으로 고쳐 중심·반지름을 찾는 과정을 예로 보이세요." },
  { unit: "I", order: 6, desc: "거리 d와 반지름 r 비교, 기하와 대수(판별식)가 만나는 지점", title: "원과 직선의 위치 관계", file: "gongtong2-05-circle-line.html", height: 980,
    rp: "원의 중심과 직선 사이의 거리 d, 반지름 r 을 비교해 (서로 다른 두 점에서 만남 / 접함 / 만나지 않음)의 세 경우를 d 와 r 의 대소로 정리하세요." },
  { unit: "I", order: 7, desc: "기울기·접점·원 밖의 점 — 세 유형을 각각 조작해 보기", title: "원의 접선의 방정식", file: "gongtong2-05b-circle-tangent.html", height: 980,
    rp: "원 x² + y² = 5 위의 점 (1, 2) 에서의 접선의 방정식을 구하고, 그 접선이 반지름과 수직임을 두 기울기의 곱으로 확인하세요. 또 접선 공식들이 모두 '중심에서 접선까지 거리 = 반지름'에서 나온다는 점을 설명해 보세요." },
  { unit: "I", order: 8, desc: "점은 +a, 도형은 −a. 부호가 반대인 이유를 그래프로", title: "평행이동", file: "gongtong2-06-translation.html", height: 960,
    rp: "도형 f(x,y)=0 을 x축으로 a, y축으로 b 만큼 평행이동하면 왜 f(x−a, y−b)=0 이 되는지, 부호가 반대인 이유를 예를 들어 설명하세요." },
  { unit: "I", order: 9, desc: "점의 네 대칭을 동시에. 두 대칭을 합성하면 회전이 나온다", title: "대칭이동", file: "gongtong2-07-reflection.html", height: 980,
    rp: "점 (x,y) 를 x축, y축, 원점, 직선 y=x 에 대해 각각 대칭이동한 좌표를 정리하고, 도형의 방정식에서는 x·y 를 어떻게 바꾸는지 규칙으로 쓰세요." },

  // ── Ⅱ. 집합과 명제 ────────────────────────────────────────────
  { unit: "II", order: 0, desc: "집합 판별 퀴즈 + 부분집합 직접 만들기(2ⁿ의 의미)", title: "집합의 뜻과 포함관계", file: "gongtong2-08-sets-subset.html", height: 960,
    rp: "'집합'이 되려면 어떤 조건을 만족해야 하는지 쓰고, 부분집합(⊂)과 진부분집합의 차이를 예를 들어 설명하세요. 원소가 n개인 집합의 부분집합 개수가 2ⁿ 인 이유도 적어보세요." },
  { unit: "II", order: 1, desc: "클릭으로 영역 강조, 분배법칙을 벤 다이어그램으로 확인", title: "교집합과 합집합", file: "gongtong2-09-intersection-union.html", height: 1000,
    rp: "벤 다이어그램을 움직여 본 뒤, n(A∪B)=n(A)+n(B)−n(A∩B) 가 성립하는 이유를 '겹치는 부분을 두 번 세지 않기'로 설명하세요. 또 분배법칙 A∩(B∪C)=(A∩B)∪(A∩C) 를 벤 다이어그램으로 확인한 과정을 적어보세요." },
  { unit: "II", order: 2, desc: "드모르간 법칙을 두 식이 같은 영역임을 눌러 비교", title: "여집합과 차집합", file: "gongtong2-10-complement-difference.html", height: 980,
    rp: "여집합 Aᶜ, 차집합 A−B 를 정의하고, 드모르간 법칙 (A∪B)ᶜ=Aᶜ∩Bᶜ 를 벤 다이어그램으로 확인한 과정을 설명하세요." },
  { unit: "II", order: 3, desc: "무엇이 명제인지 퀴즈 + 조건을 진리집합으로 옮기기", title: "명제와 조건", file: "gongtong2-11-proposition-condition.html", height: 960,
    rp: "'명제'와 '조건'의 차이를 예로 설명하고, 조건 p, q 에 대해 진리집합 P, Q 를 이용해 'p이면 q이다'가 참일 조건을 P, Q 의 포함관계로 나타내세요." },
  { unit: "II", order: 4, desc: "p→q가 거짓인 유일한 경우를 토글로. 역·이·대우와 필요충분조건", title: "명제 사이의 관계", file: "gongtong2-12-proposition-relations.html", height: 980,
    rp: "명제 'p→q' 의 역·이·대우를 각각 쓰고, 원명제와 대우의 참·거짓이 항상 일치하는 이유를 진리집합으로 설명하세요." },
  { unit: "II", order: 5, desc: "연역법·대우·귀류법(√2)과 산술기하평균", title: "명제의 증명", file: "gongtong2-13-proof.html", height: 960,
    rp: "'√2 는 무리수이다'를 귀류법으로 증명하는 큰 흐름을 자신의 말로 정리하고, 귀류법이 왜 타당한 증명 방법인지 설명하세요." },
  { unit: "II", order: 6, desc: "증언을 명제로 번역 → 대우로 연쇄 → 카드를 눌러 범인 찾기", title: "범인을 찾아라 (논리 추론)", file: "gongtong2-16b-logic-detective.html", height: 980,
    rp: "(1) 용의자 C와 D의 증언을 대우로 바꾼 과정을 쓰고, (2) 왜 범인이 A와 C 로 유일하게 결정되는지 연쇄 s⟹q⟹p⟹r 를 이용해 설명하세요. (3) 일상 문장을 명제 기호로 바꾸는 일이 왜 유용한지도 적어보세요." },

  // ── Ⅲ. 함수와 그래프 ──────────────────────────────────────────
  { unit: "III", order: 0, desc: "대응 다이어그램으로 함수/일대일함수/일대일대응 구분", title: "함수", file: "gongtong2-14-function.html", height: 980,
    rp: "대응이 '함수'가 되기 위한 조건을 쓰고, 일대일함수·일대일대응의 차이를 그림(대응)으로 설명하세요." },
  { unit: "III", order: 1, desc: "함수 기계 두 대를 연결. g∘f ≠ f∘g를 직접 확인", title: "합성함수", file: "gongtong2-15-composite.html", height: 980,
    rp: "합성함수 (g∘f)(x)=g(f(x)) 의 계산 순서를 설명하고, 일반적으로 g∘f ≠ f∘g 임을 구체적인 예로 보이세요." },
  { unit: "III", order: 2, desc: "대응 뒤집기와 y=x 대칭. 식 구하는 3단계", title: "역함수", file: "gongtong2-16-inverse.html", height: 980,
    rp: "역함수가 존재하기 위한 조건(일대일대응)을 쓰고, y=f(x) 와 y=f⁻¹(x) 의 그래프가 직선 y=x 에 대해 대칭인 이유를 설명하세요." },
  { unit: "III", order: 3, desc: "y=(ax+b)/(cx+d)를 k/(x−p)+q로 변형해 점근선 찾기", title: "유리함수", file: "gongtong2-20-rational-function.html", height: 1000,
    rp: "유리함수 y=(ax+b)/(cx+d) 를 y=k/(x−p)+q 꼴로 변형해 점근선을 찾는 과정을, 예를 하나 들어 직접 계산해 보이세요. (예: y=(2x−1)/(x+1))" },
  { unit: "III", order: 4, desc: "a의 부호로 갈리는 네 방향과 y=x²의 역함수 관계", title: "무리함수", file: "gongtong2-21-irrational-function.html", height: 1000,
    rp: "무리함수 y=√(ax+b)+c 의 정의역·치역이 a 의 부호에 따라 어떻게 달라지는지 그래프를 움직여 관찰한 내용을 바탕으로 정리하고, y=√x 와 y=x²(x≥0) 이 역함수 관계인 이유를 설명하세요." },
];

export const RETIRE = ["유리함수와 무리함수"];
