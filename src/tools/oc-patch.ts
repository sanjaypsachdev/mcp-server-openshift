import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocPatchTool: Tool = {
  name: 'oc_patch',
  description:
    'Patch OpenShift resources with strategic merge, JSON merge, or JSON patch operations',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        description:
          'Type of resource to patch (pod, deployment, service, route, configmap, secret, etc.)',
        enum: [
          'pod',
          'pods',
          'deployment',
          'deployments',
          'deploy',
          'deploymentconfig',
          'deploymentconfigs',
          'dc',
          'service',
          'services',
          'svc',
          'route',
          'routes',
          'configmap',
          'configmaps',
          'cm',
          'secret',
          'secrets',
          'persistentvolumeclaim',
          'persistentvolumeclaims',
          'pvc',
          'persistentvolume',
          'persistentvolumes',
          'pv',
          'serviceaccount',
          'serviceaccounts',
          'sa',
          'role',
          'roles',
          'rolebinding',
          'rolebindings',
          'clusterrole',
          'clusterroles',
          'clusterrolebinding',
          'clusterrolebindings',
          'networkpolicy',
          'networkpolicies',
          'ingress',
          'ingresses',
          'horizontalpodautoscaler',
          'hpa',
          'job',
          'jobs',
          'cronjob',
          'cronjobs',
          'daemonset',
          'daemonsets',
          'ds',
          'statefulset',
          'statefulsets',
          'sts',
          'replicaset',
          'replicasets',
          'rs',
          'node',
          'nodes',
          'namespace',
          'namespaces',
          'ns',
          'imagestream',
          'imagestreams',
          'is',
          'buildconfig',
          'buildconfigs',
          'bc',
          'build',
          'builds',
        ],
      },
      name: {
        type: 'string',
        description: 'Name of the resource to patch',
      },
      patch: {
        type: 'string',
        description:
          'Patch content as JSON string or YAML. For strategic merge patch (default), provide the fields to update. For JSON patch, use RFC 6902 format.',
      },
      patchType: {
        type: 'string',
        description: 'Type of patch operation',
        enum: ['strategic', 'merge', 'json'],
        default: 'strategic',
      },
      namespace: {
        type: 'string',
        description:
          'Namespace/project for the resource (not required for cluster-scoped resources)',
        default: 'default',
      },
      context: {
        type: 'string',
        description: 'OpenShift context to use (optional)',
        default: '',
      },
      dryRun: {
        type: 'boolean',
        description: 'Perform a dry run without making actual changes',
        default: false,
      },
      force: {
        type: 'boolean',
        description: 'Force the patch operation, ignoring conflicts',
        default: false,
      },
      fieldManager: {
        type: 'string',
        description: 'Field manager name for server-side apply tracking',
        default: 'mcp-openshift-client',
      },
      subresource: {
        type: 'string',
        description: 'Subresource to patch (e.g., status, scale)',
        enum: ['status', 'scale', 'spec'],
      },
      recordHistory: {
        type: 'boolean',
        description: 'Record the patch operation in the resource annotation for rollback purposes',
        default: false,
      },
    },
    required: ['resourceType', 'name', 'patch'],
    additionalProperties: false,
  },
};

export interface OcPatchArgs {
  resourceType: string;
  name: string;
  patch: string;
  patchType?: 'strategic' | 'merge' | 'json';
  namespace?: string;
  context?: string;
  dryRun?: boolean;
  force?: boolean;
  fieldManager?: string;
  subresource?: string;
  recordHistory?: boolean;
}

export async function handleOcPatch(args: OcPatchArgs) {
  const manager = OpenShiftManager.getInstance();

  try {
    // Validate arguments
    const validationResult = validatePatchArgs(args);
    if (!validationResult.valid) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ **Validation Error**\n\n${validationResult.error}`,
          },
        ],
        isError: true,
      };
    }

    // Check if patch content is valid JSON/YAML
    let patchData: any;
    try {
      // Try parsing as JSON first
      patchData = JSON.parse(args.patch);
    } catch (jsonError) {
      // If JSON parsing fails, try YAML
      try {
        const yaml = await import('js-yaml');
        patchData = yaml.load(args.patch);
        if (patchData === null || patchData === undefined) {
          throw new Error('YAML parsing resulted in null/undefined');
        }
      } catch (yamlError) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ **Invalid Patch Format**\n\nPatch content must be valid JSON or YAML.\n\nJSON Error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}\nYAML Error: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Build the patch command
    const command = buildPatchCommand(args, patchData);

    // Execute the patch command
    const result = await manager.executeCommand(command, {
      context: args.context,
      timeout: 30000, // 30 second timeout for patch operations
    });

    if (!result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ **Patch Operation Failed**\n\n**Resource**: ${args.resourceType}/${args.name}\n**Namespace**: ${args.namespace || 'cluster-scoped'}\n**Patch Type**: ${args.patchType || 'strategic'}\n\n**Error Details**:\n\`\`\`\n${result.error}\n\`\`\`\n\n**Troubleshooting Tips**:\n- Verify the resource exists: \`oc get ${args.resourceType} ${args.name}${args.namespace ? ` -n ${args.namespace}` : ''}\`\n- Check patch syntax and field names\n- Ensure you have proper permissions for the operation\n- For JSON patches, verify the path exists in the resource`,
          },
        ],
        isError: true,
      };
    }

    // Parse the result
    let patchedResource: any;
    try {
      patchedResource = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    } catch (parseError) {
      // If JSON parsing fails, treat as text output
      patchedResource = result.data;
    }

    // Format success response
    const responseText = formatPatchResponse(args, patchedResource, result.data);

    return {
      content: [
        {
          type: 'text' as const,
          text: responseText,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ **Unexpected Error During Patch Operation**\n\n**Resource**: ${args.resourceType}/${args.name}\n**Error**: ${errorMessage}\n\n**Please check**:\n- OpenShift CLI connectivity\n- Resource existence and permissions\n- Patch format and syntax`,
        },
      ],
      isError: true,
    };
  }
}

function validatePatchArgs(args: OcPatchArgs): { valid: boolean; error?: string } {
  // Check required fields
  if (!args.resourceType || !args.name || !args.patch) {
    return {
      valid: false,
      error: 'Missing required fields: resourceType, name, and patch are required.',
    };
  }

  // Validate resource type
  const validResourceTypes = [
    'pod',
    'pods',
    'deployment',
    'deployments',
    'deploy',
    'deploymentconfig',
    'deploymentconfigs',
    'dc',
    'service',
    'services',
    'svc',
    'route',
    'routes',
    'configmap',
    'configmaps',
    'cm',
    'secret',
    'secrets',
    'persistentvolumeclaim',
    'persistentvolumeclaims',
    'pvc',
    'persistentvolume',
    'persistentvolumes',
    'pv',
    'serviceaccount',
    'serviceaccounts',
    'sa',
    'role',
    'roles',
    'rolebinding',
    'rolebindings',
    'clusterrole',
    'clusterroles',
    'clusterrolebinding',
    'clusterrolebindings',
    'networkpolicy',
    'networkpolicies',
    'ingress',
    'ingresses',
    'horizontalpodautoscaler',
    'hpa',
    'job',
    'jobs',
    'cronjob',
    'cronjobs',
    'daemonset',
    'daemonsets',
    'ds',
    'statefulset',
    'statefulsets',
    'sts',
    'replicaset',
    'replicasets',
    'rs',
    'node',
    'nodes',
    'namespace',
    'namespaces',
    'ns',
    'imagestream',
    'imagestreams',
    'is',
    'buildconfig',
    'buildconfigs',
    'bc',
    'build',
    'builds',
  ];

  if (!validResourceTypes.includes(args.resourceType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid resource type: ${args.resourceType}. Must be one of: ${validResourceTypes.join(', ')}`,
    };
  }

  // Validate patch type
  if (args.patchType && !['strategic', 'merge', 'json'].includes(args.patchType)) {
    return {
      valid: false,
      error: `Invalid patch type: ${args.patchType}. Must be one of: strategic, merge, json`,
    };
  }

  // Validate subresource
  if (args.subresource && !['status', 'scale', 'spec'].includes(args.subresource)) {
    return {
      valid: false,
      error: `Invalid subresource: ${args.subresource}. Must be one of: status, scale, spec`,
    };
  }

  // Check for cluster-scoped resources
  const clusterScopedResources = [
    'node',
    'nodes',
    'persistentvolume',
    'persistentvolumes',
    'pv',
    'clusterrole',
    'clusterroles',
    'clusterrolebinding',
    'clusterrolebindings',
    'namespace',
    'namespaces',
    'ns',
  ];

  if (clusterScopedResources.includes(args.resourceType.toLowerCase()) && args.namespace) {
    return {
      valid: false,
      error: `Resource type ${args.resourceType} is cluster-scoped and does not require a namespace.`,
    };
  }

  return { valid: true };
}

function buildPatchCommand(args: OcPatchArgs, patchData: any): string[] {
  const command = ['patch', args.resourceType, args.name];

  // Add namespace if provided and resource is not cluster-scoped
  const clusterScopedResources = [
    'node',
    'nodes',
    'persistentvolume',
    'persistentvolumes',
    'pv',
    'clusterrole',
    'clusterroles',
    'clusterrolebinding',
    'clusterrolebindings',
    'namespace',
    'namespaces',
    'ns',
  ];

  if (!clusterScopedResources.includes(args.resourceType.toLowerCase()) && args.namespace) {
    command.push('-n', args.namespace);
  }

  // Add patch type
  const patchType = args.patchType || 'strategic';
  switch (patchType) {
    case 'strategic':
      command.push('--type', 'strategic');
      break;
    case 'merge':
      command.push('--type', 'merge');
      break;
    case 'json':
      command.push('--type', 'json');
      break;
  }

  // Add patch data
  command.push('-p', JSON.stringify(patchData));

  // Add subresource if specified
  if (args.subresource) {
    command.push('--subresource', args.subresource);
  }

  // Add dry run flag
  if (args.dryRun) {
    command.push('--dry-run=client');
  }

  // Add force flag
  if (args.force) {
    command.push('--force');
  }

  // Add field manager
  if (args.fieldManager) {
    command.push('--field-manager', args.fieldManager);
  }

  // Add record flag for history
  if (args.recordHistory) {
    command.push('--record');
  }

  // Always request JSON output for consistent parsing
  command.push('-o', 'json');

  return command;
}

function formatPatchResponse(args: OcPatchArgs, patchedResource: any, rawData: string): string {
  const isDryRun = args.dryRun ? ' (DRY RUN)' : '';

  let response = `✅ **Patch Operation Successful${isDryRun}**\n\n`;

  response += `**Resource Details**:\n`;
  response += `- **Type**: ${args.resourceType}\n`;
  response += `- **Name**: ${args.name}\n`;
  response += `- **Namespace**: ${args.namespace || 'cluster-scoped'}\n`;
  response += `- **Patch Type**: ${args.patchType || 'strategic'}\n`;

  if (args.subresource) {
    response += `- **Subresource**: ${args.subresource}\n`;
  }

  response += `\n`;

  // If we have structured data, show key information
  if (typeof patchedResource === 'object' && patchedResource !== null) {
    if (patchedResource.metadata) {
      response += `**Updated Resource Info**:\n`;
      response += `- **Resource Version**: ${patchedResource.metadata.resourceVersion || 'N/A'}\n`;
      response += `- **Generation**: ${patchedResource.metadata.generation || 'N/A'}\n`;

      if (patchedResource.metadata.labels) {
        const labelCount = Object.keys(patchedResource.metadata.labels).length;
        response += `- **Labels**: ${labelCount} labels\n`;
      }

      if (patchedResource.metadata.annotations) {
        const annotationCount = Object.keys(patchedResource.metadata.annotations).length;
        response += `- **Annotations**: ${annotationCount} annotations\n`;
      }
    }

    // Show status information if available
    if (patchedResource.status) {
      response += `\n**Status Information**:\n`;

      // Common status fields
      if (patchedResource.status.phase) {
        response += `- **Phase**: ${patchedResource.status.phase}\n`;
      }
      if (patchedResource.status.replicas !== undefined) {
        response += `- **Replicas**: ${patchedResource.status.replicas}/${patchedResource.status.readyReplicas || 0} ready\n`;
      }
      if (patchedResource.status.conditions && Array.isArray(patchedResource.status.conditions)) {
        const readyCondition = patchedResource.status.conditions.find(
          (c: any) => c.type === 'Ready' || c.type === 'Available'
        );
        if (readyCondition) {
          response += `- **Ready**: ${readyCondition.status} (${readyCondition.reason || 'N/A'})\n`;
        }
      }
    }

    response += `\n**Verification Commands**:\n`;
    response += `\`\`\`bash\n`;
    response += `# Check the patched resource\n`;
    response += `oc get ${args.resourceType} ${args.name}${args.namespace ? ` -n ${args.namespace}` : ''} -o yaml\n\n`;
    response += `# Describe for detailed information\n`;
    response += `oc describe ${args.resourceType} ${args.name}${args.namespace ? ` -n ${args.namespace}` : ''}\n`;
    response += `\`\`\`\n`;
  } else {
    // Fallback to raw output if parsing failed
    response += `**Raw Output**:\n\`\`\`\n${rawData}\n\`\`\`\n`;
  }

  // Add common patch examples
  response += `\n**Common Patch Examples**:\n`;
  response += `\`\`\`bash\n`;
  response += `# Strategic merge patch (default) - update labels\n`;
  response += `oc patch ${args.resourceType} ${args.name} -p '{"metadata":{"labels":{"environment":"production"}}}'\n\n`;
  response += `# JSON patch - add a label\n`;
  response += `oc patch ${args.resourceType} ${args.name} --type json -p '[{"op":"add","path":"/metadata/labels/new-label","value":"new-value"}]'\n\n`;
  response += `# Merge patch - update spec fields\n`;
  response += `oc patch ${args.resourceType} ${args.name} --type merge -p '{"spec":{"replicas":3}}'\n`;
  response += `\`\`\`\n`;

  return response;
}
