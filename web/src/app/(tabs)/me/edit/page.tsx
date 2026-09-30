import { sql } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { ProfileEditForm } from "./ProfileEditForm";

// 기획 정의서 106-293 프로필 수정 — 사진·이름. 기관명은 수정 불가 (바꾸려면 소속 절차를 다시 밟아야 한다).
export default async function ProfileEditPage() {
  const u = await pageUser();
  const [org] = u.orgId ? await sql`SELECT name FROM organizations WHERE id = ${u.orgId}` : [];
  return <ProfileEditForm name={u.realName ?? u.nickname} image={u.profileImage} orgName={org?.name ?? "소속 없음"} />;
}
