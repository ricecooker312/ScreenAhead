import { z } from 'zod';

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;

export function pageMeta(p: Pagination, total: number) {
  return { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) };
}
