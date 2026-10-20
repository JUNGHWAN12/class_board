import type { Board, Comment, Post, PostKind, RevealMode, ViewKey } from "@/lib/types";
import { DEMO_STUDENTS, DEMO_TEACHER, demoUserByName } from "./users";

// 체험 모드 첫 실행 때 채워 넣는 예시 데이터 (정보·인공지능 기초·데이터 과학 주제 게시판 5개).

export type DemoDb = {
  version: number;
  boards: Omit<Board, "post_count">[];
  posts: (Omit<Post, "author_name" | "author_avatar" | "removed"> & { deleted_at: string | null })[];
  comments: (Omit<Comment, "author_name" | "author_avatar" | "removed"> & { deleted_at: string | null })[];
  likes: string[]; // `${postId}|${userId}`
};

export const DEMO_DB_VERSION = 3;

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
  kind?: PostKind;
  photo?: string;
  hidden?: boolean;
  answer?: string; // 첫 댓글로 다는 선생님 답변
  solved?: boolean; // 선생님 답변을 채택한 질문
};

type SeedBoard = {
  id: string;
  subject: string;
  title: string;
  desc: string;
  view: ViewKey;
  kind: PostKind;
  reveal?: RevealMode;
  notice: string;
  sections: string[];
  locked?: boolean;
  posts: SeedPost[];
};

// 질문 양식으로 쓴 글과 같은 모양 (PostComposer 의 buildQuestion 참고)
function question(lang: string, code: string, error: string, tried: string) {
  return "```" + lang + "\n" + code + "\n```\n```error\n" + error + "\n```\n해 본 것: " + tried;
}

const BOARDS: SeedBoard[] = [
  {
    id: "python",
    subject: "정보 · 프로그래밍",
    title: "파이썬 코드 나눔",
    desc: "오늘 실습한 코드를 올리고 서로 고쳐 줘요.",
    view: "wall",
    kind: "code",
    notice: "[코드 넣기] 버튼으로 코드를 넣고, 실행 결과도 한 줄 적어 주세요.",
    sections: ["반복문", "조건문", "함수", "질문"],
    posts: [
      { title: "구구단 2단 출력", body: "for 문으로 2단을 출력했어요.\n```python\nfor i in range(1, 10):\n    print(2, 'x', i, '=', 2 * i)\n```", author: "김서연", section: "반복문", likes: 12, comments: 3 },
      { title: "짝수 홀수 판별", body: "입력한 수가 짝수인지 알려 줘요.\n```python\nn = int(input('수: '))\nif n % 2 == 0:\n    print('짝수')  # 2로 나눈 나머지가 0\nelse:\n    print('홀수')\n```", author: "이도윤", section: "조건문", likes: 8, comments: 2 },
      { title: "range 끝 숫자가 안 나와요", kind: "question", body: question("python", "for i in range(10):\n    print(i)", "0부터 9까지만 출력되고 10이 안 나와요", "range(11) 로 바꾸니 10까지 나오긴 하는데 이유를 모르겠어요."), author: "박지호", section: "질문", likes: 5, comments: 3, answer: "range(a, b) 는 b 바로 앞에서 멈춰요. range(10) 은 0~9 열 개를 만들어요.", solved: true },
      { title: "최댓값 함수 만들기", body: "max() 없이 직접 만들어 봤어요.\n```python\ndef my_max(nums):\n    best = nums[0]\n    for x in nums:\n        if x > best:\n            best = x\n    return best\n\nprint(my_max([3, 9, 4]))  # 9\n```", author: "최하은", section: "함수", likes: 15, comments: 2 },
      { title: "별 찍기", body: "```python\nfor i in range(1, 6):\n    print('*' * i)\n```\n결과가 삼각형 모양으로 나와요.", author: "정우진", section: "반복문", likes: 3, comments: 1 },
      { title: "수업과 관계없는 글", kind: "general", body: "선생님만 볼 수 있는 숨긴 글이에요.", author: "한서준", section: "질문", likes: 0, comments: 0, hidden: true },
    ],
  },
  {
    id: "ai",
    subject: "인공지능 기초 · 실험",
    title: "AI 모델 실험 결과",
    desc: "모둠별로 만든 분류 모델의 정확도와 느낀 점을 정리해요.",
    view: "group",
    kind: "general",
    notice: "모둠 대표 한 명이 정확도와 잘못 분류한 예시를 올려 주세요.",
    sections: ["1모둠", "2모둠", "3모둠", "4모둠"],
    locked: true,
    posts: [
      { title: "가위바위보 분류 92%", body: "사진을 클래스마다 50장씩 학습시켰더니 정확도가 92%였어요. 보를 가위로 헷갈리는 경우가 많았어요.", author: "김민준", section: "1모둠", likes: 9, comments: 2, photo: photo("✌️", "티처블 머신 학습 화면", "#DDEFE6") },
      { title: "재활용품 분류", body: "캔과 페트병은 잘 구분하는데, 구겨진 캔은 자주 틀렸어요.", author: "윤지아", section: "2모둠", likes: 6, comments: 1, photo: photo("♻️", "분류 결과", "#E3EAF6") },
      { title: "데이터가 부족했던 이유", body: "배경이 모두 교실 책상이라 다른 장소에서는 정확도가 60%까지 떨어졌어요. 데이터의 다양성이 중요하다는 걸 알았어요.", author: "오승우", section: "3모둠", likes: 11, comments: 3 },
      { title: "학습 횟수별 정확도", kind: "code", body: "```python\nfor epoch, acc in [(10, 0.71), (30, 0.85), (50, 0.88), (100, 0.87)]:\n    print(epoch, acc)\n```\n100번은 오히려 조금 떨어졌어요 (과적합?)", author: "장예린", section: "4모둠", likes: 7, comments: 0, photo: photo("📈", "정확도 변화", "#FFF3B8") },
    ],
  },
  {
    id: "qna",
    subject: "정보 · 질문",
    title: "코딩 질문방",
    desc: "수업 중에 막힌 부분을 바로 물어봐요.",
    view: "chat",
    kind: "question",
    notice: "질문을 고르면 내 코드, 에러 메시지, 해 본 것을 적는 칸이 나와요. 친구 질문에 먼저 답해 줘도 좋아요.",
    sections: ["문법 질문", "오류 질문"],
    posts: [
      { title: "", kind: "question", body: question("python", "if score >= 90:\nprint('A')", "  File \"main.py\", line 2\n    print('A')\n    ^\nIndentationError: expected an indented block", "콜론은 붙였는데 계속 같은 에러가 나요."), author: "박지호", section: "오류 질문", likes: 4, comments: 2, answer: "if 다음 줄은 스페이스 4칸 들여써야 해요. 글쓰기 창에서 Tab 키를 누르면 4칸이 들어가요.", solved: true },
      { title: "", kind: "question", body: "리스트에서 `append` 랑 `insert` 는 뭐가 달라요?", author: "김서연", section: "문법 질문", likes: 2, comments: 1, answer: "append(x) 는 맨 뒤에 붙이고, insert(i, x) 는 i 번째 자리에 끼워 넣어요." },
      { title: "", kind: "question", body: question("python", "while True:\n    n = int(input())\n    print(n * 2)", "프로그램이 끝나지 않아요", "Ctrl+C 로만 멈출 수 있어요."), author: "이도윤", section: "오류 질문", likes: 6, comments: 2 },
    ],
  },
  {
    id: "viz",
    subject: "데이터 과학 · 시각화",
    title: "데이터 시각화 갤러리",
    desc: "공공데이터로 그린 그래프를 크게 모아 봐요.",
    view: "feed",
    kind: "code",
    notice: "그래프 아래에 데이터 출처와 알게 된 점 한 줄을 적어 주세요.",
    sections: ["막대", "꺾은선", "산점도"],
    posts: [
      { title: "우리 지역 월별 기온", body: "기상청 자료로 그렸어요. 8월이 가장 덥고 1월이 가장 추워요.\n```python\nplt.plot(df['월'], df['평균기온'], marker='o')\nplt.show()\n```", author: "최하은", section: "꺾은선", likes: 18, comments: 3, photo: photo("📈", "월별 평균 기온", "#CFE3DA") },
      { title: "급식 메뉴 인기 투표", body: "우리 반 28명 설문 결과예요. 1위는 돈가스!", author: "정우진", section: "막대", likes: 13, comments: 2, photo: photo("📊", "메뉴별 득표 수", "#FCEFB4") },
      { title: "공부 시간과 수면 시간", body: "공부 시간이 길다고 수면 시간이 꼭 짧지는 않았어요. 상관관계가 약해요.", author: "한서준", section: "산점도", likes: 10, comments: 1, photo: photo("🔵", "산점도", "#DCE8F5") },
    ],
  },
  {
    id: "project",
    subject: "데이터 과학 · 과제",
    title: "탐구 프로젝트 제출함",
    desc: "데이터 탐구 보고서를 올리면 친구들 보고서를 볼 수 있어요.",
    view: "list",
    kind: "assignment",
    reveal: "after_submit",
    notice: "제출 기한은 금요일까지예요. 코드와 데이터 출처를 꼭 넣어 주세요.",
    sections: ["1차 제출", "2차 제출"],
    posts: [
      { title: "따릉이 대여량과 날씨", body: "비 오는 날은 대여량이 평균 40% 줄었어요. pandas로 날씨별로 묶어서 비교했어요.\n```python\ndf.groupby('날씨')['대여량'].mean()\n```", author: "김민준", section: "1차 제출", likes: 7, comments: 2, photo: photo("🚲", "날씨별 평균 대여량", "#DDEFE6") },
      { title: "교실 소음 측정", body: "마이크로비트로 쉬는 시간과 수업 시간 소음을 비교했어요.", author: "강하린", section: "1차 제출", likes: 5, comments: 1 },
      { title: "학교 앞 미세먼지 분석", body: "등교 시간대 미세먼지가 가장 높았어요. 요일별 차이도 정리했어요.", author: "윤지아", section: "2차 제출", likes: 9, comments: 3, photo: photo("🌫️", "시간대별 미세먼지", "#E8E0F5") },
      { title: "유튜브 조회수 예측", body: "제목 길이와 조회수의 관계를 선형 회귀로 살펴봤어요.\n```python\nfrom sklearn.linear_model import LinearRegression\nmodel = LinearRegression().fit(X, y)\nprint(model.score(X, y))\n```", author: "오승우", section: "2차 제출", likes: 4, comments: 0 },
    ],
  },
];

const COMMENT_POOL = [
  "저도 같은 오류가 났었어요!",
  "코드가 깔끔해서 이해가 잘 돼요.",
  "변수 이름을 더 알아보기 쉽게 바꾸면 좋겠어요.",
  "좋은 아이디어예요 👍",
  "실행해 보니 잘 돼요.",
  "for 문 대신 while 로도 해 볼 수 있을 것 같아요.",
  "그래프가 한눈에 들어와요.",
  "우리 모둠 결과랑 비슷해요.",
];

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
      default_kind: b.kind,
      reveal_mode: b.reveal ?? "open",
      revealed: false,
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
      const post: DemoDb["posts"][number] = {
        id: postId,
        board_id: b.id,
        author_id: author.id,
        kind: p.kind ?? b.kind,
        title: p.title,
        content: p.body,
        section: p.section,
        image_path: p.photo ?? null,
        solved_comment_id: null,
        is_hidden: Boolean(p.hidden),
        deleted_at: null,
        like_count: p.likes,
        comment_count: p.comments,
        created_at: iso(minutesAgo),
        updated_at: iso(minutesAgo),
      };
      db.posts.push(post);

      for (let c = 0; c < p.comments; c++) {
        const answer = c === 0 ? p.answer : undefined;
        const commenter = answer ? DEMO_TEACHER : DEMO_STUDENTS[(pi * 3 + c * 5 + bi + 1) % DEMO_STUDENTS.length];
        commentNo++;
        const id = `c-${commentNo}`;
        if (answer && p.solved) post.solved_comment_id = id;
        db.comments.push({
          id,
          post_id: postId,
          author_id: commenter.id,
          content: answer ?? COMMENT_POOL[(commentNo * 3) % COMMENT_POOL.length],
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
