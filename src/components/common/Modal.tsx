"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  /** 본문 래퍼 class (기본: 세로 스크롤). 내부에서 좌우 스크롤 분리 시 overflow-hidden 등 지정 */
  bodyClassName?: string;
  // 옵셔널 버튼들
  positiveButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  negativeButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
  };
  neutralButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-[90vw]",
  maxHeight = "max-h-[95vh]",
  bodyClassName,
  positiveButton,
  negativeButton,
  neutralButton,
}) => {
  const onCloseRef = useRef(onClose);

  // onClose의 최신 값을 항상 유지
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      // ESC 키 이벤트 리스너 추가
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCloseRef.current();
        }
      };
      document.addEventListener("keydown", handleEscape);

      // 모달이 열릴 때 body 스크롤 방지
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleEscape);
        // 스크롤 복원
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // 드래그 시작 위치를 추적
  const [dragStartPosition, setDragStartPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // 드래그 시작 시 위치 저장
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartPosition({ x: e.clientX, y: e.clientY });
  };

  // 드래그 종료 시 위치 비교하여 클릭인지 드래그인지 판단
  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragStartPosition) {
      const deltaX = Math.abs(e.clientX - dragStartPosition.x);
      const deltaY = Math.abs(e.clientY - dragStartPosition.y);

      // 드래그로 간주할 최소 거리 (5px)
      const dragThreshold = 5;

      if (deltaX < dragThreshold && deltaY < dragThreshold) {
        // 클릭으로 간주
        if (e.target === e.currentTarget) {
          onClose();
        }
      }

      setDragStartPosition(null);
    }
  };

  if (!isOpen) return null;

  const portalRoot =
    typeof document !== "undefined" ? document.body : null;
  if (!portalRoot) return null;

  const bodyDefaultClass =
    "p-2 flex-1 min-h-0 min-w-0 overflow-y-auto";

  const modalMarkup = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`relative z-[1] flex min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow-xl ${maxWidth} ${maxHeight}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 - 고정 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 min-h-14 max-h-14">
          <h2 id="modal-title" className="text-xl font-bold text-gray-800">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded-md p-1"
            aria-label="모달 닫기"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div
          className={bodyClassName ?? bodyDefaultClass}
        >
          {children}
        </div>

        {/* 바텀 버튼들 - 고정 */}
        {(positiveButton || negativeButton || neutralButton) && (
          <div className="flex justify-end gap-2 px-3 py-2 border-t border-gray-200 flex-shrink-0 min-h-14 max-h-14">
            {negativeButton && (
              <button
                type="button"
                onClick={negativeButton.onClick}
                disabled={negativeButton.disabled}
                className="px-4 py-2 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {negativeButton.text}
              </button>
            )}
            {neutralButton && (
              <button
                type="button"
                onClick={neutralButton.onClick}
                disabled={neutralButton.disabled}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {neutralButton.text}
              </button>
            )}
            {positiveButton && (
              <button
                type="button"
                onClick={positiveButton.onClick}
                disabled={positiveButton.disabled || positiveButton.loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {positiveButton.loading ? "처리 중..." : positiveButton.text}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalMarkup, portalRoot);
};

export default Modal;
