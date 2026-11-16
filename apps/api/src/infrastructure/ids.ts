import { v7 } from 'uuid';

/** Time-ordered UUID v7 for primary keys (DATABASE.md conventions). */
export const newId = (): string => v7();
