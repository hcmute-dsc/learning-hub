import {
  codeSpecSchema,
  projectSpecSchema,
  quizSpecSchema,
  selfCheckSpecSchema,
} from '@hub/content';
import type { z } from 'zod';

/**
 * Typed access to `exercises.spec` (CONTENT-SPECIFICATION). The spec was validated by
 * @hub/content at publish time; parsing again here applies the schema defaults
 * (e.g. `submit.kind = github_pr`) so the rest of the module never guesses them.
 * A spec that no longer parses is a server-side data problem, so it becomes a 500,
 * not a 422 the member could fix.
 */
export type QuizSpec = z.infer<typeof quizSpecSchema>;
export type QuizQuestionSpec = QuizSpec['questions'][number];
export type CodeSpec = z.infer<typeof codeSpecSchema>;
export type ProjectSpec = z.infer<typeof projectSpecSchema>;
export type SelfCheckSpec = z.infer<typeof selfCheckSpecSchema>;

function parseSpec<S extends z.ZodTypeAny>(schema: S, spec: unknown, type: string): z.infer<S> {
  const result = schema.safeParse(spec);
  if (!result.success) throw new Error(`Stored ${type} exercise spec is invalid`);
  return result.data;
}

export const quizSpec = (spec: unknown): QuizSpec => parseSpec(quizSpecSchema, spec, 'quiz');
export const codeSpec = (spec: unknown): CodeSpec => parseSpec(codeSpecSchema, spec, 'code');
export const projectSpec = (spec: unknown): ProjectSpec =>
  parseSpec(projectSpecSchema, spec, 'project');
export const selfCheckSpec = (spec: unknown): SelfCheckSpec =>
  parseSpec(selfCheckSpecSchema, spec, 'self_check');
