#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CreateMessageRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { ocGetTool, handleOcGet } from './tools/oc-get.js';
import { ocCreateTool, handleOcCreate } from './tools/oc-create.js';
import { ocInstallOperatorTool, handleOcInstallOperator } from './tools/oc-install-operator.js';
import { ocNewAppTool, handleOcNewApp } from './tools/oc-new-app.js';
import { ocScaleTool, handleOcScale } from './tools/oc-scale.js';
import { ocDescribeTool, handleOcDescribe } from './tools/oc-describe.js';
import { ocApplyTool, handleOcApply } from './tools/oc-apply.js';
import { ocDeleteTool, handleOcDelete } from './tools/oc-delete.js';
import { ocLogsTool, handleOcLogs } from './tools/oc-logs.js';
import { ocPatchTool, handleOcPatch } from './tools/oc-patch.js';
import { OpenShiftManager } from './utils/openshift-manager.js';

// Import resources
import { clusterInfoResource, getClusterInfo } from './resources/cluster-info.js';
import { projectListResource, getProjectList } from './resources/project-list.js';
import { appTemplatesResource, getAppTemplates } from './resources/app-templates.js';

// Import prompts
import {
  troubleshootPodPrompt,
  generateTroubleshootPodPrompt,
} from './prompts/troubleshoot-pod.js';
import {
  monitoringPromptsPrompt,
  generateMonitoringPrompts,
} from './prompts/monitoring-prompts.js';

// Import sampling
import { samplePodLogs, type PodLogsSamplingRequest } from './sampling/pod-logs.js';

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
          sampling: {},
        },
      }
    );

    this.openShiftManager = OpenShiftManager.getInstance();
    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupPromptHandlers();
    this.setupSamplingHandlers();
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
          ocApplyTool,
          ocDeleteTool,
          ocLogsTool,
          ocPatchTool,
          // Add more tools here as they are implemented
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
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

          case 'oc_apply':
            return await handleOcApply(args as any);

          case 'oc_delete':
            return await handleOcDelete(args as any);

          case 'oc_logs':
            return await handleOcLogs(args as any);

          case 'oc_patch':
            return await handleOcPatch(args as any);

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
          projectListResource,
          appTemplatesResource,
          // Add more resources here as they are implemented
        ],
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async request => {
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

          case 'openshift://project-list':
            const projectData = await getProjectList();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: projectData,
                },
              ],
            };

          case 'openshift://app-templates':
            const templatesData = await getAppTemplates();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: templatesData,
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
          monitoringPromptsPrompt,
          // Add more prompts here as they are implemented
        ],
      };
    });

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'troubleshoot-pod-prompt':
            const troubleshootPromptText = generateTroubleshootPodPrompt({
              podName: args?.podName || 'UNKNOWN_POD',
              namespace: args?.namespace || 'UNKNOWN_NAMESPACE',
              symptoms: args?.symptoms,
              containerName: args?.containerName,
            });
            return {
              description: `Pod troubleshooting guide for ${args?.podName || 'pod'} in ${args?.namespace || 'namespace'}`,
              messages: [
                {
                  role: 'user' as const,
                  content: {
                    type: 'text' as const,
                    text: troubleshootPromptText,
                  },
                },
              ],
            };

          case 'monitoring-prompts':
            const monitoringPromptText = generateMonitoringPrompts({
              scenario: args?.scenario || 'cluster',
              target: args?.target,
              namespace: args?.namespace,
              timeRange: args?.timeRange,
            });
            return {
              description: `Monitoring guidance for ${args?.scenario || 'cluster'} scenario`,
              messages: [
                {
                  role: 'user' as const,
                  content: {
                    type: 'text' as const,
                    text: monitoringPromptText,
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

  private setupSamplingHandlers() {
    // Handle sampling requests
    this.server.setRequestHandler(CreateMessageRequestSchema, async request => {
      const { messages } = request.params;

      try {
        // Look for sampling requests in the messages
        for (const message of messages) {
          if (message.content.type === 'text') {
            const text = message.content.text;

            // Check if this is a pod logs sampling request
            const podLogsMatch = text.match(
              /sample pod logs for (\S+) in namespace (\S+)(?:\s+container (\S+))?(?:\s+since (\S+))?(?:\s+lines (\d+))?/i
            );

            if (podLogsMatch) {
              const [, podName, namespace, containerName, since, maxLines] = podLogsMatch;

              const samplingRequest: PodLogsSamplingRequest = {
                podName,
                namespace,
                containerName,
                maxLines: maxLines ? parseInt(maxLines) : 100,
                since: since || '1h',
                includePrevious: true,
              };

              const logSample = await samplePodLogs(samplingRequest);

              return {
                model: 'openshift-pod-logs-sampler',
                role: 'assistant' as const,
                content: {
                  type: 'text' as const,
                  text: logSample,
                },
              };
            }

            // Generic pod logs sampling (fallback)
            if (
              text.toLowerCase().includes('sample pod logs') ||
              text.toLowerCase().includes('analyze pod logs')
            ) {
              return {
                model: 'openshift-pod-logs-sampler',
                role: 'assistant' as const,
                content: {
                  type: 'text' as const,
                  text: `# Pod Logs Sampling

To sample pod logs, please specify:
- Pod name
- Namespace
- Container name (optional)
- Time range (optional, default: 1h)
- Max lines (optional, default: 100)

**Example**: "Sample pod logs for my-pod-12345 in namespace my-app container web-server since 30m lines 50"

**Available sampling options**:
- \`since\`: 5m, 30m, 1h, 2h, 1d
- \`lines\`: Number of log lines to sample (1-1000)
- \`container\`: Specific container name for multi-container pods
`,
                },
              };
            }
          }
        }

        // If no sampling pattern matches, return default response
        return {
          model: 'openshift-sampler',
          role: 'assistant' as const,
          content: {
            type: 'text' as const,
            text: 'I can help sample OpenShift resources for analysis. Try asking me to "sample pod logs" with specific pod details.',
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          model: 'openshift-sampler',
          role: 'assistant' as const,
          content: {
            type: 'text' as const,
            text: `Error in sampling: ${errorMessage}`,
          },
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = error => {
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
      console.error(
        'Warning: OpenShift CLI (oc) not found in PATH. Some functionality may not work.'
      );
    }

    // Determine transport type based on environment variables or command line arguments
    const transportType = this.getTransportType();

    if (transportType === 'sse') {
      await this.startHttpServer();
    } else {
      await this.startStdioServer();
    }
  }

  private async startStdioServer() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP OpenShift server started with STDIO transport');
  }

  private async startHttpServer() {
    // Parse port from command line arguments or use default
    const args = process.argv.slice(2);
    const portArg = args.find(arg => arg.startsWith('--port='));
    const port = portArg
      ? parseInt(portArg.split('=')[1])
      : parseInt(process.env.MCP_PORT || '3000');
    const host = process.env.MCP_HOST || 'localhost';

    console.error(`Starting HTTP server on ${host}:${port}`);
    console.error(`Connect using: http://${host}:${port}/sse`);

    // Create HTTP server
    const http = await import('http');
    const httpServer = http.createServer((req, res) => {
      // Handle CORS for web clients
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Handle SSE endpoint
      if (req.url === '/sse') {
        // Create SSE transport for this request
        const transport = new SSEServerTransport('/sse', res);
        this.server.connect(transport).catch(error => {
          console.error('Failed to connect SSE transport:', error);
        });
        return;
      }

      // Handle other requests
      if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            name: 'MCP OpenShift Server',
            version: '1.0.0',
            transport: 'HTTP/SSE',
            endpoints: {
              sse: '/sse',
              health: '/health',
            },
            status: 'running',
          })
        );
        return;
      }

      // 404 for other paths
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('MCP OpenShift Server - Use /sse endpoint for MCP communication');
    });

    // Start the HTTP server
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, host, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.error(`HTTP server listening on ${host}:${port}`);
          console.error(`Health check: http://${host}:${port}/health`);
          resolve();
        }
      });
    });
  }

  private getTransportType(): 'stdio' | 'sse' {
    // Check environment variables
    if (process.env.MCP_TRANSPORT === 'sse' || process.env.MCP_TRANSPORT === 'http') {
      return 'sse';
    }

    // Check command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--transport=sse') || args.includes('--transport=http')) {
      return 'sse';
    }
    if (args.includes('--http') || args.includes('--sse')) {
      return 'sse';
    }

    // Check for port argument (indicates HTTP mode)
    const portArg = args.find(arg => arg.startsWith('--port='));
    if (portArg) {
      return 'sse';
    }

    // Default to stdio for backward compatibility
    return 'stdio';
  }
}

// Command line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MCP OpenShift Server

USAGE:
  mcp-server-openshift [OPTIONS]

OPTIONS:
  --help, -h              Show this help message
  --transport=<type>      Transport type: stdio (default) or sse/http
  --http                  Use HTTP transport (alias for --transport=sse)
  --sse                   Use SSE transport (alias for --transport=sse)
  --port=<port>           Port for HTTP transport (default: 3000)
  --host=<host>           Host for HTTP transport (default: localhost)

ENVIRONMENT VARIABLES:
  MCP_TRANSPORT           Transport type: stdio or sse/http
  MCP_PORT                Port for HTTP transport (default: 3000)
  MCP_HOST                Host for HTTP transport (default: localhost)
  OPENSHIFT_CONTEXT       Default OpenShift context
  OPENSHIFT_NAMESPACE     Default namespace/project

TRANSPORT MODES:

  STDIO (Default):
    Use for direct MCP client integration (Claude Desktop, Cursor, VS Code)
    
    Example configuration:
    {
      "mcpServers": {
        "openshift": {
          "command": "node",
          "args": ["/path/to/mcp-server-openshift/dist/index.js"]
        }
      }
    }

  HTTP/SSE (Streamable):
    Use for web-based access or remote MCP clients
    
    Start server: mcp-server-openshift --http --port=3000
    Connect to: http://localhost:3000/sse
    
    Example configuration:
    {
      "mcpServers": {
        "openshift": {
          "command": "npx",
          "args": [
            "-y", "mcp-remote", 
            "http://localhost:3000/sse", 
            "--transport", "sse-only"
          ]
        }
      }
    }

EXAMPLES:
  # Start with stdio transport (default)
  mcp-server-openshift
  
  # Start with HTTP transport on default port 3000
  mcp-server-openshift --http
  
  # Start with HTTP transport on custom port
  mcp-server-openshift --transport=sse --port=8080
  
  # Start with environment variables
  MCP_TRANSPORT=sse MCP_PORT=3000 mcp-server-openshift
`);
    process.exit(0);
  }
}

// Parse command line arguments
parseArgs();

// Start the server
const server = new OpenShiftMCPServer();
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
