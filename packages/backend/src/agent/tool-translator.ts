/**
 * Converts MCP listTools() output into Bedrock Converse API toolConfig format.
 *
 * MCP tool shape (from listTools()):
 *   { name: string; description?: string; inputSchema: JsonSchema }
 *
 * Bedrock toolSpec shape:
 *   { toolSpec: { name: string; description: string; inputSchema: { json: Record<string, unknown> } } }
 */

export interface BedrockTool {
  toolSpec: {
    name: string;
    description: string;
    inputSchema: {
      json: Record<string, unknown>;
    };
  };
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export function mcpToolsToBedrockConfig(mcpTools: McpTool[]): BedrockTool[] {
  return mcpTools.map((tool) => ({
    toolSpec: {
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: {
        json: tool.inputSchema as Record<string, unknown>,
      },
    },
  }));
}
