# 수업 게시판

학교 구글 계정으로 로그인해서 함께 쓰는 수업용 게시판입니다. 학생 300명 동시접속을 목표로, **Supabase 무료 요금제** 안에서 동작하도록 만들었습니다.

- 화면: Next.js + Tailwind CSS (Vercel 무료 배포)
- 백엔드/DB: Supabase (PostgreSQL, 구글 로그인, 사진 저장)

## 기능

- 학교 구글 계정 로그인 (다른 도메인 계정은 DB 에서 차단)
- 교사: 게시판 만들기, 글·댓글 숨기기/삭제, 게시판 잠그기, 엑셀(CSV) 내보내기
- 학생: 글쓰기(사진 첨부), 내 글 수정/삭제, 댓글, 좋아요
- 새 글·댓글·좋아요는 5초마다 자동 반영 (무료 요금제 실시간 연결 한도 200개를 피하려고 바뀐 글만 가져오는 방식 사용)
- 사진은 올리기 전에 긴 변 1280px JPEG 로 줄여서 저장

## 처음 설정하기

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 새 프로젝트를 만듭니다 (Free, 지역은 Seoul 추천).
2. **SQL Editor** 에 `supabase/migrations/0001_init.sql` 내용을 통째로 붙여넣고 실행합니다.
3. 같은 SQL Editor 에서 학교 도메인과 교사 이메일을 넣습니다.
   ```sql
   update app_config set allowed_domain = 'school.kr';   -- 학교 구글 도메인
   insert into teachers (email) values ('teacher@school.kr');  -- 교사마다 한 줄
   ```

### 2. 구글 로그인 켜기
1. Google Cloud Console > API 및 서비스 > 사용자 인증 정보에서 **OAuth 클라이언트 ID (웹 애플리케이션)** 를 만듭니다.
   - 승인된 리디렉션 URI: `https://<프로젝트>.supabase.co/auth/v1/callback`
2. Supabase > Authentication > Sign In / Providers > **Google** 을 켜고 클라이언트 ID/보안 비밀을 붙여넣습니다.
3. Supabase > Authentication > URL Configuration 에 사이트 주소(예: `https://class-board.vercel.app`)와 `https://class-board.vercel.app/**` 를 추가합니다. 로컬 개발 시 `http://localhost:3000/**` 도 추가합니다.

### 3. 화면 배포 (Vercel)
1. https://vercel.com 에서 이 GitHub 저장소를 가져옵니다.
2. 환경 변수 3개를 넣습니다 (`.env.example` 참고).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase > Project Settings > API)
   - `NEXT_PUBLIC_SCHOOL_DOMAIN` (예: `school.kr`)
3. Deploy.

### 4. 일시정지 방지
무료 프로젝트는 1주일 동안 요청이 없으면 멈춥니다. GitHub 저장소 Settings > Secrets and variables > Actions 에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 를 넣으면 `.github/workflows/keep-alive.yml` 이 3일마다 깨워 둡니다.

## 로컬에서 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

## 무료 요금제 안에서 쓰기 위한 설계

| 무료 한도 | 대응 |
|---|---|
| 실시간 동시연결 200개 | 실시간 대신 5초마다 바뀐 글만 조회, 탭이 안 보이면 멈춤 |
| DB 500MB | 글·댓글은 텍스트만 저장 (수십만 건 수준) |
| 사진 저장 1GB / 전송 5GB(월) | 업로드 전 압축, 파일당 2MB 제한, 글 삭제 시 사진도 삭제 |
| 1주 미사용 시 일시정지 | GitHub Actions 로 3일마다 깨우기 |

## 권한 구조

모든 권한은 DB 의 행 단위 보안(RLS)으로 검사합니다. 화면을 조작해도 우회할 수 없습니다.

- 학교 도메인이 아닌 계정: 아무것도 읽고 쓸 수 없음
- 학생: 글/댓글 쓰기, 본인 글·댓글 수정/삭제, 좋아요. 잠긴 게시판에는 쓸 수 없음. 숨김·카운트 값은 바꿀 수 없음
- 교사(`teachers` 표): 게시판 생성·잠금, 모든 글·댓글 숨기기/삭제, CSV 내보내기
- 학생 이메일은 교사만 볼 수 있음 (다른 학생에게는 이름만 표시)

참고: 사진 저장소는 공개 버킷이라, 사진 주소를 아는 사람은 로그인 없이도 사진을 볼 수 있습니다 (주소는 추측 불가능한 무작위 값).
