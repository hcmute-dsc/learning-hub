import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contentHash,
  exerciseIndex,
  MAX_MARKDOWN_BYTES,
  parseContent,
  readDirectory,
  splitFrontMatter,
  type ContentIssue,
  type ParseResult,
} from './index';

const EXAMPLE_ROOT = join(__dirname, '..', '..', '..', 'content-example');

const GIT = 'tracks/git-github-basics';
const GIT_MOD = `${GIT}/modules/01-first-steps`;
const SQL = 'tracks/sql-sample';
const SQL_MOD = `${SQL}/modules/01-foundations`;

const WHAT_IS_GIT = `${GIT_MOD}/lessons/what-is-git.md`;
const FIRST_COMMIT = `${GIT_MOD}/lessons/first-commit.md`;
const QUIZ = `${GIT_MOD}/exercises/git-basics-quiz/exercise.yaml`;
const INSTALL_GIT = `${GIT_MOD}/exercises/install-git/exercise.yaml`;
const FIRST_PR = `${GIT_MOD}/exercises/first-pull-request/exercise.yaml`;
const SELECT_WHERE_EX = `${SQL_MOD}/exercises/select-where-basic/exercise.yaml`;

const example = readDirectory(EXAMPLE_ROOT);

/** Fresh mutable copy of the example FileMap. */
function exampleFiles(): Map<string, string> {
  return new Map(example);
}

/** Replace `from` with `to` in one file; fails loudly if `from` is not there. */
function edit(files: Map<string, string>, path: string, from: string | RegExp, to: string): void {
  const text = files.get(path);
  if (text === undefined) throw new Error(`test setup: ${path} is not in the FileMap`);
  const next = text.replace(from, to);
  if (next === text) throw new Error(`test setup: ${String(from)} not found in ${path}`);
  files.set(path, next);
}

/** Copy the example, apply the mutation, parse. */
function parseWith(mutate: (files: Map<string, string>) => void): ParseResult {
  const files = exampleFiles();
  mutate(files);
  return parseContent(files);
}

function expectIssue(result: ParseResult, path: string, fragment: string): ContentIssue {
  const hit = result.issues.find((i) => i.path === path && i.message.includes(fragment));
  if (!hit) {
    throw new Error(
      `expected an issue on ${path} containing "${fragment}", got:\n` +
        result.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n'),
    );
  }
  return hit;
}

const VALID_LESSON = (uid: string, slug: string) =>
  `---\nuid: ${uid}\nslug: ${slug}\ntitle: Extra\n---\n\nBody.\n`;

// ------------------------------------------------------------------ valid tree

describe('parseContent on content-example', () => {
  const result = parseContent(example);
  const [git, sql] = result.tree.tracks;

  it('reads only tracks/ text files', () => {
    expect([...example.keys()].every((p) => p.startsWith('tracks/'))).toBe(true);
    expect(example.has(`${GIT}/track.yaml`)).toBe(true);
  });

  it('has zero issues', () => {
    expect(result.issues).toEqual([]);
  });

  it('has the expected counts', () => {
    const modules = result.tree.tracks.flatMap((t) => t.modules);
    expect(result.tree.tracks).toHaveLength(2);
    expect(modules).toHaveLength(2);
    expect(modules.flatMap((m) => m.lessons)).toHaveLength(3);
    expect(modules.flatMap((m) => m.exercises)).toHaveLength(4);
  });

  it('maps track fields', () => {
    expect(git.slug).toBe('git-github-basics');
    expect(git.position).toBe(5);
    expect(git.estHours).toBe(6);
    expect(git.status).toBe('active');
    expect(git.sourcePath).toBe(`${GIT}/track.yaml`);
    expect(sql.slug).toBe('sql-sample');
    expect(sql.position).toBe(10);
    expect(sql.modules[0].summary).toBeNull();
  });

  it('positions follow list order in track.yaml / module.yaml', () => {
    const mod = git.modules[0];
    expect(mod.position).toBe(1);
    expect(mod.lessons.map((l) => [l.slug, l.position])).toEqual([
      ['what-is-git', 1],
      ['first-commit', 2],
    ]);
    expect(mod.exercises.map((e) => [e.slug, e.position])).toEqual([
      ['git-basics-quiz', 1],
      ['install-git', 2],
      ['first-pull-request', 3],
    ]);
  });

  it('requiresReview defaults to true only for project exercises', () => {
    const all = result.tree.tracks.flatMap((t) => t.modules.flatMap((m) => m.exercises));
    for (const e of all) expect(e.requiresReview).toBe(e.type === 'project');

    const files = exampleFiles();
    edit(files, INSTALL_GIT, 'type: self_check', 'type: project');
    edit(files, INSTALL_GIT, /spec:[\s\S]*$/, 'spec:\n  rubric:\n    - criterion: Works\n');
    const asProject = parseContent(files);
    expect(asProject.issues).toEqual([]);
    const ex = exerciseIndex(asProject.tree).get('git-github-basics/first-steps/install-git')!;
    expect(ex.requiresReview).toBe(true);
    expect(ex.spec).toEqual({
      deliverable: 'github_repo_or_pr',
      rubric: [{ criterion: 'Works', weight: 1 }],
    });

    edit(files, INSTALL_GIT, 'difficulty: easy', 'difficulty: easy\nrequiresReview: false');
    const optedOut = exerciseIndex(parseContent(files).tree).get(
      'git-github-basics/first-steps/install-git',
    )!;
    expect(optedOut.requiresReview).toBe(false);
  });

  it('keeps lessonSlug and prerequisites', () => {
    const idx = exerciseIndex(result.tree);
    const pr = idx.get('git-github-basics/first-steps/first-pull-request')!;
    expect(pr.lessonSlug).toBe('first-commit');
    expect(pr.prerequisites).toEqual(['git-github-basics/first-steps/install-git']);
    expect(idx.get('sql-sample/foundations/select-where-basic')!.lessonSlug).toBe('select-where');

    const firstCommit = git.modules[0].lessons[1];
    expect(firstCommit.prerequisites).toEqual(['git-github-basics/first-steps/what-is-git']);
    expect(firstCommit.estMinutes).toBe(25);
    expect(firstCommit.bodyMd.startsWith('# Commit đầu tiên')).toBe(true);
  });

  it('keeps quiz answers in spec and applies spec defaults', () => {
    const quiz = git.modules[0].exercises[0];
    expect(quiz.type).toBe('quiz');
    expect(quiz.spec.passScore).toBe(0.5);
    expect(quiz.spec.shuffle).toBe(false);
    const questions = quiz.spec.questions as Array<{ id: string; answer: unknown }>;
    expect(questions.map((q) => [q.id, q.answer])).toEqual([
      ['q1', 1],
      ['q2', ['git init']],
    ]);
  });

  it('applies code spec defaults', () => {
    const pr = git.modules[0].exercises[2];
    expect(pr.spec).toMatchObject({
      runtime: { language: 'shell', timeoutSeconds: 60 },
      submit: { kind: 'github_pr', allowedPaths: ['ABOUT.md'] },
    });
  });

  it('exerciseIndex keys every exercise by track/module/slug', () => {
    expect([...exerciseIndex(result.tree).keys()].sort()).toEqual([
      'git-github-basics/first-steps/first-pull-request',
      'git-github-basics/first-steps/git-basics-quiz',
      'git-github-basics/first-steps/install-git',
      'sql-sample/foundations/select-where-basic',
    ]);
  });

  it('parses the same tree with CRLF line endings', () => {
    const crlf = new Map([...example].map(([p, t]) => [p, t.replace(/\r?\n/g, '\r\n')]));
    const r = parseContent(crlf);
    expect(r.issues).toEqual([]);
    expect(r.tree.tracks[0].modules[0].lessons[0].slug).toBe('what-is-git');
  });
});

// ------------------------------------------------------------------ hashes

describe('contentHash', () => {
  it('is stable across key order (nested too)', () => {
    const a = { x: 1, y: { p: [1, 2], q: 'z' }, z: null };
    const b = { z: null, y: { q: 'z', p: [1, 2] }, x: 1 };
    expect(contentHash(a)).toBe(contentHash(b));
    expect(contentHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a field or array order changes', () => {
    const base = contentHash({ x: 1, y: { p: [1, 2] } });
    expect(contentHash({ x: 2, y: { p: [1, 2] } })).not.toBe(base);
    expect(contentHash({ x: 1, y: { p: [2, 1] } })).not.toBe(base);
    expect(contentHash({ x: 1, y: { p: [1, 2] }, extra: true })).not.toBe(base);
  });

  it('re-parsing the same files yields identical hashes', () => {
    const hashes = (r: ParseResult) =>
      r.tree.tracks.flatMap((t) => [
        t.hash,
        ...t.modules.flatMap((m) => [
          m.hash,
          ...m.lessons.map((l) => l.hash),
          ...m.exercises.map((e) => e.hash),
        ]),
      ]);
    const first = hashes(parseContent(exampleFiles()));
    expect(first.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
    expect(new Set(first).size).toBe(first.length);
    expect(hashes(parseContent(exampleFiles()))).toEqual(first);
  });

  it('changes only the edited item hash', () => {
    const before = parseContent(example).tree.tracks[0].modules[0];
    const after = parseWith((f) =>
      edit(f, FIRST_COMMIT, 'title: Commit đầu tiên', 'title: Commit thứ nhất'),
    ).tree.tracks[0].modules[0];
    expect(after.lessons[1].hash).not.toBe(before.lessons[1].hash);
    expect(after.lessons[0].hash).toBe(before.lessons[0].hash);
    expect(after.hash).toBe(before.hash);
  });
});

// ------------------------------------------------------------------ splitFrontMatter

describe('splitFrontMatter', () => {
  it('handles LF', () => {
    expect(splitFrontMatter('---\nuid: x\nslug: y\n---\n# Body\n')).toEqual({
      data: 'uid: x\nslug: y',
      body: '# Body\n',
    });
  });

  it('handles CRLF', () => {
    const { data, body } = splitFrontMatter('---\r\nuid: x\r\nslug: y\r\n---\r\n# Body\r\n');
    expect(data).toBe('uid: x\r\nslug: y');
    expect(body).toBe('# Body\r\n');
  });

  it('returns null data when there is no front matter', () => {
    expect(splitFrontMatter('# Just a body\n')).toEqual({ data: null, body: '# Just a body\n' });
  });
});

// ------------------------------------------------------------------ error cases

describe('parseContent error cases', () => {
  it('reports invalid YAML', () => {
    const r = parseWith((f) => f.set(`${SQL}/track.yaml`, 'uid: [unclosed\nslug: x\n'));
    expectIssue(r, `${SQL}/track.yaml`, 'invalid YAML');
  });

  it('reports invalid lesson front matter YAML', () => {
    const r = parseWith((f) =>
      edit(f, WHAT_IS_GIT, 'title: Git là gì và vì sao cần nó', 'title: [oops'),
    );
    expectIssue(r, WHAT_IS_GIT, 'invalid front matter');
  });

  it('reports a missing required field', () => {
    const r = parseWith((f) => edit(f, `${SQL}/track.yaml`, 'license: CC-BY-SA-4.0\n', ''));
    expectIssue(r, `${SQL}/track.yaml`, 'license: Required');
  });

  it('reports a non-UUID uid', () => {
    const r = parseWith((f) => edit(f, `${SQL_MOD}/module.yaml`, /^uid: .*$/m, 'uid: not-a-uuid'));
    expectIssue(r, `${SQL_MOD}/module.yaml`, 'uid: uid must be a UUID');
  });

  it('reports a non-kebab slug', () => {
    const r = parseWith((f) => edit(f, INSTALL_GIT, 'slug: install-git', 'slug: Install_Git'));
    expectIssue(r, INSTALL_GIT, 'slug: slug must be kebab-case');
  });

  it('reports an unknown top-level key (file schemas are strict)', () => {
    const r = parseWith((f) =>
      edit(f, `${SQL}/track.yaml`, 'position: 10', 'position: 10\ncolour: blue'),
    );
    expectIssue(r, `${SQL}/track.yaml`, "Unrecognized key(s) in object: 'colour'");
  });

  it('reports a duplicate uid across two files', () => {
    const r = parseWith((f) =>
      edit(f, `${SQL_MOD}/module.yaml`, /^uid: .*$/m, 'uid: 0193a000-0000-7000-8000-000000000011'),
    );
    expectIssue(
      r,
      `${SQL_MOD}/module.yaml`,
      `uid 0193a000-0000-7000-8000-000000000011 is already used by ${GIT_MOD}/module.yaml`,
    );
  });

  it('reports a duplicate track slug', () => {
    const r = parseWith((f) =>
      edit(f, `${SQL}/track.yaml`, 'slug: sql-sample', 'slug: git-github-basics'),
    );
    expectIssue(
      r,
      `${SQL}/track.yaml`,
      `track slug "git-github-basics" is already used by ${GIT}/track.yaml`,
    );
  });

  it('reports a duplicate lesson slug in a module', () => {
    const r = parseWith((f) => edit(f, FIRST_COMMIT, 'slug: first-commit', 'slug: what-is-git'));
    expectIssue(r, FIRST_COMMIT, 'lesson slug "what-is-git" is already used by');
  });

  it('reports a listed lesson whose file is missing', () => {
    const r = parseWith((f) => f.delete(WHAT_IS_GIT));
    expectIssue(r, `${GIT_MOD}/module.yaml`, `lists a lesson, but ${WHAT_IS_GIT} is missing`);
  });

  it('reports a listed exercise whose file is missing', () => {
    const r = parseWith((f) => f.delete(INSTALL_GIT));
    expectIssue(r, `${GIT_MOD}/module.yaml`, `lists an exercise, but ${INSTALL_GIT} is missing`);
  });

  it('reports a listed module whose module.yaml is missing', () => {
    const r = parseWith((f) => {
      for (const p of [...f.keys()]) if (p.startsWith(`${SQL_MOD}/`)) f.delete(p);
    });
    expectIssue(r, `${SQL_MOD}/module.yaml`, 'file is missing');
  });

  it('reports an orphan lesson file', () => {
    const path = `${GIT_MOD}/lessons/extra.md`;
    const r = parseWith((f) =>
      f.set(path, VALID_LESSON('0193a000-0000-7000-8000-000000000999', 'extra')),
    );
    expectIssue(r, path, 'orphan file');
  });

  it('reports an orphan exercise', () => {
    const path = `${GIT_MOD}/exercises/extra/exercise.yaml`;
    const r = parseWith((f) => {
      f.set(path, f.get(INSTALL_GIT)!);
      f.set(`${GIT_MOD}/exercises/extra/statement.md`, 'Extra.\n');
    });
    expectIssue(r, path, 'orphan file');
  });

  it('reports module.yaml under a track dir without track.yaml', () => {
    const path = 'tracks/ghost/modules/01-intro/module.yaml';
    const r = parseWith((f) => f.set(path, f.get(`${SQL_MOD}/module.yaml`)!));
    expectIssue(r, path, 'tracks/ghost/track.yaml is missing');
  });

  it('reports an exercise lesson that is not in its module', () => {
    const r = parseWith((f) =>
      edit(f, SELECT_WHERE_EX, 'lesson: select-where', 'lesson: what-is-git'),
    );
    expectIssue(r, SELECT_WHERE_EX, 'lesson "what-is-git" is not in this module');
  });

  it('reports a lesson prerequisite that does not exist', () => {
    const r = parseWith((f) =>
      edit(
        f,
        FIRST_COMMIT,
        'git-github-basics/first-steps/what-is-git',
        'git-github-basics/first-steps/nope',
      ),
    );
    expectIssue(
      r,
      FIRST_COMMIT,
      'prerequisite "git-github-basics/first-steps/nope" does not exist',
    );
  });

  it('accepts a lesson prerequisite pointing to an exercise', () => {
    const r = parseWith((f) =>
      edit(
        f,
        FIRST_COMMIT,
        'git-github-basics/first-steps/what-is-git',
        'git-github-basics/first-steps/install-git',
      ),
    );
    expect(r.issues).toEqual([]);
  });

  it('reports an exercise prerequisite pointing to a lesson', () => {
    const r = parseWith((f) =>
      edit(
        f,
        FIRST_PR,
        'git-github-basics/first-steps/install-git',
        'git-github-basics/first-steps/what-is-git',
      ),
    );
    expectIssue(
      r,
      FIRST_PR,
      'prerequisite "git-github-basics/first-steps/what-is-git" is not an exercise',
    );
  });

  it('reports a prerequisite cycle between two exercises', () => {
    const r = parseWith((f) =>
      edit(
        f,
        INSTALL_GIT,
        'lesson: what-is-git',
        'lesson: what-is-git\nprerequisites:\n  - git-github-basics/first-steps/first-pull-request',
      ),
    );
    const issue = expectIssue(r, INSTALL_GIT, 'prerequisite cycle');
    expect(issue.message).toContain('git-github-basics/first-steps/install-git');
    expect(issue.message).toContain('git-github-basics/first-steps/first-pull-request');
    expect(r.issues.filter((i) => i.message.includes('cycle'))).toHaveLength(1);
  });

  it('reports a quiz single answer index out of range', () => {
    const r = parseWith((f) => edit(f, QUIZ, 'answer: 1', 'answer: 3'));
    expectIssue(r, QUIZ, 'spec.questions.0.answer: answer index is out of range');
  });

  it('reports a quiz multiple answer index out of range', () => {
    const r = parseWith((f) =>
      edit(f, QUIZ, /type: single([\s\S]*?)answer: 1/, 'type: multiple$1answer: [0, 7]'),
    );
    expectIssue(r, QUIZ, 'spec.questions.0.answer: an answer index is out of range');
  });

  it('reports duplicate quiz question ids', () => {
    const r = parseWith((f) => edit(f, QUIZ, 'id: q2', 'id: q1'));
    expectIssue(r, QUIZ, 'spec.questions.1.id: duplicate question id "q1"');
  });

  it('reports an unknown spec field (spec schemas are strict)', () => {
    const r = parseWith((f) => edit(f, QUIZ, 'passScore: 0.5', 'passScore: 0.5\n  bogus: true'));
    expectIssue(r, QUIZ, "spec.Unrecognized key(s) in object: 'bogus'");
  });

  it('reports a spec that does not match the exercise type', () => {
    const r = parseWith((f) => edit(f, INSTALL_GIT, 'type: self_check', 'type: quiz'));
    expectIssue(r, INSTALL_GIT, 'spec.');
  });

  it('reports a code exercise missing spec.checker', () => {
    const r = parseWith((f) => edit(f, FIRST_PR, /  checker:\n(    .*\n)+/, ''));
    expectIssue(r, FIRST_PR, 'spec.checker: Required');
  });

  it('reports a missing statement.md', () => {
    const statement = `${GIT_MOD}/exercises/install-git/statement.md`;
    const r = parseWith((f) => f.delete(statement));
    expectIssue(r, INSTALL_GIT, `${statement} is missing`);
  });

  it('rejects <script> in lesson prose', () => {
    const r = parseWith((f) =>
      f.set(WHAT_IS_GIT, f.get(WHAT_IS_GIT)! + '\n<script>alert(1)</script>\n'),
    );
    expectIssue(r, WHAT_IS_GIT, 'raw HTML/script is not allowed');
  });

  it('rejects <script> in an exercise statement', () => {
    const statement = `${SQL_MOD}/exercises/select-where-basic/statement.md`;
    const r = parseWith((f) =>
      f.set(statement, f.get(statement)! + '\n<SCRIPT src="x.js"></SCRIPT>\n'),
    );
    expectIssue(r, statement, 'raw HTML/script is not allowed');
  });

  it('rejects inline event handlers and javascript: links in prose', () => {
    const r = parseWith((f) =>
      f.set(
        WHAT_IS_GIT,
        f.get(WHAT_IS_GIT)! + '\n<img src="x" onerror="alert(1)">\n[x](javascript:alert(1))\n',
      ),
    );
    const html = r.issues.filter(
      (i) => i.path === WHAT_IS_GIT && i.message.includes('raw HTML/script'),
    );
    expect(html).toHaveLength(2);
  });

  it('allows <script> inside a fenced block or inline code', () => {
    const r = parseWith((f) =>
      f.set(
        WHAT_IS_GIT,
        f.get(WHAT_IS_GIT)! +
          '\n```html\n<script>console.log("hi")</script>\n<button onclick="go()">Go</button>\n```\n\nUse `<script src="app.js">` to load a file.\n',
      ),
    );
    expect(r.issues).toEqual([]);
    expect(r.tree.tracks[0].modules[0].lessons[0].bodyMd).toContain(
      '<script>console.log("hi")</script>',
    );
  });

  it('rejects markdown larger than MAX_MARKDOWN_BYTES', () => {
    const r = parseWith((f) =>
      f.set(WHAT_IS_GIT, f.get(WHAT_IS_GIT)! + 'a'.repeat(MAX_MARKDOWN_BYTES + 1)),
    );
    expectIssue(r, WHAT_IS_GIT, `markdown is larger than ${MAX_MARKDOWN_BYTES / 1024} KB`);
  });

  it('rejects a lesson without front matter', () => {
    const r = parseWith((f) => f.set(WHAT_IS_GIT, '# Git là gì?\n\nNo front matter here.\n'));
    expectIssue(r, WHAT_IS_GIT, 'missing front matter');
  });

  it('requires a track starterRepo for code exercises, and keeps it on the track', () => {
    const ok = parseWith(() => {});
    expect(ok.tree.tracks.find((t) => t.slug === 'git-github-basics')!.starterRepo).toBe(
      'hcmute-dsc/git-github-exercises',
    );
    const r = parseWith((f) => edit(f, `${GIT}/track.yaml`, /^starterRepo: .*$/m, ''));
    expectIssue(r, FIRST_PR, 'code exercises need `starterRepo`');
  });

  it('reports only the broken module.yaml, not every file below it as an orphan', () => {
    const r = parseWith((f) => edit(f, `${GIT_MOD}/module.yaml`, /^uid: .*$/m, 'uid: not-a-uuid'));
    expectIssue(r, `${GIT_MOD}/module.yaml`, 'uid must be a UUID');
    expect(r.issues.filter((i) => i.message.includes('orphan'))).toEqual([]);
  });

  it('allows <script> inside ~~~ fences and ``double-backtick`` code', () => {
    const r = parseWith((f) =>
      f.set(
        WHAT_IS_GIT,
        f.get(WHAT_IS_GIT)! +
          '\n~~~html\n<script>alert(1)</script>\n~~~\n\nUse ``<script src="x">`` tags.\n',
      ),
    );
    expect(r.issues).toEqual([]);
  });

  it('does not also call a listed-but-invalid lesson or exercise an orphan', () => {
    const r = parseWith((f) => {
      f.set(WHAT_IS_GIT, '# no front matter\n');
      edit(f, INSTALL_GIT, 'slug: install-git', 'slug: Bad_Slug');
      f.delete(`${GIT_MOD}/exercises/git-basics-quiz/statement.md`);
    });
    expectIssue(r, WHAT_IS_GIT, 'missing front matter');
    expectIssue(r, INSTALL_GIT, 'kebab-case');
    expectIssue(r, QUIZ, 'statement.md is missing');
    expect(r.issues.filter((i) => i.message.includes('orphan'))).toEqual([]);
  });

  it('reports every problem in one run', () => {
    const r = parseWith((f) => {
      f.set(`${SQL}/track.yaml`, 'uid: [unclosed\n');
      edit(f, QUIZ, 'answer: 1', 'answer: 9');
      f.delete(`${GIT_MOD}/exercises/install-git/statement.md`);
    });
    expectIssue(r, `${SQL}/track.yaml`, 'invalid YAML');
    expectIssue(r, QUIZ, 'out of range');
    expectIssue(r, INSTALL_GIT, 'statement.md is missing');
  });
});

// ------------------------------------------------------------------ hints and solutions (§3.7, §3.8)

describe('hints', () => {
  const HINTS = `${SQL_MOD}/exercises/select-where-basic/hints`;
  const selectWhere = (result: ParseResult) =>
    exerciseIndex(result.tree).get('sql-sample/foundations/select-where-basic')!;

  it('reads hints/NN.md in order, with an optional cost', () => {
    const result = parseContent(example);
    expect(result.issues).toEqual([]);
    const hints = selectWhere(result).hints;
    expect(hints.map((h) => [h.position, h.cost])).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(hints[1].bodyMd).toContain('WHERE');
    expect(hints[1].bodyMd).not.toContain('cost:');
  });

  it('gives exercises without hints an empty list', () => {
    const result = parseContent(example);
    expect(
      exerciseIndex(result.tree).get('git-github-basics/first-steps/install-git')!.hints,
    ).toEqual([]);
  });

  it('rejects a gap in the numbering', () => {
    const result = parseWith((files) => {
      files.set(`${HINTS}/04.md`, 'Too far.');
    });
    expectIssue(result, `${HINTS}/04.md`, 'without gaps (expected 03.md)');
  });

  it('rejects a badly named file, an empty hint and an unknown front matter field', () => {
    const result = parseWith((files) => {
      files.set(`${HINTS}/third.md`, 'Name.');
      files.set(`${HINTS}/03.md`, '---\ncost: 1\n---\n\n');
      files.set(`${HINTS}/04.md`, '---\npoints: 3\n---\nText.');
    });
    expectIssue(result, `${HINTS}/third.md`, 'NN.md');
    expectIssue(result, `${HINTS}/03.md`, 'hint is empty');
    expectIssue(result, `${HINTS}/04.md`, 'points');
  });

  it('applies the markdown rules to hints', () => {
    const result = parseWith((files) => files.set(`${HINTS}/03.md`, '<script>alert(1)</script>'));
    expectIssue(result, `${HINTS}/03.md`, 'raw HTML/script');
  });

  it('changes the exercise hash when a hint changes', () => {
    const before = selectWhere(parseContent(example)).hash;
    const after = selectWhere(
      parseWith((files) => edit(files, `${HINTS}/01.md`, 'customers', 'orders')),
    ).hash;
    expect(after).not.toBe(before);
  });
});

describe('solutions', () => {
  const SOLUTION = 'exercises/sql-sample/select-where-basic/solution.md';
  const selectWhere = (result: ParseResult) =>
    exerciseIndex(result.tree).get('sql-sample/foundations/select-where-basic')!;

  it('rejects a solution in the public content repo', () => {
    const path = `${SQL_MOD}/exercises/select-where-basic/solution.md`;
    const result = parseWith((files) => files.set(path, 'SELECT 1;'));
    expectIssue(result, path, 'private checker repo');
  });

  it('is null without the checker files, as in the content repo CLI', () => {
    expect(selectWhere(parseContent(example)).solutionMd).toBeNull();
  });

  it('attaches exercises/<track>/<exercise>/solution.md from the checker repo', () => {
    const solutions = new Map([
      [SOLUTION, '\nSELECT full_name FROM customers;\n'],
      ['exercises/sql-sample/retired-exercise/solution.md', 'ignored'],
      ['exercises/sql-sample/select-where-basic/tests/expected.md', 'ignored'],
    ]);
    const result = parseContent(example, { solutions });
    expect(result.issues).toEqual([]);
    expect(selectWhere(result).solutionMd).toBe('SELECT full_name FROM customers;');
    expect(selectWhere(result).hash).not.toBe(selectWhere(parseContent(example)).hash);
  });

  it('applies the markdown rules to solutions', () => {
    const result = parseContent(example, {
      solutions: new Map([[SOLUTION, '<iframe src="x"></iframe>']]),
    });
    expectIssue(result, SOLUTION, 'raw HTML/script');
  });

  it('keeps the hash of an exercise without hints or solution unchanged', () => {
    // Exercises written before hints existed must not all show up as "updated".
    const quiz = exerciseIndex(parseContent(example).tree).get(
      'git-github-basics/first-steps/git-basics-quiz',
    )!;
    const { hash, hints: _h, solutionMd: _s, mentorNotesMd: _n, ...rest } = quiz;
    expect(hash).toBe(contentHash(rest));
  });
});

// ------------------------------------------------------------------ mentor notes (§3.10)

describe('mentor notes', () => {
  const NOTES = `${GIT_MOD}/exercises/first-pull-request/mentor-notes.md`;
  const firstPr = (result: ParseResult) =>
    exerciseIndex(result.tree).get('git-github-basics/first-steps/first-pull-request')!;

  it('reads mentor-notes.md, trimmed', () => {
    const result = parseContent(example);
    expect(result.issues).toEqual([]);
    const notes = firstPr(result).mentorNotesMd;
    expect(notes).toMatch(/^## Khi review/);
    expect(notes).toBe(notes!.trim());
  });

  it('is null for exercises without the file', () => {
    const result = parseContent(example);
    expect(
      exerciseIndex(result.tree).get('git-github-basics/first-steps/install-git')!.mentorNotesMd,
    ).toBeNull();
  });

  it('rejects an empty file and front matter', () => {
    expectIssue(
      parseWith((files) => files.set(NOTES, '  \n')),
      NOTES,
      'mentor-notes.md is empty',
    );
    expectIssue(
      parseWith((files) => files.set(NOTES, '---\naudience: mentor\n---\nText.')),
      NOTES,
      'no front matter',
    );
  });

  it('applies the markdown rules to mentor notes', () => {
    const result = parseWith((files) => files.set(NOTES, '<script>alert(1)</script>'));
    expectIssue(result, NOTES, 'raw HTML/script');
  });

  it('changes the exercise hash when the notes change', () => {
    const before = firstPr(parseContent(example)).hash;
    const after = firstPr(parseWith((files) => edit(files, NOTES, 'ABOUT.md', 'INFO.md'))).hash;
    expect(after).not.toBe(before);
  });

  it('keeps the hash of an exercise without notes as it was before notes existed', () => {
    const without = parseWith((files) => files.delete(NOTES));
    const exercise = firstPr(without);
    const { hash, mentorNotesMd: _n, hints: _h, solutionMd: _s, ...rest } = exercise;
    expect(hash).toBe(contentHash(rest));
  });
});
