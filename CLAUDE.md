# 디자인 요청 데스크 — 작업 메모

## 기준
- 원본: claude.ai 아티팩트 https://claude.ai/artifact/SMrXd6UeHzP14SrE16HGV6 — **기능·문구의 기준**. 1차(2026-11-17)에서 그대로 옮김.
- **디자인은 B+ (11-17 사용자 확정)**: design-pick 의 '정밀 핀테크 라이트'를 부드럽게 — 흰 바탕, 섹션은 8px 연회색 띠, 일정·메모는 둥근 연회색 면, 채운 버튼(모서리 12), 선 아이콘(3D 아이콘 없앰), 등폭 숫자. 요기보 고정 규칙(프리텐다드 · #3FA6D3 · 흰 바탕 · 그라데이션/3D 없음) 지킴. 스타일은 `app/desk.css` 하나.
- 사용자 결정(11-17): DB 는 **MongoDB — 예산설정(budget-dashboard/.local/.env) 클러스터 재사용, DB `designdesk`**. 이미지 폴더링은 **드롭박스**, 루트 `03_디자인/11_디자인요청 데스크`, 요청마다 `요청사항` / `결과물/1차완성본·2차완성본…`.
- 폴더 정리 추천안(월별 묶음 · 요청일_부서_프로젝트명 · 요청서 워드 자동 저장 · 1차완성본 미리 생성)은 기본값으로 들어가 있음. 바꾸라면 `lib/server/storage/index.js` 의 `BY_MONTH`·`pickFolder`.
- 화질 걱정(11-17): 올린 파일은 줄이거나 바꾸지 않고 원본 그대로 저장한다 — 이 원칙 유지.
- Flow 는 계정 하나로만 올라가서(MCP) 이 앱을 따로 만든 것 — Flow 에는 각자 'Flow 공유용 요약 복사'로 붙인다.

## 스택 · 실행
- 루트 `Desktop/design` (독립 git, 커밋은 지시 때만), Next 16.2 + React 19 + JS, dev **7200**.
- 홈 폴더에도 package-lock.json 이 있어 `next.config.mjs` 에 `turbopack.root` 고정.
- dev 서버를 다시 켰는데 새 API 경로가 404 면 `.next` 캐시 문제 — 서버 끄고 `.next` 지우고 다시 켬(11-17 겪음).

## 요청서 흐름 (11-17 추가분)
- **STEP 0 요청할 팀** (드롭다운, 필수): 디자인 → 박민정 · VMD → 김성경 · 개발 → 이승환 (`TEAMS` in constants). 서버가 팀에 맞춰 `assignee` 를 정함.
- 담당자 표시 = `assigneeOf(r, rv)` = 디자인팀이 처리에서 고른 사람(`rv.designer`) > 요청 때 고른 팀의 담당자(`r.assignee`). 처리 화면 담당자 목록 = `ASSIGNEES` (박민정·김성경·이승환·박선화).
- 요청 부서 'MD·상품기획' → **'온라인고객지원팀'** (명단 김바르미·최동욱도 옮김). 11-18 **'CS' 부서 없앰**(사용자: "온라인고객지원팀이랑 붙어서 가면 돼서") — CS 에 있던 이현주 대리는 온라인고객지원팀으로(중복 줄 뺌). 부서 = 마케팅디자인 · 온라인고객지원팀 · 영업 · 경영지원 · 임원.
- 요청 삭제는 **디자인팀만**(상세 맨 아래 '요청 삭제', 두 번 눌러 확정) — 사용자 11-18 "지금 이 상태가 맞아". 요청자는 검토중·보류일 때 '철회'만.
- 레퍼런스 이미지 **최대 20장** (장당 20MB).
- 상태(11-18): 담당 팀이 고르는 `STATUS` = 검토중 · 진행중 · 완료 · 보류 · **취소**(새로 넣음, 진행 중에라도 접은 요청 — **사유 메모 필수**, 요청자 수정·철회 막힘, 처리 화면은 남아 되돌릴 수 있음). 요청자가 검토중·보류일 때 직접 거둔 건 따로 '철회'(withdrawn). 취소·철회 = `isDropped()` → 목록 기본 보기·일정표에서 빠짐.
- 요청 현황 목록: 상태 버튼 줄(.pipe, 건수 0이면 숨김)을 없애고 **'상태' select**(`#l-status`, 7개 늘 보임 + 건수)로 바꿈 — 사용자 11-18 "진행중·취소·요청 같은 것도 select 로".
- 로고(`a.brand`, 11-18 사용자 요청) = 첫 화면: 주소의 #을 지우고 역할별 기본 화면(요청자 = 요청서 작성, 디자인팀 = 요청 현황). 서랍·창·상태 필터를 닫고, 목록·일정표·보관 화면은 `key` 를 바꿔 처음 상태로, 접수 완료 화면이면 빈 작성 화면으로(임시저장은 유지). 수정 중이면 한 번 물어봄. 뒤로 가기로 이전 화면 복귀.
- 일정표: **항상 달력부터** 열림(보기 기억 안 함). 막대 색 = **팀 색**(디자인 #3FA6D3 · VMD #F29B38 · 개발 #20B08A), 검토중 = 옅은 점선, 보류 = 흐리게, 완료 = 회색 ✓. 팀이 없는 예전 요청은 담당자의 팀 색.

## 팀별 요청서 양식 (11-18)
- 양식은 `lib/shared/forms.js` 하나 — `formOf(team)` 이 유형 · 두 번째 칩(채널/대상 시스템) · 목표/기획 라벨 · 문구 칸 · 산출물 종류(규격) · 일정 이름을 정함. 화면(RequestForm·Drawer·공유 요약)·서버 검사(cleanRequest)·내보내기가 모두 이걸 읽음.
- **디자인** = 원본 양식 그대로. **개발** = 11-18 사용자 확인 후 적용(유형 6 · 대상 시스템 · 요구사항 양식 · 작업 항목 · 중간 확인/오픈(배포) 희망일, 문구 칸 없음).
- **VMD** = 사용자 11-18: "김성경 대리님께 따로 받아서 잡기" → 받기 전까지 디자인 양식 + 'VMD 담당' 문구만. 내가 만든 초안은 `VMD_DRAFT`(설치 매장 · 제작물 · 설치(입고) 희망일)로 남겨 둠 — 받은 항목으로 고친 뒤 `FORMS.VMD` 를 바꾸면 적용.
- 개발 양식 다듬기: 사용자 11-18 "Flow 에서 개발자(이승환)에게 요청했던 글을 보고 양식을 잡아 달라" → Flow 커넥터가 로그인 만료라 못 읽음. 다시 연결되면 읽기만 해서 DEV 를 고쳐 제안.
- 이미지 칸 이름은 양식의 `refs`({label, short, desc, note}) — 디자인 '레퍼런스 이미지', **개발 '수정할 화면 캡처' + 안내(고칠 부분·오류 화면을 캡처, 빨간 네모·화살표 표시)** (사용자 11-18 "개발쪽엔 수정 부분 캡처해서 올려달라는 것도"). 작성 화면·상세 제목·워드 섹션이 이걸 씀. 저장 파일 이름은 그대로 `레퍼런스_01…`.
- 라벨 뒤 조사는 `josa()` (`lib/shared/josa.js`) 로 붙임 — 팀마다 라벨 받침이 달라서('업로드(라이브) 날짜를' / '오픈(배포) 희망일을').

## 다음 작업
- VMD 양식(김성경 대리님 항목) · 개발 양식 Flow 대조(위).
- Vercel 배포: 드롭박스 API 키는 받음(11-18, 아래 저장소). 남은 것 — 환경변수(`MONGODB_URI`·`MONGODB_DB`·`ADMIN_PASSWORD`·`SESSION_SECRET`·`DROPBOX_APP_KEY`·`DROPBOX_APP_SECRET`·`DROPBOX_REFRESH_TOKEN`·`DROPBOX_ROOT`; **`DROPBOX_MODE`·`DROPBOX_LOCAL_DIR` 은 넣지 않음**) · 워드 내보내기 4.5MB 초과 처리 · 접속 제한 방식(사이트 비밀번호 / 회사 로그인) 사용자 결정. 사이트 = https://design-data-gamma.vercel.app (11-18 12시대에 /api/state 200 으로 살아남). 단 그때 `me.storage` = local → **Vercel 에 드롭박스 키 4개가 없거나 `DROPBOX_MODE=local` 이 들어가 있음** → 이미지 /api/files 500. 키 넣고 Redeploy 뒤 `me.storage` = dropbox 인지 확인.

## 데이터
- `requests` (_id 'r…', by = 브라우저 익명 id, team, assignee, **folder = 드롭박스 전체 경로**, results = {round, count, at} 목록 표시용 요약)
- `reviews` (_id = 요청 id; status review/progress/done/hold, designer(=담당자), start, draft, live, meeting 'YYYY-MM-DDTHH:MM', note)
- `roster` (_id 'list', people[{name,title,team}]) — 명단은 DB 에만 있음(코드 기본값 없음). 바꿀 땐 화면 '요청자 명단' 또는 디자인팀 로그인 후 PUT /api/roster(전체 목록). 11-18 온라인고객지원팀에 이현주 대리 추가(김바르미 과장·최동욱 대리 다음) 뒤 CS 줄 정리 → 전체 16명 · `files` (요청서 이미지, path = 드롭박스 전체 경로) · `login_fails` (PIN 틀린 기록, 1시간 뒤 자동 삭제)
- 결과물(완성본)은 DB 에 안 넣음 — 드롭박스 `결과물/` 폴더를 그대로 읽음(디자이너가 직접 넣은 것도 보이게).
- 화면은 `/api/state` 하나를 15초마다 폴링(rev 같으면 unchanged). 작성자 id·폴더 경로는 내려보내지 않음.
- 날짜 문자열은 모두 KST `YYYY-MM-DD` (`kstToday()`).

## 저장소 (lib/server/storage)
- 경로는 전부 '드롭박스 경로' 하나. 닿는 방법만 셋: API 키 → 드롭박스 API / `DROPBOX_LOCAL_DIR` → 이 PC 동기화 폴더 / 둘 다 없음 → `.data/dropbox`.
- `DROPBOX_MODE` (11-18): `local` 이면 키가 있어도 2·3번, `api` 면 1번, 비우면 키 있으면 API. **이 PC `.env.local` = local** (API 시험은 11-18 통과 — 빠르고 이미 돌아가니 이 PC 는 local 유지, 바꾸려면 그 줄 지움). Vercel 에는 넣지 않음. `/api/state` 의 `me.storage` 로 지금 방식 확인.
- **연결 상태 확인 `/api/health`(디자인팀 로그인 필요, 11-18)**: 저장 방식 · 드롭박스 환경변수 길이(정상 = APP_KEY 15 · APP_SECRET 15 · REFRESH_TOKEN 64 · ROOT 45자)와 `cleaned`(앞뒤 공백·따옴표가 붙어 있었으면 true) · 토큰 → 계정 → 요청 데스크 폴더 단계별 성공/드롭박스 오류. 환경변수는 `dropbox.envv()` 로 공백·따옴표 떼고 읽음. Vercel 환경변수는 바꾼 뒤 **Redeploy(또는 새 커밋)** 해야 적용.
- **API 키 받음(11-18)**: 앱 `yogibo-design-desk`(Scoped · Full Dropbox · files.metadata/content read·write), 연결 계정 = 회사 공용 **'요기코퍼레이션_포워드'**(팀 Yogicorporation · 팀 스페이스 — 이 PC 드롭박스 맨 위의 `요기코퍼레이션_포워드/` 가 그 개인 폴더). 키·토큰은 `.env.local` 에만.
- 다시 받을 때: `npm run dropbox:auth` = 7299 포트 도우미 → http://localhost:7299 → [허용]. 1단계(권한·계정·폴더·올리기) 통과하면 토큰 저장, 2단계(임시 업로드 주소·CORS·옮기기·받기·목록)는 결과만 알림. 시험 파일은 `_연결시험_…` 에 만들고 지움. Redirect URI `http://localhost:7299/callback`. `-- --check` = 지금 토큰으로 확인만.
- 드롭박스 임시 업로드 주소(`content.dropboxapi.com/apitul/1/…`)는 CORS `*` 허용 → 브라우저 직접 올리기 가능(5.7MB 도 확인). Vercel 함수는 요청·응답 4.5MB 제한이라 직접 올리기가 필수. 일반 경로 + Path-Root 헤더 그대로 팀 폴더에 들어감.
- 임시 업로드 주소로 올린 파일은 **응답 뒤 0.3~0.5초 지나야 보임**(11-18 측정) → 이미지 `/commit`·결과물 `/results/confirm` 이 `statSettled()`(최대 8초)로 기다림. 결과물은 올리기 전에 `freeName()` 으로 '이름 (1).png' 를 정해 두고 그 경로로 확인.
- `files/list_folder` recursive 는 첫 장에 다 안 옴(파일 3개인데 첫 장 1개) → cursor 끝까지 읽어야 함 (앱 `list()` 는 그렇게 함).
- ⚠ 워드 내보내기는 큰 이미지가 들어가면 4.5MB 를 넘음(5.7MB 이미지 → 7.9MB) → Vercel 에선 응답이 막힘. 배포 때 처리(예: 만든 파일을 드롭박스에 올리고 임시 링크로 넘기기).
- **11-17 실제 드롭박스 연결됨**: `.env.local` 의 `DROPBOX_LOCAL_DIR=C:/Users/Yogibo Design/Yogicorporation Dropbox` (imgCreate 와 같은 방식). [테스트] 요청 폴더 들어가 있음. 이 방식은 이 PC 에서 서버가 돌 때만 — **Vercel 배포(사용자: 11-18 예정)는 드롭박스 API 키 필요**.
- 업로드: POST /api/files → (드롭박스 API 면 임시 업로드 주소로 브라우저 직접, 아니면 /content) → /commit. 제출·수정 때 `_임시업로드/` → `요청사항/` 로 옮김. 요청서 워드는 제출·수정·철회·처리 저장 때 `after()` 로 다시 씀.
- 결과물 API: /results(목록·올리기), /round(다음 차수, 현재 차수 비면 막음), /content(서버 경유), /file(보기·받기·삭제, `safeRel` 검사). 화면은 마지막 요청 응답만 반영(겹친 응답이 최신을 덮던 문제 11-17 수정).
- 요청 삭제: 이미지·요청서 지우고, 결과물 파일이 있으면 폴더 남김. 폴더 이름 고를 때 DB + 실제 폴더 존재 둘 다 봄.

## 권한
- 요청자: 로그인 없음, `drq_uid` 쿠키(1년). 본인 요청만 수정(검토중·보류)·철회(검토중·보류). 결과물은 보기·받기만.
- 디자인팀: **PIN 4자리 `ADMIN_PASSWORD`(=2027, 사용자 지정 11-17)** → `drq_team` 서명 쿠키(30일). 같은 IP 10분 안에 8번 틀리면 10분 잠김(DB 기록이라 서버 여러 대여도 통함).
- ⚠ 배포 전 과제: 지금은 주소만 알면 누구나 목록·결과물을 봄. 사이트 전체 비밀번호 / 회사 로그인 중 사용자 결정 필요.

## 시험 (중요)
- 7200 dev 서버는 **실제 DB · 실제 팀 드롭박스**에 붙어 있음 → 요청을 만들고 지우는 자동 시험을 7200 에 돌리지 말 것.
- 시험은 빌드 후 별도 서버: `npx next build` → `MONGODB_DB=designdesk_test DROPBOX_MODE=local DROPBOX_LOCAL_DIR="<repo>/.data/dropbox" npx next start -p 7201`. 시험 DB 시드는 같은 환경변수로 `node scripts/import-artifact.mjs`. (Windows 에선 빈 값 환경변수가 사라지므로 DROPBOX_LOCAL_DIR 은 꼭 시험 폴더 경로로 채움)
- ⚠ `.env.local` 에 드롭박스 API 키가 있으면 `DROPBOX_MODE=local` 을 빼먹은 시험 서버·시드가 **실제 팀 드롭박스**에 씀 → 시험 명령엔 늘 `DROPBOX_MODE=local`. API 방식을 시험할 땐 `DROPBOX_MODE=api` + `DROPBOX_ROOT=<실제 루트>/_API시험` 으로 따로 두고 끝나면 그 폴더 지움(미리 알림).
- 셸로 한글·'/' 경로 환경변수를 넘기지 말고 scratchpad 시작 스크립트로: `start-7201-local.mjs <repo>`(시험 DB · `.data/dropbox`) / `start-7201-api.mjs <repo>`(DB `designdesk_apitest` · 루트 `<실제 루트>/_API시험`, 빈 DB 는 `apitest-db.mjs <repo> prep|drop`). API 방식 시험 = `api-mode-7201.mjs <OUT> <작은 png> <4.5MB 넘는 png> <repo>` (11-18 24개 통과, 끝나면 `_API시험` 지움).
- 시험 스크립트는 세션 scratchpad 의 `*-7201.mjs` (11-17 기준 API·화면·결과물 전부 통과). 11-18: 팀 양식 시험(`api-test-teams`)·화면 시험 2(`ui-test2`, 개발 양식으로 제출·수정·철회)를 'VMD = 디자인 양식' 기준으로 고쳐 다시 통과. scratchpad 는 지워질 수 있음 — 없으면 같은 흐름으로 새로 짬.
- `next start` 시험 서버는 TaskStop 해도 node 가 남아 7201 을 잡고 있음 → 포트로 PID 찾아 명령줄이 `next start -p 7201` 인지 보고 끔.

## 함정
- Git Bash 에서 `/…` 값을 셸 환경변수로 넘기면 `C:/Program Files/Git/…` 로 바뀜 → `.env.local` 로 넣거나 `MSYS_NO_PATHCONV=1`.
- Node 24 `fs.rm/rmSync` 는 한글·'·' 경로에서 조용히 죽음 → 앱은 unlink/rmdir 만. 시험 정리도 셸 `rm -rf` 로.
- local.js 의 `process.cwd()`·`path.join` 에 `/*turbopackIgnore: true*/` — 없으면 빌드가 프로젝트 전체를 추적한다고 경고.
- JS 문자열 `.replace(a, b)` 의 b 안 `$$` 는 `$` 하나가 됨 → 코드 치환은 `split(a).join(b)`.
- 서랍 머리말을 통째로 sticky 로 두면 scrollIntoView 된 버튼을 가림 → 고정은 얇은 줄(`.dh-bar`)만, `.drawer{scroll-padding-top}`.
- **Vercel 첫 배포(11-18) `/api/state` 500**: requests.js 를 부르는 API 만 불러오는 순간 죽음(DB·첫 화면은 정상). 빌드 로그 경고 "Both `outputFileTracingRoot` and `turbopack.root` are set, but they must have the same value" — `fileURLToPath(new URL('.', …))` 는 끝에 '/' 가 붙어 달랐음. → `next.config.mjs` 에서 둘 다 `path.dirname(fileURLToPath(import.meta.url))` 로 같게, `sanitize-html` 은 `serverExternalPackages` 에서 빼서 번들(2.18 이 ESM 전용 htmlparser2 를 require), `package.json engines.node = 24.x`(이 PC 와 같게). 로컬 `next start` 는 node_modules 가 다 있어서 이런 추적 문제가 안 드러남 — 배포 문제는 빌드 로그 경고부터 볼 것.
- `next.config.mjs` 의 루트 값을 바꾼 뒤 dev 서버가 `Cannot find module 'mongodb'` 로 죽음(11-18) — 옛 `.next/dev` 캐시 때문. dev 끄고 `rm -rf .next/dev` 뒤 다시 켜면 됨. 이때 Turbopack 이 한글 주석이 든 오류 코드 조각을 찍다 panic 해서 프로세스째 죽으니 로그 맨 위 오류부터 볼 것. `next build` 를 dev 와 같이 돌리다 dev 가 꺼진 적도 있음 → 빌드 시험 뒤 7200 이 살아 있는지 확인.
- **Vercel 배포가 'Deployment Blocked'(11-18)**: 커밋 작성자 `sijoow` 가 Vercel 팀(yogico-s-projects, Hobby) 멤버가 아니라서 푸시 배포가 막힘(처음 가져오기 배포만 통과). 저장소는 GitHub `yogicoai/designData`(비공개). 해결 = 이 저장소만 `git config user.name/email` 을 yogicoai 계정으로 + 새 커밋 푸시(이메일은 사용자에게 받기), 또는 Pro 로 멤버 추가. 저장소 공개는 비추천(CLAUDE.md 에 PIN).
- Vercel 로그를 `npx vercel logs` 로 보거나 `npx -p node@20` 같은 다른 Node 를 받아 시험하는 건 자동 권한 확인에서 막힘(11-18) → 사용자에게 Vercel 화면의 Logs/빌드 로그를 받아서 봄.
