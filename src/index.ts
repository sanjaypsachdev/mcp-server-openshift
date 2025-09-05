#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { ocGetTool, handleOcGet } from './tools/oc-get.js';
import { ocCreateTool, handleOcCreate } from './tools/oc-create.js';
import { ocInstallOperatorTool, handleOcInstallOperator } from './tools/oc-install-operator.js';
import { ocNewAppTool, handleOcNewApp } from './tools/oc-new-app.js';
import { OpenShiftManager } from './utils/openshift-manager.js';

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
        },
      }
    );

    this.openShiftManager = OpenShiftManager.getInstance();
    this.setupToolHandlers();
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
