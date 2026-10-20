import { AuthGate } from "@/components/AuthGate";
import { ShareView, ShareStash } from "@/components/ShareView";

// draw_flow 에서 [게시판에 올리기]·[게시판에 제출]을 누르면 오는 화면 (/share#d=…&board=…)
export default function SharePage() {
  return (
    <>
      <ShareStash />
      <AuthGate>
        <ShareView />
      </AuthGate>
    </>
  );
}
