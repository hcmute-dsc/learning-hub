import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/**
 * Validate a single parameter with a Zod schema shared from @hub/shared:
 *   @Query(new ZodPipe(trackListQuerySchema)) query: TrackListQuery
 * Failures throw ZodError → 422 problem+json.
 */
@Injectable()
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<S> {
    return this.schema.parse(value);
  }
}
