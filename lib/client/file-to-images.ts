// 학생이 올린 사진(이미지) 또는 PDF를 → 압축된 JPEG data URL 배열로 변환.
// 서버(Vercel)의 요청 본문 4.5MB 제한을 넘지 않도록 클라이언트에서 미리 압축한다.
// pdfjs-dist는 무겁기 때문에 실제로 PDF를 올릴 때만 동적 import 한다.

const MAX_EDGE = 1600; // 긴 변 최대 픽셀
const JPEG_QUALITY = 0.82;
export const MAX_PAGES = 5; // PDF는 최대 5페이지까지

// canvas를 압축 JPEG data URL로
function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

// 이미지 요소를 긴 변 MAX_EDGE로 리사이즈해 canvas에 그린다
function drawResized(
  img: HTMLImageElement | HTMLCanvasElement,
  w: number,
  h: number
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // 투명 배경을 흰색으로 (필기 사진 대비)
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function imageFileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return canvasToDataUrl(drawResized(img, img.naturalWidth, img.naturalHeight));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pdfFileToDataUrls(file: File): Promise<string[]> {
  // pdfjs-dist 동적 로드 + worker 설정 (turbopack이 asset으로 번들)
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const urls: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    // 렌더된 페이지를 다시 리사이즈해 용량 절감
    urls.push(canvasToDataUrl(drawResized(canvas, canvas.width, canvas.height)));
  }
  return urls;
}

// 파일 하나 → 이미지 data URL 배열 (이미지는 1장, PDF는 페이지 수만큼)
export async function fileToImageDataUrls(file: File): Promise<string[]> {
  if (file.type === "application/pdf") {
    return pdfFileToDataUrls(file);
  }
  if (file.type.startsWith("image/")) {
    return [await imageFileToDataUrl(file)];
  }
  throw new Error("이미지 또는 PDF 파일만 올릴 수 있습니다.");
}
