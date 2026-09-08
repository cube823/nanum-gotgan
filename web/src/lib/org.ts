/** 기관명 정규화. DB-SCHEMA §organizations name_norm — 띄어쓰기·기호 차이까지만 잡는다. */
export function normalizeOrgName(name: string): string {
  return name.replace(/[\s()\-_·.,]/g, "").toLowerCase();
}
