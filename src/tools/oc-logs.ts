import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcLogsSchema, type OcLogsParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocLogsTool: Tool = {
  name: 'oc_logs',
  description: 'Get logs from OpenShift resources like pods, deployments, builds, etc. with advanced filtering and streaming options',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        enum: ['pod', 'deploymentconfig', 'deployment', 'build', 'buildconfig', 'job'],
        default: 'pod',
        description: 'Type of resource to get logs from'
      },
      name: {
        type: 'string',
        description: 'Name of the resource'
      },
      namespace: {
        type: 'string',
        default: 'default',
        description: 'OpenShift namespace/project'
      },
      context: {
        type: 'string',
        default: '',
        description: 'OpenShift context to use (optional)'
      },
      container: {
        type: 'string',
        description: 'Container name (for pods with multiple containers)'
      },
      follow: {
        type: 'boolean',
        default: false,
        description: 'Follow logs output (stream live logs)'
      },
      previous: {
        type: 'boolean',
        default: false,
        description: 'Show logs from previous terminated container'
      },
      since: {
        type: 'string',
        description: 'Show logs since relative time (e.g. 5s, 2m, 3h) or absolute time'
      },
      sinceTime: {
        type: 'string',
        description: 'Show logs since absolute timestamp (RFC3339)'
      },
      tail: {
        type: 'number',
        minimum: 0,
        description: 'Number of lines to show from end of logs (-1 for all)'
      },
      timestamps: {
        type: 'boolean',
        default: false,
        description: 'Include timestamps in log output'
      },
      limitBytes: {
        type: 'number',
        minimum: 1,
        description: 'Maximum bytes to return'
      },
      allContainers: {
        type: 'boolean',
        default: false,
        description: 'Get logs from all containers in the pod'
      },
      selector: {
        type: 'string',
        description: 'Label selector to filter pods'
      },
      maxLogRequests: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        default: 5,
        description: 'Maximum number of concurrent log requests when using selectors'
      }
    },
    required: ['name']
  }
};

export async function handleOcLogs(params: OcLogsParams) {
  const manager = OpenShiftManager.getInstance();
  const progressLog: string[] = [];
  const startTime = Date.now();
  
  // Helper function to add progress logs with timestamps
  function addProgress(message: string, level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    progressLog.push(`[${elapsed}s] ${level}: ${message}`);
  }
  
  try {
    const validated = OcLogsSchema.parse(params);
    addProgress('📋 Starting log retrieval operation');
    
    // Validate input parameters
    const validationResult = validateLogsParameters(validated);
    if (!validationResult.valid) {
      addProgress(`❌ Parameter validation failed: ${validationResult.error}`, 'ERROR');
      return formatErrorResponse(progressLog, 'Parameter validation failed', validationResult.error);
    }
    addProgress('✅ Parameters validated successfully');
    
    // Check resource availability and get container info
    addProgress('🔍 Discovering target resources...');
    const resourceInfo = await discoverLogResources(manager, validated);
    if (!resourceInfo.available) {
      addProgress(`❌ Resource not available: ${resourceInfo.error}`, 'ERROR');
      return formatErrorResponse(progressLog, 'Resource not available', resourceInfo.error);
    }
    
    addProgress(`📦 Found resource: ${resourceInfo.kind}/${resourceInfo.name}`);
    if (resourceInfo.containers && resourceInfo.containers.length > 0) {
      addProgress(`📋 Available containers: ${resourceInfo.containers.join(', ')}`);
    }
    
    // Validate container selection for multi-container resources
    if (resourceInfo.containers && resourceInfo.containers.length > 1 && !validated.container && !validated.allContainers) {
      addProgress('⚠️  Multiple containers found - container selection required', 'WARNING');
      return formatContainerSelectionResponse(progressLog, resourceInfo, validated);
    }
    
    // Build logs command
    addProgress('🔨 Building logs command...');
    const logsCommands = buildLogsCommands(validated, resourceInfo);
    addProgress(`📝 Commands to execute: ${logsCommands.length}`);
    
    // Execute log retrieval
    addProgress('📜 Retrieving logs...');
    const logResults = await executeLogsCommands(manager, logsCommands, validated);
    
    if (logResults.length === 0) {
      addProgress('📭 No logs found', 'WARNING');
      return formatNoLogsResponse(progressLog, validated);
    }
    
    // Process and format results
    const processedLogs = processLogResults(logResults, validated);
    addProgress(`✅ Retrieved ${processedLogs.totalLines} lines from ${processedLogs.sources.length} source(s)`, 'SUCCESS');
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    addProgress(`🎉 Log retrieval completed successfully in ${totalTime}s`, 'SUCCESS');
    
    return formatSuccessResponse(progressLog, validated, processedLogs, resourceInfo);
    
  } catch (error) {
    addProgress(`💥 Unexpected error: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
    return formatErrorResponse(progressLog, 'Unexpected error occurred', error instanceof Error ? error.message : String(error));
  }
}

export function validateLogsParameters(params: OcLogsParams): { valid: boolean; error?: string } {
  // Cannot use both since and sinceTime
  if (params.since && params.sinceTime) {
    return {
      valid: false,
      error: 'Cannot specify both "since" and "sinceTime" - choose one'
    };
  }
  
  // Validate since format if provided
  if (params.since && !params.since.match(/^\d+[smhd]$/) && !isValidAbsoluteTime(params.since)) {
    return {
      valid: false,
      error: 'Since must be in format: <number><unit> (e.g., "5s", "2m", "3h", "1d") or absolute time'
    };
  }
  
  // Validate sinceTime format if provided
  if (params.sinceTime && !isValidRFC3339(params.sinceTime)) {
    return {
      valid: false,
      error: 'sinceTime must be in RFC3339 format (e.g., "2023-01-01T12:00:00Z")'
    };
  }
  
  // Validate tail value
  if (params.tail !== undefined && params.tail < -1) {
    return {
      valid: false,
      error: 'tail must be >= -1 (-1 for all lines, 0+ for specific number of lines)'
    };
  }
  
  // Cannot use previous with follow
  if (params.previous && params.follow) {
    return {
      valid: false,
      error: 'Cannot use "previous" and "follow" together - previous containers cannot stream'
    };
  }
  
  // allContainers only works with pods
  if (params.allContainers && params.resourceType !== 'pod') {
    return {
      valid: false,
      error: 'allContainers option only works with resourceType "pod"'
    };
  }
  
  // selector only works with pods
  if (params.selector && params.resourceType !== 'pod') {
    return {
      valid: false,
      error: 'selector option only works with resourceType "pod"'
    };
  }
  
  return { valid: true };
}

async function discoverLogResources(manager: OpenShiftManager, params: OcLogsParams): Promise<{
  available: boolean;
  error?: string;
  kind?: string;
  name?: string;
  containers?: string[];
  status?: string;
}> {
  try {
    // For selector-based queries, get list of pods
    if (params.selector) {
      const getCommand = ['get', 'pods', '-l', params.selector, '-n', params.namespace, '-o', 'json'];
      const result = await manager.executeCommand(getCommand, { context: params.context });
      
      if (!result.success) {
        return { available: false, error: `Failed to discover pods: ${result.error}` };
      }
      
      const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      if (!data.items || data.items.length === 0) {
        return { available: false, error: `No pods found matching selector: ${params.selector}` };
      }
      
      return {
        available: true,
        kind: 'PodList',
        name: `${data.items.length} pods`,
        containers: []
      };
    }
    
    // For specific resource, get detailed info
    const getCommand = ['get', params.resourceType, params.name, '-n', params.namespace, '-o', 'json'];
    const result = await manager.executeCommand(getCommand, { context: params.context });
    
    if (!result.success) {
      return { available: false, error: `Resource not found: ${result.error}` };
    }
    
    const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    const containers: string[] = [];
    let status = 'Unknown';
    
    // Extract container info based on resource type
    if (params.resourceType === 'pod') {
      if (data.spec?.containers) {
        containers.push(...data.spec.containers.map((c: any) => c.name));
      }
      status = data.status?.phase || 'Unknown';
    } else if (params.resourceType === 'deploymentconfig' || params.resourceType === 'deployment') {
      if (data.spec?.template?.spec?.containers) {
        containers.push(...data.spec.template.spec.containers.map((c: any) => c.name));
      }
      status = `${data.status?.readyReplicas || 0}/${data.status?.replicas || 0} ready`;
    }
    
    return {
      available: true,
      kind: data.kind,
      name: data.metadata?.name,
      containers,
      status
    };
    
  } catch (error) {
    return { 
      available: false, 
      error: `Discovery failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

interface LogCommand {
  command: string[];
  source: string;
  container?: string;
}

function buildLogsCommands(params: OcLogsParams, resourceInfo: any): LogCommand[] {
  const commands: LogCommand[] = [];
  
  if (params.selector) {
    // For selector-based queries, we'll build a single command
    const args = ['logs', '-l', params.selector];
    
    if (params.namespace) {
      args.push('-n', params.namespace);
    }
    
    addCommonLogsArgs(args, params);
    
    commands.push({
      command: args,
      source: `selector:${params.selector}`
    });
  } else {
    // For specific resources
    if (params.allContainers && resourceInfo.containers?.length > 1) {
      // Create command for each container
      resourceInfo.containers.forEach((container: string) => {
        const args = ['logs', params.resourceType, params.name];
        
        if (params.namespace) {
          args.push('-n', params.namespace);
        }
        
        args.push('-c', container);
        addCommonLogsArgs(args, params);
        
        commands.push({
          command: args,
          source: `${params.resourceType}/${params.name}`,
          container
        });
      });
    } else {
      // Single command
      const args = ['logs', params.resourceType, params.name];
      
      if (params.namespace) {
        args.push('-n', params.namespace);
      }
      
      if (params.container) {
        args.push('-c', params.container);
      }
      
      addCommonLogsArgs(args, params);
      
      commands.push({
        command: args,
        source: `${params.resourceType}/${params.name}`,
        container: params.container
      });
    }
  }
  
  return commands;
}

function addCommonLogsArgs(args: string[], params: OcLogsParams): void {
  if (params.follow) {
    args.push('-f');
  }
  
  if (params.previous) {
    args.push('-p');
  }
  
  if (params.since) {
    args.push('--since', params.since);
  }
  
  if (params.sinceTime) {
    args.push('--since-time', params.sinceTime);
  }
  
  if (params.tail !== undefined) {
    args.push('--tail', params.tail.toString());
  }
  
  if (params.timestamps) {
    args.push('--timestamps');
  }
  
  if (params.limitBytes) {
    args.push('--limit-bytes', params.limitBytes.toString());
  }
  
  if (params.allContainers && !params.container) {
    args.push('--all-containers');
  }
  
  if (params.maxLogRequests && params.selector) {
    args.push('--max-log-requests', params.maxLogRequests.toString());
  }
}

interface LogResult {
  success: boolean;
  data?: string;
  error?: string;
  source: string;
  container?: string;
}

async function executeLogsCommands(manager: OpenShiftManager, commands: LogCommand[], params: OcLogsParams): Promise<LogResult[]> {
  const results: LogResult[] = [];
  
  // Execute commands concurrently (but respect maxLogRequests for selectors)
  const maxConcurrent = params.selector ? params.maxLogRequests || 5 : commands.length;
  const batches = [];
  
  for (let i = 0; i < commands.length; i += maxConcurrent) {
    batches.push(commands.slice(i, i + maxConcurrent));
  }
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (cmd) => {
      try {
        const result = await manager.executeCommand(cmd.command, { 
          context: params.context,
          timeout: params.follow ? undefined : 30000 // 30s timeout for non-streaming
        });
        
        return {
          success: result.success,
          data: result.data,
          error: result.error,
          source: cmd.source,
          container: cmd.container
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          source: cmd.source,
          container: cmd.container
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

interface ProcessedLogs {
  logs: Array<{
    source: string;
    container?: string;
    content: string;
    lines: number;
    truncated: boolean;
  }>;
  totalLines: number;
  sources: string[];
  hasErrors: boolean;
  errors: string[];
}

function processLogResults(results: LogResult[], params: OcLogsParams): ProcessedLogs {
  const logs: ProcessedLogs['logs'] = [];
  let totalLines = 0;
  const sources = new Set<string>();
  const errors: string[] = [];
  
  results.forEach(result => {
    if (result.success && result.data) {
      const lines = result.data.split('\n').filter(line => line.trim());
      const truncated = params.limitBytes ? result.data.length >= params.limitBytes : false;
      
      logs.push({
        source: result.source,
        container: result.container,
        content: result.data,
        lines: lines.length,
        truncated
      });
      
      totalLines += lines.length;
      sources.add(result.source);
    } else if (result.error) {
      errors.push(`${result.source}${result.container ? ` (${result.container})` : ''}: ${result.error}`);
    }
  });
  
  return {
    logs,
    totalLines,
    sources: Array.from(sources),
    hasErrors: errors.length > 0,
    errors
  };
}

function isValidAbsoluteTime(timeStr: string): boolean {
  // Simple check for common absolute time formats
  return /^\d{4}-\d{2}-\d{2}/.test(timeStr) || /^\d{10,13}$/.test(timeStr);
}

function isValidRFC3339(timeStr: string): boolean {
  try {
    const date = new Date(timeStr);
    return !isNaN(date.getTime()) && timeStr.includes('T');
  } catch {
    return false;
  }
}

function formatSuccessResponse(progressLog: string[], params: OcLogsParams, processedLogs: ProcessedLogs, resourceInfo: any) {
  const response = [
    `# 📜 Logs Retrieved Successfully`,
    ``,
    `## 📋 Log Summary`,
    `- **Resource**: ${params.resourceType}/${params.name}`,
    `- **Namespace**: ${params.namespace}`,
    `- **Total Lines**: ${processedLogs.totalLines}`,
    `- **Sources**: ${processedLogs.sources.length}`,
    `- **Follow Mode**: ${params.follow ? 'Yes (streaming)' : 'No'}`,
    `- **Include Timestamps**: ${params.timestamps ? 'Yes' : 'No'}`,
    ``
  ];
  
  // Add container info if relevant
  if (resourceInfo.containers?.length > 1) {
    response.push(
      `## 📦 Container Information`,
      `- **Available Containers**: ${resourceInfo.containers.join(', ')}`,
      `- **Selected Container**: ${params.container || (params.allContainers ? 'All containers' : 'Default')}`,
      ``
    );
  }
  
  // Add errors if any
  if (processedLogs.hasErrors) {
    response.push(
      `## ⚠️  Errors Encountered`,
      ...processedLogs.errors.map(error => `- ${error}`),
      ``
    );
  }
  
  // Add log content
  response.push(`## 📜 Log Content`);
  
  if (processedLogs.logs.length === 1) {
    // Single source
    const log = processedLogs.logs[0];
    response.push(
      ``,
      `\`\`\``,
      log.content || '(no logs)',
      `\`\`\``
    );
    
    if (log.truncated) {
      response.push(``, `⚠️  **Note**: Logs may be truncated due to size limits`);
    }
  } else {
    // Multiple sources
    processedLogs.logs.forEach(log => {
      response.push(
        ``,
        `### ${log.source}${log.container ? ` (${log.container})` : ''} - ${log.lines} lines`,
        ``,
        `\`\`\``,
        log.content || '(no logs)',
        `\`\`\``
      );
      
      if (log.truncated) {
        response.push(``, `⚠️  **Note**: Logs may be truncated due to size limits`);
      }
    });
  }
  
  // Add progress log
  response.push(
    ``,
    `## 📝 Operation Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🔧 Useful Commands`,
    `\`\`\`bash`,
    `# Follow live logs`,
    `oc logs ${params.resourceType}/${params.name} -n ${params.namespace} -f`,
    ``
  );
  
  if (resourceInfo.containers?.length > 1) {
    response.push(
      `# Specify container`,
      `oc logs ${params.resourceType}/${params.name} -c <container-name> -n ${params.namespace}`,
      ``
    );
  }
  
  response.push(
    `# Get previous container logs`,
    `oc logs ${params.resourceType}/${params.name} -n ${params.namespace} --previous`,
    ``,
    `# Get logs with timestamps`,
    `oc logs ${params.resourceType}/${params.name} -n ${params.namespace} --timestamps`,
    `\`\`\``
  );
  
  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n')
      }
    ]
  };
}

function formatContainerSelectionResponse(progressLog: string[], resourceInfo: any, params: OcLogsParams) {
  const response = [
    `# 🔍 Container Selection Required`,
    ``,
    `## 📦 Multiple Containers Found`,
    `The ${resourceInfo.kind}/${resourceInfo.name} has multiple containers. Please specify which container's logs you want to retrieve.`,
    ``,
    `## 📋 Available Containers`,
    ...resourceInfo.containers.map((container: string) => `- **${container}**`),
    ``,
    `## 🎯 Options`,
    ``,
    `### 1. Select Specific Container`,
    `Add the container name to your request:`,
    `\`\`\`json`,
    `{`,
    `  "name": "oc_logs",`,
    `  "arguments": {`,
    `    ...your current arguments...,`,
    `    "container": "<container-name>"`,
    `  }`,
    `}`,
    `\`\`\``,
    ``,
    `### 2. Get All Container Logs`,
    `Set allContainers to true:`,
    `\`\`\`json`,
    `{`,
    `  "name": "oc_logs",`,
    `  "arguments": {`,
    `    ...your current arguments...,`,
    `    "allContainers": true`,
    `  }`,
    `}`,
    `\`\`\``,
    ``,
    `## 📝 Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``
  ];
  
  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n')
      }
    ]
  };
}

function formatNoLogsResponse(progressLog: string[], params: OcLogsParams) {
  const response = [
    `# 📭 No Logs Found`,
    ``,
    `## 🔍 Search Criteria`,
    `- **Resource**: ${params.resourceType}/${params.name}`,
    `- **Namespace**: ${params.namespace}`,
    `- **Container**: ${params.container || 'Default'}`,
    `- **Previous**: ${params.previous ? 'Yes' : 'No'}`,
    params.since ? `- **Since**: ${params.since}` : '',
    params.sinceTime ? `- **Since Time**: ${params.sinceTime}` : '',
    ``,
    `## 📝 Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 💡 Possible Reasons`,
    `1. Container hasn't started yet or has no output`,
    `2. Logs may have been rotated or cleared`,
    `3. Time filters may be excluding all logs`,
    `4. Container may be in a failed state`,
    ``,
    `## 🔧 Troubleshooting`,
    `- Check resource status: \`oc describe ${params.resourceType} ${params.name} -n ${params.namespace}\``,
    `- Check events: \`oc get events -n ${params.namespace} --sort-by='.lastTimestamp'\``,
    `- Try previous container logs: Add \`"previous": true\``,
    `- Remove time filters to see all available logs`
  ].filter(line => line !== '');
  
  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n')
      }
    ]
  };
}

function formatErrorResponse(progressLog: string[], errorTitle: string, errorDetails?: string) {
  const response = [
    `# ❌ Log Retrieval Failed`,
    ``,
    `## 🚨 Error Details`,
    `**Error**: ${errorTitle}`,
    errorDetails ? `**Details**: ${errorDetails}` : '',
    ``,
    `## 📝 Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🔧 Troubleshooting Steps`,
    `1. Verify resource exists: \`oc get <resource> <name> -n <namespace>\``,
    `2. Check resource status: \`oc describe <resource> <name> -n <namespace>\``,
    `3. Verify container name (if specified): \`oc get <resource> <name> -o jsonpath='{.spec.containers[*].name}' -n <namespace>\``,
    `4. Check cluster connectivity: \`oc whoami\``,
    `5. Verify namespace access: \`oc auth can-i get pods -n <namespace>\``
  ];
  
  return {
    content: [
      {
        type: 'text' as const,
        text: response.filter(line => line !== '').join('\n')
      }
    ]
  };
}

