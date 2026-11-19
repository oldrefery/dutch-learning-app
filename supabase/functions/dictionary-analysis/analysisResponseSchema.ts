import {
  SEMANTIC_DIMENSIONS,
  SEMANTIC_RESPONSE_SCHEMA,
} from './responseSchemas.ts'

const semanticContent = SEMANTIC_RESPONSE_SCHEMA.properties!.content
const checks = semanticContent.properties!.checks

// Keep the shared/creation schema stable; bind each analysis check to its dimension.
export const ANALYSIS_SEMANTIC_RESPONSE_SCHEMA = {
  ...SEMANTIC_RESPONSE_SCHEMA,
  properties: {
    content: {
      ...semanticContent,
      properties: {
        ...semanticContent.properties,
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
