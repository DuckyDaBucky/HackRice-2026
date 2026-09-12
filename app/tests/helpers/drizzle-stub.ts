/** Minimal thenable mimicking Drizzle's chainable query builder so unit tests
 * run without a database. Every builder method returns the stub itself;
 * awaiting it resolves the queued rows. SQL correctness is covered by the
 * live smoke test and column types, not by string-matching generated SQL. */
export function stubQuery(rows: unknown[]) {
  const stub: Record<string, unknown> = {
    then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  for (const method of [
    "select",
    "from",
    "where",
    "limit",
    "insert",
    "values",
    "set",
    "update",
    "delete",
    "onConflictDoNothing",
    "onConflictDoUpdate",
    "returning",
    "orderBy",
    "groupBy",
    "innerJoin",
    "leftJoin",
    "for",
    "on",
  ]) {
    stub[method] = () => stub;
  }
  return stub;
}
