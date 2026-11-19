/**
 * @hub/content — parse and validate a learning-hub-content repo.
 *
 * Files:
 *   layout.ts         where each file lives (the only place that knows the folders)
 *   schemas.ts        what each file may contain (Zod)
 *   parse.ts          files → tree, one function per file type
 *   checks.ts         rules that need the whole tree (orphans, duplicates, references, cycles)
 *   markdown.ts       front matter + size/HTML rules for .md files
 *   hash.ts           stable content hash, used to skip unchanged items on publish
 *   read-directory.ts read a local checkout into a FileMap
 *   registry.ts       `tracks.yaml`: which repo and commit each track is published from
 *   cli.ts            `hub-content-validate [dir]`
 */
export * from './types';
export * from './schemas';
export { parseContent } from './parse';
export type { FileMap, ParseOptions } from './parse';
export { exerciseIndex } from './checks';
export { layout, LAYOUT_PATTERNS } from './layout';
export { contentHash } from './hash';
export { MAX_MARKDOWN_BYTES, splitFrontMatter } from './markdown';
export { readDirectory } from './read-directory';
export { parseRegistry, REGISTRY_FILE, trackSlugOf } from './registry';
export type { RegistryEntry, RegistryResult } from './registry';
