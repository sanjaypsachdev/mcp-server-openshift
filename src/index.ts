#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { ocGetTool, handleOcGet } from './tools/oc-get.js';
import { ocCreateTool, handleOcCreate } from './tools/oc-create.js';
import { ocInstallOperatorTool, handleOcInstallOperator } from './tools/oc-install-operator.js';
import { ocNewAppTool, handleOcNewApp } from './tools/oc-new-app.js';
import { ocScaleTool, handleOcScale } from './tools/oc-scale.js';
import { ocDescribeTool, handleOcDescribe } from './tools/oc-describe.js';
import { OpenShiftManager } from './utils/openshift-manager.js';

// Import resources
import { clusterInfoResource, getClusterInfo } from './resources/cluster-info.js';

// Import prompts
import { troubleshootPodPrompt, generateTroubleshootPodPrompt } from './prompts/troubleshoot-pod.js';

class OpenShiftMCPServer {
  private server: Server;
  private openShiftManager: OpenShiftManager;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-server-openshift',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.openShiftManager = OpenShiftManager.getInstance();
    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupPromptHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          ocGetTool,
          ocCreateTool,
          ocInstallOperatorTool,
          ocNewAppTool,
          ocScaleTool,
          ocDescribeTool,
          // Add more tools here as they are implemented
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'oc_get':
            return await handleOcGet(args as any);

          case 'oc_create':
            return await handleOcCreate(args as any);

          case 'oc_install_operator':
            return await handleOcInstallOperator(args as any);

          case 'oc_new_app':
            return await handleOcNewApp(args as any);

          case 'oc_scale':
            return await handleOcScale(args as any);

          case 'oc_describe':
            return await handleOcDescribe(args as any);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error executing tool ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          clusterInfoResource,
          // Add more resources here as they are implemented
        ],
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'openshift://cluster-info':
            const clusterData = await getClusterInfo();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: clusterData,
                },
              ],
            };

          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error reading resource ${uri}: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private setupPromptHandlers() {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          troubleshootPodPrompt,
          // Add more prompts here as they are implemented
        ],
      };
    });

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'troubleshoot-pod-prompt':
            const promptText = generateTroubleshootPodPrompt({
              podName: args?.podName || 'UNKNOWN_POD',
              namespace: args?.namespace || 'UNKNOWN_NAMESPACE',
              symptoms: args?.symptoms,
              containerName: args?.containerName
            });
            return {
              description: `Pod troubleshooting guide for ${args?.podName || 'pod'} in ${args?.namespace || 'namespace'}`,
              messages: [
                {
                  role: 'user' as const,
                  content: {
                    type: 'text' as const,
                    text: promptText,
                  },
                },
              ],
            };

          default:
            throw new Error(`Unknown prompt: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          description: `Error generating prompt ${name}`,
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Error generating prompt: ${errorMessage}`,
              },
            },
          ],
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start() {
    // Check if OpenShift CLI is available
    const cliAvailable = await this.openShiftManager.checkCLI();
    if (!cliAvailable) {
      console.error('Warning: OpenShift CLI (oc) not found in PATH. Some functionality may not work.');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP OpenShift server started');
  }
}

// Start the server
const server = new OpenShiftMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
