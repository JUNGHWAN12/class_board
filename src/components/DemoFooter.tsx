"use client";

import { useAuth } from "./AuthProvider";
import { resetDemoData } from "@/lib/store/demoStore";

// 체험 모드일 때만 화면 아래에 안내와 초기화 버튼을 보여줍니다.
export function DemoFooter() {
  const { demo } = useAuth();
  if (!demo) return null;
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] text-muted sm:px-6">
        <span>
          <b className="text-ink-soft">체험 모드</b> · Supabase 연결 전이라 가상 학생·교사로 동작하고, 데이터는 이 브라우저에만
          저장돼요. 탭 두 개를 열면 교사·학생 화면을 나란히 볼 수 있어요.
        </span>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper"
          onClick={() => {
            if (confirm("체험 데이터를 처음 상태로 되돌릴까요?")) {
              resetDemoData();
              window.location.replace(window.location.origin);
            }
          }}
        >
          체험 데이터 초기화
        </button>
      </div>
    </footer>
  );
}
