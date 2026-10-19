import { BoardList } from "@/components/BoardList";
import { AuthGate } from "@/components/AuthGate";

export default function Home() {
  return (
    <AuthGate>
      <BoardList />
    </AuthGate>
  );
}
