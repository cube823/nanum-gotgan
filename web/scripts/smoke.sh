#!/usr/bin/env bash
# MVP.md §6 한 바퀴 스모크. dev 서버(:3000)가 떠 있어야 한다.
#   bash scripts/smoke.sh
# 계정 3개(운영자·기관A·기관B)로 등록→스와이프→채팅→예약→완료→내리기 + 막혀야 하는 경로.
set -euo pipefail
BASE=${BASE:-http://localhost:3000}
J=$(mktemp -d); trap 'rm -rf "$J"' EXIT
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

echo "2. 소속 — 새 기관 생성 (manager) + pending"
# 사업자등록번호는 국세청 체크디지트를 통과해야 한다 (lib/bizno.ts).
# 아래 번호는 체크디지트만 맞춘 테스트값이다 — 실존 사업자와 무관하다.
# JSON은 변수에 담아 넘긴다 — $( ) 안에 인라인으로 쓰면 \" 가 한 번 더 해석돼 body가 깨진다.
NO_BIZ="{\"name\":\"번호없는센터$SUF\",\"orgType\":\"위탁\"}"
BAD_BIZ="{\"name\":\"틀린번호센터$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"1234567890\"}"
ZERO_BIZ="{\"name\":\"영번호센터$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"0000000000\"}"
ORG_A="{\"name\":\"테스트 청년센터 A$SUF\",\"orgType\":\"위탁\",\"bizNo\":\"3098100129\"}"
ORG_B="{\"name\":\"테스트 청년센터 B$SUF\",\"orgType\":\"모름\",\"bizNo\":\"309-81-00342\"}"
expect "번호 없이 400"  "400" "$(api "$A" POST /api/orgs "$NO_BIZ" | status)"
expect "체크디지트 400" "400" "$(api "$A" POST /api/orgs "$BAD_BIZ" | status)"
expect "0반복 400"      "400" "$(api "$A" POST /api/orgs "$ZERO_BIZ" | status)"
api "$A" POST /api/orgs "$ORG_A" >/dev/null
api "$B" POST /api/orgs "$ORG_B" >/dev/null
expect "A pending"  "pending" "$(api "$A" GET /api/me | body | jget orgStatus)"
expect "A manager"  "manager" "$(api "$A" GET /api/me | body | jget orgRole)"
DUP="{\"name\":\"테스트청년센터A$SUF\",\"orgType\":\"직영\",\"bizNo\":\"309-81-00342\"}"
expect "중복 기관명 409" "409" "$(api "$B" POST /api/orgs "$DUP" | status)"
expect "pending은 등록 403" "403" "$(api "$A" POST /api/items '{}' | status)"

echo "2b. 관심 자원 — 기획 정의서 STEP 3 (4개 이상, 🔴 제외)"
FOUR='{"categories":["stationery","packaging","craft","disposable"]}'
expect "3개는 400"        "400" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","packaging","craft"]}' | status)"
expect "🔴 섞이면 400"    "400" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","packaging","craft","electronics"]}' | status)"
expect "없는 코드 400"    "400" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","packaging","craft","nope"]}' | status)"
expect "pending도 저장됨" "200" "$(api "$A" PUT /api/me/interests "$FOUR" | status)"
expect "4개 저장"         "4"   "$(api "$A" GET /api/me/interests | body | count)"
expect "중복은 접힘"      "200" "$(api "$A" PUT /api/me/interests '{"categories":["stationery","stationery","packaging","craft","disposable"]}' | status)"
expect "여전히 4개"       "4"   "$(api "$A" GET /api/me/interests | body | count)"
# packaging을 넣어 둔다 — 4번에서 A가 등록하는 물품이 이 카테고리다. 로컬 DB에 테스트
# 물품이 쌓이면 20칸 피드에서 밀려나므로, 관심에 넣어 앞쪽에 오게 한다.
api "$B" PUT /api/me/interests '{"categories":["packaging","interior","printed","banner"]}' >/dev/null
expect "B도 4개"          "4"   "$(api "$B" GET /api/me/interests | body | count)"
expect "비로그인 401"     "401" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/me/interests" -H 'content-type: application/json' --data "$FOUR")"

echo "3. 승인 — 운영자가 둘 다"
expect "pending manager는 승인 권한 없음 403" "403" "$(api "$B" GET /api/admin/approvals | status)"
for jar in "$A" "$B"; do
  uid=$(api "$jar" GET /api/me | body | jget id)
  APPROVE="{\"userId\":\"$uid\",\"action\":\"approve\"}"
  api "$ADM" PATCH /api/admin/approvals "$APPROVE" >/dev/null
done
expect "A verified" "verified" "$(api "$A" GET /api/me | body | jget orgStatus)"
expect "verified manager는 우리 기관 승인 가능 200" "200" "$(api "$B" GET /api/admin/approvals | status)"
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
expect "🔴 전기류 승인 없이 400" "400" "$(api "$A" POST /api/items "$RED_NO" | status)"
expect "🔴 전기류 승인 있으면 201" "201" "$(api "$A" POST /api/items "$RED_OK" | status)"

echo "5. 스와이프·목록 — B에게 보이고 A에겐 안 보임"
expect "B 피드에 있음" "True"  "$(api "$B" GET /api/items | body | has $ITEM)"
expect "A 피드엔 없음 (같은 기관)" "False" "$(api "$A" GET /api/items | body | has $ITEM)"
SW="{\"itemId\":\"$ITEM\"}"
api "$B" POST /api/swipes "$SW" >/dev/null
expect "넘긴 뒤 피드에서 사라짐" "False" "$(api "$B" GET /api/items | body | has $ITEM)"
expect "목록엔 여전히 있음" "True" "$(api "$B" GET "/api/items?mode=list" | body | has $ITEM)"
expect "카테고리 필터" "True" "$(api "$B" GET "/api/items?mode=list&category=packaging" | body | has $ITEM)"

echo "5b. 추천 정렬 — B의 관심 자원이 최신순보다 앞에"
# B의 관심은 event/interior/printed/banner. interior를 먼저, 관심 밖 stationery를 나중에 등록한다.
# 최신순만이라면 나중에 등록한 stationery가 1번이어야 한다 — 관심이 이기면 정렬이 도는 것이다.
OLD_INT="{\"category\":\"interior\",\"name\":\"액자 세트\",\"quantity\":3,\"condition\":\"중\",\"isUsed\":true,\"photos\":[\"$URL\"]}"
NEW_OFF="{\"category\":\"stationery\",\"name\":\"네임펜 한 박스\",\"quantity\":50,\"condition\":\"상\",\"isUsed\":false,\"photos\":[\"$URL\"]}"
INT_ID=$(api "$A" POST /api/items "$OLD_INT" | body | jget id)
OFF_ID=$(api "$A" POST /api/items "$NEW_OFF" | body | jget id)
expect "관심(interior)이 1번" "$INT_ID" "$(api "$B" GET /api/items | body | first)"
# A는 관심을 stationery 포함으로 골랐지만 둘 다 자기 기관 것이라 안 보인다 — 정렬이 소속 규칙을 뚫지 않는다.
expect "A 피드엔 자기 것 없음" "False" "$(api "$A" GET /api/items | body | has $OFF_ID)"

echo "6. 채팅 시작"
expect "A 자기 기관 물품 신청 400" "400" "$(api "$A" POST /api/transfers "$SW" | status)"
T=$(api "$B" POST /api/transfers "$SW" | body | jget id)
T2=$(api "$B" POST /api/transfers "$SW" | body | jget id)
expect "재신청해도 같은 방" "$T" "$T2"
expect "B 메시지 201" "201" "$(api "$B" POST "/api/transfers/$T/messages" '{"body":"안녕하세요, 봉투 필요해요"}' | status)"
expect "A 메시지 201" "201" "$(api "$A" POST "/api/transfers/$T/messages" '{"body":"네, 내일 오세요"}' | status)"
expect "A가 이력 2건" "2" "$(api "$A" GET "/api/transfers/$T/messages" | body | count)"
expect "제3자 열람 403" "403" "$(api "$ADM" GET "/api/transfers/$T/messages" | status)"

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
ORG_C="{\"name\":\"테스트 청년센터 C$SUF\",\"orgType\":\"직영\",\"bizNo\":\"3098100565\"}"
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
for p in /swipe /items "/items/$ITEM" /new /messages "/messages/$T" /me "/me?tab=received"; do
  expect "GET $p" "200" "$(curl -s -o /dev/null -b "$A" -w '%{http_code}' "$BASE$p")"
done
expect "GET /admin/approvals (운영자)" "200" "$(curl -s -o /dev/null -b "$ADM" -w '%{http_code}' "$BASE/admin/approvals")"
expect "GET /admin/approvals (B, manager verified) 200" "200" "$(curl -s -o /dev/null -b "$B" -w '%{http_code}' "$BASE/admin/approvals")"
expect "GET / 미로그인 → /login" "307" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"

echo
echo "통과 $PASS · 실패 $FAIL"
[ "$FAIL" -eq 0 ]
