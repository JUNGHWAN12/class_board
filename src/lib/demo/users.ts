// 체험 모드에서 쓰는 가상 사용자. 실제 운영에서는 학교 구글 계정이 이 자리를 대신합니다.
export type DemoUser = { id: string; name: string; email: string; isTeacher: boolean };

export const DEMO_TEACHER: DemoUser = {
  id: "t-1",
  name: "○○○ 선생님",
  email: "teacher@school.kr",
  isTeacher: true,
};

const STUDENT_NAMES = [
  "김서연", "박지호", "최하은", "이도윤", "정우진", "한서준", "김민준", "윤지아", "오승우", "장예린",
  "강하린", "조민재", "임수아", "신유준", "배지민", "송예준", "홍채원", "문시우", "권다은", "류건우",
  "남지유", "백현우", "서아린", "황도현", "안소율", "유태윤", "전나윤", "고은호",
];

export const DEMO_STUDENTS: DemoUser[] = STUDENT_NAMES.map((name, i) => ({
  id: `s-${i + 1}`,
  name,
  email: `student${i + 1}@school.kr`,
  isTeacher: false,
}));

export const DEMO_USERS = [DEMO_TEACHER, ...DEMO_STUDENTS];

export function demoUserByName(name: string) {
  const u = DEMO_USERS.find((u) => u.name === name);
  if (!u) throw new Error(`없는 가상 사용자: ${name}`);
  return u;
}

// 지금 누구로 보고 있는지는 탭마다 따로 기억합니다 (탭 두 개로 교사·학생 화면을 나란히 볼 수 있게).
const KEY = "class-board-demo-user";
const EVENT = "class-board-demo-user";

export function getDemoUser(): DemoUser {
  let id: string | null = null;
  try {
    id = sessionStorage.getItem(KEY);
  } catch {
    // 저장소를 못 쓰는 환경이면 기본 학생으로
  }
  return DEMO_USERS.find((u) => u.id === id) ?? DEMO_STUDENTS[0];
}

export function setDemoUser(id: string) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // 무시
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onDemoUserChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
