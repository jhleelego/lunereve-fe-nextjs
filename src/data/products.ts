export type Product = {
  id: string;
  sno: number;
  name: string;
  description: string;
  details: string[];
  image: string;
  imageAlt: string;
};

export const products: Product[] = [
  {
    id: "sno-12",
    sno: 12,
    name: "벨크로 가리개 암막 커튼",
    description:
      "벨크로 방식으로 간편하게 설치하는 암막 커튼입니다. 빛 차단과 인테리어를 동시에 만족시키는 가리개 솔루션입니다.",
    details: ["벨크로 간편 설치", "암막 차광", "가리개 커튼"],
    image: "/products/12/main.png",
    imageAlt: "륀레브 벨크로 가리개 암막 커튼",
  },
  {
    id: "sno-7",
    sno: 7,
    name: "허그쿠션",
    description:
      "달 모양의 대형 허그 쿠션으로 침대, 소파, 바닥 어디서든 편안한 독서와 휴식을 제공합니다. 독서, 게이밍, 휴식 시 몸을 편안하게 받쳐주며 5가지 컬러로 선택할 수 있습니다.",
    details: ["대형 달 허그 디자인", "5색상", "독서·게이밍 겸용"],
    image: "/products/7/main.png",
    imageAlt: "륀레브 게임 독서 대형 달 허그 쿠션",
  },
  {
    id: "sno-5",
    sno: 5,
    name: "비접착식 애완매트",
    description:
      "비접착식 논슬립 타일 카페트로 셀프 DIY가 가능합니다. 반려동물 미끄럼 방지, 소음 완화 등 다용도로 활용할 수 있습니다.",
    details: ["비접착식", "미끄럼방지", "반려동물 매트"],
    image: "/products/5/main.png",
    imageAlt: "륀레브 비접착식 논슬립 타일 카페트",
  },
  {
    id: "sno-4",
    sno: 4,
    name: "썬캐쳐",
    description:
      "햇빛을 받으면 아름다운 무지개빛을 내뿜는 크리스탈 모빌 썬캐쳐입니다. 창가에 걸어 두면 은은한 빛의 굴절로 공간에 포인트를 더하는 인테리어 소품입니다.",
    details: ["크리스탈 모빌", "인테리어 장식", "12종"],
    image: "/products/4/main.png",
    imageAlt: "륀레브 썬캐쳐 크리스탈 모빌 인테리어 장식 12종",
  },
  {
    id: "sno-3",
    sno: 3,
    name: "접착식 애완매트",
    description:
      "접착식 타일 카페트로 바닥, 베란다, 캣타워 등 원하는 공간에 쉽게 붙여 사용할 수 있습니다. 반려동물 미끄럼 방지와 소음 완화에 효과적입니다.",
    details: ["접착식 DIY", "반려동물 매트", "캣타워"],
    image: "/products/3/main.png",
    imageAlt: "륀레브 접착식 셀프 DIY 타일 카페트",
  },
  {
    id: "sno-2",
    sno: 2,
    name: "커튼 바란스",
    description:
      "주방·중문 등 다양한 공간에 맞는 전사이즈 커튼 바란스입니다. 봉이 포함되어 있어 바로 설치할 수 있으며, 5가지 디자인으로 선택 가능합니다.",
    details: ["봉 포함 세트", "전사이즈 30~200", "주방·중문 가리개"],
    image: "/products/2/main.png",
    imageAlt: "륀레브 5종 전사이즈 봉 포함 커튼 바란스",
  },
  {
    id: "sno-1",
    sno: 1,
    name: "다리찢기기구",
    description:
      "집에서 셀프로 다리 유연성을 기를 수 있는 스트레칭 기구입니다. 밴드 세트가 함께 구성되어 필라테스, 요가 스트레칭에 활용할 수 있습니다.",
    details: ["밴드 세트 포함", "셀프 스트레칭", "필라테스·요가"],
    image: "/products/1/main.png",
    imageAlt: "륀레브 다리찢기 기구 + 밴드 세트",
  },
];
