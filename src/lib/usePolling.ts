"use client";

import { useEffect, useRef } from "react";

// 몇 초마다 fn 을 실행합니다. 탭이 안 보일 때는 멈춰서 요청 수를 줄입니다.
export function usePolling(fn: () => Promise<void> | void, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let running = false;

    const tick = async () => {
      if (stopped) return;
      if (!document.hidden && !running) {
        running = true;
        try {
          await fnRef.current();
        } catch (e) {
          console.error(e);
        } finally {
          running = false;
        }
      }
      // 300명이 동시에 요청하지 않도록 간격에 약간의 무작위성을 둡니다.
      timer = setTimeout(tick, intervalMs * (0.85 + Math.random() * 0.3));
    };

    const onVisible = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        tick();
      }
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
