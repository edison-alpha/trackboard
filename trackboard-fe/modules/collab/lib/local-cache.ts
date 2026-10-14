/** Prefix of every IndexedDB that holds the offline copy of a document. */
export const LOCAL_DB_PREFIX = "tb:";

/**
 * Deletes the offline copies of documents. The server is the source of truth; these only make opening instant and
 * let the editor work offline. They are dropped at sign-out so the next person on a shared browser never reads them.
 */
export async function clearLocalCache(): Promise<void> {
  try {
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(
      dbs
        .filter((d) => d.name?.startsWith(LOCAL_DB_PREFIX))
        .map(
          (d) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(d.name!);
              // A connection still open completes the delete once it closes; do not hold sign-out for it.
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }),
        ),
    );
  } catch {
    /* storage unavailable: nothing was cached */
  }
}

/** Removes the offline copy of specific documents (pages deleted for good). */
export async function dropLocalDocs(names: string[]): Promise<void> {
  await Promise.all(
    names.map(
      (name) =>
        new Promise<void>((resolve) => {
          try {
            const req = indexedDB.deleteDatabase(`${LOCAL_DB_PREFIX}${name}`);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          } catch {
            resolve();
          }
        }),
    ),
  );
}
