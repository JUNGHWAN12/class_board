// 300명 동시 접속 부하 테스트
//
// 실제 화면이 Supabase 에 보내는 요청을 그대로 흉내 냅니다.
//   - 학생마다 5초(±15%)마다 바뀐 글 확인 (get_board_posts, 바뀐 것만)
//   - 15초마다 게시판 정보 확인 (get_boards)
//   - 가끔 글쓰기 / 좋아요 / 댓글 / 댓글 확인
// 테스트 전용 게시판을 만들어 그 안에서만 쓰고, 끝나면 게시판째 지웁니다.
//
// 필요한 환경 변수
//   SUPABASE_URL, SUPABASE_ANON_KEY   : 화면에서 쓰는 것과 같은 값
//   LOADTEST_EMAIL, LOADTEST_PASSWORD  : 테스트 계정 (teachers 표에 등록된 비밀번호 로그인 계정)
//   USERS (기본 300), MINUTES (기본 10), RAMP_SECONDS (기본 60)
//
// 실행: node scripts/loadtest.mjs

const env = process.env;
const BASE = (env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_ANON_KEY || "";
const USERS = Number(env.USERS || 300);
const MINUTES = Math.min(50, Number(env.MINUTES || 10)); // 로그인 토큰이 1시간이라 50분까지
const RAMP_SECONDS = Number(env.RAMP_SECONDS || 60);

const POLL_MS = 5000; // 화면과 같은 값 (BoardView POLL_MS)
const BOARD_POLL_MS = 15000; // BoardView BOARD_POLL_MS
const OVERLAP_MS = 10000;
// 학생 한 명이 평균적으로 하는 일 (수업 중 활발한 상황을 가정)
const POST_EVERY_MS = 4 * 60_000; // 4분에 글 1개
const LIKE_EVERY_MS = 60_000; // 1분에 좋아요 1번
const COMMENT_EVERY_MS = 3 * 60_000; // 3분에 댓글 1개
const OPEN_POST_EVERY_MS = 90_000; // 1분 30초마다 글 하나 열어서 댓글 보기

if (!BASE || !KEY || !env.LOADTEST_EMAIL || !env.LOADTEST_PASSWORD) {
  console.error("SUPABASE_URL, SUPABASE_ANON_KEY, LOADTEST_EMAIL, LOADTEST_PASSWORD 가 필요합니다.");
  process.exit(2);
}

// ---------------------------------------------------------------- 측정
const stats = new Map(); // name -> { ok, fail, times: number[], errors: Map }
function record(name, ms, ok, err) {
  let s = stats.get(name);
  if (!s) stats.set(name, (s = { ok: 0, fail: 0, times: [], errors: new Map() }));
  s.times.push(ms);
  if (ok) s.ok++;
  else {
    s.fail++;
    const k = String(err).slice(0, 120);
    s.errors.set(k, (s.errors.get(k) || 0) + 1);
  }
}
function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

// ---------------------------------------------------------------- 요청
let token = "";
const TIMEOUT_MS = 20_000;
let inFlight = 0;

// AbortSignal.timeout 만으로는 요청이 끝나지 않는 경우가 있어서(첫 실행에서 멈춤),
// 직접 만든 타이머로 abort 하고, 그래도 안 끝나면 기다리지 않고 실패로 셉니다.
function withTimeout(run) {
  const ac = new AbortController();
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      ac.abort();
      reject(Object.assign(new Error("timeout 20s"), { name: "TimeoutError" }));
    }, TIMEOUT_MS);
  });
  return Promise.race([run(ac.signal), guard]).finally(() => clearTimeout(timer));
}

async function call(name, method, path, body, { prefer } = {}) {
  const t0 = performance.now();
  inFlight++;
  try {
    const { res, text } = await withTimeout(async (signal) => {
      const res = await fetch(BASE + path, {
        method,
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${token || KEY}`,
          "Content-Type": "application/json",
          ...(prefer ? { Prefer: prefer } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      return { res, text: await res.text() };
    });
    const ms = performance.now() - t0;
    // 23505: 이미 좋아요한 글 (화면도 무시함)
    const ok = res.ok || (name === "like" && text.includes("23505"));
    record(name, ms, ok, ok ? null : `${res.status} ${text}`);
    if (!res.ok) return null;
    return text ? JSON.parse(text) : null;
  } catch (e) {
    record(name, performance.now() - t0, false, e?.name === "TimeoutError" ? "timeout 20s" : e?.message || e);
    return null;
  } finally {
    inFlight--;
  }
}
const rpc = (name, args) => call(name, "POST", `/rest/v1/rpc/${name}`, args);

// ---------------------------------------------------------------- 준비
async function signIn() {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.LOADTEST_EMAIL, password: env.LOADTEST_PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`테스트 계정 로그인 실패: ${res.status} ${JSON.stringify(data)}`);
  token = data.access_token;
  return data.user.id;
}

async function setup(userId) {
  const teacher = await rpc("is_teacher", {});
  if (teacher !== true) {
    throw new Error("테스트 계정이 교사로 인식되지 않습니다. teachers 표와 school_domains 표를 확인하세요.");
  }
  const rows = await call("setup", "POST", "/rest/v1/boards", {
    title: `부하 테스트 ${new Date().toISOString().slice(0, 16)} (자동 삭제)`,
    subject: "부하 테스트",
    description: "자동 테스트용 게시판입니다. 테스트가 끝나면 지워집니다.",
    owner_id: userId,
  }, { prefer: "return=representation" });
  if (!rows?.[0]?.id) throw new Error("테스트 게시판을 만들지 못했습니다.");
  return rows[0].id;
}

async function cleanup(boardId) {
  if (!boardId) return;
  try {
    const { res, text } = await withTimeout(async (signal) => {
      const res = await fetch(`${BASE}/rest/v1/boards?id=eq.${boardId}`, {
        method: "DELETE",
        headers: { apikey: KEY, Authorization: `Bearer ${token}` },
        signal,
      });
      return { res, text: await res.text() };
    });
    console.log(res.ok ? `테스트 게시판 삭제 완료 (${boardId})` : `테스트 게시판 삭제 실패: ${res.status} ${text}`);
  } catch (e) {
    console.log(`테스트 게시판 삭제 실패: ${e?.message || e} — Supabase 에서 "부하 테스트 … (자동 삭제)" 게시판을 직접 지워주세요.`);
  }
}

// ---------------------------------------------------------------- 학생 한 명
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.85 + Math.random() * 0.3);
const chance = (everyMs) => Math.random() < POLL_MS / everyMs;

const SAMPLE_CODE = 'n = int(input())\ntotal = 0\nfor i in range(1, n + 1):\n    total += i\nprint(total)';

async function student(i, boardId, userId, endAt) {
  await sleep((RAMP_SECONDS * 1000 * i) / USERS); // 한꺼번에 몰리지 않게 천천히 입장
  let since = null;
  const posts = new Map();
  let nextBoardPoll = 0;

  // 입장: 게시판 정보 + 내 좋아요 + 전체 글
  await rpc("get_boards", { p_board: boardId });
  await call("my_likes", "GET", `/rest/v1/likes?select=post_id&user_id=eq.${userId}`);

  while (Date.now() < endAt) {
    const sinceArg = since ? new Date(new Date(since).getTime() - OVERLAP_MS).toISOString() : null;
    const rows = await rpc("get_board_posts", { p_board: boardId, p_since: sinceArg });
    for (const r of rows || []) {
      if (!since || r.updated_at > since) since = r.updated_at;
      if (r.removed) posts.delete(r.id);
      else posts.set(r.id, r);
    }

    if (Date.now() >= nextBoardPoll) {
      await rpc("get_boards", { p_board: boardId });
      nextBoardPoll = Date.now() + jitter(BOARD_POLL_MS);
    }

    const ids = [...posts.keys()];
    const pick = () => ids[Math.floor(Math.random() * ids.length)];

    if (chance(POST_EVERY_MS)) {
      const kind = ["general", "code", "question"][i % 3];
      await call("create_post", "POST", "/rest/v1/posts", {
        board_id: boardId,
        author_id: userId,
        kind,
        title: `학생${i} 테스트`,
        content: kind === "general" ? `학생${i}의 생각입니다.` : "```python\n" + SAMPLE_CODE + "\n```",
        section: "",
      }, { prefer: "return=minimal" });
    }
    if (ids.length && chance(LIKE_EVERY_MS)) {
      const id = pick();
      // 테스트 계정 하나를 300명이 같이 쓰므로, 좋아요/취소를 번갈아 보냄
      if (Math.random() < 0.5) {
        await call("like", "POST", "/rest/v1/likes", { post_id: id, user_id: userId }, { prefer: "return=minimal" });
      } else {
        await call("unlike", "DELETE", `/rest/v1/likes?post_id=eq.${id}&user_id=eq.${userId}`);
      }
    }
    if (ids.length && chance(COMMENT_EVERY_MS)) {
      await call("add_comment", "POST", "/rest/v1/comments", {
        post_id: pick(),
        author_id: userId,
        content: `학생${i} 댓글`,
      }, { prefer: "return=minimal" });
    }
    if (ids.length && chance(OPEN_POST_EVERY_MS)) {
      await rpc("get_post_comments", { p_post: pick(), p_since: null });
    }

    await sleep(jitter(POLL_MS));
  }
}

// ---------------------------------------------------------------- 실행
function report(seconds) {
  const lines = [];
  lines.push(`## 부하 테스트 결과`);
  lines.push("");
  lines.push(`가상 학생 ${USERS}명 · ${MINUTES}분 (입장 ${RAMP_SECONDS}초에 걸쳐) · 실제 측정 ${Math.round(seconds)}초`);
  lines.push("");
  lines.push("| 요청 | 횟수 | 실패 | 초당 | 중간값 | 95% | 99% | 최대 |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  let total = 0;
  let failed = 0;
  const allTimes = [];
  for (const [name, s] of [...stats].sort((a, b) => b[1].times.length - a[1].times.length)) {
    const t = [...s.times].sort((a, b) => a - b);
    total += t.length;
    failed += s.fail;
    allTimes.push(...t);
    const f = (x) => `${Math.round(x)}ms`;
    lines.push(
      `| ${name} | ${t.length} | ${s.fail} | ${(t.length / seconds).toFixed(1)} | ${f(pct(t, 50))} | ${f(pct(t, 95))} | ${f(pct(t, 99))} | ${f(t[t.length - 1] || 0)} |`,
    );
  }
  allTimes.sort((a, b) => a - b);
  const errRate = total ? (failed / total) * 100 : 0;
  lines.push("");
  lines.push(`**전체 ${total}건, 실패 ${failed}건 (${errRate.toFixed(2)}%), 초당 ${(total / seconds).toFixed(1)}건, 95% 응답 ${Math.round(pct(allTimes, 95))}ms**`);
  const errs = [];
  for (const [name, s] of stats) for (const [e, n] of s.errors) errs.push(`- ${name}: ${n}건 — ${e}`);
  if (errs.length) {
    lines.push("");
    lines.push("### 오류 (같은 오류는 묶음)");
    lines.push(...errs.slice(0, 30));
  }
  return { text: lines.join("\n"), errRate, p95: pct(allTimes, 95) };
}

let boardId = null;
let stopping = false;
async function main() {
  const userId = await signIn();
  boardId = await setup(userId);
  console.log(`테스트 게시판 ${boardId} 에서 학생 ${USERS}명, ${MINUTES}분 시작`);
  const start = Date.now();
  const endAt = start + MINUTES * 60_000;
  const progress = setInterval(() => {
    let n = 0;
    let f = 0;
    for (const s of stats.values()) {
      n += s.times.length;
      f += s.fail;
    }
    console.log(`${Math.round((Date.now() - start) / 1000)}초: 요청 ${n}건, 실패 ${f}건, 진행 중 ${inFlight}건`);
  }, 30_000);
  try {
    // 시간이 끝나고 1분 안에 못 끝낸 학생은 기다리지 않고 결과를 냅니다.
    let finished = 0;
    const all = Promise.all(
      Array.from({ length: USERS }, (_, i) => student(i, boardId, userId, endAt).finally(() => finished++)),
    );
    const late = await Promise.race([all.then(() => false), sleep(endAt + 60_000 - Date.now()).then(() => true)]);
    if (late) console.log(`시간이 지나도 끝나지 않은 학생 ${USERS - finished}명은 빼고 결과를 냅니다.`);
  } finally {
    clearInterval(progress);
  }
  const r = report((Date.now() - start) / 1000);
  console.log(r.text);
  if (env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(env.GITHUB_STEP_SUMMARY, r.text + "\n");
  }
  return r;
}

async function stop(code) {
  if (stopping) return;
  stopping = true;
  await cleanup(boardId);
  process.exit(code);
}
process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

main().then(
  (r) => stop(r.errRate > 1 ? 1 : 0),
  async (e) => {
    console.error(e.message || e);
    await stop(1);
  },
);
