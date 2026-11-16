import { NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { DomainError } from './errors';
import { toProblem } from './problem-details.filter';

describe('toProblem', () => {
  it('keeps the code and status of domain errors', () => {
    const p = toProblem(DomainError.conflict('Already enrolled'), 'req-1');
    expect(p).toMatchObject({
      status: 409,
      code: 'CONFLICT',
      title: 'Already enrolled',
      requestId: 'req-1',
    });
    expect(p.type).toBe('https://hub.hcmute-dsc.io.vn/errors/conflict');
  });

  it('turns Zod errors into 422 with field paths', () => {
    const result = z.object({ pageSize: z.number().max(100) }).safeParse({ pageSize: 500 });
    const p = toProblem(result.error);
    expect(p.status).toBe(422);
    expect(p.code).toBe('VALIDATION_FAILED');
    expect(p.errors?.[0].path).toBe('pageSize');
  });

  it('maps Nest HTTP exceptions by status', () => {
    expect(toProblem(new NotFoundException()).code).toBe('NOT_FOUND');
  });

  it('hides unknown errors behind a generic 500', () => {
    const p = toProblem(new Error('db password is hunter2'));
    expect(p).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      title: 'Unexpected server error',
    });
    expect(JSON.stringify(p)).not.toContain('hunter2');
  });
});
