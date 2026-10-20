"use client";

import { useEffect, useRef } from "react";

// 휴대폰에서는 아래에서 올라오는 시트, 큰 화면에서는 가운데 창
// dirty 이면 바깥 누르기·Esc·✕ 로 닫기 전에 한 번 묻습니다 (쓰던 글이 사라지지 않게).
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  dirty,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  dirty?: boolean;
}) {
  const requestClose = () => {
    if (!dirty || confirm("작성 중인 내용을 버리고 닫을까요?")) onClose();
  };
  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 한글 입력 중의 Esc 는 글자 조합 취소라서 창을 닫지 않습니다.
      if (e.key === "Escape" && !e.isComposing) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 창 안에서 누른 채로 바깥에서 뗀 경우(글자 드래그 선택 등)는 바깥 누르기로 치지 않습니다.
  const downOnBackdrop = useRef(false);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:rounded-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}
      >
        <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
          <div className="min-w-0 flex-1">{title}</div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full px-3 py-1 text-xl text-muted hover:bg-paper"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-line-soft">{footer}</div>}
      </div>
    </div>
  );
}
