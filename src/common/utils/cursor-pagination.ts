export interface CursorPaginationQuery {
  limit?: number;
  cursor?: string;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
}

export function parseCursor(
  cursor: string | undefined,
): { id: string; createdAt: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [id, createdAt] = decoded.split('::');
    if (!id || !createdAt) return null;
    return { id, createdAt };
  } catch {
    return null;
  }
}

export function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(`${id}::${createdAt.toISOString()}`).toString('base64');
}

export function buildCursorWhere(
  cursor: { id: string; createdAt: string } | null,
  order: 'asc' | 'desc',
): any {
  if (!cursor) return {};

  const dateCondition = order === 'desc' ? 'lt' : 'gt';
  const idCondition = order === 'desc' ? 'lt' : 'gt';

  return {
    OR: [
      { createdAt: { [dateCondition]: new Date(cursor.createdAt) } },
      {
        createdAt: new Date(cursor.createdAt),
        id: { [idCondition]: cursor.id },
      },
    ],
  };
}
