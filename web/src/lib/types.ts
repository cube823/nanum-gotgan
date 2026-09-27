// DB 행 타입. DB-SCHEMA.md와 1:1. postgres.camel 변환 후 모양.

export type OrgStatus = "pending" | "verified" | "rejected";
export type OrgRole = "member" | "manager";
export type OrgType = "위탁" | "직영" | "모름";
export type ItemStatus = "open" | "reserved" | "completed" | "withdrawn";
export type TransferStatus = "requested" | "scheduled" | "completed" | "cancelled";
export type Risk = "green" | "yellow" | "red";
export type Condition = "상" | "중" | "하";

export type DbUser = {
  id: string;
  orgId: string | null;
  email: string | null;
  nickname: string;
  profileImage: string | null;
  realName: string | null;      // 회원가입 STEP 1. nickname(OAuth)과 다를 수 있다
  phone: string | null;
  orgRole: OrgRole;
  orgStatus: OrgStatus;
  isAdmin: boolean;
};

export type Organization = {
  id: string;
  name: string;
  orgType: OrgType;
  verified: boolean;
};

export type Category = {
  code: string;
  label: string;
  riskLevel: Risk;
  notice: string | null;
  sortOrder: number;
};

export type Item = {
  id: string;
  orgId: string;
  createdBy: string;
  category: string;
  name: string;
  description: string | null;
  quantity: number;
  quantityUnit: string;
  isUsed: boolean;
  condition: Condition;
  onLedger: boolean;
  approvalConfirmed: boolean;
  fundingSource: string | null;
  status: ItemStatus;
  createdAt: Date;
};

export type ItemCard = Item & {
  orgName: string;
  photos: string[];
  categoryLabel: string;
  riskLevel: Risk;
};
