// Guards on .github/workflows/deploy.yml (learning-hub#98): only a push to main of this
// repository that passed CI, or a manual run started on main, may build and deploy.
// The test reads the `if:` of each job and evaluates it for typical events, so the guard
// cannot be dropped or weakened by accident. No YAML library: the workflow keeps each `if:`
// as one line or a `>-` folded block, which jobIf() reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');

/** The `if:` expression of a job under `jobs:`, folded into one line. */
function jobIf(job) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.indexOf(`  ${job}:`);
  assert.ok(start >= 0, `job ${job} not found`);
  for (let i = start + 1; i < lines.length && !/^ {2}\S/.test(lines[i]); i++) {
    const m = /^ {4}if:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    if (m[1] !== '>-') return m[1];
    const folded = [];
    for (let j = i + 1; j < lines.length && /^ {6}/.test(lines[j]); j++)
      folded.push(lines[j].trim());
    return folded.join(' ');
  }
  assert.fail(`job ${job} has no if:`);
}

/** Evaluates the small part of the Actions expression language the guards use. */
function evaluate(expr, ctx) {
  const tokens = expr.match(/'[^']*'|==|!=|&&|\|\||[()]|[\w.-]+/g);
  let pos = 0;
  const peek = () => tokens[pos];
  const value = () => {
    const t = tokens[pos++];
    if (t === '(') {
      const v = or();
      assert.equal(tokens[pos++], ')');
      return v;
    }
    if (t.startsWith("'")) return t.slice(1, -1);
    return t.split('.').reduce((o, k) => o?.[k], ctx) ?? '';
  };
  const cmp = () => {
    const left = value();
    if (peek() === '==') return (pos++, left === value());
    if (peek() === '!=') return (pos++, left !== value());
    return left;
  };
  const and = () => {
    let v = cmp();
    while (peek() === '&&') (pos++, (v = cmp() && v));
    return v;
  };
  const or = () => {
    let v = and();
    while (peek() === '||') (pos++, (v = and() || v));
    return v;
  };
  const result = or();
  assert.equal(pos, tokens.length, `could not read the whole expression: ${expr}`);
  return Boolean(result);
}

const REPO = 'hcmute-dsc/learning-hub';
const ciRun = (over = {}) => ({
  conclusion: 'success',
  event: 'push',
  head_branch: 'main',
  head_repository: { full_name: REPO },
  ...over,
});
const events = {
  'push to main, CI green': { event_name: 'workflow_run', workflow_run: ciRun() },
  'manual run on main': { event_name: 'workflow_dispatch', ref: 'refs/heads/main' },
};
const blocked = {
  'CI failed': { event_name: 'workflow_run', workflow_run: ciRun({ conclusion: 'failure' }) },
  'pull request run': {
    event_name: 'workflow_run',
    workflow_run: ciRun({ event: 'pull_request' }),
  },
  'run from another repository': {
    event_name: 'workflow_run',
    workflow_run: ciRun({ head_repository: { full_name: 'someone/learning-hub' } }),
  },
  'push to another branch': {
    event_name: 'workflow_run',
    workflow_run: ciRun({ head_branch: 'dev' }),
  },
  'manual run on another branch': { event_name: 'workflow_dispatch', ref: 'refs/heads/feature' },
};

function context(event, deployEnabled = 'true') {
  return {
    github: { repository: REPO, ref: '', ...event, event: { workflow_run: event.workflow_run } },
    vars: { DEPLOY_ENABLED: deployEnabled },
  };
}

for (const job of ['images', 'deploy']) {
  test(`${job} runs for a push to main and a manual run on main`, () => {
    for (const [name, event] of Object.entries(events)) {
      assert.equal(evaluate(jobIf(job), context(event)), true, name);
    }
  });

  test(`${job} is skipped for anything else`, () => {
    for (const [name, event] of Object.entries(blocked)) {
      assert.equal(evaluate(jobIf(job), context(event)), false, name);
    }
  });
}

test('deploy still needs DEPLOY_ENABLED', () => {
  for (const [name, event] of Object.entries(events)) {
    assert.equal(evaluate(jobIf('deploy'), context(event, 'false')), false, name);
  }
});

test('the expression reader handles precedence and parentheses', () => {
  const ctx = { a: 'x', b: 'y' };
  assert.equal(evaluate("a == 'x' || a == 'z' && b == 'n'", ctx), true);
  assert.equal(evaluate("(a == 'x' || a == 'z') && b == 'n'", ctx), false);
  assert.equal(evaluate("missing.key == ''", ctx), true);
});
