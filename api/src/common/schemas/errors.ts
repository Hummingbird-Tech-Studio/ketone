import { Schema as S } from 'effect';

export class InternalServerErrorSchema extends S.TaggedError<InternalServerErrorSchema>()('InternalServerError', {
  message: S.String,
}) {}
