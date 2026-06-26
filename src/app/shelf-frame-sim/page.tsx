"use client";

import { useCallback, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import { SHELF_FRAME_SIM_ENABLED } from "@/config/features";
import ShelfFrameSimAccessDenied from "./ShelfFrameSimAccessDenied";
import {
  FACE_META,
  FACE_DISPLAY_ORDER,
  PART_META,
  type FaceKind,
  type PartKind,
  type ShelfCalcResult,
  type ShelfSize,
  type ShelfParts,
  calcAllShelves,
  calcShelf,
  applyRowOrderMultiplier,
  formatOrderQuantityPartDisplays,
  ORDER_QUANTITY_ROUND_MULTIPLE,
  getSegmentFace,
  getSteelFrameSquareCorners,
  isExteriorHolder,
  isFloorHolder,
  sizeLabel,
} from "@/utils/shelfFrameCalc";

const ISO_DX = 0.866;
const ISO_DY = 0.5;
const DEG = 180 / Math.PI;

type Point2 = { x: number; y: number };
type Point3 = { x: number; y: number; z: number };

function rotateX(p: Point3, angle: number): Point3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

function rotateY(p: Point3, angle: number): Point3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function rotateZ(p: Point3, angle: number): Point3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

function transformPoint(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  rotX: number,
  rotY: number,
  rotZ: number,
): Point3 {
  const cx = w / 2;
  const cy = d / 2;
  const cz = h / 2;
  let p: Point3 = { x: x - cx, y: y - cy, z: z - cz };
  p = rotateZ(p, rotZ);
  p = rotateX(p, rotX);
  p = rotateY(p, rotY);
  return { x: p.x + cx, y: p.y + cy, z: p.z + cz };
}

function projectPoint(
  p: Point3,
  scale: number,
  ox: number,
  oy: number,
): Point2 {
  return {
    x: ox + (p.x - p.y) * scale * ISO_DX,
    y: oy + (p.x + p.y) * scale * ISO_DY - p.z * scale * 0.95,
  };
}

function projectRotated(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  rotX: number,
  rotY: number,
  rotZ: number,
  scale: number,
  ox: number,
  oy: number,
): { screen: Point2; depth: number } {
  const t = transformPoint(x, y, z, w, d, h, rotX, rotY, rotZ);
  return {
    screen: projectPoint(t, scale, ox, oy),
    // 등각 투영 방향과 맞춤 — rot=0에서 y=d(뒷면·문)이 앞에 그려짐
    depth: t.x + t.y + t.z,
  };
}

function getShelfAnchorScreen(
  w: number,
  d: number,
  h: number,
  scale: number,
  ox: number,
  oy: number,
): Point2 {
  return projectPoint({ x: w / 2, y: d / 2, z: h / 2 }, scale, ox, oy);
}

/** 회전해도 화면 배율이 변하지 않도록 0° 기준 고정 viewBox */
function getStableViewBox(
  w: number,
  d: number,
  h: number,
  scale: number,
  ox: number,
  oy: number,
  pinR: number,
  fontSm: number,
  fontMd: number,
  strokeW: number,
): { x: number; y: number; width: number; height: number } {
  const anchor = getShelfAnchorScreen(w, d, h, scale, ox, oy);
  const project0 = (x: number, y: number, z: number) =>
    projectRotated(x, y, z, w, d, h, 0, 0, 0, scale, ox, oy).screen;

  const cornerCoords: Array<[number, number, number]> = [
    [0, 0, 0],
    [w, 0, 0],
    [w, d, 0],
    [0, d, 0],
    [0, 0, h],
    [w, 0, h],
    [w, d, h],
    [0, d, h],
  ];

  let maxDist = 0;
  cornerCoords.forEach(([x, y, z]) => {
    const p = project0(x, y, z);
    maxDist = Math.max(maxDist, Math.hypot(p.x - anchor.x, p.y - anchor.y));
  });

  const labelMargin = Math.max(pinR * 1.5, fontMd * 1.2, strokeW * 2);
  const halfExtent = maxDist * 1.1 + labelMargin;

  return {
    x: anchor.x - halfExtent,
    y: anchor.y - halfExtent,
    width: halfExtent * 2,
    height: halfExtent * 2,
  };
}

function pointOnSegment(
  p1: Point2,
  p2: Point2,
  t: number,
  normalOffset = 0,
): Point2 {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return {
    x: p1.x + dx * t + nx * normalOffset,
    y: p1.y + dy * t + ny * normalOffset,
  };
}

function isSequenceEndpoint(no: number, total: number): boolean {
  return total > 0 && (no === 1 || no === total);
}

function labelTextY(y: number, fontSize: number): number {
  return y + fontSize * 0.35;
}

/** 바닥홀더 — 아래 평면, 위쪽 반원 */
function floorHolderSemicirclePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`;
}

function PartLegendIcon({ kind }: { kind: PartKind }) {
  const meta = PART_META[kind];
  const box = 16;

  if (kind === "baseFrame" || kind === "coverFrame") {
    return (
      <svg
        width={14}
        height={14}
        viewBox={`0 0 ${box} ${box}`}
        className="shrink-0"
        aria-hidden
      >
        <rect
          x={3}
          y={3}
          width={10}
          height={10}
          fill="none"
          stroke={meta.stroke}
          strokeWidth={2}
        />
      </svg>
    );
  }

  if (kind === "door") {
    return (
      <svg
        width={14}
        height={14}
        viewBox={`0 0 ${box} ${box}`}
        className="shrink-0"
        aria-hidden
      >
        <rect
          x={3}
          y={3}
          width={10}
          height={10}
          fill={meta.color}
          fillOpacity={0.85}
          stroke={meta.stroke}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  if (kind === "floorHolder") {
    return (
      <svg
        width={14}
        height={14}
        viewBox={`0 0 ${box} ${box}`}
        className="shrink-0"
        aria-hidden
      >
        <path
          d={floorHolderSemicirclePath(8, 12, 5)}
          fill={meta.color}
          stroke={meta.stroke}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  if (kind === "holder") {
    return (
      <svg
        width={14}
        height={14}
        viewBox={`0 0 ${box} ${box}`}
        className="shrink-0"
        aria-hidden
      >
        <circle
          cx={8}
          cy={8}
          r={5}
          fill={meta.color}
          stroke={meta.stroke}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  if (kind === "cableTie") {
    return (
      <svg
        width={14}
        height={14}
        viewBox={`0 0 ${box} ${box}`}
        className="shrink-0"
        aria-hidden
      >
        <rect
          x={3}
          y={5}
          width={10}
          height={6}
          rx={1}
          fill={meta.color}
          stroke={meta.stroke}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  return (
    <svg
      width={14}
      height={14}
      viewBox={`0 0 ${box} ${box}`}
      className="shrink-0"
      aria-hidden
    >
      <rect
        x={4}
        y={4}
        width={8}
        height={8}
        rx={1}
        fill={meta.color}
        stroke={meta.stroke}
        strokeWidth={1.5}
      />
    </svg>
  );
}

type LabeledPartKind = Extract<PartKind, "holder" | "floorHolder" | "cableTie">;

/** 부품 표시 순서: 기본 프레임 → 커버 프레임 → 문 → 홀더 → 바닥홀더 → 케이블타이 → 걸쇠 */
const PART_DISPLAY_ORDER = [
  "baseFrame",
  "coverFrame",
  "door",
  "holder",
  "floorHolder",
  "cableTie",
  "latch",
] as const satisfies readonly PartKind[];

type ShelfDisplayPartKind = (typeof PART_DISPLAY_ORDER)[number];

/** 상단 도형·패널 — 1:1, 각 최대 704px */
const SHELF_LAYOUT_MAX_H_CLASS = "max-h-[704px]";
const SHELF_TOP_PANEL_CLASS = `min-h-0 min-w-0 w-full max-w-[704px] ${SHELF_LAYOUT_MAX_H_CLASS} flex-1 basis-0`;
const SHELF_VIEW_ROW_CLASS = `flex w-full max-w-[2400px] mx-auto gap-4 min-h-0 ${SHELF_LAYOUT_MAX_H_CLASS} items-stretch overflow-hidden`;
const SHELF_BASIC_TABLE_COLUMN_CLASS = `min-h-0 shrink-0 ${SHELF_LAYOUT_MAX_H_CLASS} overflow-auto rounded-lg border border-gray-200 bg-white`;
const SHELF_DIAGRAM_COLUMN_CLASS = `${SHELF_TOP_PANEL_CLASS} flex aspect-square overflow-hidden`;
const SHELF_DIAGRAM_FRAME_CLASS =
  "flex h-full w-full max-h-[704px] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white";

type ShelfColor = "white" | "black";

function shelfSizeKey(size: ShelfSize): string {
  return `${size.w}-${size.d}-${size.h}`;
}

/** 테이블 NO 기준 기본 고객수량 — 1~6: 4, 7~14: 3, 15~26: 2 */
function getDefaultCustomerQuantityByRowNo(rowNo: number): number {
  if (rowNo <= 6) return 4;
  if (rowNo <= 14) return 3;
  return 2;
}

function buildInitialColorQuantities(
  rows: ShelfCalcResult[],
): Record<ShelfColor, Record<string, number>> {
  const quantities = Object.fromEntries(
    rows.map((row, index) => [
      shelfSizeKey(row.size),
      getDefaultCustomerQuantityByRowNo(index + 1),
    ]),
  ) as Record<string, number>;

  return { white: { ...quantities }, black: { ...quantities } };
}

const SHELF_WIDTH_GROUP_BORDER_CLASS = "border-b-2 border-b-gray-600";
const SHELF_ROW_BORDER_CLASS = "border-b border-b-gray-200";
const SHELF_TABLE_ROW_HEIGHT_CLASS = "h-6 max-h-6 min-h-6";
const SHELF_TABLE_NUM_CELL_CLASS = `${SHELF_TABLE_ROW_HEIGHT_CLASS} px-1 leading-6 align-middle overflow-hidden`;
const SHELF_SPEC_CELL_CLASS = `${SHELF_TABLE_ROW_HEIGHT_CLASS} px-2 leading-6 align-middle whitespace-nowrap`;
const SHELF_NO_CELL_CLASS = `${SHELF_TABLE_ROW_HEIGHT_CLASS} px-1.5 leading-6 align-middle text-center tabular-nums whitespace-nowrap w-[1%]`;

function ShelfTableCopyButton({
  copied,
  onClick,
  title,
}: {
  copied: boolean;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
      title={copied ? "복사됨" : (title ?? "표 데이터 복사")}
      aria-label={copied ? "복사됨" : (title ?? "표 데이터 복사")}
    >
      {copied ? (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

function getPartColumnHeaderLabel(kind: PartKind): string {
  return PART_META[kind].label;
}

const SHELF_WHITE_SECTION_BORDER = "border-l-2 border-l-blue-500";
const SHELF_BLACK_SECTION_BORDER = "border-l-2 border-l-gray-800";
const SHELF_WHITE_SECTION_CELL_BG = "bg-slate-50";
const SHELF_WHITE_SECTION_HEAD_BG = "bg-slate-100 text-gray-800";
const SHELF_BLACK_SECTION_HEAD_BG = "bg-gray-900 text-white";
const SHELF_BASIC_SECTION_HEAD_BG = "bg-gray-100 text-gray-800";
const SHELF_BASIC_ACTIVE_ROW_CLASS = "bg-blue-200 text-blue-950";
const SHELF_BASIC_IDLE_ROW_CLASS = "bg-white text-gray-900 hover:bg-blue-50";
const SHELF_WHITE_ACTIVE_ROW_CLASS = "bg-blue-100 text-blue-950";
const SHELF_BLACK_ACTIVE_ROW_CLASS = "bg-gray-200 text-gray-900";
const SHELF_SUMMARY_ROW_BORDER = "border-t-2 border-gray-500";

function sumColorSection(
  rows: ShelfCalcResult[],
  quantities: Record<string, number>,
): { parts: Record<PartKind, number>; quantitySum: number } {
  const totals = Object.fromEntries(
    PART_DISPLAY_ORDER.map((kind) => [kind, 0]),
  ) as Record<PartKind, number>;
  let quantitySum = 0;

  rows.forEach((row) => {
    const key = shelfSizeKey(row.size);
    const q = quantities[key] ?? 1;
    quantitySum += q;
    const multiplied = applyRowOrderMultiplier(row.parts, q);
    PART_DISPLAY_ORDER.forEach((kind) => {
      totals[kind] += multiplied[kind];
    });
  });

  return { parts: totals, quantitySum };
}

function getPartOrderQuantityDivideSuffix(multiple: number): string {
  return `(÷${multiple})`;
}

function getPartOrderQuantityBundleSuffix(multiple: number): string {
  return `(1묶음당 ${multiple}개)`;
}

function getPartOrderQuantityHeaderLabel(kind: PartKind): string {
  const label = PART_META[kind].label;
  const multiple = ORDER_QUANTITY_ROUND_MULTIPLE[kind];
  return multiple
    ? `${label}${getPartOrderQuantityBundleSuffix(multiple)}`
    : label;
}

function getPartOrderQuantityHeaderLabelForClipboard(kind: PartKind): string {
  const label = PART_META[kind].label;
  const multiple = ORDER_QUANTITY_ROUND_MULTIPLE[kind];
  return multiple
    ? `${label}${getPartOrderQuantityDivideSuffix(multiple)}`
    : label;
}

const ORDER_QUANTITY_PART_ZH: Record<
  ShelfColor,
  Record<(typeof PART_DISPLAY_ORDER)[number], string>
> = {
  white: {
    baseFrame: "白35*35铁网",
    coverFrame: "35*35黄色方片",
    door: "白35*35铁网门",
    holder: "白色球形卡扣",
    floorHolder: "白卡扣1包【4个】",
    cableTie: "扎带",
    latch: "门扣",
  },
  black: {
    baseFrame: "黑35*35铁网",
    coverFrame: "35*35黄色方片",
    door: "黑35*35铁网门",
    holder: "黑色球形卡扣",
    floorHolder: "黑卡扣1包【4个】",
    cableTie: "扎带",
    latch: "门扣",
  },
};

function getPartOrderQuantityHeaderLabelForColor(
  kind: ShelfDisplayPartKind,
  color: ShelfColor,
): string {
  const label = PART_META[kind].label;
  const zh = ORDER_QUANTITY_PART_ZH[color][kind];
  const multiple = ORDER_QUANTITY_ROUND_MULTIPLE[kind];
  const withZh = `${label}(${zh})`;
  return multiple
    ? `${withZh}${getPartOrderQuantityDivideSuffix(multiple)}`
    : withZh;
}

function OrderQuantityPartHeaderCell({
  kind,
  color,
}: {
  kind: ShelfDisplayPartKind;
  color: ShelfColor;
}) {
  const label = PART_META[kind].label;
  const multiple = ORDER_QUANTITY_ROUND_MULTIPLE[kind];
  const zh = ORDER_QUANTITY_PART_ZH[color][kind];
  const mainLabel = multiple
    ? `${label}${getPartOrderQuantityBundleSuffix(multiple)}`
    : label;

  return (
    <div className="flex flex-col items-end gap-0 leading-tight">
      <span className="whitespace-nowrap">{mainLabel}</span>
      <span
        className={`whitespace-nowrap text-[10px] font-normal leading-tight ${
          color === "black" ? "text-gray-300" : "text-gray-600"
        }`}
      >
        {zh}
      </span>
    </div>
  );
}

function toOrderQuantityParts(summary: {
  parts: Record<PartKind, number>;
}): Record<PartKind, number> {
  return Object.fromEntries(
    PART_DISPLAY_ORDER.map((kind) => {
      const multiple = ORDER_QUANTITY_ROUND_MULTIPLE[kind];
      const value = summary.parts[kind];
      return [kind, multiple ? value / multiple : value];
    }),
  ) as Record<PartKind, number>;
}

function mergeColorSummaries(
  whiteSummary: { parts: Record<PartKind, number>; quantitySum: number },
  blackSummary: { parts: Record<PartKind, number>; quantitySum: number },
): { parts: Record<PartKind, number>; quantitySum: number } {
  return {
    parts: Object.fromEntries(
      PART_DISPLAY_ORDER.map((kind) => [
        kind,
        whiteSummary.parts[kind] + blackSummary.parts[kind],
      ]),
    ) as Record<PartKind, number>,
    quantitySum: whiteSummary.quantitySum + blackSummary.quantitySum,
  };
}

function toOrderQuantityShelfParts(parts: ShelfParts): Record<PartKind, number> {
  return toOrderQuantityParts({ parts });
}

type ShelfColorTableVariant = "customer" | "order";

function ShelfMergedSummaryTable({
  title,
  parts,
  quantitySum,
  useOrderQuantityHeaders,
}: {
  title: string;
  parts: Record<PartKind, number>;
  quantitySum: number;
  useOrderQuantityHeaders: boolean;
}) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold text-gray-700">{title}</p>
      <table className="w-max text-xs border-collapse rounded-md border border-gray-200 bg-white">
        <colgroup>
          {Array.from({ length: PART_DISPLAY_ORDER.length + 1 }, (_, i) => (
            <col key={i} className="w-[1%]" />
          ))}
        </colgroup>
        <thead>
          <tr
            className={`border-b border-gray-300 ${SHELF_TABLE_ROW_HEIGHT_CLASS}`}
          >
            {PART_DISPLAY_ORDER.map((kind) => (
              <th
                key={`${title}-head-${kind}`}
                className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} border border-gray-300 text-right font-semibold whitespace-nowrap`}
              >
                {useOrderQuantityHeaders
                  ? getPartOrderQuantityHeaderLabel(kind)
                  : PART_META[kind].label}
              </th>
            ))}
            <th
              className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} border border-gray-300 text-right font-semibold whitespace-nowrap`}
            >
              수량
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className={SHELF_TABLE_ROW_HEIGHT_CLASS}>
            {PART_DISPLAY_ORDER.map((kind) => (
              <td
                key={`${title}-sum-${kind}`}
                className={`${SHELF_TABLE_NUM_CELL_CLASS} border border-gray-300 text-right tabular-nums font-semibold whitespace-nowrap bg-white`}
              >
                {parts[kind].toLocaleString()}
              </td>
            ))}
            <td
              className={`${SHELF_TABLE_NUM_CELL_CLASS} border border-gray-300 text-right tabular-nums font-semibold bg-white`}
            >
              {quantitySum.toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ShelfColorDataTable({
  title,
  variant,
  rows,
  selectedKey,
  onSelect,
  colorQuantities,
  onColorQuantityChange,
  onOpenBulkQuantity,
  onCopyTable,
  copied,
  whiteSummary,
  blackSummary,
  whiteOrderParts,
  blackOrderParts,
  mergedSummary,
}: {
  title: string;
  variant: ShelfColorTableVariant;
  rows: ShelfCalcResult[];
  selectedKey: string;
  onSelect: (size: ShelfSize) => void;
  colorQuantities: Record<ShelfColor, Record<string, number>>;
  onColorQuantityChange?: (
    color: ShelfColor,
    size: ShelfSize,
    quantity: number,
  ) => void;
  onOpenBulkQuantity?: (color: ShelfColor) => void;
  onCopyTable?: (e: React.MouseEvent) => void;
  copied?: boolean;
  whiteSummary: { parts: Record<PartKind, number>; quantitySum: number };
  blackSummary: { parts: Record<PartKind, number>; quantitySum: number };
  whiteOrderParts: Record<PartKind, number>;
  blackOrderParts: Record<PartKind, number>;
  mergedSummary: { parts: Record<PartKind, number>; quantitySum: number };
}) {
  const partColCount = PART_DISPLAY_ORDER.length;
  const isCustomer = variant === "customer";
  const mergedOrderParts = useMemo(
    () => toOrderQuantityParts(mergedSummary),
    [mergedSummary],
  );

  const partHeadCellClass = (sectionHeadBg: string, sectionBorder = "") =>
    `${SHELF_TABLE_NUM_CELL_CLASS} ${sectionHeadBg} text-right font-semibold ${
      isCustomer ? "whitespace-nowrap" : "!h-auto min-h-6 py-0.5 whitespace-normal"
    } ${sectionBorder}`;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold text-gray-700">{title}</p>
      <table className="w-max min-w-full text-xs border-collapse rounded-md border border-gray-200 bg-white">
        <colgroup>
          {Array.from({ length: 2 + (partColCount + 1) * 2 }, (_, i) => (
            <col key={i} className="w-[1%]" />
          ))}
        </colgroup>
        <thead>
          <tr
            className={`border-b border-gray-300 ${SHELF_TABLE_ROW_HEIGHT_CLASS}`}
          >
            <th
              rowSpan={2}
              className={`${SHELF_NO_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} font-semibold`}
            >
              NO
            </th>
            <th
              rowSpan={2}
              className={`${SHELF_SPEC_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} text-left font-semibold`}
            >
              <span className="inline-flex items-center gap-1">
                규격
                {!isCustomer && onCopyTable ? (
                  <ShelfTableCopyButton
                    copied={copied ?? false}
                    onClick={onCopyTable}
                    title="주문 수량 표 복사"
                  />
                ) : null}
              </span>
            </th>
            <th
              colSpan={partColCount + 1}
              className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_WHITE_SECTION_HEAD_BG} ${SHELF_WHITE_SECTION_BORDER} text-center font-semibold`}
            >
              화이트
            </th>
            <th
              colSpan={partColCount + 1}
              className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_BLACK_SECTION_HEAD_BG} ${SHELF_BLACK_SECTION_BORDER} text-center font-semibold`}
            >
              블랙
            </th>
          </tr>
          <tr
            className={`border-b border-gray-300 ${
              isCustomer ? SHELF_TABLE_ROW_HEIGHT_CLASS : ""
            }`}
          >
            {PART_DISPLAY_ORDER.map((kind, index) => (
              <th
                key={`${variant}-white-head-${kind}`}
                className={partHeadCellClass(
                  SHELF_WHITE_SECTION_HEAD_BG,
                  index === 0 ? SHELF_WHITE_SECTION_BORDER : "",
                )}
              >
                {isCustomer ? (
                  PART_META[kind].label
                ) : (
                  <OrderQuantityPartHeaderCell kind={kind} color="white" />
                )}
              </th>
            ))}
            <th
              className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_WHITE_SECTION_HEAD_BG} text-right font-semibold whitespace-nowrap`}
            >
              {isCustomer ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBulkQuantity?.("white");
                  }}
                  className="w-full text-right underline-offset-2 hover:underline cursor-pointer"
                  title="화이트 전체 수량 일괄 변경"
                >
                  수량
                </button>
              ) : (
                "수량"
              )}
            </th>
            {PART_DISPLAY_ORDER.map((kind, index) => (
              <th
                key={`${variant}-black-head-${kind}`}
                className={partHeadCellClass(
                  SHELF_BLACK_SECTION_HEAD_BG,
                  index === 0 ? SHELF_BLACK_SECTION_BORDER : "",
                )}
              >
                {isCustomer ? (
                  PART_META[kind].label
                ) : (
                  <OrderQuantityPartHeaderCell kind={kind} color="black" />
                )}
              </th>
            ))}
            <th
              className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_BLACK_SECTION_HEAD_BG} text-right font-semibold whitespace-nowrap`}
            >
              {isCustomer ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBulkQuantity?.("black");
                  }}
                  className="w-full text-right underline-offset-2 hover:underline cursor-pointer text-inherit"
                  title="블랙 전체 수량 일괄 변경"
                >
                  수량
                </button>
              ) : (
                "수량"
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = shelfSizeKey(row.size);
            const active = key === selectedKey;
            const widthGroupEnd =
              index < rows.length - 1 && row.size.w !== rows[index + 1].size.w;
            const rowDividerClass = widthGroupEnd
              ? SHELF_WIDTH_GROUP_BORDER_CLASS
              : SHELF_ROW_BORDER_CLASS;
            const whiteQuantity = colorQuantities.white[key] ?? 1;
            const blackQuantity = colorQuantities.black[key] ?? 1;
            const whiteMultiplied = applyRowOrderMultiplier(
              row.parts,
              whiteQuantity,
            );
            const blackMultiplied = applyRowOrderMultiplier(
              row.parts,
              blackQuantity,
            );
            const whiteDisplay = isCustomer
              ? whiteMultiplied
              : toOrderQuantityShelfParts(whiteMultiplied);
            const blackDisplay = isCustomer
              ? blackMultiplied
              : toOrderQuantityShelfParts(blackMultiplied);

            return (
              <tr
                key={`${variant}-${key}`}
                className={`${SHELF_TABLE_ROW_HEIGHT_CLASS} cursor-pointer transition-colors`}
                onClick={() => onSelect(row.size)}
              >
                <td
                  className={`${SHELF_NO_CELL_CLASS} ${rowDividerClass} ${
                    active
                      ? SHELF_BASIC_ACTIVE_ROW_CLASS
                      : SHELF_BASIC_IDLE_ROW_CLASS
                  }`}
                >
                  {index + 1}
                </td>
                <td
                  className={`${SHELF_SPEC_CELL_CLASS} font-medium ${rowDividerClass} ${
                    active
                      ? SHELF_BASIC_ACTIVE_ROW_CLASS
                      : SHELF_BASIC_IDLE_ROW_CLASS
                  }`}
                >
                  {row.label}
                </td>
                {PART_DISPLAY_ORDER.map((kind, partIndex) => (
                  <td
                    key={`${variant}-white-${kind}`}
                    className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums ${rowDividerClass} ${
                      partIndex === 0 ? SHELF_WHITE_SECTION_BORDER : ""
                    } ${
                      active
                        ? SHELF_WHITE_ACTIVE_ROW_CLASS
                        : SHELF_WHITE_SECTION_CELL_BG
                    }`}
                  >
                    {whiteDisplay[kind].toLocaleString()}
                  </td>
                ))}
                <td
                  className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums ${rowDividerClass} ${
                    active
                      ? SHELF_WHITE_ACTIVE_ROW_CLASS
                      : SHELF_WHITE_SECTION_CELL_BG
                  }`}
                  onClick={
                    isCustomer ? (e) => e.stopPropagation() : undefined
                  }
                >
                  {isCustomer ? (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={whiteQuantity}
                      onChange={(e) => {
                        const next = Math.max(
                          1,
                          Math.floor(Number(e.target.value) || 1),
                        );
                        onColorQuantityChange?.("white", row.size, next);
                      }}
                      className="h-6 max-h-6 w-12 rounded border border-gray-300 bg-white px-1 text-right text-xs leading-none text-gray-900 tabular-nums"
                      aria-label={`${row.label} 화이트 수량`}
                    />
                  ) : (
                    whiteQuantity.toLocaleString()
                  )}
                </td>
                {PART_DISPLAY_ORDER.map((kind, partIndex) => (
                  <td
                    key={`${variant}-black-${kind}`}
                    className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums ${rowDividerClass} ${
                      partIndex === 0 ? SHELF_BLACK_SECTION_BORDER : ""
                    } ${
                      active
                        ? SHELF_BLACK_ACTIVE_ROW_CLASS
                        : "bg-white text-gray-900"
                    }`}
                  >
                    {blackDisplay[kind].toLocaleString()}
                  </td>
                ))}
                <td
                  className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums ${rowDividerClass} ${
                    active
                      ? SHELF_BLACK_ACTIVE_ROW_CLASS
                      : "bg-white text-gray-900"
                  }`}
                  onClick={
                    isCustomer ? (e) => e.stopPropagation() : undefined
                  }
                >
                  {isCustomer ? (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={blackQuantity}
                      onChange={(e) => {
                        const next = Math.max(
                          1,
                          Math.floor(Number(e.target.value) || 1),
                        );
                        onColorQuantityChange?.("black", row.size, next);
                      }}
                      className="h-6 max-h-6 w-12 rounded border border-gray-300 bg-white px-1 text-right text-xs leading-none text-gray-900 tabular-nums"
                      aria-label={`${row.label} 블랙 수량`}
                    />
                  ) : (
                    blackQuantity.toLocaleString()
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className={SHELF_TABLE_ROW_HEIGHT_CLASS}>
            <td
              className={`${SHELF_NO_CELL_CLASS} ${SHELF_SUMMARY_ROW_BORDER} ${SHELF_BASIC_SECTION_HEAD_BG}`}
            />
            <td
              className={`${SHELF_SPEC_CELL_CLASS} font-semibold ${SHELF_SUMMARY_ROW_BORDER} ${SHELF_BASIC_SECTION_HEAD_BG}`}
            >
              합계
            </td>
            {PART_DISPLAY_ORDER.map((kind, partIndex) => (
              <td
                key={`${variant}-white-sum-${kind}`}
                className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums font-semibold whitespace-nowrap ${SHELF_SUMMARY_ROW_BORDER} ${SHELF_WHITE_SECTION_CELL_BG} ${
                  partIndex === 0 ? SHELF_WHITE_SECTION_BORDER : ""
                }`}
              >
                {(isCustomer
                  ? whiteSummary.parts[kind]
                  : whiteOrderParts[kind]
                ).toLocaleString()}
              </td>
            ))}
            <td
              className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums font-semibold ${SHELF_SUMMARY_ROW_BORDER} ${SHELF_WHITE_SECTION_CELL_BG}`}
            >
              {whiteSummary.quantitySum.toLocaleString()}
            </td>
            {PART_DISPLAY_ORDER.map((kind, partIndex) => (
              <td
                key={`${variant}-black-sum-${kind}`}
                className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums font-semibold whitespace-nowrap ${SHELF_SUMMARY_ROW_BORDER} bg-gray-100 ${
                  partIndex === 0 ? SHELF_BLACK_SECTION_BORDER : ""
                }`}
              >
                {(isCustomer
                  ? blackSummary.parts[kind]
                  : blackOrderParts[kind]
                ).toLocaleString()}
              </td>
            ))}
            <td
              className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums font-semibold ${SHELF_SUMMARY_ROW_BORDER} bg-gray-100`}
            >
              {blackSummary.quantitySum.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>

      <ShelfMergedSummaryTable
        title={
          isCustomer
            ? "고객수량 화이트 · 블랙 통합 합계"
            : "주문수량 화이트 · 블랙 통합 합계"
        }
        parts={isCustomer ? mergedSummary.parts : mergedOrderParts}
        quantitySum={mergedSummary.quantitySum}
        useOrderQuantityHeaders={!isCustomer}
      />
    </div>
  );
}

function buildShelfSpecClipboardText(
  rows: ShelfCalcResult[],
  colorQuantities: Record<ShelfColor, Record<string, number>>,
): string {
  const toTsvRow = (cells: (string | number)[]) =>
    cells.map((cell) => String(cell)).join("\t");

  const basicPartHeaders = PART_DISPLAY_ORDER.map((kind) =>
    getPartColumnHeaderLabel(kind),
  );
  const colorPartHeaders = PART_DISPLAY_ORDER.map(
    (kind) => PART_META[kind].label,
  );

  const basicBlock = [
    toTsvRow(["NO", "규격", ...basicPartHeaders]),
    ...rows.map((row, index) => {
      const basicDisplay = formatOrderQuantityPartDisplays(row.parts, 1);
      return toTsvRow([
        index + 1,
        row.label,
        ...PART_DISPLAY_ORDER.map((kind) => basicDisplay[kind]),
      ]);
    }),
  ].join("\n");

  const buildColorBlock = (color: ShelfColor) => {
    const quantities = colorQuantities[color];
    return [
      toTsvRow(["NO", "규격", ...colorPartHeaders, "수량"]),
      ...rows.map((row, index) => {
        const key = shelfSizeKey(row.size);
        const quantity = quantities[key] ?? 1;
        const parts = applyRowOrderMultiplier(row.parts, quantity);
        return toTsvRow([
          index + 1,
          row.label,
          ...PART_DISPLAY_ORDER.map((kind) => parts[kind]),
          quantity,
        ]);
      }),
    ].join("\n");
  };

  const buildMergedSummaryBlock = (
    mergedSummary: { parts: Record<PartKind, number>; quantitySum: number },
  ) =>
    [
      toTsvRow([...colorPartHeaders, "수량"]),
      toTsvRow([
        ...PART_DISPLAY_ORDER.map((kind) => mergedSummary.parts[kind]),
        mergedSummary.quantitySum,
      ]),
    ].join("\n");

  const whiteSummary = sumColorSection(rows, colorQuantities.white);
  const blackSummary = sumColorSection(rows, colorQuantities.black);
  const mergedSummary = mergeColorSummaries(whiteSummary, blackSummary);

  return [
    basicBlock,
    buildColorBlock("white"),
    buildColorBlock("black"),
    buildMergedSummaryBlock(mergedSummary),
  ].join("\n\n");
}

function buildOrderQuantityClipboardText(
  rows: ShelfCalcResult[],
  colorQuantities: Record<ShelfColor, Record<string, number>>,
): string {
  const toTsvRow = (cells: (string | number)[]) =>
    cells.map((cell) => String(cell)).join("\t");

  const buildOrderColorBlock = (color: ShelfColor) => {
    const quantities = colorQuantities[color];
    const orderPartHeaders = PART_DISPLAY_ORDER.map((kind) =>
      getPartOrderQuantityHeaderLabelForColor(kind, color),
    );
    return [
      toTsvRow(["NO", "규격", ...orderPartHeaders, "수량"]),
      ...rows.map((row, index) => {
        const key = shelfSizeKey(row.size);
        const quantity = quantities[key] ?? 1;
        const parts = toOrderQuantityShelfParts(
          applyRowOrderMultiplier(row.parts, quantity),
        );
        return toTsvRow([
          index + 1,
          row.label,
          ...PART_DISPLAY_ORDER.map((kind) => parts[kind]),
          quantity,
        ]);
      }),
    ].join("\n");
  };

  const mergedSummary = mergeColorSummaries(
    sumColorSection(rows, colorQuantities.white),
    sumColorSection(rows, colorQuantities.black),
  );
  const mergedOrderParts = toOrderQuantityParts(mergedSummary);
  const mergedPartHeaders = PART_DISPLAY_ORDER.map((kind) =>
    getPartOrderQuantityHeaderLabelForClipboard(kind),
  );

  const mergedBlock = [
    toTsvRow([...mergedPartHeaders, "수량"]),
    toTsvRow([
      ...PART_DISPLAY_ORDER.map((kind) => mergedOrderParts[kind]),
      mergedSummary.quantitySum,
    ]),
  ].join("\n");

  return [
    buildOrderColorBlock("white"),
    buildOrderColorBlock("black"),
    mergedBlock,
  ].join("\n\n");
}

function ShelfBasicSpecTable({
  rows,
  selectedKey,
  onSelect,
  colorQuantities,
}: {
  rows: ShelfCalcResult[];
  selectedKey: string;
  onSelect: (size: ShelfSize) => void;
  colorQuantities: Record<ShelfColor, Record<string, number>>;
}) {
  const partColCount = PART_DISPLAY_ORDER.length;
  const [copied, setCopied] = useState(false);

  const handleCopyTable = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(
          buildShelfSpecClipboardText(rows, colorQuantities),
        );
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error("복사 실패:", err);
      }
    },
    [rows, colorQuantities],
  );

  return (
    <table className="w-max min-w-full text-xs border-collapse bg-white">
      <colgroup>
        {Array.from({ length: partColCount + 2 }, (_, i) => (
          <col key={i} className="w-[1%]" />
        ))}
      </colgroup>
      <thead>
        <tr
          className={`border-b border-gray-300 ${SHELF_TABLE_ROW_HEIGHT_CLASS}`}
        >
          <th
            rowSpan={2}
            className={`${SHELF_NO_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} font-semibold`}
          >
            NO
          </th>
          <th
            rowSpan={2}
            className={`${SHELF_SPEC_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} text-left font-semibold`}
          >
            <span className="inline-flex items-center gap-1">
              규격
              <ShelfTableCopyButton copied={copied} onClick={handleCopyTable} />
            </span>
          </th>
          <th
            colSpan={partColCount}
            className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} text-center font-semibold`}
          >
            기본
          </th>
        </tr>
        <tr
          className={`border-b border-gray-300 ${SHELF_TABLE_ROW_HEIGHT_CLASS}`}
        >
          {PART_DISPLAY_ORDER.map((kind) => (
            <th
              key={`basic-${kind}`}
              className={`${SHELF_TABLE_NUM_CELL_CLASS} ${SHELF_BASIC_SECTION_HEAD_BG} text-right font-semibold whitespace-nowrap`}
            >
              {getPartColumnHeaderLabel(kind)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const key = shelfSizeKey(row.size);
          const active = key === selectedKey;
          const widthGroupEnd =
            index < rows.length - 1 && row.size.w !== rows[index + 1].size.w;
          const rowDividerClass = widthGroupEnd
            ? SHELF_WIDTH_GROUP_BORDER_CLASS
            : SHELF_ROW_BORDER_CLASS;
          const basicDisplay = formatOrderQuantityPartDisplays(row.parts, 1);

          return (
            <tr
              key={key}
              className={`${SHELF_TABLE_ROW_HEIGHT_CLASS} cursor-pointer transition-colors`}
              onClick={() => onSelect(row.size)}
            >
              <td
                className={`${SHELF_NO_CELL_CLASS} ${rowDividerClass} ${
                  active
                    ? SHELF_BASIC_ACTIVE_ROW_CLASS
                    : SHELF_BASIC_IDLE_ROW_CLASS
                }`}
              >
                {index + 1}
              </td>
              <td
                className={`${SHELF_SPEC_CELL_CLASS} font-medium ${rowDividerClass} ${
                  active
                    ? SHELF_BASIC_ACTIVE_ROW_CLASS
                    : SHELF_BASIC_IDLE_ROW_CLASS
                }`}
              >
                {row.label}
              </td>
              {PART_DISPLAY_ORDER.map((kind) => (
                <td
                  key={`basic-${kind}`}
                  className={`${SHELF_TABLE_NUM_CELL_CLASS} text-right tabular-nums whitespace-nowrap ${rowDividerClass} ${
                    active
                      ? SHELF_BASIC_ACTIVE_ROW_CLASS
                      : SHELF_BASIC_IDLE_ROW_CLASS
                  }`}
                >
                  {basicDisplay[kind]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CombinedShelfSpecTable({
  rows,
  selectedKey,
  onSelect,
  colorQuantities,
  onColorQuantityChange,
  onBulkColorQuantityChange,
}: {
  rows: ShelfCalcResult[];
  selectedKey: string;
  onSelect: (size: ShelfSize) => void;
  colorQuantities: Record<ShelfColor, Record<string, number>>;
  onColorQuantityChange: (
    color: ShelfColor,
    size: ShelfSize,
    quantity: number,
  ) => void;
  onBulkColorQuantityChange: (color: ShelfColor, quantity: number) => void;
}) {
  const { whiteSummary, blackSummary, mergedSummary, whiteOrderParts, blackOrderParts } =
    useMemo(() => {
      const white = sumColorSection(rows, colorQuantities.white);
      const black = sumColorSection(rows, colorQuantities.black);
      return {
        whiteSummary: white,
        blackSummary: black,
        mergedSummary: mergeColorSummaries(white, black),
        whiteOrderParts: toOrderQuantityParts(white),
        blackOrderParts: toOrderQuantityParts(black),
      };
    }, [rows, colorQuantities]);
  const [orderCopied, setOrderCopied] = useState(false);
  const [bulkQuantityModalColor, setBulkQuantityModalColor] =
    useState<ShelfColor | null>(null);
  const [bulkQuantityInput, setBulkQuantityInput] = useState("1");

  const openBulkQuantityModal = useCallback((color: ShelfColor) => {
    setBulkQuantityInput("1");
    setBulkQuantityModalColor(color);
  }, []);

  const closeBulkQuantityModal = useCallback(() => {
    setBulkQuantityModalColor(null);
  }, []);

  const applyBulkQuantity = useCallback(() => {
    if (!bulkQuantityModalColor) return;
    const quantity = Math.max(1, Math.floor(Number(bulkQuantityInput) || 1));
    onBulkColorQuantityChange(bulkQuantityModalColor, quantity);
    setBulkQuantityModalColor(null);
  }, [bulkQuantityInput, bulkQuantityModalColor, onBulkColorQuantityChange]);

  const bulkQuantityModalLabel =
    bulkQuantityModalColor === "white"
      ? "화이트"
      : bulkQuantityModalColor === "black"
        ? "블랙"
        : "";

  const handleCopyOrderTable = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(
          buildOrderQuantityClipboardText(rows, colorQuantities),
        );
        setOrderCopied(true);
        window.setTimeout(() => setOrderCopied(false), 1500);
      } catch (err) {
        console.error("복사 실패:", err);
      }
    },
    [rows, colorQuantities],
  );

  return (
    <div>
      <ShelfColorDataTable
        title="고객수량"
        variant="customer"
        rows={rows}
        selectedKey={selectedKey}
        onSelect={onSelect}
        colorQuantities={colorQuantities}
        onColorQuantityChange={onColorQuantityChange}
        onOpenBulkQuantity={openBulkQuantityModal}
        whiteSummary={whiteSummary}
        blackSummary={blackSummary}
        whiteOrderParts={whiteOrderParts}
        blackOrderParts={blackOrderParts}
        mergedSummary={mergedSummary}
      />

      <ShelfColorDataTable
        title="주문 수량"
        variant="order"
        rows={rows}
        selectedKey={selectedKey}
        onSelect={onSelect}
        colorQuantities={colorQuantities}
        onCopyTable={handleCopyOrderTable}
        copied={orderCopied}
        whiteSummary={whiteSummary}
        blackSummary={blackSummary}
        whiteOrderParts={whiteOrderParts}
        blackOrderParts={blackOrderParts}
        mergedSummary={mergedSummary}
      />

      <Modal
        isOpen={bulkQuantityModalColor != null}
        onClose={closeBulkQuantityModal}
        title={`${bulkQuantityModalLabel} 전체 수량`}
        maxWidth="max-w-sm"
        positiveButton={{
          text: "적용",
          onClick: applyBulkQuantity,
        }}
        negativeButton={{
          text: "취소",
          onClick: closeBulkQuantityModal,
        }}
      >
        <p className="mb-3 text-sm text-gray-600">
          모든 규격의 {bulkQuantityModalLabel} 수량을 아래 값으로 일괄 설정합니다.
        </p>
        <label className="block text-sm font-medium text-gray-700">
          수량
          <input
            type="number"
            min={1}
            step={1}
            value={bulkQuantityInput}
            onChange={(e) => setBulkQuantityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyBulkQuantity();
              }
            }}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-right text-sm text-gray-900 tabular-nums"
            autoFocus
          />
        </label>
      </Modal>
    </div>
  );
}

function getPartBadgeColors(kind: LabeledPartKind, isEndpoint: boolean) {
  return {
    fill: PART_META[kind].color,
    stroke: isEndpoint ? "#111827" : "#FFFFFF",
    strokeWidth: isEndpoint ? 2.5 : 1,
    textFill: "#FFFFFF",
  };
}

function clampDeg(deg: number): number {
  return Math.max(-180, Math.min(180, deg));
}

const RULES_SUMMARY =
  "지정 규격 · 바닥 없음 · 천장 윗면 · 기본 프레임 = 외곽 면(천장 제외) 정사각형 · 커버 프레임 = 천장 면 · 높이 1 포함 모든 규격 문 1개 이상 · 문 최대 2개 · 문 1개 = 뒷면 정사각형 1개 대체 · 걸쇠 문당 4개";

function DiagramSidePanel({
  size,
  parts,
  rotXDeg,
  rotYDeg,
  rotZDeg,
  onRotX,
  onRotY,
  onRotZ,
  onResetView,
}: {
  size: ShelfSize;
  parts: ShelfCalcResult["parts"];
  rotXDeg: number;
  rotYDeg: number;
  rotZDeg: number;
  onRotX: (deg: number) => void;
  onRotY: (deg: number) => void;
  onRotZ: (deg: number) => void;
  onResetView: () => void;
}) {
  const faceItems = FACE_DISPLAY_ORDER.map((key) => ({
    label: FACE_META[key].label,
    color: FACE_META[key].stroke,
    fill: FACE_META[key].fill,
  }));
  const partLegendItems: Array<{
    kind: PartKind;
    label: string;
    note: string;
  }> = [
    {
      kind: "baseFrame",
      label: "기본 프레임",
      note: "외곽 면(천장 제외) 정사각형",
    },
    {
      kind: "coverFrame",
      label: "커버 프레임",
      note: "천장 면 정사각형",
    },
    { kind: "door", label: "문", note: "회색 면" },
    {
      kind: "holder",
      label: "홀더",
      note: "외곽 꼭지점 원형 1~n",
    },
    {
      kind: "floorHolder",
      label: "바닥홀더",
      note: "z=0 바닥 외곽 반원 1~n",
    },
    {
      kind: "cableTie",
      label: "케이블타이",
      note: "외곽 면 중앙 1~n · 문 걸쇠 반대편(오른쪽) 세로 변",
    },
    { kind: "latch", label: "걸쇠", note: "문 왼쪽 2개" },
  ];

  return (
    <div className="px-3 py-2.5">
      <div className="text-left text-base font-semibold leading-snug text-gray-900">
        {sizeLabel(size)}
      </div>
      <hr className="my-2.5 border-gray-300" />
      <div className="grid grid-cols-3 gap-x-2 gap-y-1">
        {PART_DISPLAY_ORDER.map((kind) => (
          <div
            key={kind}
            className="flex min-w-0 items-center gap-1.5 text-sm text-gray-800"
          >
            <PartLegendIcon kind={kind} />
            <span className="min-w-0 truncate font-medium">
              {PART_META[kind].label}
            </span>
            <span className="ml-auto shrink-0 font-bold tabular-nums text-gray-900">
              {parts[kind].toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <hr className="my-2.5 border-gray-300" />
      <p className="text-left text-xs leading-relaxed text-gray-700">
        {RULES_SUMMARY}
      </p>
      <hr className="my-2.5 border-gray-300" />
      <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs text-gray-800">
        {faceItems.map((item) => (
          <div key={item.label} className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-4 w-4 shrink-0 rounded border-2"
              style={{
                backgroundColor: item.fill,
                borderColor: item.color,
              }}
            />
            <span className="font-medium">{item.label}</span>
          </div>
        ))}
      </div>
      <hr className="my-2.5 border-gray-300" />
      <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs text-gray-700">
        {partLegendItems.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-start gap-1.5 text-left"
          >
            <span className="mt-0.5 shrink-0">
              <PartLegendIcon kind={item.kind} />
            </span>
            <span className="min-w-0 leading-snug">
              <span className="font-medium text-gray-900">{item.label}</span>
              <span className="text-gray-600"> — {item.note}</span>
            </span>
          </div>
        ))}
      </div>
      <hr className="my-2.5 border-gray-300" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-900">축 회전</span>
        <button
          type="button"
          onClick={onResetView}
          className="rounded border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
        >
          회전 초기화
        </button>
      </div>
      <div className="divide-y divide-gray-200">
        <AxisRotationHandle
          compact
          embedded
          label="가로축"
          subLabel="X축"
          color="#B45309"
          valueDeg={rotXDeg}
          onChange={onRotX}
          onReset={() => onRotX(0)}
        />
        <AxisRotationHandle
          compact
          embedded
          label="세로축"
          subLabel="Y축"
          color="#BE185D"
          valueDeg={rotYDeg}
          onChange={onRotY}
          onReset={() => onRotY(0)}
        />
        <AxisRotationHandle
          compact
          embedded
          label="높이축"
          subLabel="Z축"
          color="#0E7490"
          valueDeg={rotZDeg}
          onChange={onRotZ}
          onReset={() => onRotZ(0)}
        />
      </div>
    </div>
  );
}

function AxisRotationHandle({
  label,
  subLabel,
  color,
  valueDeg,
  onChange,
  onReset,
  compact = false,
  embedded = false,
}: {
  label: string;
  subLabel: string;
  color: string;
  valueDeg: number;
  onChange: (deg: number) => void;
  onReset: () => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  if (compact) {
    return (
      <div
        className={
          embedded
            ? "py-1"
            : "rounded border border-gray-200 bg-white/95 p-2 backdrop-blur-sm"
        }
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-900">{label}</span>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={-180}
              max={180}
              step={1}
              value={valueDeg}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isNaN(next)) onChange(clampDeg(next));
              }}
              className="w-11 rounded border border-gray-300 px-1 py-0.5 text-right text-xs font-bold tabular-nums text-gray-800"
              aria-label={`${label} 각도`}
            />
            <span className="text-xs text-gray-500">°</span>
            <button
              type="button"
              onClick={onReset}
              className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
              aria-label={`${label} 초기화`}
            >
              0°
            </button>
          </div>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={valueDeg}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer"
          style={{ accentColor: color }}
          aria-label={`${label} 회전`}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-8 w-8 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: color, borderColor: color }}
          >
            ↔
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">{label}</div>
            <div className="text-xs text-gray-500 truncate">{subLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            value={valueDeg}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next)) onChange(clampDeg(next));
            }}
            className="w-[4.25rem] rounded border border-gray-300 px-2 py-1 text-right text-sm font-bold tabular-nums text-gray-800 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
            aria-label={`${label} 각도`}
          />
          <span className="text-sm font-medium text-gray-500">°</span>
          <button
            type="button"
            onClick={onReset}
            className="ml-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            aria-label={`${label} 초기화`}
          >
            0°
          </button>
        </div>
      </div>
      <input
        type="range"
        min={-180}
        max={180}
        step={1}
        value={valueDeg}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 cursor-pointer"
        style={{ accentColor: color }}
        aria-label={`${label} 회전`}
      />
    </div>
  );
}

function ShelfDiagram({
  result,
  rotX,
  rotY,
  rotZ,
}: {
  result: ShelfCalcResult;
  rotX: number;
  rotY: number;
  rotZ: number;
}) {
  const geometry = useMemo(() => {
    const { w, d, h } = result.size;
    const scale = (420 * 1.15) / Math.max(w + d, h, 3);
    const ox = d * scale * ISO_DX;
    const oy = scale * 0.5;
    const strokeW = Math.max(3, scale * 0.055);
    const pinR = Math.max(7, scale * 0.1);
    const fontSm = Math.max(10, scale * 0.12);
    const fontMd = Math.max(12, scale * 0.14);
    const gizmoR = Math.max(3, scale * 0.07);
    const axisStrokeW = Math.max(2, strokeW * 0.85);
    const viewBox = getStableViewBox(
      w,
      d,
      h,
      scale,
      ox,
      oy,
      pinR,
      fontSm,
      fontMd,
      strokeW,
    );

    const project = (x: number, y: number, z: number) =>
      projectRotated(x, y, z, w, d, h, rotX, rotY, rotZ, scale, ox, oy);

    const facePanels: Array<{
      id: string;
      face: FaceKind;
      path: string;
      depth: number;
    }> = [];

    const addFace = (
      id: string,
      face: FaceKind,
      corners: Array<[number, number, number]>,
    ) => {
      const projected = corners.map(([x, y, z]) => project(x, y, z));
      const depth =
        projected.reduce((sum, item) => sum + item.depth, 0) / projected.length;
      facePanels.push({
        id,
        face,
        depth,
        path:
          projected
            .map(
              ({ screen }, i) =>
                `${i === 0 ? "M" : "L"}${screen.x},${screen.y}`,
            )
            .join(" ") + " Z",
      });
    };

    addFace("front", "front", [
      [0, 0, 0],
      [w, 0, 0],
      [w, 0, h],
      [0, 0, h],
    ]);
    addFace("back", "back", [
      [0, d, 0],
      [w, d, 0],
      [w, d, h],
      [0, d, h],
    ]);
    addFace("left", "left", [
      [0, 0, 0],
      [0, d, 0],
      [0, d, h],
      [0, 0, h],
    ]);
    addFace("right", "right", [
      [w, 0, 0],
      [w, d, 0],
      [w, d, h],
      [w, 0, h],
    ]);
    addFace("top", "top", [
      [0, 0, h],
      [w, 0, h],
      [w, d, h],
      [0, d, h],
    ]);
    for (let zi = 1; zi < h; zi += 1) {
      addFace(`inner-z${zi}`, "inner", [
        [0, 0, zi],
        [w, 0, zi],
        [w, d, zi],
        [0, d, zi],
      ]);
    }

    facePanels.sort((a, b) => a.depth - b.depth);

    const steelFrameSquares = result.steelFrameSquares
      .filter((sq) => !sq.replacedByDoor)
      .map((sq) => {
        const corners = getSteelFrameSquareCorners(sq, w, d, h).map(
          ([x, y, z]) => project(x, y, z),
        );
        const path =
          corners
            .map(
              ({ screen }, i) =>
                `${i === 0 ? "M" : "L"}${screen.x},${screen.y}`,
            )
            .join(" ") + " Z";
        const depth =
          corners.reduce((sum, c) => sum + c.depth, 0) / corners.length;
        return { ...sq, path, depth };
      })
      .sort((a, b) => a.depth - b.depth);

    const cableTieSegments = result.segments
      .filter((s) => !s.replacedByDoor)
      .map((s) => {
        const p1 = project(s.x1, s.y1, s.z1);
        const p2 = project(s.x2, s.y2, s.z2);
        const mx = (p1.screen.x + p2.screen.x) / 2;
        const my = (p1.screen.y + p2.screen.y) / 2;
        const face = getSegmentFace(s, w, d, h);
        const depth = (p1.depth + p2.depth) / 2;
        return {
          ...s,
          p1: p1.screen,
          p2: p2.screen,
          mx,
          my,
          face,
          depth,
          cableTieNos: s.cableTieNos ?? [],
        };
      })
      .filter((s) => s.face !== "inner")
      .sort((a, b) => a.depth - b.depth);

    const mapHolderDot = (joint: (typeof result.holders)[number]) => {
      const p = project(joint.x, joint.y, joint.z);
      return {
        ...joint,
        x: p.screen.x,
        y: p.screen.y,
        depth: p.depth,
      };
    };

    const floorHolderDots = result.holders
      .filter((joint) => isFloorHolder(joint, w, d))
      .map(mapHolderDot)
      .sort((a, b) => a.depth - b.depth);

    const holderDots = result.holders
      .filter(
        (joint) =>
          isExteriorHolder(joint, w, d, h) && !isFloorHolder(joint, w, d),
      )
      .map(mapHolderDot)
      .sort((a, b) => a.depth - b.depth);

    const doors = result.doors.map((door) => {
      const corners = [
        project(door.x1, door.y, door.z1),
        project(door.x2, door.y, door.z1),
        project(door.x2, door.y, door.z2),
        project(door.x1, door.y, door.z2),
      ];
      const path =
        corners
          .map(
            ({ screen }, i) => `${i === 0 ? "M" : "L"}${screen.x},${screen.y}`,
          )
          .join(" ") + " Z";
      const cx = (corners[0].screen.x + corners[2].screen.x) / 2;
      const cy = (corners[0].screen.y + corners[2].screen.y) / 2;
      const latchOffsets = [1 / 3, 2 / 3] as const;
      const leftBottom = project(door.x1, door.y, door.z1);
      const leftTop = project(door.x1, door.y, door.z2);
      const latchPoints = latchOffsets.map((t) => {
        const x =
          leftBottom.screen.x + (leftTop.screen.x - leftBottom.screen.x) * t;
        const y =
          leftBottom.screen.y + (leftTop.screen.y - leftBottom.screen.y) * t;
        const depth = (leftBottom.depth + leftTop.depth) / 2;
        return { x, y, depth };
      });
      return { ...door, corners, path, cx, cy, latchPoints };
    });

    const axisGizmo = {
      center: project(w / 2, d / 2, h / 2).screen,
      xTip: project(w, d / 2, h / 2).screen,
      yTip: project(w / 2, d, h / 2).screen,
      zTip: project(w / 2, d / 2, h).screen,
    };

    return {
      w,
      d,
      h,
      scale,
      facePanels,
      steelFrameSquares,
      cableTieSegments,
      floorHolderDots,
      holderDots,
      doors,
      viewBox,
      strokeW,
      pinR,
      fontSm,
      fontMd,
      gizmoR,
      axisStrokeW,
      axisGizmo,
    };
  }, [result, rotX, rotY, rotZ]);

  const { viewBox } = geometry;
  const aspectRatio = viewBox.width / Math.max(viewBox.height, 1);
  const maxCableTieNo = result.segments.reduce(
    (max, seg) => Math.max(max, ...(seg.cableTieNos ?? []), 0),
    0,
  );
  const maxHolderNo = result.holders.reduce(
    (max, joint) => Math.max(max, joint.holderNo ?? 0),
    0,
  );
  const maxFloorHolderNo = result.holders.reduce(
    (max, joint) => Math.max(max, joint.floorHolderNo ?? 0),
    0,
  );

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="relative z-0 block h-full max-h-full w-full max-w-full select-none object-contain"
      style={{ aspectRatio }}
      role="img"
      aria-label={`${result.label} 선반 도면`}
    >
      <g opacity={0.9}>
        <line
          x1={geometry.axisGizmo.center.x}
          y1={geometry.axisGizmo.center.y}
          x2={geometry.axisGizmo.xTip.x}
          y2={geometry.axisGizmo.xTip.y}
          stroke={FACE_META.left.stroke}
          strokeWidth={geometry.axisStrokeW}
          strokeLinecap="round"
        />
        <line
          x1={geometry.axisGizmo.center.x}
          y1={geometry.axisGizmo.center.y}
          x2={geometry.axisGizmo.yTip.x}
          y2={geometry.axisGizmo.yTip.y}
          stroke={FACE_META.right.stroke}
          strokeWidth={geometry.axisStrokeW}
          strokeLinecap="round"
        />
        <line
          x1={geometry.axisGizmo.center.x}
          y1={geometry.axisGizmo.center.y}
          x2={geometry.axisGizmo.zTip.x}
          y2={geometry.axisGizmo.zTip.y}
          stroke={FACE_META.top.stroke}
          strokeWidth={geometry.axisStrokeW}
          strokeLinecap="round"
        />
        <circle
          cx={geometry.axisGizmo.xTip.x}
          cy={geometry.axisGizmo.xTip.y}
          r={geometry.gizmoR}
          fill={FACE_META.left.stroke}
        />
        <circle
          cx={geometry.axisGizmo.yTip.x}
          cy={geometry.axisGizmo.yTip.y}
          r={geometry.gizmoR}
          fill={FACE_META.right.stroke}
        />
        <circle
          cx={geometry.axisGizmo.zTip.x}
          cy={geometry.axisGizmo.zTip.y}
          r={geometry.gizmoR}
          fill={FACE_META.top.stroke}
        />
      </g>
      {geometry.facePanels.map((panel) => {
        const meta = FACE_META[panel.face];
        const isInner = panel.face === "inner";
        return (
          <path
            key={panel.id}
            d={panel.path}
            fill={meta.fill}
            fillOpacity={isInner ? 0.72 : 0.58}
            stroke={meta.stroke}
            strokeWidth={geometry.strokeW * (isInner ? 0.55 : 0.75)}
            strokeOpacity={1}
          />
        );
      })}

      {geometry.steelFrameSquares.map((sq) => {
        const strokeColor = FACE_META[sq.face].stroke;
        return (
          <path
            key={sq.id}
            d={sq.path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={geometry.strokeW * 0.85}
            strokeOpacity={1}
          />
        );
      })}

      {geometry.doors.map((door) => (
        <path
          key={`door-path-${door.tier}`}
          d={door.path}
          fill={PART_META.door.color}
          fillOpacity={0.35}
          stroke={PART_META.door.stroke}
          strokeWidth={geometry.strokeW}
        />
      ))}

      {/* 부품 번호·라벨 — 도형 위 최상단에 항상 표시 */}
      {geometry.cableTieSegments.map((s) => {
        const cableOffsets = [0.5] as const;
        return (
          <g key={`label-${s.id}`}>
            {s.cableTie > 0 &&
              cableOffsets.map((t, tieIndex) => {
                const pos = pointOnSegment(s.p1, s.p2, t, geometry.pinR * 0.4);
                const tieNo = s.cableTieNos[tieIndex] ?? 0;
                if (tieNo <= 0) return null;
                const tieEndpoint = isSequenceEndpoint(tieNo, maxCableTieNo);
                const tieBadge = getPartBadgeColors("cableTie", tieEndpoint);
                return (
                  <g key={`ct-${s.id}-${t}`}>
                    <rect
                      x={pos.x - geometry.pinR * 0.75}
                      y={pos.y - geometry.pinR * 0.55}
                      width={geometry.pinR * 1.5}
                      height={geometry.pinR * 1.1}
                      rx={2}
                      fill={tieBadge.fill}
                      stroke={tieBadge.stroke}
                      strokeWidth={tieBadge.strokeWidth}
                    />
                    <text
                      x={pos.x}
                      y={labelTextY(pos.y, geometry.fontSm * 0.8)}
                      textAnchor="middle"
                      fill={tieBadge.textFill}
                      fontSize={geometry.fontSm * 0.8}
                      fontWeight={700}
                    >
                      {tieNo}
                    </text>
                  </g>
                );
              })}
          </g>
        );
      })}

      {geometry.floorHolderDots.map((joint) => {
        const floorNo = joint.floorHolderNo ?? 0;
        if (floorNo <= 0) return null;
        const floorEndpoint = isSequenceEndpoint(floorNo, maxFloorHolderNo);
        const floorBadge = getPartBadgeColors("floorHolder", floorEndpoint);
        const r = geometry.pinR * 0.85;
        return (
          <g key={joint.id}>
            <path
              d={floorHolderSemicirclePath(joint.x, joint.y, r)}
              fill={floorBadge.fill}
              stroke={floorBadge.stroke}
              strokeWidth={floorBadge.strokeWidth}
            />
            <text
              x={joint.x}
              y={labelTextY(joint.y - r * 0.35, geometry.fontSm * 0.8)}
              textAnchor="middle"
              fill={floorBadge.textFill}
              fontSize={geometry.fontSm * 0.8}
              fontWeight={700}
            >
              {floorNo}
            </text>
          </g>
        );
      })}

      {geometry.holderDots.map((joint) => {
        const holderNo = joint.holderNo ?? 0;
        if (holderNo <= 0) return null;
        const holderEndpoint = isSequenceEndpoint(holderNo, maxHolderNo);
        const holderBadge = getPartBadgeColors("holder", holderEndpoint);
        return (
          <g key={joint.id}>
            <circle
              cx={joint.x}
              cy={joint.y}
              r={geometry.pinR * 0.85}
              fill={holderBadge.fill}
              stroke={holderBadge.stroke}
              strokeWidth={holderBadge.strokeWidth}
            />
            <text
              x={joint.x}
              y={labelTextY(joint.y, geometry.fontSm * 0.8)}
              textAnchor="middle"
              fill={holderBadge.textFill}
              fontSize={geometry.fontSm * 0.8}
              fontWeight={700}
            >
              {holderNo}
            </text>
          </g>
        );
      })}

      {geometry.doors.map((door) => (
        <g key={`door-label-${door.tier}`}>
          <text
            x={door.cx}
            y={labelTextY(door.cy, geometry.fontMd)}
            textAnchor="middle"
            fill={PART_META.door.stroke}
            fontSize={geometry.fontMd}
            fontWeight={700}
          >
            문
          </text>
          {door.latchPoints.map((latch, index) => (
            <g key={`latch-${door.tier}-${index}`}>
              <rect
                x={latch.x - geometry.pinR * 0.55}
                y={latch.y - geometry.pinR * 0.55}
                width={geometry.pinR * 1.1}
                height={geometry.pinR * 1.1}
                rx={2}
                fill={PART_META.latch.color}
                stroke="#111827"
                strokeWidth={geometry.strokeW * 0.5}
              />
              <text
                x={latch.x}
                y={labelTextY(latch.y, geometry.fontSm * 0.75)}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize={geometry.fontSm * 0.75}
                fontWeight={700}
              >
                {index + 1}
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

function SelectedShelfView({ result }: { result: ShelfCalcResult }) {
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [rotZ, setRotZ] = useState(0);

  const rotXDeg = Math.round(rotX * DEG);
  const rotYDeg = Math.round(rotY * DEG);
  const rotZDeg = Math.round(rotZ * DEG);

  const resetView = useCallback(() => {
    setRotX(0);
    setRotY(0);
    setRotZ(0);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <div className={SHELF_DIAGRAM_COLUMN_CLASS}>
        <div className={SHELF_DIAGRAM_FRAME_CLASS}>
          <ShelfDiagram result={result} rotX={rotX} rotY={rotY} rotZ={rotZ} />
        </div>
      </div>

      <aside
        className={`${SHELF_TOP_PANEL_CLASS} aspect-square overflow-y-auto rounded-lg border border-gray-200 bg-white ${SHELF_LAYOUT_MAX_H_CLASS}`}
      >
        <DiagramSidePanel
          size={result.size}
          parts={result.parts}
          rotXDeg={rotXDeg}
          rotYDeg={rotYDeg}
          rotZDeg={rotZDeg}
          onRotX={(deg) => setRotX(deg / DEG)}
          onRotY={(deg) => setRotY(deg / DEG)}
          onRotZ={(deg) => setRotZ(deg / DEG)}
          onResetView={resetView}
        />
      </aside>
    </div>
  );
}

export default function ShelfFrameSimPage() {
  if (!SHELF_FRAME_SIM_ENABLED) {
    return <ShelfFrameSimAccessDenied />;
  }

  return <ShelfFrameSimContent />;
}

function ShelfFrameSimContent() {
  const allResults = useMemo(() => calcAllShelves(), []);
  const initialColorQuantities = useMemo(
    () => buildInitialColorQuantities(allResults),
    [allResults],
  );
  const [selected, setSelected] = useState<ShelfSize>({ w: 3, d: 2, h: 2 });
  const [colorQuantities, setColorQuantities] = useState(
    initialColorQuantities,
  );

  const result = useMemo(() => calcShelf(selected), [selected]);
  const selectedKey = `${selected.w}-${selected.d}-${selected.h}`;

  return (
    <div className="mx-auto max-w-[2400px] space-y-4 px-4 py-6 text-gray-900 sm:px-6">
      <div className={SHELF_VIEW_ROW_CLASS}>
        <div className={SHELF_BASIC_TABLE_COLUMN_CLASS}>
          <ShelfBasicSpecTable
            rows={allResults}
            selectedKey={selectedKey}
            onSelect={setSelected}
            colorQuantities={colorQuantities}
          />
        </div>
        <SelectedShelfView key={selectedKey} result={result} />
      </div>

      <div className="overflow-x-auto">
        <CombinedShelfSpecTable
          rows={allResults}
          selectedKey={selectedKey}
          onSelect={setSelected}
          colorQuantities={colorQuantities}
          onColorQuantityChange={(color, size, quantity) =>
            setColorQuantities((prev) => ({
              ...prev,
              [color]: {
                ...prev[color],
                [shelfSizeKey(size)]: quantity,
              },
            }))
          }
          onBulkColorQuantityChange={(color, quantity) =>
            setColorQuantities((prev) => ({
              ...prev,
              [color]: Object.fromEntries(
                allResults.map((row, index) => [
                  shelfSizeKey(row.size),
                  quantity,
                ]),
              ),
            }))
          }
        />
      </div>
    </div>
  );
}
