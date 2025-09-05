import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcCreateSchema, type OcCreateParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocCreateTool: Tool = {
  name: 'oc_create',
  description: 'Create OpenShift resources like projects, deploymentconfigs, routes, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        description: 'Type of resource to create (project, deploymentconfig, route, service, etc.)'
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
      manifest: {
        type: 'string',
        description: 'YAML manifest to create resources from'
      },
      filename: {
        type: 'string',
        description: 'Path to YAML file to create resources from'
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Validate only, don\'t create'
      },
      // DeploymentConfig specific
      image: {
        type: 'string',
        description: 'Container image for deploymentconfig'
      },
      replicas: {
        type: 'number',
        default: 1,
        description: 'Number of replicas'
      },
      // Route specific
      service: {
        type: 'string',
        description: 'Service name for route'
      },
      hostname: {
        type: 'string',
        description: 'Hostname for route'
      },
      // Project specific
      displayName: {
        type: 'string',
        description: 'Display name for project'
      },
      description: {
        type: 'string',
        description: 'Description for project'
      }
    },
    required: []
  }
};

export async function handleOcCreate(params: OcCreateParams) {
  const manager = OpenShiftManager.getInstance();
  
  try {
    const validated = OcCreateSchema.parse(params);
    
    // Handle manifest or filename creation
    if (validated.manifest || validated.filename) {
      const result = await manager.createResource({
        namespace: validated.namespace,
        context: validated.context,
        manifest: validated.manifest,
        filename: validated.filename,
        dryRun: validated.dryRun
      });
      
      if (!result.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating resource: ${result.error}`
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text' as const,
            text: `Tool: oc_create, Result: ${result.data}`
          }
        ]
      };
    }
    
    // Handle specific resource type creation
    if (!validated.resourceType || !validated.name) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: resourceType and name are required when not using manifest or filename'
          }
        ]
      };
    }
    
    const result = await createSpecificResource(manager, validated);
    
    if (!result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error creating ${validated.resourceType}: ${result.error}`
          }
        ]
      };
    }
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Tool: oc_create, Result: ${result.data}`
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

async function createSpecificResource(manager: OpenShiftManager, params: OcCreateParams) {
  const { resourceType, name, namespace, context, dryRun } = params;
  
  switch (resourceType) {
    case 'project':
      return createProject(manager, params);
    
    case 'deploymentconfig':
    case 'dc':
      return createDeploymentConfig(manager, params);
    
    case 'route':
      return createRoute(manager, params);
    
    case 'service':
    case 'svc':
      return createService(manager, params);
    
    default:
      // Generic resource creation
      return manager.createResource({
        resourceType,
        name,
        namespace,
        context,
        dryRun
      });
  }
}

async function createProject(manager: OpenShiftManager, params: OcCreateParams) {
  const args = ['new-project', params.name!];
  
  if (params.displayName) {
    args.push('--display-name', params.displayName);
  }
  
  if (params.description) {
    args.push('--description', params.description);
  }
  
  if (params.dryRun) {
    args.push('--dry-run=client');
  }
  
  return manager.executeCommand(args, { context: params.context });
}

async function createDeploymentConfig(manager: OpenShiftManager, params: OcCreateParams) {
  if (!params.image) {
    throw new Error('image is required for deploymentconfig creation');
  }
  
  const args = ['create', 'deploymentconfig', params.name!, `--image=${params.image}`];
  
  if (params.namespace) {
    args.push('-n', params.namespace);
  }
  
  if (params.replicas && params.replicas !== 1) {
    args.push(`--replicas=${params.replicas}`);
  }
  
  if (params.dryRun) {
    args.push('--dry-run=client');
  }
  
  return manager.executeCommand(args, { context: params.context });
}

async function createRoute(manager: OpenShiftManager, params: OcCreateParams) {
  if (!params.service) {
    throw new Error('service is required for route creation');
  }
  
  const args = ['create', 'route', 'edge', params.name!, `--service=${params.service}`];
  
  if (params.namespace) {
    args.push('-n', params.namespace);
  }
  
  if (params.hostname) {
    args.push(`--hostname=${params.hostname}`);
  }
  
  if (params.dryRun) {
    args.push('--dry-run=client');
  }
  
  return manager.executeCommand(args, { context: params.context });
}

async function createService(manager: OpenShiftManager, params: OcCreateParams) {
  const args = ['create', 'service', 'clusterip', params.name!];
  
  if (params.namespace) {
    args.push('-n', params.namespace);
  }
  
  if (params.dryRun) {
    args.push('--dry-run=client');
  }
  
  return manager.executeCommand(args, { context: params.context });
}
