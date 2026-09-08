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

A=$J/a B=$J/b ADM=$J/adm
SUF=$RANDOM

echo "1. 로그인 (dev provider)"
login "$ADM" "admin@dev.local" "운영자"
login "$A" "a$SUF@dev.local" "기관A 담당자"
login "$B" "b$SUF@dev.local" "기관B 담당자"
expect "admin is_admin" "True" "$(api "$ADM" GET /api/me | body | jget isAdmin)"
expect "A org_id null" "None" "$(api "$A" GET /api/me | body | jget orgId)"

echo "2. 소속 — 새 기관 생성 (manager) + pending"
api "$A" POST /api/orgs "{\"name\":\"테스트 청년센터 A$SUF\",\"orgType\":\"위탁\"}" >/dev/null
api "$B" POST /api/orgs "{\"name\":\"테스트 청년센터 B$SUF\",\"orgType\":\"모름\"}" >/dev/null
expect "A pending"  "pending" "$(api "$A" GET /api/me | body | jget orgStatus)"
expect "A manager"  "manager" "$(api "$A" GET /api/me | body | jget orgRole)"
DUP="{\"name\":\"테스트청년센터A$SUF\",\"orgType\":\"직영\"}"
expect "중복 기관명 409" "409" "$(api "$B" POST /api/orgs "$DUP" | status)"
expect "pending은 등록 403" "403" "$(api "$A" POST /api/items '{}' | status)"

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
api "$C" POST /api/orgs "{\"name\":\"테스트 청년센터 C$SUF\",\"orgType\":\"직영\"}" >/dev/null
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
