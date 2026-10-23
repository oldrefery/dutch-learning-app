import {
  SEMANTIC_DIMENSIONS,
  SEMANTIC_RESPONSE_SCHEMA,
} from '../dictionary-analysis/responseSchemas.ts'

const content = SEMANTIC_RESPONSE_SCHEMA.properties!.content
const checks = content.properties!.checks

// Pin one dimension per position without changing the shared analysis wire contract.
export const CREATION_JUDGEMENT_RESPONSE_SCHEMA = {
  ...SEMANTIC_RESPONSE_SCHEMA,
  properties: {
    content: {
      ...content,
      properties: {
        ...content.properties,
        checks: {
          ...checks,
          prefixItems: SEMANTIC_DIMENSIONS.map(dimension => ({
            ...checks.items!,
            properties: {
              ...checks.items!.properties,
              dimension: { type: 'string', enum: [dimension] },
            },
          })),
        },
      },
    },
  },
}
