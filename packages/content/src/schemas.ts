import { z } from 'zod';

/**
 * File schemas for learning-hub-content (learning-hub-docs CONTENT-SPECIFICATION §3).
 * `uid` must be a UUID: it becomes the database primary key, so it never changes.
 */

const uid = z.string().uuid({ message: 'uid must be a UUID (generate once, never change it)' });
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case (a-z, 0-9, -)')
  .max(80);
const githubHandle = z.string().regex(/^github:[A-Za-z0-9-]+$/, 'use the form github:<login>');
/** Logical reference to another item: <track-slug>/<module-slug>/<item-slug> */
const itemRef = z
  .string()
  .regex(/^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/, 'use <track>/<module>/<slug>');
const name = z
  .string()
  .regex(/^[A-Za-z0-9._-]+$/, 'file/folder name may use letters, digits, . _ -');

export const trackFileSchema = z
  .object({
    uid,
    slug,
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(500),
    language: z.enum(['vi', 'en']),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    estimatedHours: z.number().int().positive().max(1000).optional(),
    tags: z.array(slug).max(15).default([]),
    prerequisites: z.array(slug).default([]),
    outcomes: z.array(z.string().min(1)).min(1),
    maintainers: z.array(githubHandle).min(1, 'a track needs at least one maintainer'),
    license: z.string().min(1),
    /** One starter repo per track (decided 16/11/2026): members create ONE repo from it
     * in their own account and solve every `code` exercise in its own folder. */
    starterRepo: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/, 'use <owner>/<repo>')
      .optional(),
    source: z.object({ repo: z.string(), commit: z.string().optional() }).optional(),
    position: z.number().int().default(0),
    status: z.enum(['active', 'archived']).default('active'),
    modules: z.array(name).min(1),
  })
  .strict();
export type TrackFile = z.infer<typeof trackFileSchema>;

export const moduleFileSchema = z
  .object({
    uid,
    slug,
    title: z.string().min(1).max(120),
    summary: z.string().max(500).optional(),
    lessons: z.array(name).default([]),
    exercises: z.array(name).default([]),
  })
  .strict();
export type ModuleFile = z.infer<typeof moduleFileSchema>;

export const lessonFrontMatterSchema = z
  .object({
    uid,
    slug,
    title: z.string().min(1).max(160),
    estimatedMinutes: z.number().int().positive().max(600).optional(),
    objectives: z.array(z.string().min(1)).default([]),
    prerequisites: z.array(itemRef).default([]),
    authors: z.array(githubHandle).default([]),
    license: z.string().optional(),
    /** Words this lesson introduces, from the track's glossary.yaml (§3.1c, learning-hub#106) */
    terms: z.array(z.string().min(1).max(60)).max(30).default([]),
  })
  .strict();
export type LessonFrontMatter = z.infer<typeof lessonFrontMatterSchema>;

/**
 * One entry of the optional `tracks/<slug>/glossary.yaml` (CONTENT-SPECIFICATION §3.1c,
 * learning-hub#106). TEACHING.md T1: every new English word shows its full form and its
 * literal Vietnamese meaning, so learners know what `init` stands for, not only what it does.
 */
export const glossaryEntrySchema = z
  .object({
    /** The word as learners meet it, in English: `init`, `pull request` */
    term: z
      .string()
      .min(1)
      .max(60)
      .regex(/^\S(.*\S)?$/, 'term has spaces at the start or end')
      .regex(/[\p{L}\p{N}]/u, 'term needs at least one letter or digit'),
    /** The full form when `term` is short for something: init → initialize */
    expansion: z.string().min(1).max(120).optional(),
    /** Literal Vietnamese meaning of the word: initialize → khởi tạo */
    literal: z.string().min(1).max(120).optional(),
    /** What it means here, in a sentence or two */
    meaning: z.string().min(1).max(500),
    /** A command or short line that uses it: git init */
    example: z.string().min(1).max(200).optional(),
    /** Related terms in the same glossary */
    see: z.array(z.string().min(1).max(60)).max(10).default([]),
  })
  .strict();
export type GlossaryEntryFile = z.infer<typeof glossaryEntrySchema>;

export const glossaryFileSchema = z
  .array(glossaryEntrySchema)
  .min(1, 'glossary is empty; delete the file or add a term')
  .max(500);

/**
 * Optional front matter of `hints/NN.md` (CONTENT-SPECIFICATION §3.7). `cost` is soft: the
 * number of attempts a member needs before this hint can be opened. It never lowers a score.
 */
export const hintFrontMatterSchema = z
  .object({ cost: z.number().int().min(0).max(100).default(0) })
  .strict();
export type HintFrontMatter = z.infer<typeof hintFrontMatterSchema>;

// ---- exercise spec, one shape per type ----

const quizQuestion = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('single'),
    prompt: z.string().min(1),
    options: z.array(z.string()).min(2),
    answer: z.number().int().min(0),
    explanation: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('multiple'),
    prompt: z.string().min(1),
    options: z.array(z.string()).min(2),
    answer: z.array(z.number().int().min(0)).min(1),
    explanation: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('short_text'),
    prompt: z.string().min(1),
    answer: z.array(z.string().min(1)).min(1),
    explanation: z.string().optional(),
  }),
]);

export const quizSpecSchema = z
  .object({
    shuffle: z.boolean().default(false),
    passScore: z.number().min(0).max(1).default(0.7),
    questions: z.array(quizQuestion).min(1),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const ids = new Set<string>();
    spec.questions.forEach((q, i) => {
      if (ids.has(q.id))
        ctx.addIssue({
          code: 'custom',
          path: ['questions', i, 'id'],
          message: `duplicate question id "${q.id}"`,
        });
      ids.add(q.id);
      if (q.type === 'single' && q.answer >= q.options.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', i, 'answer'],
          message: 'answer index is out of range',
        });
      }
      if (q.type === 'multiple' && q.answer.some((a) => a >= q.options.length)) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', i, 'answer'],
          message: 'an answer index is out of range',
        });
      }
    });
  });

export const codeSpecSchema = z
  .object({
    /** Folder of this exercise inside the track's `starterRepo` */
    starterPath: z
      .string()
      .regex(/^[\w.-]+(\/[\w.-]+)*$/, 'a folder path like first-pull-request or week-1/hello'),
    checker: z.object({ workflow: z.string().min(1), tests: z.string().min(1) }).strict(),
    runtime: z
      .object({
        language: z.string().min(1),
        timeoutSeconds: z.number().int().positive().max(600).default(120),
      })
      .strict(),
    submit: z
      .object({
        kind: z.enum(['github_pr', 'github_commit']).default('github_pr'),
        allowedPaths: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({}),
  })
  .strict();

export const selfCheckSpecSchema = z
  .object({ checklist: z.array(z.string().min(1)).min(1) })
  .strict();

export const projectSpecSchema = z
  .object({
    deliverable: z.enum(['github_repo_or_pr', 'link']).default('github_repo_or_pr'),
    rubric: z
      .array(
        z
          .object({
            criterion: z.string().min(1),
            // Points or relative weight, e.g. a 100-point rubric (SQL final project)
            weight: z.number().int().min(1).max(100).default(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const SPEC_SCHEMAS = {
  code: codeSpecSchema,
  quiz: quizSpecSchema,
  self_check: selfCheckSpecSchema,
  project: projectSpecSchema,
} as const;

export const exerciseFileSchema = z
  .object({
    uid,
    slug,
    title: z.string().min(1).max(160),
    type: z.enum(['code', 'quiz', 'self_check', 'project']),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    lesson: slug.optional(),
    estimatedMinutes: z.number().int().positive().max(600).optional(),
    requiresReview: z.boolean().optional(),
    prerequisites: z.array(itemRef).default([]),
    tags: z.array(slug).default([]),
    authors: z.array(githubHandle).default([]),
    license: z.string().optional(),
    spec: z.unknown(),
  })
  .strict();
export type ExerciseFile = z.infer<typeof exerciseFileSchema>;
