export interface ContentIssue {
  /** File path relative to the content repo root */
  path: string;
  message: string;
}

export interface LessonNode {
  uid: string;
  slug: string;
  title: string;
  bodyMd: string;
  estMinutes: number | null;
  objectives: string[];
  /** logical refs: <track>/<module>/<slug> (lesson or exercise) */
  prerequisites: string[];
  position: number;
  sourcePath: string;
  hash: string;
}

export interface ExerciseNode {
  uid: string;
  slug: string;
  title: string;
  type: 'code' | 'quiz' | 'self_check' | 'project';
  difficulty: 'easy' | 'medium' | 'hard';
  lessonSlug: string | null;
  statementMd: string;
  /** validated, type-specific spec (quiz answers live here: never send to members) */
  spec: Record<string, unknown>;
  requiresReview: boolean;
  /** logical refs to exercises: <track>/<module>/<slug> */
  prerequisites: string[];
  tags: string[];
  position: number;
  sourcePath: string;
  hash: string;
}

export interface ModuleNode {
  uid: string;
  slug: string;
  title: string;
  summary: string | null;
  position: number;
  sourcePath: string;
  hash: string;
  lessons: LessonNode[];
  exercises: ExerciseNode[];
}

export interface TrackNode {
  uid: string;
  slug: string;
  title: string;
  summary: string;
  language: 'vi' | 'en';
  level: 'beginner' | 'intermediate' | 'advanced';
  estHours: number | null;
  tags: string[];
  position: number;
  status: 'active' | 'archived';
  outcomes: string[];
  maintainers: string[];
  license: string;
  /** owner/repo of the track's starter template, when it has `code` exercises */
  starterRepo: string | null;
  sourcePath: string;
  hash: string;
  modules: ModuleNode[];
}

export interface ContentTree {
  tracks: TrackNode[];
}

export interface ParseResult {
  /** Parsed items. When `issues` is non-empty the tree may be partial: do not publish it. */
  tree: ContentTree;
  issues: ContentIssue[];
}
