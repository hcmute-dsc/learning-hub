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

/** One `hints/NN.md` file: opened one by one by members (CONTENT-SPECIFICATION §3.7). */
export interface HintNode {
  /** 1-based, from the file name `NN.md` */
  position: number;
  /** attempts needed before it can be opened (soft, never lowers a score) */
  cost: number;
  bodyMd: string;
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
  /** `hints/NN.md`, by position; empty when the exercise has none */
  hints: HintNode[];
  /**
   * Reference solution from the PRIVATE checker repo (§3.8), never from the public content
   * repo. Null when there is none. Members only get it once they complete the exercise.
   */
  solutionMd: string | null;
  /**
   * `mentor-notes.md` (§3.10): what to look at when reviewing, common mistakes. Null when the
   * exercise has none. Only mentors and admins get it from the API; the repo itself is public.
   */
  mentorNotesMd: string | null;
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
