import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcDeleteSchema, type OcDeleteParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocDeleteTool: Tool = {
  name: 'oc_delete',
  description:
    'Delete OpenShift resources with comprehensive safety checks, validation, and error handling',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        description: 'Type of resource to delete (required if not using manifest/filename)',
      },
      name: {
        type: 'string',
        description: 'Name of the resource to delete',
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
      manifest: {
        type: 'string',
        description: 'YAML manifest defining resources to delete',
      },
      filename: {
        type: 'string',
        description: 'Path to YAML file to delete resources from',
      },
      url: {
        type: 'string',
        description: 'URL to YAML manifest defining resources to delete',
      },
      labelSelector: {
        type: 'string',
        description: 'Delete resources matching label selector',
      },
      fieldSelector: {
        type: 'string',
        description: 'Delete resources matching field selector',
      },
      all: {
        type: 'boolean',
        default: false,
        description: 'Delete all resources of the specified type',
      },
      allNamespaces: {
        type: 'boolean',
        default: false,
        description: 'Delete resources across all namespaces',
      },
      force: {
        type: 'boolean',
        default: false,
        description: 'Force deletion (bypass finalizers)',
      },
      gracePeriodSeconds: {
        type: 'number',
        description: 'Grace period for deletion in seconds',
      },
      timeout: {
        type: 'string',
        description: 'Timeout for deletion operation (e.g., "60s", "5m")',
      },
      wait: {
        type: 'boolean',
        default: false,
        description: 'Wait for deletion to complete',
      },
      cascade: {
        type: 'string',
        enum: ['background', 'foreground', 'orphan'],
        default: 'background',
        description: 'Deletion cascade strategy',
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Show what would be deleted without actually deleting',
      },
      confirm: {
        type: 'boolean',
        default: false,
        description: 'Require explicit confirmation for destructive operations',
      },
      recursive: {
        type: 'boolean',
        default: false,
        description: 'Process directory recursively',
      },
      ignore404: {
        type: 'boolean',
        default: false,
        description: 'Ignore 404 errors if resource does not exist',
      },
    },
    required: [],
  },
};

export async function handleOcDelete(params: OcDeleteParams) {
  const manager = OpenShiftManager.getInstance();
  const progressLog: string[] = [];
  const startTime = Date.now();

  // Helper function to add progress logs with timestamps
  function addProgress(message: string, level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    progressLog.push(`[${elapsed}s] ${level}: ${message}`);
  }

  try {
    const validated = OcDeleteSchema.parse(params);
    addProgress('🗑️  Starting delete operation');

    // Validate input parameters
    const validationResult = validateDeleteParameters(validated);
    if (!validationResult.valid) {
      addProgress(`❌ Parameter validation failed: ${validationResult.error}`, 'ERROR');
      return formatErrorResponse(
        progressLog,
        'Parameter validation failed',
        validationResult.error
      );
    }
    addProgress('✅ Parameters validated successfully');

    // Safety checks for destructive operations
    const safetyResult = await performSafetyChecks(manager, validated);
    if (!safetyResult.safe) {
      addProgress(`⚠️  Safety check failed: ${safetyResult.warning}`, 'WARNING');
      if (!validated.confirm && !validated.force) {
        addProgress('❌ Operation cancelled for safety. Use confirm=true to proceed', 'ERROR');
        return formatSafetyResponse(progressLog, safetyResult, validated);
      }
    }
    safetyResult.warnings.forEach(warning =>
      addProgress(`⚠️  Safety warning: ${warning}`, 'WARNING')
    );

    // Pre-delete resource discovery
    addProgress('🔍 Discovering resources to delete...');
    const resourcesToDelete = await discoverResources(manager, validated);
    if (resourcesToDelete.length === 0) {
      addProgress('📭 No resources found matching criteria', 'INFO');
      return formatNoResourcesResponse(progressLog, validated);
    }

    addProgress(`📦 Found ${resourcesToDelete.length} resource(s) to delete`);
    resourcesToDelete.forEach(resource =>
      addProgress(
        `  - ${resource.kind}/${resource.name} (${resource.namespace || 'cluster-scoped'})`
      )
    );

    // Execute dry run if requested
    if (validated.dryRun) {
      addProgress('🧪 Executing dry run (no actual deletion)...');
      return formatDryRunResponse(progressLog, resourcesToDelete, validated);
    }

    // Require confirmation for dangerous operations
    if (
      requiresConfirmation(validated, resourcesToDelete) &&
      !validated.confirm &&
      !validated.force
    ) {
      addProgress('⚠️  Dangerous operation detected - confirmation required', 'WARNING');
      return formatConfirmationResponse(progressLog, resourcesToDelete, validated);
    }

    // Build delete command
    addProgress('🔨 Building delete command...');
    const deleteCommand = buildDeleteCommand(validated);
    addProgress(`📝 Command: oc ${deleteCommand.join(' ')}`);

    // Execute the delete command
    addProgress('⚡ Executing delete operation...');
    const deleteResult = await manager.executeCommand(deleteCommand, {
      context: validated.context,
      input: validated.manifest,
    });

    if (!deleteResult.success) {
      addProgress(`❌ Delete operation failed: ${deleteResult.error}`, 'ERROR');
      const errorAnalysis = analyzeDeleteError(deleteResult.error || '', validated);
      return formatErrorResponse(
        progressLog,
        'Delete operation failed',
        deleteResult.error,
        errorAnalysis
      );
    }

    addProgress('✅ Delete operation completed successfully');

    // Parse delete results
    const deletedResources = parseDeleteResults(deleteResult.data);
    deletedResources.forEach(resource =>
      addProgress(`🗑️  Deleted: ${resource.kind}/${resource.name}`, 'SUCCESS')
    );

    // Wait for deletion completion if requested
    if (validated.wait) {
      addProgress('⏳ Waiting for deletion to complete...');
      const waitResult = await waitForDeletion(manager, deletedResources, validated);
      waitResult.forEach(result => addProgress(result.message, result.level));
    }

    // Post-delete validation
    addProgress('🔍 Performing post-delete validation...');
    const postValidationResult = await performPostDeleteValidation(
      manager,
      deletedResources,
      validated
    );
    postValidationResult.forEach(result => addProgress(result.message, result.level));

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    addProgress(`🎉 Delete operation completed successfully in ${totalTime}s`, 'SUCCESS');

    return formatSuccessResponse(progressLog, validated, deletedResources, deleteResult);
  } catch (error) {
    addProgress(
      `💥 Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      'ERROR'
    );
    return formatErrorResponse(
      progressLog,
      'Unexpected error occurred',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function validateDeleteParameters(params: OcDeleteParams): {
  valid: boolean;
  error?: string;
} {
  // Must have at least one way to identify resources
  if (!params.resourceType && !params.manifest && !params.filename && !params.url) {
    return {
      valid: false,
      error: 'Must specify resourceType, manifest, filename, or url',
    };
  }

  // If using resourceType, need either name, labelSelector, fieldSelector, or all=true
  if (
    params.resourceType &&
    !params.name &&
    !params.labelSelector &&
    !params.fieldSelector &&
    !params.all
  ) {
    return {
      valid: false,
      error:
        'When using resourceType, must specify name, labelSelector, fieldSelector, or all=true',
    };
  }

  // Cannot have multiple sources
  const sources = [params.manifest, params.filename, params.url].filter(Boolean);
  if (sources.length > 1) {
    return {
      valid: false,
      error: 'Cannot specify multiple sources (manifest, filename, url) - choose one',
    };
  }

  // Validate timeout format if provided
  if (params.timeout && !params.timeout.match(/^\d+[smh]$/)) {
    return {
      valid: false,
      error: 'Timeout must be in format: <number><unit> (e.g., "60s", "5m", "1h")',
    };
  }

  // Grace period validation
  if (params.gracePeriodSeconds !== undefined && params.gracePeriodSeconds < 0) {
    return {
      valid: false,
      error: 'Grace period must be >= 0 seconds',
    };
  }

  return { valid: true };
}

async function performSafetyChecks(
  manager: OpenShiftManager,
  params: OcDeleteParams
): Promise<{ safe: boolean; warning?: string; warnings: string[] }> {
  const warnings: string[] = [];
  let safe = true;
  let mainWarning: string | undefined;

  try {
    // Check for dangerous operations
    if (params.all && !params.labelSelector && !params.fieldSelector) {
      safe = false;
      mainWarning =
        'Attempting to delete ALL resources of type without selectors - extremely dangerous';
      warnings.push('Consider using labelSelector or fieldSelector to limit scope');
    }

    if (params.allNamespaces && (params.all || params.labelSelector)) {
      safe = false;
      mainWarning =
        'Attempting to delete resources across ALL namespaces - potentially destructive';
      warnings.push('Consider limiting to specific namespace');
    }

    // Check for system namespace operations
    const systemNamespaces = [
      'kube-system',
      'kube-public',
      'openshift',
      'openshift-monitoring',
      'openshift-operators',
    ];
    if (systemNamespaces.includes(params.namespace)) {
      safe = false;
      mainWarning = `Operating on system namespace '${params.namespace}' - can break cluster functionality`;
      warnings.push('System namespace operations require extreme caution');
    }

    // Check for critical resource types
    const criticalResourceTypes = [
      'node',
      'namespace',
      'clusterrole',
      'clusterrolebinding',
      'customresourcedefinition',
    ];
    if (params.resourceType && criticalResourceTypes.includes(params.resourceType.toLowerCase())) {
      safe = false;
      mainWarning = `Deleting critical resource type '${params.resourceType}' can impact cluster functionality`;
      warnings.push('Critical resource deletion requires careful consideration');
    }

    // Check for force deletion
    if (params.force) {
      warnings.push('Force deletion bypasses finalizers and may cause data loss');
    }
  } catch (error) {
    warnings.push(`Safety check error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { safe, warning: mainWarning, warnings };
}

async function discoverResources(
  manager: OpenShiftManager,
  params: OcDeleteParams
): Promise<Array<{ kind: string; name: string; namespace?: string }>> {
  const resources: Array<{ kind: string; name: string; namespace?: string }> = [];

  try {
    if (params.manifest || params.filename || params.url) {
      // For manifest-based deletion, we'd need to parse the YAML
      // For now, return a placeholder
      resources.push({ kind: 'Unknown', name: 'manifest-resources' });
    } else if (params.resourceType) {
      // Build get command to discover resources
      const getCommand = ['get', params.resourceType];

      if (params.name) {
        getCommand.push(params.name);
      }

      if (params.allNamespaces) {
        getCommand.push('--all-namespaces');
      } else if (params.namespace) {
        getCommand.push('-n', params.namespace);
      }

      if (params.labelSelector) {
        getCommand.push('-l', params.labelSelector);
      }

      if (params.fieldSelector) {
        getCommand.push('--field-selector', params.fieldSelector);
      }

      getCommand.push('-o', 'json');

      const getResult = await manager.executeCommand(getCommand, { context: params.context });

      if (getResult.success && getResult.data) {
        const data =
          typeof getResult.data === 'string' ? JSON.parse(getResult.data) : getResult.data;

        if (data.items) {
          // Multiple resources
          data.items.forEach((item: any) => {
            resources.push({
              kind: item.kind || params.resourceType || 'Unknown',
              name: item.metadata?.name || 'unknown',
              namespace: item.metadata?.namespace,
            });
          });
        } else if (data.metadata) {
          // Single resource
          resources.push({
            kind: data.kind || params.resourceType || 'Unknown',
            name: data.metadata?.name || 'unknown',
            namespace: data.metadata?.namespace,
          });
        }
      }
    }
  } catch (error) {
    // If discovery fails, we'll proceed with the deletion attempt
    // The actual delete command will provide the real error
  }

  return resources;
}

function requiresConfirmation(
  params: OcDeleteParams,
  resources: Array<{ kind: string; name: string; namespace?: string }>
): boolean {
  // Require confirmation for dangerous operations
  if (params.all || params.allNamespaces) return true;
  if (resources.length > 10) return true;
  if (params.force) return true;

  // Check for critical resource types
  const criticalTypes = ['namespace', 'node', 'clusterrole', 'persistentvolume'];
  if (resources.some(r => criticalTypes.includes(r.kind.toLowerCase()))) return true;

  return false;
}

function buildDeleteCommand(params: OcDeleteParams): string[] {
  const args = ['delete'];

  // Add resource type and name
  if (params.resourceType) {
    args.push(params.resourceType);
    if (params.name) {
      args.push(params.name);
    }
  }

  // Add source files
  if (params.manifest) {
    args.push('-f', '-');
  } else if (params.filename) {
    args.push('-f', params.filename);
  } else if (params.url) {
    // Validate URL for security
    if (!isValidManifestUrl(params.url)) {
      throw new Error('Invalid URL format. Only HTTPS URLs from trusted domains are allowed.');
    }
    args.push('-f', params.url);
  }

  // Add namespace options
  if (params.allNamespaces) {
    args.push('--all-namespaces');
  } else if (params.namespace) {
    args.push('-n', params.namespace);
  }

  // Add selectors
  if (params.labelSelector) {
    args.push('-l', params.labelSelector);
  }

  if (params.fieldSelector) {
    args.push('--field-selector', params.fieldSelector);
  }

  // Add flags
  if (params.all) {
    args.push('--all');
  }

  if (params.force) {
    args.push('--force');
  }

  if (params.gracePeriodSeconds !== undefined) {
    args.push('--grace-period', params.gracePeriodSeconds.toString());
  }

  if (params.timeout) {
    args.push('--timeout', params.timeout);
  }

  if (params.wait) {
    args.push('--wait');
  }

  if (params.cascade) {
    args.push('--cascade', params.cascade);
  }

  if (params.dryRun) {
    args.push('--dry-run=client');
  }

  if (params.recursive) {
    args.push('-R');
  }

  if (params.ignore404) {
    args.push('--ignore-not-found');
  }

  return args;
}

function parseDeleteResults(data: string): Array<{ kind: string; name: string; action: string }> {
  const resources: Array<{ kind: string; name: string; action: string }> = [];

  if (!data) return resources;

  // Parse oc delete output format: "resource/name deleted"
  const lines = data.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const match = line.match(/^([^\/]+)\/([^\s]+)\s+(deleted|not found)/);
    if (match) {
      const [, kind, name, action] = match;
      resources.push({
        kind: kind.charAt(0).toUpperCase() + kind.slice(1),
        name,
        action: action.charAt(0).toUpperCase() + action.slice(1),
      });
    }
  }

  return resources;
}

async function waitForDeletion(
  manager: OpenShiftManager,
  resources: Array<{ kind: string; name: string; action: string }>,
  params: OcDeleteParams
): Promise<Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }>> {
  const results: Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }> = [];

  for (const resource of resources) {
    if (resource.action === 'Deleted') {
      try {
        // Wait for resource to be fully deleted
        const waitCommand = [
          'wait',
          `${resource.kind.toLowerCase()}/${resource.name}`,
          '--for=delete',
        ];
        if (params.namespace) {
          waitCommand.push('-n', params.namespace);
        }
        if (params.timeout) {
          waitCommand.push('--timeout', params.timeout);
        }

        const waitResult = await manager.executeCommand(waitCommand, { context: params.context });
        if (waitResult.success) {
          results.push({
            message: `✅ ${resource.kind}/${resource.name} deletion completed`,
            level: 'SUCCESS',
          });
        } else {
          results.push({
            message: `⚠️  ${resource.kind}/${resource.name} deletion timeout: ${waitResult.error}`,
            level: 'WARNING',
          });
        }
      } catch (error) {
        results.push({
          message: `⚠️  Error waiting for ${resource.kind}/${resource.name} deletion: ${error}`,
          level: 'WARNING',
        });
      }
    }
  }

  return results;
}

async function performPostDeleteValidation(
  manager: OpenShiftManager,
  resources: Array<{ kind: string; name: string; action: string }>,
  params: OcDeleteParams
): Promise<Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }>> {
  const results: Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }> = [];

  try {
    // Verify resources are actually deleted
    for (const resource of resources.slice(0, 5)) {
      // Limit to first 5 to avoid too many API calls
      if (resource.action === 'Deleted') {
        const checkCommand = ['get', resource.kind.toLowerCase(), resource.name];
        if (params.namespace) {
          checkCommand.push('-n', params.namespace);
        }

        const checkResult = await manager.executeCommand(checkCommand, { context: params.context });
        if (!checkResult.success && checkResult.error?.includes('not found')) {
          results.push({
            message: `✅ Verified ${resource.kind}/${resource.name} is deleted`,
            level: 'SUCCESS',
          });
        } else if (checkResult.success) {
          results.push({
            message: `⚠️  ${resource.kind}/${resource.name} still exists (may be terminating)`,
            level: 'WARNING',
          });
        }
      }
    }

    if (resources.length > 5) {
      results.push({
        message: `📊 ${resources.length - 5} additional resources not individually verified`,
        level: 'INFO',
      });
    }
  } catch (error) {
    results.push({ message: `⚠️  Post-delete validation error: ${error}`, level: 'WARNING' });
  }

  return results;
}

function analyzeDeleteError(
  errorMessage: string,
  params: OcDeleteParams
): { category: string; suggestions: string[] } {
  const suggestions: string[] = [];
  let category = 'Unknown Error';

  if (errorMessage.includes('forbidden') || errorMessage.includes('Forbidden')) {
    category = 'Permission Error';
    suggestions.push('Check RBAC permissions for delete operations');
    suggestions.push(
      `Verify access: oc auth can-i delete ${params.resourceType || '<resource>'} -n ${params.namespace}`
    );
    suggestions.push('Contact cluster administrator for required permissions');
  } else if (errorMessage.includes('not found') || errorMessage.includes('NotFound')) {
    category = 'Resource Not Found';
    suggestions.push('Resource may have already been deleted');
    suggestions.push('Use ignore404=true to ignore missing resources');
    suggestions.push('Check resource name and namespace spelling');
  } else if (errorMessage.includes('finalizer') || errorMessage.includes('Finalizer')) {
    category = 'Finalizer Blocking Deletion';
    suggestions.push('Resource has finalizers preventing deletion');
    suggestions.push('Use force=true to bypass finalizers (dangerous)');
    suggestions.push('Check what controller owns the finalizer');
    suggestions.push(
      'Remove finalizers manually if safe: oc patch <resource> --type=merge -p \'{"metadata":{"finalizers":null}}\''
    );
  } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    category = 'Timeout Error';
    suggestions.push('Deletion operation timed out');
    suggestions.push('Increase timeout value or remove wait option');
    suggestions.push('Check if resource has finalizers or dependencies');
  } else if (errorMessage.includes('dependency') || errorMessage.includes('dependent')) {
    category = 'Dependency Error';
    suggestions.push('Resource has dependent resources preventing deletion');
    suggestions.push('Delete dependent resources first');
    suggestions.push('Use cascade=foreground to delete dependencies first');
  }

  return { category, suggestions };
}

function formatSuccessResponse(
  progressLog: string[],
  params: OcDeleteParams,
  resources: Array<{ kind: string; name: string; action: string }>,
  result: any
) {
  const response = [
    `# ✅ Delete Operation Successful`,
    ``,
    `## 📋 Operation Summary`,
    `- **Source**: ${params.manifest ? 'Inline manifest' : params.filename || params.url || 'Resource specification'}`,
    `- **Namespace**: ${params.namespace}`,
    `- **Resources Deleted**: ${resources.length}`,
    `- **Dry Run**: ${params.dryRun ? 'Yes' : 'No'}`,
    `- **Force**: ${params.force ? 'Yes' : 'No'}`,
    `- **Wait for Completion**: ${params.wait ? 'Yes' : 'No'}`,
    ``,
    `## 🗑️  Deleted Resources`,
    ...resources.map(r => `- **${r.action}**: ${r.kind}/${r.name}`),
    ``,
    `## 📝 Operation Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🔧 Useful Commands`,
    `\`\`\`bash`,
    `# Verify deletion`,
    `oc get ${params.resourceType || 'all'} -n ${params.namespace}`,
    ``,
    `# Check for stuck resources`,
    `oc get all -n ${params.namespace} | grep Terminating`,
    ``,
    `# Force delete stuck resources if needed`,
    `oc delete <resource> <name> --grace-period=0 --force -n ${params.namespace}`,
    `\`\`\``,
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n'),
      },
    ],
  };
}

function formatSafetyResponse(progressLog: string[], safetyResult: any, params: OcDeleteParams) {
  const response = [
    `# ⚠️  Dangerous Delete Operation Detected`,
    ``,
    `## 🚨 Safety Warning`,
    `**Warning**: ${safetyResult.warning}`,
    ``,
    `## 🛡️  Safety Concerns`,
    ...safetyResult.warnings.map((w: string) => `- ${w}`),
    ``,
    `## 📝 Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🎯 To Proceed Safely`,
    `1. **Review the warnings above carefully**`,
    `2. **Add confirm=true to acknowledge the risks**`,
    `3. **Consider using more specific selectors**`,
    `4. **Test with dryRun=true first**`,
    `5. **Have a backup/recovery plan ready**`,
    ``,
    `## 🔧 Safer Alternatives`,
    `- Use labelSelector to limit scope`,
    `- Use fieldSelector for more precise targeting`,
    `- Delete resources individually instead of bulk operations`,
    `- Use dryRun=true to preview what would be deleted`,
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n'),
      },
    ],
  };
}

function formatConfirmationResponse(
  progressLog: string[],
  resources: Array<{ kind: string; name: string; namespace?: string }>,
  params: OcDeleteParams
) {
  const response = [
    `# ⚠️  Confirmation Required for Delete Operation`,
    ``,
    `## 📦 Resources to be Deleted (${resources.length})`,
    ...resources
      .slice(0, 20)
      .map(r => `- ${r.kind}/${r.name} ${r.namespace ? `(${r.namespace})` : '(cluster-scoped)'}`),
    ...(resources.length > 20 ? [`- ... and ${resources.length - 20} more resources`] : []),
    ``,
    `## ⚠️  Confirmation Required Because`,
    `- ${requiresConfirmation(params, resources) ? 'Operation affects multiple resources or critical components' : 'Safety check triggered'}`,
    ``,
    `## 🎯 To Proceed`,
    `**Add confirm=true to your request to proceed with the deletion**`,
    ``,
    `Example:`,
    `\`\`\`json`,
    `{`,
    `  "name": "oc_delete",`,
    `  "arguments": {`,
    `    ...your current arguments...,`,
    `    "confirm": true`,
    `  }`,
    `}`,
    `\`\`\``,
    ``,
    `## 🧪 Alternative: Test First`,
    `Use dryRun=true to see what would be deleted without actually deleting`,
    ``,
    `## 📝 Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n'),
      },
    ],
  };
}

function formatDryRunResponse(
  progressLog: string[],
  resources: Array<{ kind: string; name: string; namespace?: string }>,
  params: OcDeleteParams
) {
  const response = [
    `# 🧪 Dry Run: Delete Operation Preview`,
    ``,
    `## 📦 Resources That Would Be Deleted (${resources.length})`,
    ...resources.map(
      r => `- ${r.kind}/${r.name} ${r.namespace ? `(${r.namespace})` : '(cluster-scoped)'}`
    ),
    ``,
    `## 📝 Dry Run Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🎯 Next Steps`,
    `1. Review the resources that would be deleted above`,
    `2. Remove dryRun=true to execute the deletion`,
    `3. Consider adding confirm=true for safety`,
    `4. Set up monitoring for the deletion process`,
    ``,
    `## 🔧 Execution Command`,
    `Remove dryRun parameter and add confirm=true to proceed with deletion`,
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n'),
      },
    ],
  };
}

function formatNoResourcesResponse(progressLog: string[], params: OcDeleteParams) {
  const response = [
    `# 📭 No Resources Found for Deletion`,
    ``,
    `## 🔍 Search Criteria`,
    `- **Resource Type**: ${params.resourceType || 'From manifest'}`,
    `- **Name**: ${params.name || 'Any'}`,
    `- **Namespace**: ${params.namespace}`,
    `- **Label Selector**: ${params.labelSelector || 'None'}`,
    `- **Field Selector**: ${params.fieldSelector || 'None'}`,
    ``,
    `## 📝 Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 💡 Possible Reasons`,
    `1. Resources may have already been deleted`,
    `2. Resource names or selectors may be incorrect`,
    `3. Resources may exist in a different namespace`,
    `4. Resources may not exist yet`,
    ``,
    `## 🔧 Troubleshooting`,
    `- Check resource existence: \`oc get ${params.resourceType || 'all'} -n ${params.namespace}\``,
    `- List all resources: \`oc get all -n ${params.namespace}\``,
    `- Check other namespaces: \`oc get ${params.resourceType || 'all'} --all-namespaces\``,
    `- Verify label selectors: \`oc get ${params.resourceType || 'all'} -l ${params.labelSelector || '<selector>'} -n ${params.namespace}\``,
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n'),
      },
    ],
  };
}

function formatErrorResponse(
  progressLog: string[],
  errorTitle: string,
  errorDetails?: string,
  errorAnalysis?: { category: string; suggestions: string[] }
) {
  const response = [
    `# ❌ Delete Operation Failed`,
    ``,
    `## 🚨 Error Details`,
    `**Error**: ${errorTitle}`,
    errorDetails ? `**Details**: ${errorDetails}` : '',
    ``,
    errorAnalysis ? `## 🔍 Error Analysis` : '',
    errorAnalysis ? `**Category**: ${errorAnalysis.category}` : '',
    errorAnalysis ? `` : '',
    errorAnalysis ? `## 💡 Suggested Solutions` : '',
    ...(errorAnalysis?.suggestions.map(s => `- ${s}`) || []),
    errorAnalysis ? `` : '',
    `## 📝 Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🔧 Troubleshooting Steps`,
    `1. Review the error details and progress log above`,
    `2. Check cluster connectivity: \`oc whoami\``,
    `3. Verify resource exists: \`oc get <resource> <name> -n <namespace>\``,
    `4. Check permissions: \`oc auth can-i delete <resource> -n <namespace>\``,
    `5. Check for finalizers: \`oc get <resource> <name> -o yaml | grep finalizers\``,
    `6. Consider using force=true for stuck resources (dangerous)`,
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: response.filter(line => line !== '').join('\n'),
      },
    ],
  };
}

function isValidManifestUrl(url: string): boolean {
  try {
    // Basic URL format validation
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return false;
    }

    // Parse the URL
    const parsedUrl = new URL(url.trim());
    
    // Only allow HTTPS for security
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    // Ensure hostname is present and valid
    if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
      return false;
    }

    // Block potentially malicious domains
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedDomains = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'metadata.google.internal',
      '169.254.169.254', // AWS metadata
    ];

    if (blockedDomains.some(blocked => hostname === blocked || hostname.endsWith('.' + blocked))) {
      return false;
    }

    // Block private IP ranges
    if (hostname.match(/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/)) {
      return false;
    }

    // Ensure pathname is present (not just a domain)
    if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
