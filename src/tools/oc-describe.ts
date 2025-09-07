import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcDescribeSchema, type OcDescribeParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocDescribeTool: Tool = {
  name: 'oc_describe',
  description:
    'Describe any OpenShift resource and share the output in various formats including human-readable summary',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        description: 'Type of resource to describe (pod, deployment, service, route, etc.)',
      },
      name: {
        type: 'string',
        description: 'Name of the resource to describe',
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
        enum: ['text', 'yaml', 'json', 'human-readable'],
        default: 'human-readable',
        description:
          'Output format: text (default oc describe), yaml, json, or human-readable (concise summary)',
      },
    },
    required: ['resourceType', 'name'],
  },
};

export async function handleOcDescribe(params: OcDescribeParams) {
  const manager = OpenShiftManager.getInstance();

  try {
    const validated = OcDescribeSchema.parse(params);

    if (validated.output === 'human-readable') {
      return await getHumanReadableDescription(manager, validated);
    } else {
      return await getFormattedDescription(manager, validated);
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

async function getFormattedDescription(manager: OpenShiftManager, params: OcDescribeParams) {
  let result;

  if (params.output === 'text') {
    // Use oc describe for text output
    result = await manager.executeCommand(
      ['describe', params.resourceType, params.name, '-n', params.namespace],
      { context: params.context }
    );
  } else {
    // Use oc get with output format for yaml/json
    result = await manager.executeCommand(
      ['get', params.resourceType, params.name, '-n', params.namespace, '-o', params.output],
      { context: params.context }
    );
  }

  if (!result.success) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error describing ${params.resourceType} '${params.name}': ${result.error}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `Tool: oc_describe, Format: ${params.output}\nResource: ${params.resourceType}/${params.name} in namespace ${params.namespace}\n\n${result.data}`,
      },
    ],
  };
}

async function getHumanReadableDescription(manager: OpenShiftManager, params: OcDescribeParams) {
  // Get the resource in JSON format for parsing
  const result = await manager.executeCommand(
    ['get', params.resourceType, params.name, '-n', params.namespace, '-o', 'json'],
    { context: params.context }
  );

  if (!result.success) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error describing ${params.resourceType} '${params.name}': ${result.error}`,
        },
      ],
    };
  }

  try {
    const resource = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    const summary = generateHumanReadableSummary(resource, params.resourceType);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Tool: oc_describe, Format: human-readable\nResource: ${params.resourceType}/${params.name} in namespace ${params.namespace}\n\n${summary}`,
        },
      ],
    };
  } catch (parseError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error parsing resource data for human-readable format: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        },
      ],
    };
  }
}

function generateHumanReadableSummary(resource: any, resourceType: string): string {
  const summary: string[] = [];
  const metadata = resource.metadata || {};
  const spec = resource.spec || {};
  const status = resource.status || {};

  // Basic information
  summary.push(`📋 RESOURCE SUMMARY`);
  summary.push(`• Name: ${metadata.name || 'Unknown'}`);
  summary.push(`• Namespace: ${metadata.namespace || 'N/A'}`);
  summary.push(`• Kind: ${resource.kind || resourceType}`);
  summary.push(`• Created: ${metadata.creationTimestamp || 'Unknown'}`);

  // Labels
  if (metadata.labels && Object.keys(metadata.labels).length > 0) {
    summary.push(
      `• Labels: ${Object.entries(metadata.labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`
    );
  }

  // Annotations (show only important ones)
  if (metadata.annotations) {
    const importantAnnotations = Object.entries(metadata.annotations)
      .filter(
        ([key]) =>
          !key.startsWith('kubectl.kubernetes.io') && !key.startsWith('deployment.kubernetes.io')
      )
      .slice(0, 3);
    if (importantAnnotations.length > 0) {
      summary.push(
        `• Annotations: ${importantAnnotations.map(([k, v]) => `${k}=${v}`).join(', ')}`
      );
    }
  }

  summary.push(''); // Empty line

  // Resource-specific information
  switch (resourceType.toLowerCase()) {
    case 'pod':
      summary.push(...generatePodSummary(spec, status));
      break;
    case 'deployment':
    case 'deploymentconfig':
      summary.push(...generateDeploymentSummary(spec, status));
      break;
    case 'service':
    case 'svc':
      summary.push(...generateServiceSummary(spec, status));
      break;
    case 'route':
      summary.push(...generateRouteSummary(spec, status));
      break;
    case 'configmap':
    case 'cm':
      summary.push(...generateConfigMapSummary(resource.data));
      break;
    case 'secret':
      summary.push(...generateSecretSummary(resource.data));
      break;
    case 'persistentvolumeclaim':
    case 'pvc':
      summary.push(...generatePVCSummary(spec, status));
      break;
    default:
      summary.push(...generateGenericSummary(spec, status));
  }

  return summary.join('\n');
}

function generatePodSummary(spec: any, status: any): string[] {
  const summary: string[] = [];
  summary.push(`🚀 POD DETAILS`);

  // Pod status
  summary.push(`• Phase: ${status.phase || 'Unknown'}`);
  summary.push(`• Node: ${spec.nodeName || status.hostIP || 'Not assigned'}`);
  summary.push(`• Pod IP: ${status.podIP || 'Not assigned'}`);

  // Containers
  if (spec.containers && spec.containers.length > 0) {
    summary.push(`• Containers (${spec.containers.length}):`);
    spec.containers.forEach((container: any, index: number) => {
      summary.push(`  - ${container.name}: ${container.image}`);
      if (container.ports && container.ports.length > 0) {
        summary.push(
          `    Ports: ${container.ports.map((p: any) => `${p.containerPort}/${p.protocol || 'TCP'}`).join(', ')}`
        );
      }
    });
  }

  // Container statuses
  if (status.containerStatuses && status.containerStatuses.length > 0) {
    summary.push(`• Container Status:`);
    status.containerStatuses.forEach((cs: any) => {
      const state = cs.state ? Object.keys(cs.state)[0] : 'unknown';
      summary.push(
        `  - ${cs.name}: ${state} (Ready: ${cs.ready ? 'Yes' : 'No'}, Restarts: ${cs.restartCount || 0})`
      );
    });
  }

  return summary;
}

function generateDeploymentSummary(spec: any, status: any): string[] {
  const summary: string[] = [];
  summary.push(`🚀 DEPLOYMENT DETAILS`);

  // Replicas
  const desired = spec.replicas || 0;
  const ready = status.readyReplicas || 0;
  const available = status.availableReplicas || 0;
  const updated = status.updatedReplicas || 0;

  summary.push(
    `• Replicas: ${ready}/${desired} ready, ${available}/${desired} available, ${updated}/${desired} updated`
  );
  summary.push(`• Strategy: ${spec.strategy?.type || 'Unknown'}`);

  // Selector
  if (spec.selector?.matchLabels) {
    summary.push(
      `• Selector: ${Object.entries(spec.selector.matchLabels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`
    );
  }

  // Template info
  if (spec.template?.spec?.containers) {
    summary.push(`• Containers (${spec.template.spec.containers.length}):`);
    spec.template.spec.containers.forEach((container: any) => {
      summary.push(`  - ${container.name}: ${container.image}`);
      if (container.ports && container.ports.length > 0) {
        summary.push(
          `    Ports: ${container.ports.map((p: any) => `${p.containerPort}/${p.protocol || 'TCP'}`).join(', ')}`
        );
      }
    });
  }

  // Conditions
  if (status.conditions && status.conditions.length > 0) {
    summary.push(`• Conditions:`);
    status.conditions.forEach((condition: any) => {
      summary.push(`  - ${condition.type}: ${condition.status} (${condition.reason || 'N/A'})`);
    });
  }

  return summary;
}

function generateServiceSummary(spec: any, status: any): string[] {
  const summary: string[] = [];
  summary.push(`🌐 SERVICE DETAILS`);

  summary.push(`• Type: ${spec.type || 'ClusterIP'}`);
  summary.push(`• Cluster IP: ${spec.clusterIP || 'None'}`);

  // Ports
  if (spec.ports && spec.ports.length > 0) {
    summary.push(`• Ports:`);
    spec.ports.forEach((port: any) => {
      summary.push(
        `  - ${port.name || 'unnamed'}: ${port.port}:${port.targetPort}/${port.protocol || 'TCP'}`
      );
    });
  }

  // Selector
  if (spec.selector) {
    summary.push(
      `• Selector: ${Object.entries(spec.selector)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`
    );
  }

  // External IPs
  if (spec.externalIPs && spec.externalIPs.length > 0) {
    summary.push(`• External IPs: ${spec.externalIPs.join(', ')}`);
  }

  return summary;
}

function generateRouteSummary(spec: any, status: any): string[] {
  const summary: string[] = [];
  summary.push(`🛣️ ROUTE DETAILS`);

  summary.push(`• Host: ${spec.host || 'Not set'}`);
  summary.push(`• TLS: ${spec.tls ? `${spec.tls.termination} termination` : 'No TLS'}`);
  summary.push(`• Target Service: ${spec.to?.name || 'Unknown'}`);
  summary.push(`• Target Port: ${spec.port?.targetPort || 'Default'}`);

  // Path
  if (spec.path) {
    summary.push(`• Path: ${spec.path}`);
  }

  // Ingress status
  if (status.ingress && status.ingress.length > 0) {
    const ingress = status.ingress[0];
    summary.push(
      `• Status: ${ingress.conditions?.[0]?.status === 'True' ? 'Admitted' : 'Pending'}`
    );
    if (ingress.routerCanonicalHostname) {
      summary.push(`• Router: ${ingress.routerCanonicalHostname}`);
    }
  }

  return summary;
}

function generateConfigMapSummary(data: any): string[] {
  const summary: string[] = [];
  summary.push(`📄 CONFIGMAP DETAILS`);

  if (data && Object.keys(data).length > 0) {
    summary.push(`• Data Keys (${Object.keys(data).length}):`);
    Object.entries(data).forEach(([key, value]: [string, any]) => {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      const truncated = valueStr.length > 100 ? `${valueStr.substring(0, 100)}...` : valueStr;
      summary.push(`  - ${key}: ${truncated.split('\n')[0]}`);
    });
  } else {
    summary.push(`• Data: No data keys`);
  }

  return summary;
}

function generateSecretSummary(data: any): string[] {
  const summary: string[] = [];
  summary.push(`🔐 SECRET DETAILS`);

  if (data && Object.keys(data).length > 0) {
    summary.push(`• Data Keys (${Object.keys(data).length}):`);
    Object.keys(data).forEach((key: string) => {
      summary.push(`  - ${key}: [REDACTED]`);
    });
  } else {
    summary.push(`• Data: No data keys`);
  }

  return summary;
}

function generatePVCSummary(spec: any, status: any): string[] {
  const summary: string[] = [];
  summary.push(`💾 PERSISTENT VOLUME CLAIM DETAILS`);

  summary.push(`• Status: ${status.phase || 'Unknown'}`);
  summary.push(`• Storage Class: ${spec.storageClassName || 'Default'}`);
  summary.push(`• Access Modes: ${spec.accessModes ? spec.accessModes.join(', ') : 'Unknown'}`);

  if (spec.resources?.requests?.storage) {
    summary.push(`• Requested Storage: ${spec.resources.requests.storage}`);
  }

  if (status.capacity?.storage) {
    summary.push(`• Actual Storage: ${status.capacity.storage}`);
  }

  if (status.volumeName) {
    summary.push(`• Volume: ${status.volumeName}`);
  }

  return summary;
}

function generateGenericSummary(spec: any, status: any): string[] {
  const summary: string[] = [];
  summary.push(`📦 RESOURCE DETAILS`);

  // Show key spec fields
  if (spec && Object.keys(spec).length > 0) {
    summary.push(`• Specification:`);
    Object.entries(spec)
      .slice(0, 5)
      .forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object') {
          summary.push(`  - ${key}: [Object with ${Object.keys(value).length} properties]`);
        } else {
          summary.push(`  - ${key}: ${value}`);
        }
      });
  }

  // Show key status fields
  if (status && Object.keys(status).length > 0) {
    summary.push(`• Status:`);
    Object.entries(status)
      .slice(0, 5)
      .forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object') {
          summary.push(`  - ${key}: [Object with ${Object.keys(value).length} properties]`);
        } else {
          summary.push(`  - ${key}: ${value}`);
        }
      });
  }

  return summary;
}
