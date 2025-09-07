import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcGetSchema, type OcGetParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocGetTool: Tool = {
  name: 'oc_get',
  description: 'Get OpenShift resources like pods, deploymentconfigs, routes, projects, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        description:
          'Type of resource to get (e.g., pods, deploymentconfigs, routes, projects, services)',
      },
      name: {
        type: 'string',
        description: 'Name of the resource (optional - if not provided, lists all resources)',
      },
      namespace: {
        type: 'string',
        default: 'default',
        description: 'OpenShift namespace/project',
      },
      context: {
        type: 'string',
        default: '',
        description: 'OpenShift context to use (optional)',
      },
      output: {
        type: 'string',
        enum: ['json', 'yaml', 'wide', 'name'],
        default: 'json',
        description: 'Output format',
      },
      allNamespaces: {
        type: 'boolean',
        default: false,
        description: 'List resources across all namespaces',
      },
      labelSelector: {
        type: 'string',
        description: 'Filter resources by label selector (e.g., app=nginx)',
      },
      fieldSelector: {
        type: 'string',
        description: 'Filter resources by field selector',
      },
    },
    required: ['resourceType'],
  },
};

export async function handleOcGet(params: OcGetParams) {
  const manager = OpenShiftManager.getInstance();

  try {
    const validated = OcGetSchema.parse(params);

    const result = await manager.getResources(
      validated.resourceType,
      validated.namespace,
      validated.name,
      {
        context: validated.context,
        output: validated.output,
        labelSelector: validated.labelSelector,
        fieldSelector: validated.fieldSelector,
        allNamespaces: validated.allNamespaces,
      }
    );

    if (!result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting ${validated.resourceType}: ${result.error}`,
          },
        ],
      };
    }

    // Format the response based on output type
    if (validated.output === 'json' && typeof result.data === 'object') {
      // For JSON output, format nicely
      let items = result.data;

      // Handle both single items and lists
      if (result.data.items) {
        items = result.data.items;
      } else if (Array.isArray(result.data)) {
        items = result.data;
      } else {
        items = [result.data];
      }

      // Transform to simpler format for display
      const simplifiedItems = items.map((item: any) => ({
        name: item.metadata?.name || 'unknown',
        namespace: item.metadata?.namespace || 'N/A',
        kind: item.kind || validated.resourceType,
        status: getResourceStatus(item),
        createdAt: item.metadata?.creationTimestamp || 'unknown',
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: `Tool: oc_get, Result: ${JSON.stringify({ items: simplifiedItems }, null, 2)}`,
          },
        ],
      };
    } else {
      // For other output formats, return as-is
      return {
        content: [
          {
            type: 'text' as const,
            text: `Tool: oc_get, Result: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)}`,
          },
        ],
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

function getResourceStatus(item: any): string {
  if (!item.status) {
    return 'Unknown';
  }

  const { kind } = item;

  switch (kind) {
    case 'Pod':
      return item.status.phase || 'Unknown';

    case 'DeploymentConfig':
      const replicas = item.status.replicas || 0;
      const readyReplicas = item.status.readyReplicas || 0;
      return `${readyReplicas}/${replicas} ready`;

    case 'Service':
      return item.spec?.type || 'ClusterIP';

    case 'Route':
      return item.status?.ingress?.[0]?.host || item.spec?.host || 'No host';

    case 'Project':
      return item.status.phase || 'Unknown';

    case 'BuildConfig':
      return item.status?.lastVersion ? `Build ${item.status.lastVersion}` : 'No builds';

    case 'Build':
      return item.status.phase || 'Unknown';

    default:
      return item.status.phase || item.status.state || 'Active';
  }
}
