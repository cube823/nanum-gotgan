import postgres from "postgres";

// 개발 중 HMR로 커넥션이 늘어나는 걸 막는다.
const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

export const sql =
  g.__sql ??
  (g.__sql = postgres(process.env.DATABASE_URL!, {
    max: 10,
    transform: postgres.camel, // snake_case 컬럼 → camelCase
  }));
