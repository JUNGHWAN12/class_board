import type { Board, Comment, Post, ViewKey } from "@/lib/types";
import { DEMO_STUDENTS, DEMO_TEACHER, demoUserByName } from "./users";

// 체험 모드 첫 실행 때 채워 넣는 예시 데이터 (UI 초안 통합안의 주제 게시판 5개).

export type DemoDb = {
  version: number;
  boards: Omit<Board, "post_count">[];
  posts: (Omit<Post, "author_name" | "author_avatar" | "removed"> & { deleted_at: string | null })[];
  comments: (Omit<Comment, "author_name" | "author_avatar" | "removed"> & { deleted_at: string | null })[];
  likes: string[]; // `${postId}|${userId}`
};

export const DEMO_DB_VERSION = 1;

// 실제 사진 대신 쓰는 그림 (SVG). 학생이 체험 모드에서 올린 사진은 실제 사진으로 저장됩니다.
function photo(emoji: string, caption: string, bg: string, ratio = 0.75) {
  const w = 800;
  const h = Math.round(w * ratio);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.6"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<text x="50%" y="48%" font-size="${Math.round(h * 0.42)}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
<text x="50%" y="88%" font-size="34" text-anchor="middle" fill="#1C2B27" font-family="sans-serif" opacity="0.7">${caption}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type SeedPost = {
  title: string;
  body: string;
  author: string;
  section: string;
  likes: number;
  comments: number;
  photo?: string;
  hidden?: boolean;
};

type SeedBoard = {
  id: string;
  subject: string;
  title: string;
  desc: string;
  view: ViewKey;
  notice: string;
  sections: string[];
  locked?: boolean;
  posts: SeedPost[];
};

const BOARDS: SeedBoard[] = [
  {
    id: "plant",
    subject: "과학 · 관찰",
    title: "봄 식물 찾기",
    desc: "동네에서 찾은 봄 식물 사진과 특징을 올려요.",
    view: "wall",
    notice: "직접 찍은 식물 사진 1장과 특징 한 문장을 올려 주세요.",
    sections: ["꽃", "나무", "풀", "질문"],
    posts: [
      { title: "학교 화단 민들레", body: "점심시간에 화단에서 찾았어요. 꽃잎이 생각보다 훨씬 많아요.", author: "김서연", section: "꽃", likes: 12, comments: 3, photo: photo("🌼", "학교 화단", "#F6D365") },
      { title: "질문 있어요!", body: "개나리랑 영춘화는 어떻게 구분하나요?", author: "박지호", section: "질문", likes: 5, comments: 4 },
      { title: "냉이 꽃", body: "할머니가 알려주셨어요. 아주 작은 흰 꽃이 피어요.", author: "최하은", section: "풀", likes: 15, comments: 2, photo: photo("🌿", "뒷산 길가", "#BFE3C8", 1) },
      { title: "아파트 앞 벚꽃", body: "꽃잎이 다섯 장이고 꽃자루가 길어요.", author: "이도윤", section: "나무", likes: 8, comments: 2, photo: photo("🌸", "아파트 앞", "#F8D7DF", 0.66) },
      { title: "제비꽃 관찰 기록", body: "잎 모양이 하트처럼 생겼고 꽃은 보라색이에요.", author: "정우진", section: "꽃", likes: 3, comments: 1 },
      { title: "수업과 관계없는 글", body: "선생님만 볼 수 있는 숨긴 글이에요.", author: "한서준", section: "풀", likes: 0, comments: 0, hidden: true },
    ],
  },
  {
    id: "exp",
    subject: "과학 · 실험",
    title: "광합성 실험 결과",
    desc: "모둠별 실험 결과와 측정값을 정리해요.",
    view: "group",
    notice: "모둠 대표 한 명이 결과를 올려 주세요.",
    sections: ["1모둠", "2모둠", "3모둠", "4모둠"],
    locked: true,
    posts: [
      { title: "빛 세기에 따른 기포 수", body: "전등을 가까이 할수록 기포가 많이 나왔어요.", author: "김민준", section: "1모둠", likes: 9, comments: 2, photo: photo("💡", "1모둠 실험대", "#FFF3B8") },
      { title: "수온 실험", body: "따뜻한 물에서 기포가 더 빨리 생겼어요.", author: "윤지아", section: "2모둠", likes: 6, comments: 1 },
      { title: "실패한 이유", body: "물풀을 너무 오래 꺼내 둬서 기포가 거의 없었어요.", author: "오승우", section: "3모둠", likes: 11, comments: 3 },
      { title: "측정표", body: "1분마다 기포 수를 셌어요: 4, 7, 11, 12", author: "장예린", section: "4모둠", likes: 7, comments: 0, photo: photo("📊", "측정표", "#E3EAF6") },
    ],
  },
  {
    id: "qna",
    subject: "과학 · 질문",
    title: "우리 반 질문방",
    desc: "수업 중에 궁금한 점을 바로 물어봐요.",
    view: "chat",
    notice: "친구 질문에 답할 수 있으면 먼저 답해 주세요.",
    sections: ["수업 질문", "과제 질문"],
    posts: [
      { title: "", body: "선생님, 엽록체는 동물 세포에도 있나요?", author: "박지호", section: "수업 질문", likes: 4, comments: 2 },
      { title: "", body: "수행평가 사진은 몇 장까지 올려요?", author: "김서연", section: "과제 질문", likes: 2, comments: 1 },
      { title: "", body: "광합성 식 다시 알려 주실 수 있나요?", author: "이도윤", section: "수업 질문", likes: 6, comments: 2 },
    ],
  },
  {
    id: "gallery",
    subject: "과학 · 사진",
    title: "생태 사진전",
    desc: "학교 주변 생물 사진을 크게 모아 봐요.",
    view: "feed",
    notice: "사진 아래에 찍은 장소를 적어 주세요.",
    sections: ["식물", "곤충", "새"],
    posts: [
      { title: "비 온 뒤 달팽이", body: "체육관 뒤 화단에서 찍었어요.", author: "최하은", section: "곤충", likes: 18, comments: 3, photo: photo("🐌", "체육관 뒤 화단", "#CFE3DA") },
      { title: "운동장 까치", body: "둥지 재료를 물고 가고 있었어요.", author: "정우진", section: "새", likes: 13, comments: 2, photo: photo("🐦", "운동장 나무", "#DCE8F5") },
      { title: "꿀벌과 유채꽃", body: "가까이 가도 도망가지 않았어요.", author: "한서준", section: "곤충", likes: 10, comments: 1, photo: photo("🐝", "정문 꽃밭", "#FCEFB4") },
    ],
  },
  {
    id: "report",
    subject: "과학 · 과제",
    title: "탐구 보고서 제출함",
    desc: "수행평가 탐구 보고서를 올리고 서로 읽어요.",
    view: "list",
    notice: "제출 기한은 금요일까지예요.",
    sections: ["1차 제출", "2차 제출"],
    posts: [
      { title: "식물의 증산 작용 보고서", body: "비닐봉지 실험으로 증산량을 비교했어요. 햇빛이 드는 곳에 둔 봉지에 물방울이 두 배 정도 더 많이 맺혔어요.", author: "김서연", section: "1차 제출", likes: 7, comments: 2, photo: photo("🧪", "증산 작용 실험", "#DDEFE6") },
      { title: "광합성 속도 탐구", body: "빛의 색깔에 따라 기포 수를 비교했어요. 빨간빛과 파란빛에서 기포가 가장 많았어요.", author: "김민준", section: "1차 제출", likes: 5, comments: 1 },
      { title: "양파 표피 세포 관찰", body: "현미경 사진과 그림을 함께 정리했어요.", author: "윤지아", section: "2차 제출", likes: 9, comments: 3, photo: photo("🔬", "현미경 100배", "#E8E0F5") },
      { title: "잎맥 모양 비교", body: "나란히맥과 그물맥 잎 10장을 비교했어요.", author: "오승우", section: "2차 제출", likes: 4, comments: 0 },
    ],
  },
];

const COMMENT_POOL = [
  "저도 비슷한 걸 봤어요!",
  "사진이 정말 선명해요.",
  "어디서 찾았는지 궁금해요.",
  "좋은 관찰이에요 👍",
  "다음 시간에 같이 확인해 봐요.",
  "저는 조금 다르게 생각했어요. 빛 때문이 아닐까요?",
  "정리가 깔끔해서 이해가 잘 돼요.",
  "우리 모둠 결과랑 비슷해요.",
];

// 질문방은 선생님 답변이 먼저 달리도록
const TEACHER_ANSWERS: Record<string, string> = {
  "선생님, 엽록체는 동물 세포에도 있나요?": "좋은 질문이에요. 엽록체는 식물 세포에만 있어요. 내일 현미경으로 같이 확인해 봐요.",
  "수행평가 사진은 몇 장까지 올려요?": "최대 3장까지 올려 주세요.",
  "광합성 식 다시 알려 주실 수 있나요?": "이산화 탄소 + 물 → (빛) → 포도당 + 산소 예요.",
};

export function createSeed(): DemoDb {
  const now = Date.now();
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const db: DemoDb = { version: DEMO_DB_VERSION, boards: [], posts: [], comments: [], likes: [] };
  let commentNo = 0;

  BOARDS.forEach((b, bi) => {
    db.boards.push({
      id: b.id,
      title: b.title,
      description: b.desc,
      subject: b.subject,
      notice: b.notice,
      sections: b.sections,
      default_view: b.view,
      allow_photos: true,
      owner_id: DEMO_TEACHER.id,
      is_locked: Boolean(b.locked),
      created_at: iso(60 * 24 * (5 - bi)),
      updated_at: iso(60 * 24 * (5 - bi)),
    });

    b.posts.forEach((p, pi) => {
      // 앞쪽 글일수록 최신
      const minutesAgo = 6 + pi * 7 + bi * 3;
      const postId = `${b.id}-${pi + 1}`;
      const author = demoUserByName(p.author);
      db.posts.push({
        id: postId,
        board_id: b.id,
        author_id: author.id,
        title: p.title,
        content: p.body,
        section: p.section,
        image_path: p.photo ?? null,
        is_hidden: Boolean(p.hidden),
        deleted_at: null,
        like_count: p.likes,
        comment_count: p.comments,
        created_at: iso(minutesAgo),
        updated_at: iso(minutesAgo),
      });

      for (let c = 0; c < p.comments; c++) {
        const teacherAnswer = c === 0 ? TEACHER_ANSWERS[p.body] : undefined;
        const commenter = teacherAnswer
          ? DEMO_TEACHER
          : DEMO_STUDENTS[(pi * 3 + c * 5 + bi + 1) % DEMO_STUDENTS.length];
        commentNo++;
        db.comments.push({
          id: `c-${commentNo}`,
          post_id: postId,
          author_id: commenter.id,
          content: teacherAnswer ?? COMMENT_POOL[(commentNo * 3) % COMMENT_POOL.length],
          is_hidden: false,
          deleted_at: null,
          created_at: iso(minutesAgo - 1 - c),
          updated_at: iso(minutesAgo - 1 - c),
        });
      }
    });
  });
  return db;
}
