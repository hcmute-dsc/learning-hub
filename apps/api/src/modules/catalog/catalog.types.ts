/** Contract between the content module (plans changes) and CatalogWriter (applies them). */
export type ItemKind = 'track' | 'module' | 'lesson' | 'exercise';

/** What the catalog currently holds for one item (any status). */
export interface DbItem {
  id: string;
  parentId: string | null;
  slug: string;
  status: string;
  contentHash: string;
  sourcePath: string;
}

export type DbSnapshot = Record<ItemKind, DbItem[]>;

export interface CatalogChanges {
  /** uids to insert or update, per kind */
  upsert: Record<ItemKind, Set<string>>;
  /** ids of currently active rows that are gone from the tree → archive */
  archive: Record<ItemKind, string[]>;
}
