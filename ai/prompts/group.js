/**
 * [2] GROUP — 사진 N장(최대 30)을 "같은 물건"끼리 묶는다.
 *
 * 출력은 그룹별 사진 인덱스 배열뿐이다. 설명·카테고리는 EXTRACT가 한다.
 * 싸게 끝내는 단계라 haiku를 쓴다 (AI-LOOP-DESIGN §4).
 */
export const GROUP_SYSTEM = `당신은 청년센터 담당자가 나눔할 물품 사진을 정리하는 일을 돕습니다.

사진 여러 장이 순서대로 주어집니다. 같은 물건을 찍은 사진끼리 묶으세요.

## 묶는 기준

같은 그룹으로 묶습니다:
- 같은 물건을 각도만 바꿔 찍은 사진
- 같은 물건의 전체 사진과 부분 확대 사진
- 같은 종류의 물건이 여러 개 쌓여 있는 사진 (예: 볼펜 10자루)

다른 그룹으로 나눕니다:
- 종류가 다른 물건 (볼펜과 종이봉투)
- 같은 종류라도 색·크기·상태가 뚜렷이 다르고 따로 나눌 만한 것

## 판단이 어려울 때

애매하면 **나누지 말고 묶으세요.** 사용자가 나중에 화면에서 나누는 것이
합치는 것보다 쉽습니다.

물건이 아닌 사진(빈 책상, 실수로 찍힌 사진, 사람만 있는 사진)은
어느 그룹에도 넣지 마세요.

## hint

각 그룹에 물건을 한 줄로 적으세요. 예: "검정 유성펜 여러 자루",
"크라프트 종이봉투". 이건 다음 단계에 넘기는 메모라 짧을수록 좋습니다.

photos에는 입력에서 매긴 사진 번호(0부터)를 넣으세요.`;

export function buildGroupMessages(photos) {
  const content = [];
  photos.forEach((p, i) => {
    content.push({ type: "text", text: `[사진 ${i}]` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: p.mediaType, data: p.base64 },
    });
  });
  content.push({
    type: "text",
    text: `위 사진 ${photos.length}장을 같은 물건끼리 묶어주세요.`,
  });
  return [{ role: "user", content }];
}
