import { Schema } from 'effect';

export function createVeeValidateSchema<T extends Schema.Schema.AnyNoContext>(effectSchema: T) {
  const StandardSchemaClass = Schema.standardSchemaV1(effectSchema);
  return {
    ...StandardSchemaClass,
    '~standard': StandardSchemaClass['~standard' as keyof typeof StandardSchemaClass],
  };
}
