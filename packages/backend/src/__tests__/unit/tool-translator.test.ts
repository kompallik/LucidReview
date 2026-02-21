import { describe, it, expect } from 'vitest';

/**
 * tool-translator.ts converts MCP listTools() output into Bedrock Converse
 * API toolConfig format. Expected import:
 *   import { mcpToolsToBedrockConfig } from '../../agent/tool-translator.js';
 *
 * MCP tool shape (from listTools()):
 *   { name: string; description?: string; inputSchema: JsonSchema }
 *
 * Bedrock toolSpec shape:
 *   { toolSpec: { name: string; description: string; inputSchema: { json: JsonSchema } } }
 */
import { mcpToolsToBedrockConfig } from '../../agent/tool-translator.js';

describe('mcpToolsToBedrockConfig', () => {
  it('converts a single MCP tool to Bedrock toolSpec format', () => {
    const mcpTools = [
      {
        name: 'um_get_case',
        description: 'Fetch case metadata by case number',
        inputSchema: {
          type: 'object' as const,
          properties: {
            caseNumber: { type: 'string', description: 'The case number' },
          },
          required: ['caseNumber'],
        },
      },
    ];

    const result = mcpToolsToBedrockConfig(mcpTools);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      toolSpec: {
        name: 'um_get_case',
        description: 'Fetch case metadata by case number',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              caseNumber: { type: 'string', description: 'The case number' },
            },
            required: ['caseNumber'],
          },
        },
      },
    });
  });

  it('handles a tool with empty description', () => {
    const mcpTools = [
      {
        name: 'pdf_extract_text',
        inputSchema: {
          type: 'object' as const,
          properties: {
            base64Content: { type: 'string' },
          },
          required: ['base64Content'],
        },
      },
    ];

    const result = mcpToolsToBedrockConfig(mcpTools);

    expect(result).toHaveLength(1);
    expect(result[0].toolSpec.name).toBe('pdf_extract_text');
    // Should have a description (empty string or default), since Bedrock requires it
    expect(typeof result[0].toolSpec.description).toBe('string');
  });

  it('handles multiple tools', () => {
    const mcpTools = [
      {
        name: 'um_get_case',
        description: 'Get case data',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'um_get_clinical_info',
        description: 'Get clinical data',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'pdf_extract_text',
        description: 'Extract PDF text',
        inputSchema: { type: 'object' as const, properties: {} },
      },
    ];

    const result = mcpToolsToBedrockConfig(mcpTools);

    expect(result).toHaveLength(3);
    expect(result.map((t) => t.toolSpec.name)).toEqual([
      'um_get_case',
      'um_get_clinical_info',
      'pdf_extract_text',
    ]);
  });

  it('preserves JSON Schema structure in inputSchema.json', () => {
    const complexSchema = {
      type: 'object' as const,
      properties: {
        caseData: {
          type: 'object',
          properties: {
            caseNumber: { type: 'string' },
            memberId: { type: 'string' },
          },
          required: ['caseNumber'],
        },
        nlpEntities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              type: { type: 'string', enum: ['problem', 'medication', 'procedure'] },
            },
          },
        },
      },
      required: ['caseData'],
    };

    const mcpTools = [
      {
        name: 'fhir_normalize_case',
        description: 'Normalize case data to FHIR',
        inputSchema: complexSchema,
      },
    ];

    const result = mcpToolsToBedrockConfig(mcpTools);

    // The JSON Schema should be nested under inputSchema.json unchanged
    expect(result[0].toolSpec.inputSchema.json).toEqual(complexSchema);
  });

  it('returns empty array for empty input', () => {
    const result = mcpToolsToBedrockConfig([]);
    expect(result).toEqual([]);
  });
});
