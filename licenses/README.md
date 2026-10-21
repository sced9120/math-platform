# 가져다 쓴 것들

이 폴더에는 바깥에서 가져온 자료의 라이선스 원문을 둔다.

## Lucian Icons

- 쓰는 곳 — [`components/icon.tsx`](../components/icon.tsx) 의 선 아이콘 27개
- 받은 곳 — https://lucianlabs.dev/icons/ (v2.0.13)
- 만든 이 — Lucian (lucianLabs)
- 라이선스 — MIT ([원문](./lucian-icons-LICENSE.txt))

### 어떻게 바꿔 썼나

원본은 **움직이는 웹컴포넌트**(`<lucian-heart>` 같은 커스텀 엘리먼트)로,
`lucianlabs.dev` 에서 자바스크립트를 내려받아 동작한다. 우리는 그렇게 쓰지 않는다.

1. 정지 SVG(`downloads/svg/<이름>.svg`)만 내려받았다.
2. **선(line) 모드**로 바꿨다 — 아이콘마다 박혀 있던 강조색(`stroke="#F2CF3B"` 등)과
   면을 채우던 틴트(`fill-opacity="0.24"`)를 지워, 획이 전부 둘레
   글자색(`currentColor`)을 따르게 했다.
3. 인라인 SVG 로 `icon.tsx` 안에 넣었다.

그래서 —

- **바깥 서버에 기대지 않는다.** 수업 중에 lucianlabs.dev 가 느려도 아이콘은 뜬다.
- **움직이지 않는다.** 원본의 스프링 애니메이션은 쓰지 않는다. 수업 화면에서 튀지 않게.
- **색이 따로 놀지 않는다.** 경고 문구 안에 있으면 호박색, 링크 안에 있으면 파란색이 된다.

### 지켜야 할 것

MIT 는 **저작권 문구를 함께 배포**할 것을 요구한다. 그래서

- [`lucian-icons-LICENSE.txt`](./lucian-icons-LICENSE.txt) 원문을 그대로 둔다.
- `components/icon.tsx` 맨 위 주석에도 출처와 저작권을 적어 둔다.

화면에 표시되는 크레딧은 요구하지 않는다.

> ⚠️ **상표는 MIT 가 아니다.** "Lucian"·"lucianLabs" 이름과 로고는 아이콘 라이선스에
> 들어가지 않는다. 우리 서비스 이름이나 로고로 쓰지 말 것.

### 아이콘을 더 가져오려면

```bash
curl -o 이름.svg https://lucianlabs.dev/icons/downloads/svg/<이름>.svg
```

전체 목록은 `https://lucianlabs.dev/icons/api/v1/catalog.json` 에 있다.
받은 뒤에는 위 2번(선 모드)을 똑같이 적용하고 `icon.tsx` 의 `PATHS` 에 넣는다.
`<script>`·`on*=`·`xlink:href` 가 섞여 들어오지 않았는지 꼭 확인할 것.
