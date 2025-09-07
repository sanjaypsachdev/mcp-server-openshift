import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcApplySchema, type OcApplyParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocApplyTool: Tool = {
  name: 'oc_apply',
  description:
    'Apply YAML manifests to OpenShift cluster with comprehensive error handling and validation for all scenarios',
  inputSchema: {
    type: 'object',
    properties: {
      manifest: {
        type: 'string',
        description: 'YAML manifest content to apply',
      },
      filename: {
        type: 'string',
        description: 'Path to YAML file to apply',
      },
      url: {
        type: 'string',
        description: 'URL to YAML manifest to apply',
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
      dryRun: {
        type: 'boolean',
        default: false,
        description: "Validate only, don't apply (client or server)",
      },
      force: {
        type: 'boolean',
        default: false,
        description: 'Force apply, ignore conflicts',
      },
      validate: {
        type: 'boolean',
        default: true,
        description: 'Validate resources before applying',
      },
      wait: {
        type: 'boolean',
        default: false,
        description: 'Wait for resources to be ready',
      },
      timeout: {
        type: 'string',
        description: 'Timeout for wait operation (e.g., "60s", "5m")',
      },
      prune: {
        type: 'boolean',
        default: false,
        description: 'Prune resources not in current configuration',
      },
      pruneWhitelist: {
        type: 'array',
        items: { type: 'string' },
        description: 'Resource types to include in pruning',
      },
      selector: {
        type: 'string',
        description: 'Label selector for pruning',
      },
      recursive: {
        type: 'boolean',
        default: false,
        description: 'Process directory recursively',
      },
      kustomize: {
        type: 'boolean',
        default: false,
        description: 'Apply kustomization directory',
      },
      serverSideApply: {
        type: 'boolean',
        default: false,
        description: 'Use server-side apply',
      },
      fieldManager: {
        type: 'string',
        description: 'Field manager name for server-side apply',
      },
      overwrite: {
        type: 'boolean',
        default: false,
        description: 'Overwrite existing resources',
      },
      cascade: {
        type: 'string',
        enum: ['background', 'foreground', 'orphan'],
        description: 'Deletion cascade strategy',
      },
      gracePeriod: {
        type: 'number',
        description: 'Grace period for resource deletion (seconds)',
      },
    },
    required: [],
  },
};

export async function handleOcApply(params: OcApplyParams) {
  const manager = OpenShiftManager.getInstance();
  const progressLog: string[] = [];
  const startTime = Date.now();

  // Helper function to add progress logs with timestamps
  function addProgress(message: string, level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    progressLog.push(`[${elapsed}s] ${level}: ${message}`);
  }

  try {
    const validated = OcApplySchema.parse(params);
    addProgress('🚀 Starting oc apply operation');

    // Validate input parameters
    const validationResult = validateApplyParameters(validated);
    if (!validationResult.valid) {
      addProgress(`❌ Parameter validation failed: ${validationResult.error}`, 'ERROR');
      return formatErrorResponse(
        progressLog,
        'Parameter validation failed',
        validationResult.error,
        undefined,
        validated
      );
    }
    addProgress('✅ Parameters validated successfully');

    // Pre-apply validation
    if (validated.validate) {
      addProgress('🔍 Performing pre-apply validation...');
      const preValidationResult = await performPreApplyValidation(manager, validated);
      if (!preValidationResult.valid) {
        addProgress(`❌ Pre-apply validation failed: ${preValidationResult.error}`, 'ERROR');
        return formatErrorResponse(
          progressLog,
          'Pre-apply validation failed',
          preValidationResult.error,
          undefined,
          validated
        );
      }
      preValidationResult.warnings.forEach(warning =>
        addProgress(`⚠️  Validation warning: ${warning}`, 'WARNING')
      );
      addProgress('✅ Pre-apply validation passed');
    }

    // Build apply command
    addProgress('🔨 Building oc apply command...');
    const applyCommand = buildApplyCommand(validated);
    addProgress(`📝 Command: oc ${applyCommand.join(' ')}`);

    // Execute dry run if requested
    if (validated.dryRun) {
      addProgress('🧪 Executing dry run validation...');
      const dryRunResult = await executeDryRun(manager, validated, applyCommand);
      if (!dryRunResult.success) {
        addProgress(`❌ Dry run failed: ${dryRunResult.error}`, 'ERROR');
        return formatErrorResponse(
          progressLog,
          'Dry run validation failed',
          dryRunResult.error,
          undefined,
          validated
        );
      }
      addProgress('✅ Dry run validation successful');
      return formatDryRunResponse(progressLog, dryRunResult);
    }

    // Execute the apply command
    addProgress('⚡ Executing oc apply...');
    const applyResult = await manager.executeCommand(applyCommand, {
      context: validated.context,
      input: validated.manifest,
    });

    if (!applyResult.success) {
      addProgress(`❌ Apply operation failed: ${applyResult.error}`, 'ERROR');
      const errorAnalysis = analyzeApplyError(applyResult.error || '', validated);
      return formatErrorResponse(
        progressLog,
        'Apply operation failed',
        applyResult.error,
        errorAnalysis,
        validated
      );
    }

    addProgress('✅ Apply operation completed successfully');

    // Parse apply results
    const appliedResources = parseApplyResults(applyResult.data);
    appliedResources.forEach(resource =>
      addProgress(`📦 ${resource.action}: ${resource.kind}/${resource.name}`, 'SUCCESS')
    );

    // Wait for resources if requested
    if (validated.wait) {
      addProgress('⏳ Waiting for resources to be ready...');
      const waitResult = await waitForResources(manager, appliedResources, validated);
      waitResult.forEach(result => addProgress(result.message, result.level));
    }

    // Post-apply validation
    addProgress('🔍 Performing post-apply validation...');
    const postValidationResult = await performPostApplyValidation(
      manager,
      appliedResources,
      validated
    );
    postValidationResult.forEach(result => addProgress(result.message, result.level));

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    addProgress(`🎉 Apply operation completed successfully in ${totalTime}s`, 'SUCCESS');

    return formatSuccessResponse(progressLog, validated, appliedResources, applyResult);
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

function validateApplyParameters(params: OcApplyParams): { valid: boolean; error?: string } {
  // Must have at least one source (manifest, filename, or url)
  if (!params.manifest && !params.filename && !params.url) {
    return {
      valid: false,
      error: 'Must specify either manifest content, filename, or URL',
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

  // Server-side apply requires field manager
  if (params.serverSideApply && !params.fieldManager) {
    return {
      valid: false,
      error: 'Server-side apply requires fieldManager to be specified',
    };
  }

  return { valid: true };
}

async function performPreApplyValidation(
  manager: OpenShiftManager,
  params: OcApplyParams
): Promise<{ valid: boolean; error?: string; warnings: string[] }> {
  const warnings: string[] = [];

  try {
    // Check namespace exists
    if (params.namespace && params.namespace !== 'default') {
      const namespaceCheck = await manager.executeCommand(['get', 'namespace', params.namespace], {
        context: params.context,
      });
      if (!namespaceCheck.success) {
        warnings.push(
          `Namespace '${params.namespace}' does not exist - it will be created if resources require it`
        );
      }
    }

    // Check for resource conflicts if not forcing
    if (!params.force && params.manifest) {
      const conflictCheck = await checkResourceConflicts(manager, params);
      warnings.push(...conflictCheck.warnings);
      if (conflictCheck.hasConflicts && !params.force) {
        return {
          valid: false,
          error:
            'Resource conflicts detected. Use force=true to override, or resolve conflicts manually.',
          warnings,
        };
      }
    }

    // Validate YAML syntax
    if (params.manifest) {
      try {
        // Basic YAML validation - check for common syntax errors
        if (
          !params.manifest.trim().startsWith('apiVersion:') &&
          !params.manifest.trim().startsWith('---')
        ) {
          warnings.push('Manifest does not start with apiVersion - ensure proper YAML format');
        }
      } catch (error) {
        return {
          valid: false,
          error: `YAML syntax validation failed: ${error instanceof Error ? error.message : String(error)}`,
          warnings,
        };
      }
    }

    return { valid: true, warnings };
  } catch (error) {
    return {
      valid: false,
      error: `Pre-apply validation error: ${error instanceof Error ? error.message : String(error)}`,
      warnings,
    };
  }
}

async function checkResourceConflicts(
  manager: OpenShiftManager,
  params: OcApplyParams
): Promise<{ hasConflicts: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  let hasConflicts = false;

  try {
    // This is a simplified conflict check
    // In a real implementation, you'd parse the YAML and check each resource
    if (params.manifest && params.manifest.includes('name:')) {
      // Extract resource names and check if they exist
      const nameMatches = params.manifest.match(/name:\s*([^\s\n]+)/g);
      if (nameMatches) {
        for (const match of nameMatches.slice(0, 3)) {
          // Check first 3 resources to avoid too many calls
          const name = match.split(':')[1].trim();
          const checkResult = await manager.executeCommand(
            ['get', 'all', '-l', `app=${name}`, '-n', params.namespace],
            { context: params.context }
          );
          if (checkResult.success && checkResult.data && checkResult.data.trim()) {
            warnings.push(`Resource with name '${name}' may already exist`);
            hasConflicts = true;
          }
        }
      }
    }
  } catch (error) {
    warnings.push(
      `Conflict check error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { hasConflicts, warnings };
}

function buildApplyCommand(params: OcApplyParams): string[] {
  const args = ['apply'];

  // Add namespace
  if (params.namespace) {
    args.push('-n', params.namespace);
  }

  // Add source
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

  // Add options
  if (params.dryRun) {
    args.push('--dry-run=client');
  }

  if (params.force) {
    args.push('--force');
  }

  if (!params.validate) {
    args.push('--validate=false');
  }

  if (params.wait) {
    args.push('--wait');
    if (params.timeout) {
      args.push('--timeout', params.timeout);
    }
  }

  if (params.prune) {
    args.push('--prune');
    if (params.selector) {
      args.push('-l', params.selector);
    }
    if (params.pruneWhitelist && params.pruneWhitelist.length > 0) {
      args.push('--prune-whitelist', params.pruneWhitelist.join(','));
    }
  }

  if (params.recursive) {
    args.push('-R');
  }

  if (params.kustomize) {
    args.push('-k');
  }

  if (params.serverSideApply) {
    args.push('--server-side');
    if (params.fieldManager) {
      args.push('--field-manager', params.fieldManager);
    }
  }

  if (params.overwrite) {
    args.push('--overwrite');
  }

  if (params.cascade) {
    args.push('--cascade', params.cascade);
  }

  if (params.gracePeriod !== undefined) {
    args.push('--grace-period', params.gracePeriod.toString());
  }

  return args;
}

async function executeDryRun(
  manager: OpenShiftManager,
  params: OcApplyParams,
  command: string[]
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const result = await manager.executeCommand(command, {
      context: params.context,
      input: params.manifest,
    });
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseApplyResults(
  data: string
): Array<{ kind: string; name: string; action: string; namespace?: string }> {
  const resources: Array<{ kind: string; name: string; action: string; namespace?: string }> = [];

  if (!data) return resources;

  // Parse oc apply output format: "resource/name created|configured|unchanged"
  const lines = data.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const match = line.match(/^([^\/]+)\/([^\s]+)\s+(created|configured|unchanged|deleted)/);
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

async function waitForResources(
  manager: OpenShiftManager,
  resources: Array<{ kind: string; name: string; action: string }>,
  params: OcApplyParams
): Promise<Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }>> {
  const results: Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }> = [];

  for (const resource of resources) {
    if (resource.action === 'Created' || resource.action === 'Configured') {
      try {
        // Wait for specific resource types that have readiness concepts
        if (['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind)) {
          const waitCommand = [
            'wait',
            `${resource.kind.toLowerCase()}/${resource.name}`,
            '--for=condition=Available',
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
              message: `✅ ${resource.kind}/${resource.name} is ready`,
              level: 'SUCCESS',
            });
          } else {
            results.push({
              message: `⚠️  ${resource.kind}/${resource.name} not ready: ${waitResult.error}`,
              level: 'WARNING',
            });
          }
        } else {
          results.push({
            message: `📦 ${resource.kind}/${resource.name} applied (no readiness check available)`,
            level: 'INFO',
          });
        }
      } catch (error) {
        results.push({
          message: `⚠️  Error waiting for ${resource.kind}/${resource.name}: ${error}`,
          level: 'WARNING',
        });
      }
    }
  }

  return results;
}

async function performPostApplyValidation(
  manager: OpenShiftManager,
  resources: Array<{ kind: string; name: string; action: string }>,
  params: OcApplyParams
): Promise<Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }>> {
  const results: Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }> = [];

  try {
    // Check if resources were actually created/updated
    for (const resource of resources.slice(0, 5)) {
      // Limit to first 5 to avoid too many API calls
      const checkCommand = ['get', resource.kind.toLowerCase(), resource.name];
      if (params.namespace) {
        checkCommand.push('-n', params.namespace);
      }

      const checkResult = await manager.executeCommand(checkCommand, { context: params.context });
      if (checkResult.success) {
        results.push({
          message: `✅ Verified ${resource.kind}/${resource.name} exists`,
          level: 'SUCCESS',
        });
      } else {
        results.push({
          message: `⚠️  Could not verify ${resource.kind}/${resource.name}: ${checkResult.error}`,
          level: 'WARNING',
        });
      }
    }

    if (resources.length > 5) {
      results.push({
        message: `📊 ${resources.length - 5} additional resources not individually verified`,
        level: 'INFO',
      });
    }
  } catch (error) {
    results.push({ message: `⚠️  Post-apply validation error: ${error}`, level: 'WARNING' });
  }

  return results;
}

function analyzeApplyError(
  errorMessage: string,
  params: OcApplyParams
): { category: string; suggestions: string[] } {
  const suggestions: string[] = [];
  let category = 'Unknown Error';

  if (errorMessage.includes('forbidden') || errorMessage.includes('Forbidden')) {
    category = 'Permission Error';
    suggestions.push('Check RBAC permissions for the current user');
    suggestions.push(`Verify access: oc auth can-i create <resource> -n ${params.namespace}`);
    suggestions.push('Contact cluster administrator for required permissions');
  } else if (errorMessage.includes('already exists') || errorMessage.includes('AlreadyExists')) {
    category = 'Resource Conflict';
    suggestions.push('Resource already exists - use force=true to overwrite');
    suggestions.push('Check existing resources: oc get all -n ' + params.namespace);
    suggestions.push('Consider using server-side apply for better conflict resolution');
  } else if (errorMessage.includes('invalid') || errorMessage.includes('Invalid')) {
    category = 'Validation Error';
    suggestions.push('Check YAML syntax and resource schema');
    suggestions.push('Validate with: oc apply --dry-run=client');
    suggestions.push('Verify API version and resource kind are correct');
  } else if (errorMessage.includes('not found') || errorMessage.includes('NotFound')) {
    category = 'Resource Not Found';
    suggestions.push('Check if namespace exists: oc get namespace ' + params.namespace);
    suggestions.push('Verify resource dependencies exist');
    suggestions.push('Check if CRDs are installed for custom resources');
  } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    category = 'Timeout Error';
    suggestions.push('Increase timeout value or remove wait option');
    suggestions.push('Check cluster connectivity and performance');
    suggestions.push('Apply without waiting and monitor separately');
  } else if (errorMessage.includes('quota') || errorMessage.includes('Quota')) {
    category = 'Resource Quota Exceeded';
    suggestions.push('Check resource quotas: oc get resourcequota -n ' + params.namespace);
    suggestions.push('Request quota increase or reduce resource requirements');
    suggestions.push('Check limit ranges: oc get limitrange -n ' + params.namespace);
  }

  return { category, suggestions };
}

function formatSuccessResponse(
  progressLog: string[],
  params: OcApplyParams,
  resources: Array<{ kind: string; name: string; action: string }>,
  result: any
) {
  const response = [
    `# ✅ Apply Operation Successful`,
    ``,
    `## 📋 Operation Summary`,
    `- **Source**: ${params.manifest ? 'Inline manifest' : params.filename || params.url}`,
    `- **Namespace**: ${params.namespace}`,
    `- **Resources Applied**: ${resources.length}`,
    `- **Dry Run**: ${params.dryRun ? 'Yes' : 'No'}`,
    `- **Wait for Ready**: ${params.wait ? 'Yes' : 'No'}`,
    ``,
    `## 📦 Applied Resources`,
    ...resources.map(r => `- **${r.action}**: ${r.kind}/${r.name}`),
    ``,
    `## 📝 Operation Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🔧 Useful Commands`,
    `\`\`\`bash`,
    `# Check applied resources`,
    `oc get all -n ${params.namespace}`,
    ``,
    `# Monitor resource status`,
    `oc get events -n ${params.namespace} --sort-by='.lastTimestamp'`,
    ``,
    `# Rollback if needed`,
    `oc delete -f <same-file-or-manifest>`,
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

function formatDryRunResponse(progressLog: string[], result: any) {
  const response = [
    `# 🧪 Dry Run Validation Successful`,
    ``,
    `## 📋 Validation Results`,
    `The resources would be applied successfully without errors.`,
    ``,
    `## 📝 Validation Progress Log`,
    `\`\`\``,
    ...progressLog,
    `\`\`\``,
    ``,
    `## 🎯 Next Steps`,
    `1. Review the validation results above`,
    `2. Remove dryRun=true to apply the resources`,
    `3. Consider using wait=true to monitor resource readiness`,
    `4. Set up monitoring for applied resources`,
    ``,
    `## 📊 Dry Run Output`,
    `\`\`\``,
    result.data || 'No additional output',
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

function formatErrorResponse(
  progressLog: string[],
  errorTitle: string,
  errorDetails?: string,
  errorAnalysis?: { category: string; suggestions: string[] },
  params?: OcApplyParams
) {
  const response = [
    `# ❌ Apply Operation Failed`,
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
    `3. Validate YAML syntax: \`oc apply --dry-run=client -f <file>\``,
    `4. Check namespace permissions: \`oc auth can-i create <resource> -n ${params?.namespace || '<namespace>'}\``,
    `5. Verify resource dependencies and CRDs exist`,
    `6. Check resource quotas and limits: \`oc describe quota -n ${params?.namespace || '<namespace>'}\``,
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
