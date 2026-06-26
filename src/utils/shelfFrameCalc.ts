/** 모듈형 철제 선반 (W×D×H단) 부품 산출 — 임시 계산기 */

export type ShelfSize = { w: number; d: number; h: number };

/** 사용자 지정 규격만 */
export const PRESET_SHELF_SIZES: ShelfSize[] = [
  { w: 2, d: 1, h: 1 },
  { w: 2, d: 1, h: 2 },
  { w: 2, d: 1, h: 3 },
  { w: 2, d: 2, h: 1 },
  { w: 2, d: 2, h: 2 },
  { w: 2, d: 2, h: 3 },
  { w: 3, d: 2, h: 1 },
  { w: 3, d: 2, h: 2 },
  { w: 3, d: 2, h: 3 },
  { w: 3, d: 2, h: 4 },
  { w: 3, d: 3, h: 1 },
  { w: 3, d: 3, h: 2 },
  { w: 3, d: 3, h: 3 },
  { w: 3, d: 3, h: 4 },
  { w: 4, d: 2, h: 1 },
  { w: 4, d: 2, h: 2 },
  { w: 4, d: 2, h: 3 },
  { w: 4, d: 2, h: 4 },
  { w: 4, d: 3, h: 1 },
  { w: 4, d: 3, h: 2 },
  { w: 4, d: 3, h: 3 },
  { w: 4, d: 3, h: 4 },
  { w: 4, d: 4, h: 1 },
  { w: 4, d: 4, h: 2 },
  { w: 4, d: 4, h: 3 },
  { w: 4, d: 4, h: 4 },
];

export type FaceKind = "front" | "back" | "left" | "right" | "top" | "inner";

export const FACE_META: Record<
  FaceKind,
  { label: string; stroke: string; fill: string }
> = {
  front: { label: "앞면", stroke: "#1D4ED8", fill: "#60A5FA" },
  back: { label: "뒷면", stroke: "#6D28D9", fill: "#A78BFA" },
  left: { label: "왼쪽", stroke: "#C2410C", fill: "#FB923C" },
  right: { label: "오른쪽", stroke: "#BE185D", fill: "#F472B6" },
  top: { label: "천장", stroke: "#0F766E", fill: "#2DD4BF" },
  inner: { label: "내부", stroke: "#44403C", fill: "#D6D3D1" },
};

/** 면 범례·도면 표시 순서 */
export const FACE_DISPLAY_ORDER: FaceKind[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "inner",
];

export type PartKind =
  | "baseFrame"
  | "coverFrame"
  | "holder"
  | "floorHolder"
  | "fixedPin"
  | "cableTie"
  | "door"
  | "latch";

export const PART_META: Record<
  PartKind,
  { label: string; color: string; stroke: string }
> = {
  baseFrame: { label: "기본 프레임", color: "#6B7280", stroke: "#374151" },
  coverFrame: { label: "커버 프레임", color: "#14B8A6", stroke: "#0F766E" },
  holder: { label: "홀더", color: "#F97316", stroke: "#C2410C" },
  floorHolder: { label: "바닥홀더", color: "#78716C", stroke: "#44403C" },
  fixedPin: { label: "고정핀", color: "#DC2626", stroke: "#991B1B" },
  cableTie: { label: "케이블타이", color: "#16A34A", stroke: "#166534" },
  door: { label: "문", color: "#9CA3AF", stroke: "#6B7280" },
  latch: { label: "걸쇠", color: "#9333EA", stroke: "#6B21A8" },
};

export type ShelfParts = Record<PartKind, number>;

export type FrameSegment = {
  id: string;
  axis: "x" | "y" | "z";
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  replacedByDoor: boolean;
  fixedPin: number;
  cableTie: number;
  /** 철제프레임 일련번호 1~n (문 대체 제외) */
  frameNo?: number;
  /** 케이블타이 일련번호 — 변 중앙 순서대로 1~n */
  cableTieNos?: number[];
};

export type HolderJoint = {
  id: string;
  x: number;
  y: number;
  z: number;
  holder: number;
  holderPin: number;
  /** 홀더 일련번호 1~n (바닥홀더 제외) */
  holderNo?: number;
  /** 바닥홀더 일련번호 1~n */
  floorHolderNo?: number;
};

export type DoorPanel = {
  tier: number;
  x1: number;
  x2: number;
  y: number;
  z1: number;
  z2: number;
};

/** 외곽 면 1칸 = 철제프레임 정사각형 1개 */
export type SteelFrameSquare = {
  id: string;
  face: Exclude<FaceKind, "inner">;
  col: number;
  row: number;
  replacedByDoor: boolean;
};

export type ShelfCalcResult = {
  size: ShelfSize;
  label: string;
  parts: ShelfParts;
  segments: FrameSegment[];
  steelFrameSquares: SteelFrameSquare[];
  holders: HolderJoint[];
  doors: DoorPanel[];
};

const MAX_DOOR_COUNT = 2;

/** 문 개수 — 높이 1도 문 1개, h≥2 는 (h-1)개, 최대 2개 */
function getDoorCount(h: number): number {
  return Math.min(MAX_DOOR_COUNT, Math.max(1, h - 1));
}

/** 뒷면 철제프레임 중 문이 대체하는 z칸 상한(미포함) */
function getDoorFrontRowLimit(h: number): number {
  return getDoorCount(h);
}
/** 문이 들어갈 y면 — 뒷면(y=d) */
function getDoorY(d: number): number {
  return d;
}

/** 문이 들어갈 x칸 시작 위치 — 홀수 가로는 가운데, 짝수 가로는 2번째 칸 */
function getDoorX(w: number): number {
  return w % 2 === 1 ? Math.floor(w / 2) : 1;
}

export function sizeLabel({ w, d, h }: ShelfSize): string {
  return `가로 ${w} × 세로 ${d} × 높이 ${h} + 천장`;
}

export function getSegmentFace(
  segment: Pick<FrameSegment, "axis" | "x1" | "y1" | "z1">,
  w: number,
  d: number,
  h: number,
): FaceKind {
  const { axis, x1, y1, z1 } = segment;
  const zi = z1;
  const onTop = zi === h;

  if (axis === "z") {
    if (y1 === 0) return "front";
    if (y1 === d) return "back";
    if (x1 === 0) return "left";
    if (x1 === w) return "right";
    return "inner";
  }

  if (axis === "x") {
    if (onTop) return "top";
    if (y1 === 0) return "front";
    if (y1 === d) return "back";
    return "inner";
  }

  if (onTop) return "top";
  if (x1 === 0) return "left";
  if (x1 === w) return "right";
  return "inner";
}

/** 지정 규격 목록 */
export function listAllShelfSizes(): ShelfSize[] {
  return [...PRESET_SHELF_SIZES];
}

function countMeetingBars(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
): number {
  let meet = 0;
  if (z > 0) meet += 1;
  if (z < h) meet += 1;
  if (x > 0) meet += 1;
  if (x < w) meet += 1;
  if (y > 0) meet += 1;
  if (y < d) meet += 1;
  return meet;
}

function segmentSortKey(segment: FrameSegment): string {
  if (segment.axis === "z") {
    return `0-${segment.x1}-${segment.y1}-${segment.z1}`;
  }
  if (segment.axis === "x") {
    return `1-${segment.z1}-${segment.y1}-${segment.x1}`;
  }
  return `2-${segment.z1}-${segment.x1}-${segment.y1}`;
}

/** 홀더·케이블타이 번호 — rot=0 기준 y=d 쪽부터 1번 (값이 작을수록 우선) */
export function viewDepthForNumbering(
  x: number,
  y: number,
  z: number,
  d: number,
): number {
  return x + (d - y) + z;
}

/** 도면 Z-order — 값이 클수록 화면 앞. rot=0에서 y=d(뒷면·문)이 카메라에 가깝다 */
export function viewDepthForPainting(
  x: number,
  y: number,
  z: number,
  _d: number,
): number {
  return x + y + z;
}

function holderViewDepth(holder: HolderJoint, d: number): number {
  return viewDepthForNumbering(holder.x, holder.y, holder.z, d);
}

function segmentViewDepth(segment: FrameSegment, d: number): number {
  return viewDepthForNumbering(
    (segment.x1 + segment.x2) / 2,
    (segment.y1 + segment.y2) / 2,
    (segment.z1 + segment.z2) / 2,
    d,
  );
}

function assignFrameNumbers(segments: FrameSegment[]): void {
  const active = segments
    .filter((s) => !s.replacedByDoor)
    .sort((a, b) => segmentSortKey(a).localeCompare(segmentSortKey(b)));
  active.forEach((segment, index) => {
    segment.frameNo = index + 1;
  });
}

function assignCableTieNumbers(segments: FrameSegment[], d: number): void {
  const withTies = segments
    .filter((s) => !s.replacedByDoor && s.cableTie > 0)
    .sort((a, b) => segmentViewDepth(a, d) - segmentViewDepth(b, d));
  let counter = 1;
  withTies.forEach((segment) => {
    segment.cableTieNos = [];
    for (let i = 0; i < segment.cableTie; i += 1) {
      segment.cableTieNos.push(counter);
      counter += 1;
    }
  });
}

function assignHolderNumbers(
  holders: HolderJoint[],
  w: number,
  d: number,
  h: number,
): void {
  holders.forEach((holder) => {
    delete holder.holderNo;
  });
  holders
    .filter(
      (holder) =>
        !isFloorHolder(holder, w, d) && isExteriorHolder(holder, w, d, h),
    )
    .sort((a, b) => holderViewDepth(a, d) - holderViewDepth(b, d))
    .forEach((holder, index) => {
      holder.holderNo = index + 1;
    });
}

function assignFloorHolderNumbers(
  holders: HolderJoint[],
  w: number,
  d: number,
): void {
  holders
    .filter((holder) => isFloorHolder(holder, w, d))
    .sort((a, b) => holderViewDepth(a, d) - holderViewDepth(b, d))
    .forEach((holder, index) => {
      holder.floorHolderNo = index + 1;
    });
}

/** 문 열 뒷면(y=d) — 문·걸쇠 구역은 대부분 케이블타이 제외, 걸쇠 없는 반대편(오른쪽) 세로 변만 유지 · 위쪽 가로 변 제외 */
function clearDoorCableTies(
  segments: FrameSegment[],
  doorX: number,
  doorY: number,
  h: number,
): void {
  const onDoorColumnX = (x: number) => x === doorX || x === doorX + 1;
  const doorFrontRowLimit = getDoorFrontRowLimit(h);

  const isLatchVerticalSegment = (segment: FrameSegment) =>
    segment.axis === "z" &&
    segment.x1 === doorX &&
    segment.y1 === doorY &&
    segment.z1 >= 0 &&
    segment.z1 < doorFrontRowLimit;

  const isOppositeDoorVerticalSegment = (segment: FrameSegment) =>
    segment.axis === "z" &&
    segment.x1 === doorX + 1 &&
    segment.y1 === doorY &&
    segment.z1 >= 0 &&
    segment.z1 < doorFrontRowLimit;

  segments.forEach((segment) => {
    if (segment.replacedByDoor) return;
    if (segment.y1 !== doorY) return;
    if (isOppositeDoorVerticalSegment(segment)) return;

    if (isLatchVerticalSegment(segment)) {
      segment.cableTie = 0;
      return;
    }

    if (segment.axis === "z" && onDoorColumnX(segment.x1) && segment.z1 < h) {
      segment.cableTie = 0;
      return;
    }

    if (
      segment.axis === "x" &&
      segment.z1 >= 1 &&
      segment.z1 <= h - 1 &&
      segment.x1 >= doorX &&
      segment.x1 <= doorX + 1
    ) {
      segment.cableTie = 0;
      return;
    }

    if (
      segment.axis === "y" &&
      onDoorColumnX(segment.x1) &&
      segment.z1 >= 1 &&
      segment.z1 <= h - 1
    ) {
      segment.cableTie = 0;
    }
  });
}

/** 내부 칸 구분 프레임 — 케이블타이 없음 */
function clearInnerCableTies(
  segments: FrameSegment[],
  w: number,
  d: number,
  h: number,
): void {
  segments.forEach((segment) => {
    if (segment.replacedByDoor || segment.cableTie === 0) return;
    if (getSegmentFace(segment, w, d, h) === "inner") {
      segment.cableTie = 0;
    }
  });
}

export function isFloorHolder(
  joint: Pick<HolderJoint, "x" | "y" | "z">,
  w: number,
  d: number,
): boolean {
  const { x, y, z } = joint;
  return z === 0 && (x === 0 || x === w || y === 0 || y === d);
}

export function isExteriorHolder(
  joint: Pick<HolderJoint, "x" | "y" | "z">,
  w: number,
  d: number,
  h: number,
): boolean {
  if (isFloorHolder(joint, w, d)) return true;
  const { x, y, z } = joint;
  return x === 0 || x === w || y === 0 || y === d || z === h;
}

export function getSteelFrameSquareCorners(
  square: SteelFrameSquare,
  w: number,
  d: number,
  h: number,
): Array<[number, number, number]> {
  const { face, col, row } = square;
  switch (face) {
    case "front":
      return [
        [col, 0, row],
        [col + 1, 0, row],
        [col + 1, 0, row + 1],
        [col, 0, row + 1],
      ];
    case "back":
      return [
        [col, d, row],
        [col + 1, d, row],
        [col + 1, d, row + 1],
        [col, d, row + 1],
      ];
    case "left":
      return [
        [0, col, row],
        [0, col + 1, row],
        [0, col + 1, row + 1],
        [0, col, row + 1],
      ];
    case "right":
      return [
        [w, col, row],
        [w, col + 1, row],
        [w, col + 1, row + 1],
        [w, col, row + 1],
      ];
    case "top":
      return [
        [col, row, h],
        [col + 1, row, h],
        [col + 1, row + 1, h],
        [col, row + 1, h],
      ];
  }
}

function buildSteelFrameSquares(
  w: number,
  d: number,
  h: number,
  doorX: number,
): SteelFrameSquare[] {
  const squares: SteelFrameSquare[] = [];

  for (let xi = 0; xi < w; xi += 1) {
    for (let zi = 0; zi < h; zi += 1) {
      squares.push({
        id: `sq-f-${xi}-${zi}`,
        face: "front",
        col: xi,
        row: zi,
        replacedByDoor: false,
      });
    }
  }
  for (let xi = 0; xi < w; xi += 1) {
    for (let zi = 0; zi < h; zi += 1) {
      squares.push({
        id: `sq-b-${xi}-${zi}`,
        face: "back",
        col: xi,
        row: zi,
        replacedByDoor: xi === doorX && zi < getDoorFrontRowLimit(h),
      });
    }
  }
  for (let yi = 0; yi < d; yi += 1) {
    for (let zi = 0; zi < h; zi += 1) {
      squares.push({
        id: `sq-l-${yi}-${zi}`,
        face: "left",
        col: yi,
        row: zi,
        replacedByDoor: false,
      });
    }
  }
  for (let yi = 0; yi < d; yi += 1) {
    for (let zi = 0; zi < h; zi += 1) {
      squares.push({
        id: `sq-r-${yi}-${zi}`,
        face: "right",
        col: yi,
        row: zi,
        replacedByDoor: false,
      });
    }
  }
  for (let xi = 0; xi < w; xi += 1) {
    for (let yi = 0; yi < d; yi += 1) {
      squares.push({
        id: `sq-t-${xi}-${yi}`,
        face: "top",
        col: xi,
        row: yi,
        replacedByDoor: false,
      });
    }
  }

  return squares;
}

/**
 * 규칙:
 * - 바닥(z=0) 수평 프레임 없음
 * - z=1..h 각 층 수평 그리드 + 최상단 천장(동일 그리드)
 * - 기본 프레임: 외곽 면(앞·뒤·좌·우) 1칸 = 정사각형 1개 (문 대체 제외)
 * - 커버 프레임: 천장 면 1칸 = 정사각형 1개
 * - 케이블타이: 외곽 면(앞·뒤·좌·우·천장) 프레임 변마다 1 · 내부·문 구역 제외 · 문 걸쇠 반대편(오른쪽) 세로 변만 유지
 * - 홀더: 꼭지점 · z=0 바닥 외곽 = 바닥홀더(일반 홀더와 별도)
 * - 문: 높이 1도 1개 · h≥2 는 (h-1)개(최대 2). 아래부터 뒷면(y=d) 같은 x칸에 연달아. 문 1개 = 뒷면 정사각형 1개 대체
 * - 걸쇠: 문당 4
 */
export function calcShelf(size: ShelfSize): ShelfCalcResult {
  const { w, d, h } = size;
  const segments: FrameSegment[] = [];
  const doors: DoorPanel[] = [];

  const doorCount = getDoorCount(h);

  // 수직 프레임
  for (let xi = 0; xi <= w; xi += 1) {
    for (let yi = 0; yi <= d; yi += 1) {
      for (let zi = 0; zi < h; zi += 1) {
        segments.push({
          id: `v-${xi}-${yi}-${zi}`,
          axis: "z",
          x1: xi,
          y1: yi,
          z1: zi,
          x2: xi,
          y2: yi,
          z2: zi + 1,
          replacedByDoor: false,
          fixedPin: 1,
          cableTie: 1,
        });
      }
    }
  }

  // 수평 z=1..h
  for (let zi = 1; zi <= h; zi += 1) {
    for (let xi = 0; xi < w; xi += 1) {
      for (let yi = 0; yi <= d; yi += 1) {
        segments.push({
          id: `x-${xi}-${yi}-${zi}`,
          axis: "x",
          x1: xi,
          y1: yi,
          z1: zi,
          x2: xi + 1,
          y2: yi,
          z2: zi,
          replacedByDoor: false,
          fixedPin: 1,
          cableTie: 1,
        });
      }
    }
    for (let yi = 0; yi < d; yi += 1) {
      for (let xi = 0; xi <= w; xi += 1) {
        segments.push({
          id: `y-${xi}-${yi}-${zi}`,
          axis: "y",
          x1: xi,
          y1: yi,
          z1: zi,
          x2: xi,
          y2: yi + 1,
          z2: zi,
          replacedByDoor: false,
          fixedPin: 1,
          cableTie: 1,
        });
      }
    }
  }

  // 문: 1~(h-1)단 뒷면(y=d) 수평 x프레임 1개씩 대체, 가운데(또는 짝수 가로 2번째) x칸에 세로로 연달아
  const doorX = getDoorX(w);
  const doorY = getDoorY(d);
  const doorTierEnd = getDoorCount(h);
  for (let tier = 1; tier <= doorTierEnd; tier += 1) {
    const target = segments.find(
      (s) =>
        s.axis === "x" &&
        !s.replacedByDoor &&
        s.y1 === doorY &&
        s.z1 === tier &&
        s.x1 === doorX,
    );
    if (target) {
      target.replacedByDoor = true;
      target.fixedPin = 0;
      target.cableTie = 0;
    }
    doors.push({
      tier,
      x1: doorX,
      x2: doorX + 1,
      y: doorY,
      z1: tier - 1,
      z2: tier,
    });
  }

  clearDoorCableTies(segments, doorX, doorY, h);
  clearInnerCableTies(segments, w, d, h);

  const holders: HolderJoint[] = [];
  for (let xi = 0; xi <= w; xi += 1) {
    for (let yi = 0; yi <= d; yi += 1) {
      for (let zi = 0; zi <= h; zi += 1) {
        const meet = countMeetingBars(xi, yi, zi, w, d, h);
        if (meet === 0) continue;
        holders.push({
          id: `h-${xi}-${yi}-${zi}`,
          x: xi,
          y: yi,
          z: zi,
          holder: 1,
          holderPin: meet,
        });
      }
    }
  }

  assignFrameNumbers(segments);
  assignCableTieNumbers(segments, d);
  assignHolderNumbers(holders, w, d, h);
  assignFloorHolderNumbers(holders, w, d);

  const steelFrameSquares = buildSteelFrameSquares(w, d, h, doorX);
  const activeSteelFrames = steelFrameSquares.filter((s) => !s.replacedByDoor);
  const coverFrameCount = activeSteelFrames.filter(
    (s) => s.face === "top",
  ).length;
  const baseFrameCount = activeSteelFrames.length - coverFrameCount;

  const activeSegments = segments.filter((s) => !s.replacedByDoor);
  const fixedPinEdge = activeSegments.reduce((sum, s) => sum + s.fixedPin, 0);
  const floorHolderCount = holders.filter((h) => isFloorHolder(h, w, d)).length;
  const holderCount = holders.length - floorHolderCount;
  const holderPin = holders.reduce((sum, item) => sum + item.holderPin, 0);
  const cableTie = activeSegments.reduce((sum, s) => sum + s.cableTie, 0);

  const parts: ShelfParts = {
    baseFrame: baseFrameCount,
    coverFrame: coverFrameCount,
    holder: holderCount,
    floorHolder: floorHolderCount,
    fixedPin: fixedPinEdge + holderPin,
    cableTie,
    door: doorCount,
    latch: doorCount * 4,
  };

  return {
    size,
    label: sizeLabel(size),
    parts,
    segments,
    steelFrameSquares,
    holders,
    doors,
  };
}

export function calcAllShelves(): ShelfCalcResult[] {
  return listAllShelfSizes().map(calcShelf);
}

function roundUpToMultiple(value: number, multiple: number): number {
  if (multiple <= 0) return value;
  return Math.ceil(value / multiple) * multiple;
}

/** 주문 수량 반영 시 올림 배수 — 홀더·바닥홀더·걸쇠 4, 케이블타이 10 */
export const ORDER_QUANTITY_ROUND_MULTIPLE: Partial<
  Record<PartKind, number>
> = {
  holder: 4,
  floorHolder: 4,
  cableTie: 10,
  latch: 4,
};

/** 주문 수량 반영 — 기본/커버/문은 ×수량, 홀더·바닥홀더·케이블타이·걸쇠는 여분·배수 규칙 적용 */
export function applyOrderQuantity(
  parts: ShelfParts,
  quantity: number,
): ShelfParts {
  const q = Math.max(1, Math.floor(quantity) || 1);

  return {
    baseFrame: parts.baseFrame * q,
    coverFrame: parts.coverFrame * q,
    door: parts.door * q,
    fixedPin: parts.fixedPin * q,
    holder: roundUpToMultiple(
      parts.holder * q + 2,
      ORDER_QUANTITY_ROUND_MULTIPLE.holder ?? 4,
    ),
    floorHolder: roundUpToMultiple(
      parts.floorHolder * q + 2,
      ORDER_QUANTITY_ROUND_MULTIPLE.floorHolder ?? 4,
    ),
    cableTie: roundUpToMultiple(
      parts.cableTie * q + 9,
      ORDER_QUANTITY_ROUND_MULTIPLE.cableTie ?? 10,
    ),
    latch: roundUpToMultiple(
      parts.latch * q,
      ORDER_QUANTITY_ROUND_MULTIPLE.latch ?? 4,
    ),
  };
}

/** 화이트·블랙 — 수량 1 기준(여분·배수 반영) 값 × 행 수량 */
export function applyRowOrderMultiplier(
  parts: ShelfParts,
  rowQuantity: number,
): ShelfParts {
  const q = Math.max(1, Math.floor(rowQuantity) || 1);
  const unit = applyOrderQuantity(parts, 1);
  return {
    baseFrame: unit.baseFrame * q,
    coverFrame: unit.coverFrame * q,
    holder: unit.holder * q,
    floorHolder: unit.floorHolder * q,
    fixedPin: unit.fixedPin * q,
    cableTie: unit.cableTie * q,
    door: unit.door * q,
    latch: unit.latch * q,
  };
}

/** 기본 테이블 표시 — 예: 8(6+2), 20(11+9), 4(2+2) */
export function formatOrderQuantityPartDisplays(
  parts: ShelfParts,
  quantity: number,
): Record<PartKind, string> {
  const q = Math.max(1, Math.floor(quantity) || 1);
  const applied = applyOrderQuantity(parts, quantity);

  const holderScaled = parts.holder * q;
  const floorScaled = parts.floorHolder * q;
  const cableScaled = parts.cableTie * q;
  const latchScaled = parts.latch * q;

  const formatLatchDisplay = (): string => {
    const result = applied.latch;
    if (result > latchScaled) {
      return `${result}(${latchScaled})`;
    }
    if (result % 2 === 0) {
      const half = result / 2;
      return `${result}(${half}+${half})`;
    }
    return String(result);
  };

  return {
    baseFrame: String(applied.baseFrame),
    coverFrame: String(applied.coverFrame),
    door: String(applied.door),
    fixedPin: String(applied.fixedPin),
    holder: `${applied.holder}(${holderScaled}+2)`,
    floorHolder: `${applied.floorHolder}(${floorScaled}+2)`,
    cableTie: `${applied.cableTie}(${cableScaled}+9)`,
    latch: formatLatchDisplay(),
  };
}
