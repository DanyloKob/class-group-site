/**
 * "Nearest on top" sort, shared by News (eventAt) and Tasks (dueDate).
 * Three buckets computed against the current instant, not stored: upcoming
 * (soonest first), undated (newest-created first), then past (most recently
 * past first, sinking to the bottom as an in-feed archive).
 */
export function sortByNearestDate<T>(
  items: T[],
  getDate: (item: T) => Date | null,
  getCreatedAt: (item: T) => Date,
  now: Date = new Date(),
): T[] {
  function bucketOf(item: T): 0 | 1 | 2 {
    const date = getDate(item);
    if (date === null) return 1;
    return date >= now ? 0 : 2;
  }

  return [...items].sort((a, b) => {
    const bucketA = bucketOf(a);
    const bucketB = bucketOf(b);
    if (bucketA !== bucketB) return bucketA - bucketB;

    if (bucketA === 0) {
      return getDate(a)!.getTime() - getDate(b)!.getTime();
    }
    if (bucketA === 1) {
      return getCreatedAt(b).getTime() - getCreatedAt(a).getTime();
    }
    return getDate(b)!.getTime() - getDate(a)!.getTime();
  });
}
