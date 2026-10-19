import { AuthGate } from "@/components/AuthGate";
import { BoardView } from "@/components/BoardView";

export default function BoardPage() {
  return (
    <AuthGate>
      <BoardView />
    </AuthGate>
  );
}
