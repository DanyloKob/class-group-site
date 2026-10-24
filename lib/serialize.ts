/**
 * Prisma BigInt fields (telegramUserId, telegramChatId) throw
 * "Do not know how to serialize a BigInt" from JSON.stringify/NextResponse.json.
 * Route handlers must pass their payload through this before returning it.
 */
export function serializeBigInts<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInts(item)) as unknown as T;
  }
  if (value instanceof Date) {
    return value as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeBigInts(val);
    }
    return result as unknown as T;
  }
  return value;
}
