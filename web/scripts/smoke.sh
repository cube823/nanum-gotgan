#!/usr/bin/env bash
# MVP.md §6 한 바퀴 스모크. dev 서버(:3000)가 떠 있어야 한다.
#   bash scripts/smoke.sh
# 계정 3개(운영자·기관A·기관B)로 등록→스와이프→채팅→예약→완료→내리기 + 막혀야 하는 경로.
set -euo pipefail
BASE=${BASE:-http://localhost:3000}
J=$(mktemp -d)
HERE=$(cd "$(dirname "$0")" && pwd)
# 끝나면 이번 실행이 만든 계정·기관·물품을 지운다 (db/cleanup-test-data.sql). 안 지우면 돌릴 때마다 쌓인다.
# 로컬 DB일 때만. 남겨서 보고 싶으면 SMOKE_KEEP=1.
cleanup() {
  rm -rf "$J"
  [ -z "${SUF:-}" ] && return                      # 계정을 만들기 전에 끝났다
  [ -n "${SMOKE_KEEP:-}" ] && { echo "(SMOKE_KEEP — 테스트 데이터 남김, 접미사 $SUF)"; return; }
  case "${URL:-}" in /uploads/*) rm -f "$HERE/../public$URL";; esac   # 올린 사진 파일 (Blob URL이면 그대로 둔다)
  local db; db=$(grep '^DATABASE_URL=' "$HERE/../.env.local" 2>/dev/null | cut -d= -f2-)
  case "$db" in
    *localhost*|*127.0.0.1*) psql "$db" -q -v re="^[a-z]${SUF}@dev\\.local\$" -f "$HERE/../../db/cleanup-test-data.sql" >/dev/null \
                               && echo "(테스트 데이터 정리함)" || echo "(테스트 데이터 정리 실패 — db/cleanup-test-data.sql)";;
    *) echo "(DATABASE_URL이 로컬이 아니라 정리 안 함)";;
  esac
}
trap cleanup EXIT
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
expect() { # expect <label> <want> <got>
  if [ "$2" = "$3" ]; then ok "$1"; else fail "$1 (want $2, got $3)"; fi
}

# ─── helpers ───────────────────────────────────────────────────────────────
login() { # login <jar> <email> <nickname>
  local jar=$1 csrf
  csrf=$(curl -s -c "$jar" -b "$jar" "$BASE/api/auth/csrf" | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
  curl -s -o /dev/null -c "$jar" -b "$jar" -X POST "$BASE/api/auth/callback/dev" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "email=$2" --data-urlencode "nickname=$3"
}
api() { # api <jar> <method> <path> [json]  → prints "STATUS\nBODY"
  local jar=$1 m=$2 p=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -b "$jar" -X "$m" "$BASE$p" -H 'content-type: application/json' --data "$body" -w '\n%{http_code}'
  else
    curl -s -b "$jar" -X "$m" "$BASE$p" -w '\n%{http_code}'
  fi
}
status() { tail -n1; }
body()   { sed '$d'; }
jget()   { python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
has()    { python3 -c "import sys,json; print(any(i['id']=='$1' for i in json.load(sys.stdin)))"; }
count()  { python3 -c "import sys,json; print(len(json.load(sys.stdin)))"; }
first()  { python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')"; }
dist()   { python3 -c "import sys,json; print(next((i.get('distanceKm') for i in json.load(sys.stdin) if i['id']=='$1'), 'missing'))"; }
marked() { python3 -c "import sys,json; print(next((i.get('bookmarked') for i in json.load(sys.stdin) if i['id']=='$1'), None))"; }

# 없는 자원 = 404 화면. loading.tsx가 있는 라우트는 스트리밍이 먼저 시작돼 HTTP 상태가 200으로 나가고
# 본문에 Next의 404 화면 + noindex가 온다 (next/dist/docs … loading.md "Status Codes"). 둘 다 404로 본다.
nf() { # nf <jar> <path>  → "404" 또는 실제 상태
  local out code; out=$(curl -s -b "$1" -w '\n%{http_code}' "$BASE$2"); code=$(echo "$out" | tail -n1)
  if [ "$code" = 404 ] || { [ "$code" = 200 ] && echo "$out" | grep -q 'name="robots" content="noindex"' && echo "$out" | grep -q 'could not be found'; }; then echo 404; else echo "$code"; fi
}
A=$J/a B=$J/b ADM=$J/adm
SUF=$RANDOM

echo "1. 로그인 (dev provider)"
login "$ADM" "admin@dev.local" "운영자"
login "$A" "a$SUF@dev.local" "기관A 담당자"
login "$B" "b$SUF@dev.local" "기관B 담당자"
expect "admin is_admin" "True" "$(api "$ADM" GET /api/me | body | jget isAdmin)"
expect "A org_id null" "None" "$(api "$A" GET /api/me | body | jget orgId)"

echo "1b. 개인정보 — 기획 정의서 STEP 1 (실명·휴대폰)"
expect "이름 1자 400"  "400" "$(api "$A" PUT /api/me/profile '{"realName":"김","phone":"01012345678"}' | status)"
expect "유선번호 400"  "400" "$(api "$A" PUT /api/me/profile '{"realName":"기관A 담당","phone":"021234567"}' | status)"
expect "정상 200"      "200" "$(api "$A" PUT /api/me/profile '{"realName":"기관A 담당","phone":"010-1234-5678"}' | status)"
expect "하이픈 정규화" "01012345678" "$(api "$A" GET /api/me | body | jget phone)"
api "$B" PUT /api/me/profile '{"realName":"기관B 담당","phone":"01098765432"}' >/dev/null

echo "2. 소속 — 기관 생성/합류 (바로 verified, decisions/0008)"
# 사업자등록번호는 국세청 체크디지트를 통과해야 한다 (lib/bizno.ts).
# 아래 번호는 체크디지트만 맞춘 테스트값이다 — 실존 사업자와 무관하다.
# JSON은 변수에 담아 넘긴다 — $( ) 안에 인라인으로 쓰면 \" 가 한 번 더 해석돼 body가 깨진다.
NO_BIZ="{\"name\":\"번호없는센터$SUF\",\"orgType\":\"위탁\",\"address\":\"서울특별시 중구 세종대로 110\"}"
BAD_BIZ="{\"name\":\"틀린번호센터$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"1234567890\",\"address\":\"서울특별시 중구 세종대로 110\"}"
ZERO_BIZ="{\"name\":\"영번호센터$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"0000000000\",\"address\":\"서울특별시 중구 세종대로 110\"}"
ORG_A="{\"name\":\"테스트 청년센터 A$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"3098100129\",\"address\":\"서울특별시 중구 세종대로 110\"}"
ORG_B="{\"name\":\"테스트 청년센터 B$SUF\",\"orgType\":\"모름\",\"bizNo\":\"309-81-00342\",\"address\":\"서울특별시 종로구 사직로 161\"}"
NO_ADDR="{\"name\":\"주소없는센터$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"3098100129\"}"
BAD_ADDR="{\"name\":\"주소틀린센터$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"3098100129\",\"address\":\"없는나라 없는길 99999\"}"
expect "주소 없이 400"  "400" "$(api "$A" POST /api/orgs "$NO_ADDR" | status)"
expect "못 찾는 주소 400" "400" "$(api "$A" POST /api/orgs "$BAD_ADDR" | status)"
expect "번호 없이 400"  "400" "$(api "$A" POST /api/orgs "$NO_BIZ" | status)"
expect "체크디지트 400" "400" "$(api "$A" POST /api/orgs "$BAD_BIZ" | status)"
expect "0반복 400"      "400" "$(api "$A" POST /api/orgs "$ZERO_BIZ" | status)"
BIZ_BAD='{"bizNo":"1234567890"}'; BIZ_OK='{"bizNo":"309-81-00129"}'
expect "인증하기 틀린번호 400" "400" "$(api "$A" POST /api/orgs/bizno "$BIZ_BAD" | status)"
expect "인증하기 맞는번호 200" "200" "$(api "$A" POST /api/orgs/bizno "$BIZ_OK" | status)"
api "$A" POST /api/orgs "$ORG_A" >/dev/null
api "$B" POST /api/orgs "$ORG_B" >/dev/null
expect "A 바로 verified" "verified" "$(api "$A" GET /api/me | body | jget orgStatus)"
expect "A manager"  "manager" "$(api "$A" GET /api/me | body | jget orgRole)"
expect "소속 확정 후 재지정 400" "400" "$(api "$A" POST /api/orgs "$ORG_B" | status)"
# 중복 검사는 아직 소속이 없는 계정이라야 거기까지 간다 (위는 "이미 확정" 에서 먼저 걸린다)
D=$J/d; login "$D" "d$SUF@dev.local" "중복 시도자"
DUP="{\"name\":\"테스트청년센터A$SUF\",\"orgType\":\"직영\",\"bizNo\":\"309-81-00342\",\"address\":\"서울특별시 중구 세종대로 110\"}"
expect "중복 기관명 409" "409" "$(api "$D" POST /api/orgs "$DUP" | status)"
# 기존 기관 합류 경로도 바로 verified여야 한다 — 신규 생성만 보면 이 분기를 놓친다
AORG=$(api "$A" GET /api/me | body | python3 -c "import sys,json; print(json.load(sys.stdin)['org']['id'])")
JOIN_NOBIZ="{\"orgId\":\"$AORG\"}"
JOIN_WRONG="{\"orgId\":\"$AORG\",\"bizNo\":\"309-81-00342\"}"
JOIN="{\"orgId\":\"$AORG\",\"bizNo\":\"309-81-00129\"}"
expect "합류 번호 없이 400"     "400" "$(api "$D" POST /api/orgs "$JOIN_NOBIZ" | status)"
expect "합류 번호 불일치 400"   "400" "$(api "$D" POST /api/orgs "$JOIN_WRONG" | status)"
BIZ_MATCH="{\"orgId\":\"$AORG\",\"bizNo\":\"3098100129\"}"
expect "인증하기 기관 대조 matched" "True" "$(api "$D" POST /api/orgs/bizno "$BIZ_MATCH" | body | jget matched)"
expect "기존 기관 합류 200"   "200"      "$(api "$D" POST /api/orgs "$JOIN" | status)"
expect "합류도 바로 verified" "verified" "$(api "$D" GET /api/me | body | jget orgStatus)"
expect "합류는 member"        "member"   "$(api "$D" GET /api/me | body | jget orgRole)"

echo "2b. 관심 자원 — 기획 정의서 STEP 3 (4개 이상, 🔴 제외)"
FOUR='{"categories":["stationery","packaging","craft","disposable"]}'
expect "3개는 400"        "400" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","packaging","craft"]}' | status)"
expect "🔴 섞이면 400"    "400" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","packaging","craft","electronics"]}' | status)"
expect "없는 코드 400"    "400" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","packaging","craft","nope"]}' | status)"
expect "4개 저장 200"     "200" "$(api "$A" PUT /api/me/interests "$FOUR" | status)"
expect "4개 저장"         "4"   "$(api "$A" GET /api/me/interests | body | count)"
expect "중복은 접힘"      "200" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","stationery","packaging","craft","disposable"]}' | status)"
expect "여전히 4개"       "4"   "$(api "$A" GET /api/me/interests | body | count)"
# packaging을 넣어 둔다 — 4번에서 A가 등록하는 물품이 이 카테고리다. 로컬 DB에 테스트
# 물품이 쌓이면 20칸 피드에서 밀려나므로, 관심에 넣어 앞쪽에 오게 한다.
api "$B" PUT /api/me/interests '{"categories":["packaging","interior","printed","banner"]}' >/dev/null
expect "B도 4개"          "4"   "$(api "$B" GET /api/me/interests | body | count)"
expect "비로그인 401"     "401" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/me/interests" -H 'content-type: application/json' --data "$FOUR")"

echo "3. 승인 화면 — 가입은 바로 verified다. 화면은 반려용으로 남아 있다 (decisions/0008)"
expect "member는 승인 권한 없음 403" "403" "$(api "$D" GET /api/admin/approvals | status)"
expect "verified manager는 우리 기관 승인 화면 200" "200" "$(api "$B" GET /api/admin/approvals | status)"
expect "운영자는 전체 200" "200" "$(api "$ADM" GET /api/admin/approvals | status)"
# JWT 갱신 — 브라우저는 session.update()로 하지만 curl은 재로그인 (jwt 콜백이 DB를 다시 읽는다)
login "$A" "a$SUF@dev.local" "기관A 담당자"
login "$B" "b$SUF@dev.local" "기관B 담당자"
expect "재로그인 후 JWT에 org 반영 → /swipe 200" "200" "$(curl -s -o /dev/null -b "$A" -w '%{http_code}' "$BASE/swipe")"

echo "4. 등록 — 사진 업로드 → 물품"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > "$J/p.png"
URL=$(curl -s -b "$A" -F "file=@$J/p.png;type=image/png" "$BASE/api/uploads" | jget url)
expect "업로드 url" "/uploads/" "$(echo "$URL" | cut -c1-9)"
ITEM_JSON="{\"category\":\"packaging\",\"name\":\"크라프트 종이봉투\",\"quantity\":20,\"quantityUnit\":\"장\",\"isUsed\":false,\"condition\":\"상\",\"description\":\"행사 후 남았어요\",\"photos\":[\"$URL\"]}"
R=$(api "$A" POST /api/items "$ITEM_JSON"); expect "등록 201" "201" "$(echo "$R" | status)"
ITEM=$(echo "$R" | body | jget id)
RED_NO="{\"category\":\"electronics\",\"name\":\"선풍기\",\"quantity\":1,\"condition\":\"중\",\"isUsed\":true,\"photos\":[\"$URL\"]}"
RED_OK="{\"category\":\"electronics\",\"name\":\"선풍기\",\"quantity\":1,\"condition\":\"중\",\"isUsed\":true,\"approvalConfirmed\":true,\"onLedger\":true,\"fundingSource\":\"자체예산\",\"photos\":[\"$URL\"]}"
BAD_COND="{\"category\":\"packaging\",\"name\":\"x\",\"quantity\":1,\"condition\":\"새것\",\"isUsed\":false,\"photos\":[\"$URL\"]}"
expect "표시 라벨을 그대로 보내면 400" "400" "$(api "$A" POST /api/items "$BAD_COND" | status)"
EMPTY_PHOTO="{\"category\":\"packaging\",\"name\":\"x\",\"quantity\":1,\"condition\":\"상\",\"isUsed\":false,\"photos\":[\"\"]}"
EXT_PHOTO="{\"category\":\"packaging\",\"name\":\"x\",\"quantity\":1,\"condition\":\"상\",\"isUsed\":false,\"photos\":[\"https://evil.example/x.jpg\"]}"
expect "물품 빈 사진 주소 400"   "400" "$(api "$A" POST /api/items "$EMPTY_PHOTO" | status)"
expect "물품 외부 사진 주소 400" "400" "$(api "$A" POST /api/items "$EXT_PHOTO" | status)"
expect "🔴 전기류 승인 없이 400" "400" "$(api "$A" POST /api/items "$RED_NO" | status)"
expect "🔴 전기류 승인 있으면 201" "201" "$(api "$A" POST /api/items "$RED_OK" | status)"

echo "5. 스와이프·목록 — B에게 보이고 A에겐 안 보임"
expect "B 피드에 있음" "True"  "$(api "$B" GET /api/items | body | has $ITEM)"
expect "A 피드엔 없음 (같은 기관)" "False" "$(api "$A" GET /api/items | body | has $ITEM)"
SW="{\"itemId\":\"$ITEM\"}"
api "$B" POST /api/swipes "$SW" >/dev/null
# 본 물품은 빠지지 않고 뒤로 간다 — 안 본 것 먼저, 본 것은 seen=True (2026-09-27)
expect "넘긴 뒤에도 피드에 남음" "True" "$(api "$B" GET /api/items | body | has $ITEM)"
expect "넘긴 물품은 seen" "True" "$(api "$B" GET /api/items | body | python3 -c "import sys,json; print(next(i['seen'] for i in json.load(sys.stdin) if i['id']=='$ITEM'))")"
expect "안 본 물품이 앞 (1번은 넘긴 물품이 아님)" "False" "$(api "$B" GET /api/items | body | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id']=='$ITEM')")"
expect "다시 넘겨도 200" "200" "$(api "$B" POST /api/swipes "$SW" | status)"
expect "목록엔 여전히 있음" "True" "$(api "$B" GET "/api/items?mode=list" | body | has $ITEM)"
expect "카테고리 필터" "True" "$(api "$B" GET "/api/items?mode=list&category=packaging" | body | has $ITEM)"

echo "5b. 추천 정렬 — B의 관심 자원이 최신순보다 앞에"
# B의 관심은 event/interior/printed/banner. interior를 먼저, 관심 밖 stationery를 나중에 등록한다.
# 최신순만이라면 나중에 등록한 stationery가 1번이어야 한다 — 관심이 이기면 정렬이 도는 것이다.
OLD_INT="{\"category\":\"interior\",\"name\":\"액자 세트\",\"history\":\"작년 청년주간 행사 때 쓴 액자\",\"quantity\":3,\"condition\":\"중\",\"isUsed\":true,\"photos\":[\"$URL\"]}"
NEW_OFF="{\"category\":\"stationery\",\"name\":\"네임펜 한 박스\",\"quantity\":50,\"condition\":\"상\",\"isUsed\":false,\"photos\":[\"$URL\"]}"
INT_ID=$(api "$A" POST /api/items "$OLD_INT" | body | jget id)
OFF_ID=$(api "$A" POST /api/items "$NEW_OFF" | body | jget id)
expect "물품 히스토리 저장" "작년 청년주간 행사 때 쓴 액자" "$(api "$B" GET "/api/items/$INT_ID" | body | jget history)"
LONG_HIST="{\"category\":\"interior\",\"name\":\"긴 히스토리\",\"history\":\"$(printf '가%.0s' $(seq 201))\",\"quantity\":1,\"condition\":\"중\",\"isUsed\":true,\"photos\":[\"$URL\"]}"
expect "히스토리 200자 초과 400" "400" "$(api "$A" POST /api/items "$LONG_HIST" | status)"

expect "관심(interior)이 1번" "$INT_ID" "$(api "$B" GET /api/items | body | first)"
# A는 관심을 stationery 포함으로 골랐지만 둘 다 자기 기관 것이라 안 보인다 — 정렬이 소속 규칙을 뚫지 않는다.
expect "A 피드엔 자기 것 없음" "False" "$(api "$A" GET /api/items | body | has $OFF_ID)"

echo "5b-2. 거래 희망 장소 — 주소 찾기, 저장, 거리 기준 (기획 정의서 82-26)"
# 도로명 주소를 몰라도 장소 이름으로 찾는다 — "강동 청년센터" 같은 검색어로 후보를 받고, 고른 후보의 좌표를 쓴다
first_ll() { python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d[0]['lat']} {d[0]['lng']}\" if d else '')"; }
expect "장소 검색 결과 있음" "True" "$(api "$A" GET "/api/places?q=%ED%95%A9%EC%A0%95%EC%97%AD" | body | python3 -c 'import sys,json; print(len(json.load(sys.stdin))>0)')"
expect "한 글자는 빈 목록"   "0"    "$(api "$A" GET "/api/places?q=a" | body | count)"
read GLAT GLNG <<< "$(api "$A" GET "/api/places?q=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C%20%EA%B0%95%EB%8F%99%EA%B5%AC%20%EC%98%AC%EB%A6%BC%ED%94%BD%EB%A1%9C%20610" | body | first_ll)"
expect "핀 → 주소"           "True" "$(api "$A" GET "/api/places/reverse?lat=$GLAT&lng=$GLNG" | body | python3 -c 'import sys,json; print("강동구" in (json.load(sys.stdin)["address"] or ""))')"
expect "한국 밖 핀 400"      "400"  "$(api "$A" GET "/api/places/reverse?lat=0&lng=0" | status)"
PICK="{\"category\":\"packaging\",\"name\":\"장소 지정 박스\",\"quantity\":1,\"condition\":\"중\",\"isUsed\":true,\"photos\":[\"$URL\"],\"pickupPlace\":\"강동 창고\",\"pickupAddress\":\"서울 강동구 올림픽로 610\",\"pickupLat\":$GLAT,\"pickupLng\":$GLNG}"
PICK_ID=$(api "$A" POST /api/items "$PICK" | body | jget id)
expect "거래 장소 저장" "강동 창고" "$(api "$B" GET "/api/items/$PICK_ID" | body | jget pickupPlace)"
# A 기관(세종대로)·B 기관(사직로)은 1~2km. 거래 장소가 강동이면 10km를 넘어야 한다 — 거리가 장소 기준이라는 뜻
expect "거리는 거래 장소 기준" "True" "$(api "$B" GET /api/items | body | dist $PICK_ID | python3 -c 'import sys; v=sys.stdin.read().strip(); print(v not in ("None","missing") and float(v) > 10)')"
BADPICK="{\"category\":\"packaging\",\"name\":\"좌표 틀림\",\"quantity\":1,\"condition\":\"중\",\"isUsed\":true,\"photos\":[\"$URL\"],\"pickupLat\":0,\"pickupLng\":0}"
expect "한국 밖 좌표 400" "400" "$(api "$A" POST /api/items "$BADPICK" | status)"

echo "5c. 북마크 — 하트 켜기/끄기, 프로필 > 북마크"
expect "처음엔 꺼짐"        "False" "$(api "$B" GET /api/items | body | marked $INT_ID)"
expect "켜기 200"           "200"   "$(api "$B" PUT "/api/items/$INT_ID/bookmark" | status)"
expect "두 번 켜도 200"     "200"   "$(api "$B" PUT "/api/items/$INT_ID/bookmark" | status)"
expect "피드에 켜짐"        "True"  "$(api "$B" GET /api/items | body | marked $INT_ID)"
expect "끄기 200"           "200"   "$(api "$B" DELETE "/api/items/$INT_ID/bookmark" | status)"
expect "피드에 꺼짐"        "False" "$(api "$B" GET /api/items | body | marked $INT_ID)"
expect "없는 물품 404"      "404"   "$(api "$B" PUT "/api/items/00000000-0000-0000-0000-000000000000/bookmark" | status)"
api "$B" PUT "/api/items/$INT_ID/bookmark" >/dev/null   # 아래 /me?tab=bookmarks 화면에 한 건 남긴다

echo "5d. 거리 — 시드 기관 좌표로 직선거리 (db/orgs.sql)"
# 강동 ↔ 마포 = 18.7km (psql 하버사인으로 확인한 값).
orgid() { python3 -c "import sys,json; print(next(o['id'] for o in json.load(sys.stdin) if o['name']=='$1'))"; }
E=$J/e F=$J/f
login "$E" "e$SUF@dev.local" "강동 담당"; login "$F" "f$SUF@dev.local" "마포 담당"
GD=$(api "$E" GET "/api/orgs/search?q=%EA%B0%95%EB%8F%99" | body | orgid "서울청년센터 강동")
MP=$(api "$F" GET "/api/orgs/search?q=%EB%A7%88%ED%8F%AC" | body | orgid "서울청년센터 마포")
JOIN_GD="{\"orgId\":\"$GD\",\"bizNo\":\"3098100129\"}"; JOIN_MP="{\"orgId\":\"$MP\",\"bizNo\":\"3098100129\"}"
api "$E" POST /api/orgs "$JOIN_GD" >/dev/null; api "$F" POST /api/orgs "$JOIN_MP" >/dev/null
GD_ITEM_BODY="{\"category\":\"packaging\",\"name\":\"거리 확인용 박스\",\"quantity\":1,\"condition\":\"중\",\"isUsed\":true,\"photos\":[\"$URL\"]}"
GD_ITEM=$(api "$E" POST /api/items "$GD_ITEM_BODY" | body | jget id)
expect "마포에서 본 강동 물품 18.7km" "18.7" "$(api "$F" GET /api/items | body | dist $GD_ITEM)"
# B는 직접 등록한 기관이지만 가입 때 주소를 받아 좌표가 있다 — 거리가 나와야 한다 (종로 사직로 ↔ 강동)
expect "직접 등록 기관도 거리 나옴" "True" "$(api "$B" GET /api/items | body | dist $GD_ITEM | python3 -c 'import sys; v=sys.stdin.read().strip(); print(v not in ("None","missing") and float(v) > 0)')"

echo "6. 채팅 시작"
expect "A 자기 기관 물품 신청 400" "400" "$(api "$A" POST /api/transfers "$SW" | status)"
T=$(api "$B" POST /api/transfers "$SW" | body | jget id)
T2=$(api "$B" POST /api/transfers "$SW" | body | jget id)
expect "재신청해도 같은 방" "$T" "$T2"
expect "B 메시지 201" "201" "$(api "$B" POST "/api/transfers/$T/messages" '{"body":"안녕하세요, 봉투 필요해요"}' | status)"
expect "A 탭바 안 읽음 1" "1" "$(api "$A" GET /api/me/unread | body | jget count)"
expect "A 메시지 201" "201" "$(api "$A" POST "/api/transfers/$T/messages" '{"body":"네, 내일 오세요"}' | status)"
expect "A가 이력 2건" "2" "$(api "$A" GET "/api/transfers/$T/messages" | body | count)"
expect "A가 방을 열면 안 읽음 0" "0" "$(api "$A" GET /api/me/unread | body | jget count)"
expect "B는 A의 답장 1건 안 읽음" "1" "$(api "$B" GET /api/me/unread | body | jget count)"
expect "제3자 열람 403" "403" "$(api "$ADM" GET "/api/transfers/$T/messages" | status)"
# 메시지 목록 탭 — 서버 렌더 HTML에서 확인. 이름은 채팅방과 같게 실명(realName).
see() { curl -s -b "$1" "$BASE$2" | grep -q "$3" && echo yes || echo no; }
expect "A 등록한 물품 탭에 B 실명"     "yes" "$(see "$A" "/messages?tab=mine" "기관B 담당")"
expect "A 신청한 물품 탭은 빈 상태"     "yes" "$(see "$A" "/messages?tab=requested" "신청한 물품이 없어요")"
expect "B 신청한 물품 탭에 물품"        "yes" "$(see "$B" "/messages?tab=requested" "크라프트 종이봉투")"
expect "B 등록한 물품 탭은 빈 상태"     "yes" "$(see "$B" "/messages?tab=mine" "등록한 물품이 없어요")"
expect "A 목록 상태 알약 채팅 중"       "yes" "$(see "$A" "/messages" "채팅 중")"

echo "7. 예약 → 완료 (DB-SCHEMA §3 검산표)"
expect "B가 예약 시도 403" "403" "$(api "$B" PATCH "/api/transfers/$T" '{"action":"schedule"}' | status)"
expect "requested→completed 직행 400" "400" "$(api "$A" PATCH "/api/transfers/$T" '{"action":"complete"}' | status)"
expect "schedule 200" "200" "$(api "$A" PATCH "/api/transfers/$T" '{"action":"schedule"}' | status)"
expect "items reserved" "reserved" "$(api "$B" GET "/api/items/$ITEM" | body | jget status)"
expect "unschedule 200" "200" "$(api "$A" PATCH "/api/transfers/$T" '{"action":"unschedule"}' | status)"
expect "items open 복귀" "open" "$(api "$B" GET "/api/items/$ITEM" | body | jget status)"
api "$A" PATCH "/api/transfers/$T" '{"action":"schedule"}' >/dev/null
expect "complete 200" "200" "$(api "$A" PATCH "/api/transfers/$T" '{"action":"complete"}' | status)"
expect "items completed" "completed" "$(api "$B" GET "/api/items/$ITEM" | body | jget status)"
expect "완료된 물품 신청 400" "400" "$(api "$B" POST /api/transfers "$SW" | status)"
expect "완료 후 목록에서 사라짐" "False" "$(api "$B" GET "/api/items?mode=list" | body | has $ITEM)"

echo "7b. 동시 예약 경합 — 둘 중 하나만 성공해야 한다 (FOR UPDATE)"
R=$(api "$A" POST /api/items "$ITEM_JSON"); ITEM3=$(echo "$R" | body | jget id)
SW3="{\"itemId\":\"$ITEM3\"}"
login "$ADM" "admin@dev.local" "운영자"   # 운영자에게도 소속을 줘서 신청자 C 역할
C=$J/c; login "$C" "c$SUF@dev.local" "기관C 담당자"
ORG_C="{\"name\":\"테스트 청년센터 C$SUF\",\"orgType\":\"직영\",\"bizNo\":\"3098100565\",\"address\":\"서울특별시 용산구 한강대로 366\"}"
api "$C" POST /api/orgs "$ORG_C" >/dev/null
cuid=$(api "$C" GET /api/me | body | jget id); APPROVE_C="{\"userId\":\"$cuid\",\"action\":\"approve\"}"
api "$ADM" PATCH /api/admin/approvals "$APPROVE_C" >/dev/null
login "$C" "c$SUF@dev.local" "기관C 담당자"
TB=$(api "$B" POST /api/transfers "$SW3" | body | jget id)
TC=$(api "$C" POST /api/transfers "$SW3" | body | jget id)
( api "$A" PATCH "/api/transfers/$TB" '{"action":"schedule"}' | status > "$J/r1" ) &
( api "$A" PATCH "/api/transfers/$TC" '{"action":"schedule"}' | status > "$J/r2" ) &
wait
WINS=$( { cat "$J/r1"; echo; cat "$J/r2"; echo; } | grep -c '^200$' || true)
expect "동시 schedule 2건 중 성공은 정확히 1" "1" "$WINS"
expect "물품은 reserved" "reserved" "$(api "$B" GET "/api/items/$ITEM3" | body | jget status)"

echo "8. 내리기"
R=$(api "$A" POST /api/items "$ITEM_JSON"); ITEM2=$(echo "$R" | body | jget id)
SW2="{\"itemId\":\"$ITEM2\"}"
T3=$(api "$B" POST /api/transfers "$SW2" | body | jget id)
expect "B가 내리기 403" "403" "$(api "$B" PATCH "/api/items/$ITEM2" '{"action":"withdraw"}' | status)"
expect "A 내리기 200" "200" "$(api "$A" PATCH "/api/items/$ITEM2" '{"action":"withdraw"}' | status)"
expect "내린 물품은 API로도 404" "404" "$(api "$A" GET "/api/items/$ITEM2" | status)"
expect "내린 물품은 내 등록 목록에서도 빠짐" "False" "$(api "$A" GET "/api/items?mode=list" | body | has $ITEM2)"
expect "종료된 방 이력 조회는 200" "200" "$(api "$B" GET "/api/transfers/$T3/messages" | status)"
expect "종료된 방에 새 메시지는 400" "400" "$(api "$B" POST "/api/transfers/$T3/messages" '{"body":"아직 되나요"}' | status)"
expect "완료된 방에 새 메시지도 400" "400" "$(api "$B" POST "/api/transfers/$T/messages" '{"body":"감사합니다"}' | status)"
expect "완료된 물품 내리기 400" "400" "$(api "$A" PATCH "/api/items/$ITEM" '{"action":"withdraw"}' | status)"

echo "9. 페이지 렌더 (200)"
BID=$(api "$B" GET /api/me | body | jget id)
for p in /swipe /items "/items/$ITEM" /new /messages "/messages/$T" /me /me/bookmarks /me/requested /me/received /me/org-received /me/org-registered /me/org-given /me/members /me/edit "/users/$BID"; do
  expect "GET $p" "200" "$(curl -s -o /dev/null -b "$A" -w '%{http_code}' "$BASE$p")"
done
expect "GET /admin/approvals (운영자)" "200" "$(curl -s -o /dev/null -b "$ADM" -w '%{http_code}' "$BASE/admin/approvals")"
expect "GET /admin/approvals (B, manager verified) 200" "200" "$(curl -s -o /dev/null -b "$B" -w '%{http_code}' "$BASE/admin/approvals")"
expect "없는 내 정보 목록 404" "404" "$(nf "$A" /me/nope)"

echo "9b. 내 정보 목록 — 사람 기준 / 기관 기준 (기획 정의서 106-294~296)"
expect "B 수령한 물품에 완료 물품"       "yes" "$(see "$B" /me/received "크라프트 종이봉투")"
expect "B 기관 수령 물품에도"            "yes" "$(see "$B" /me/org-received "크라프트 종이봉투")"
expect "A 나눔 완료 물품에"              "yes" "$(see "$A" /me/org-given "크라프트 종이봉투")"
expect "A 수령한 물품은 비어 있음"       "yes" "$(see "$A" /me/received "받은 물품이 없어요")"
expect "A 구성원에 본인"                 "yes" "$(see "$A" /me/members "기관A 담당")"

echo "9c. 프로필 수정 (기획 정의서 106-293) — 이름·사진"
NEWNAME='{"realName":"기관A 새이름"}'
BADIMG='{"realName":"기관A 새이름","profileImage":"https://evil.example/x.png"}'
expect "이름 1자 400"          "400" "$(api "$A" PATCH /api/me/profile '{"realName":"김"}' | status)"
expect "외부 사진 주소 400"    "400" "$(api "$A" PATCH /api/me/profile "$BADIMG" | status)"
expect "이름 바꾸기 200"       "200" "$(api "$A" PATCH /api/me/profile "$NEWNAME" | status)"
expect "바뀐 이름"             "기관A 새이름" "$(api "$A" GET /api/me | body | jget realName)"
expect "전화번호는 그대로"     "01012345678" "$(api "$A" GET /api/me | body | jget phone)"
expect "내 정보에 바뀐 이름"   "yes" "$(see "$A" /me "기관A 새이름")"

expect "없는 사용자 프로필 404" "404" "$(nf "$A" /users/00000000-0000-0000-0000-000000000000)"
expect "uuid 아닌 프로필 404"   "404" "$(nf "$A" /users/abc)"
expect "GET / 미로그인 → /login" "307" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"
expect "GET /logo.png 미로그인 200 (정적 파일은 게이트 밖)" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/logo.png")"
expect "PWA manifest 미로그인 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/manifest.webmanifest")"
expect "PWA manifest standalone" "standalone" "$(curl -s "$BASE/manifest.webmanifest" | jget display)"

echo
echo "통과 $PASS · 실패 $FAIL"
[ "$FAIL" -eq 0 ]
