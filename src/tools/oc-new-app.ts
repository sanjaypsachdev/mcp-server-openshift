import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcNewAppSchema, type OcNewAppParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocNewAppTool: Tool = {
  name: 'oc_new_app',
  description: 'Create a new application from a GitHub repository using S2I build and expose it with an edge-terminated route',
  inputSchema: {
    type: 'object',
    properties: {
      gitRepo: {
        type: 'string',
        format: 'uri',
        description: 'GitHub repository URL for the source code'
      },
      appName: {
        type: 'string',
        description: 'Name for the application (if not specified, derives from repo name)'
      },
      namespace: {
        type: 'string',
        default: 'default',
        description: 'Target namespace for the application'
      },
      context: {
        type: 'string',
        default: '',
        description: 'OpenShift context to use (optional)'
      },
      builderImage: {
        type: 'string',
        description: 'Builder image for S2I build (e.g., "nodejs:18-ubi8", "python:3.9-ubi8")'
      },
      env: {
        type: 'array',
        items: { type: 'string' },
        description: 'Environment variables in KEY=VALUE format'
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels in KEY=VALUE format'
      },
      createNamespace: {
        type: 'boolean',
        default: true,
        description: 'Create namespace if it does not exist'
      },
      exposeRoute: {
        type: 'boolean',
        default: true,
        description: 'Create an edge-terminated route to expose the application'
      },
      routeHostname: {
        type: 'string',
        description: 'Custom hostname for the route (if not specified, uses default)'
      },
      gitRef: {
        type: 'string',
        description: 'Git reference (branch, tag, or commit) to build from (default: main/master)'
      },
      contextDir: {
        type: 'string',
        description: 'Context directory within the Git repository'
      },
      strategy: {
        type: 'string',
        enum: ['source', 'docker'],
        default: 'source',
        description: 'Build strategy: source (S2I) or docker'
      }
    },
    required: ['gitRepo']
  }
};

export async function handleOcNewApp(params: OcNewAppParams) {
  const manager = OpenShiftManager.getInstance();
  
  try {
    const validated = OcNewAppSchema.parse(params);
    
    // Extract app name from Git repo URL if not provided
    const appName = validated.appName || extractAppNameFromGitUrl(validated.gitRepo);
    
    // Create namespace if requested
    if (validated.createNamespace) {
      const namespaceResult = await createNamespaceIfNotExists(manager, validated.namespace, validated.context);
      if (!namespaceResult.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Warning: Failed to create namespace ${validated.namespace}: ${namespaceResult.error || 'Unknown error'}`
            }
          ]
        };
      }
    }
    
    // Build the oc new-app command
    const newAppResult = await executeNewApp(manager, validated, appName);
    
    if (!newAppResult.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Failed to create application: ${newAppResult.error}`
          }
        ]
      };
    }
    
    // Create edge-terminated route if requested
    let routeResult = null;
    if (validated.exposeRoute) {
      routeResult = await createEdgeRoute(manager, appName, validated.namespace, validated.context, validated.routeHostname);
    }
    
    // Format response
    const response = [
      `Tool: oc_new_app, Result: Successfully created application '${appName}' from ${validated.gitRepo}`,
      `Namespace: ${validated.namespace}`,
      `Build Strategy: ${validated.strategy}`,
      `Application creation: ${newAppResult.data || 'Success'}`
    ];
    
    if (routeResult) {
      if (routeResult.success) {
        response.push(`Route creation: ${routeResult.data || 'Success'}`);
      } else {
        response.push(`Route creation failed: ${routeResult.error}`);
      }
    }
    
    return {
      content: [
        {
          type: 'text' as const,
          text: response.join('\n')
        }
      ]
    };
    
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

async function createNamespaceIfNotExists(manager: OpenShiftManager, namespace: string, context?: string) {
  // Check if namespace exists
  const checkResult = await manager.executeCommand(['get', 'namespace', namespace], { context });
  
  if (checkResult.success) {
    return { success: true, data: `Namespace ${namespace} already exists` };
  }
  
  // Create namespace
  const createResult = await manager.executeCommand(['create', 'namespace', namespace], { context });
  return createResult;
}

function extractAppNameFromGitUrl(gitUrl: string): string {
  try {
    const url = new URL(gitUrl);
    const pathParts = url.pathname.split('/');
    let repoName = pathParts[pathParts.length - 1];
    
    // Remove .git extension if present
    if (repoName.endsWith('.git')) {
      repoName = repoName.slice(0, -4);
    }
    
    // Replace invalid characters for OpenShift resource names
    return repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  } catch {
    return 'my-app';
  }
}

async function executeNewApp(manager: OpenShiftManager, params: OcNewAppParams, appName: string) {
  const args = ['new-app'];
  
  // Add namespace
  args.push('-n', params.namespace);
  
  // Add name
  args.push('--name', appName);
  
  // Add strategy
  if (params.strategy === 'source') {
    args.push('--strategy=source');
  } else if (params.strategy === 'docker') {
    args.push('--strategy=docker');
  }
  
  // Add builder image if specified
  if (params.builderImage) {
    args.push(`${params.builderImage}~${params.gitRepo}`);
  } else {
    args.push(params.gitRepo);
  }
  
  // Add git reference
  if (params.gitRef) {
    args.push(`--source-secret=${params.gitRef}`);
  }
  
  // Add context directory
  if (params.contextDir) {
    args.push(`--context-dir=${params.contextDir}`);
  }
  
  // Add environment variables
  if (params.env && params.env.length > 0) {
    params.env.forEach(envVar => {
      args.push('-e', envVar);
    });
  }
  
  // Add labels
  if (params.labels && params.labels.length > 0) {
    params.labels.forEach(label => {
      args.push('-l', label);
    });
  }
  
  return manager.executeCommand(args, { context: params.context });
}

async function createEdgeRoute(
  manager: OpenShiftManager, 
  appName: string, 
  namespace: string, 
  context?: string, 
  hostname?: string
) {
  const args = ['create', 'route', 'edge', `${appName}-route`];
  
  // Add namespace
  args.push('-n', namespace);
  
  // Add service
  args.push('--service', appName);
  
  // Add custom hostname if specified
  if (hostname) {
    args.push('--hostname', hostname);
  }
  
  return manager.executeCommand(args, { context });
}

