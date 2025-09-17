/**
 * Shared response formatting utilities for OpenShift tools
 * Provides consistent response structures for success and error cases
 */

import type { ProgressLogger, LogLevel } from './progress-logger.js';

export interface MCPResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface ErrorAnalysis {
  category: string;
  suggestions: string[];
}

export interface SuccessResponseOptions {
  title?: string;
  operationType?: string;
  resourceType?: string;
  resourceName?: string;
  namespace?: string;
  additionalSections?: Array<{
    title: string;
    content: string[];
  }>;
  commands?: Array<{
    description: string;
    command: string;
  }>;
  includeProgressLog?: boolean;
}

export interface ErrorResponseOptions {
  title?: string;
  operationType?: string;
  errorAnalysis?: ErrorAnalysis;
  troubleshootingSteps?: string[];
  includeProgressLog?: boolean;
}

/**
 * Format a successful operation response with consistent structure
 */
export function formatSuccessResponse(
  progressLog: string[] | ProgressLogger,
  options: SuccessResponseOptions
): MCPResponse {
  const {
    title = 'Operation Successful',
    operationType = 'Operation',
    resourceType,
    resourceName,
    namespace,
    additionalSections = [],
    commands = [],
    includeProgressLog = true,
  } = options;

  // Get progress log as string array
  const logEntries = Array.isArray(progressLog) 
    ? progressLog 
    : progressLog.getFormattedLog();

  const response: string[] = [
    `# ✅ ${title}`,
    ``,
  ];

  // Add operation summary if resource info provided
  if (resourceType || resourceName || namespace) {
    response.push(`## 📋 ${operationType} Summary`);
    if (resourceType && resourceName) {
      response.push(`- **Resource**: ${resourceType}/${resourceName}`);
    }
    if (namespace) {
      response.push(`- **Namespace**: ${namespace}`);
    }
    response.push(``);
  }

  // Add additional sections
  additionalSections.forEach(section => {
    response.push(`## ${section.title}`);
    response.push(...section.content);
    response.push(``);
  });

  // Add progress log
  if (includeProgressLog && logEntries.length > 0) {
    response.push(`## 📝 ${operationType} Progress Log`);
    response.push(`\`\`\``);
    response.push(...logEntries);
    response.push(`\`\`\``);
    response.push(``);
  }

  // Add useful commands
  if (commands.length > 0) {
    response.push(`## 🔧 Useful Commands`);
    response.push(`\`\`\`bash`);
    commands.forEach(cmd => {
      response.push(`# ${cmd.description}`);
      response.push(cmd.command);
      response.push(``);
    });
    response.push(`\`\`\``);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n'),
      },
    ],
  };
}

/**
 * Format an error response with consistent structure and troubleshooting guidance
 */
export function formatErrorResponse(
  progressLog: string[] | ProgressLogger,
  errorTitle: string,
  errorDetails?: string,
  options: ErrorResponseOptions = {}
): MCPResponse {
  const {
    title = 'Operation Failed',
    operationType = 'Operation',
    errorAnalysis,
    troubleshootingSteps = [],
    includeProgressLog = true,
  } = options;

  // Get progress log as string array
  const logEntries = Array.isArray(progressLog) 
    ? progressLog 
    : progressLog.getFormattedLog();

  const response: string[] = [
    `# ❌ ${title}`,
    ``,
    `## 🚨 Error Details`,
    `**Error**: ${errorTitle}`,
  ];

  if (errorDetails) {
    response.push(`**Details**: ${errorDetails}`);
  }
  response.push(``);

  // Add error analysis if provided
  if (errorAnalysis) {
    response.push(`## 🔍 Error Analysis`);
    response.push(`**Category**: ${errorAnalysis.category}`);
    response.push(``);
    response.push(`## 💡 Suggested Solutions`);
    response.push(...errorAnalysis.suggestions.map(s => `- ${s}`));
    response.push(``);
  }

  // Add progress log
  if (includeProgressLog && logEntries.length > 0) {
    response.push(`## 📝 Progress Log`);
    response.push(`\`\`\``);
    response.push(...logEntries);
    response.push(`\`\`\``);
    response.push(``);
  }

  // Add troubleshooting steps
  if (troubleshootingSteps.length > 0) {
    response.push(`## 🔧 Troubleshooting Steps`);
    troubleshootingSteps.forEach((step, index) => {
      response.push(`${index + 1}. ${step}`);
    });
  } else {
    // Default troubleshooting steps
    response.push(`## 🔧 Troubleshooting Steps`);
    response.push(`1. Review the error details and progress log above`);
    response.push(`2. Check cluster connectivity: \`oc whoami\``);
    response.push(`3. Verify resource permissions and existence`);
    response.push(`4. Check namespace access and quotas`);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: response.filter(line => line !== '').join('\n'),
      },
    ],
    isError: true,
  };
}

/**
 * Format a dry-run response
 */
export function formatDryRunResponse(
  progressLog: string[] | ProgressLogger,
  result: any,
  operationType: string = 'Operation'
): MCPResponse {
  const logEntries = Array.isArray(progressLog) 
    ? progressLog 
    : progressLog.getFormattedLog();

  const response = [
    `# 🧪 Dry Run Validation Successful`,
    ``,
    `## 📋 ${operationType} Preview`,
    `The following changes would be applied:`,
    ``,
    `\`\`\`yaml`,
    typeof result === 'string' ? result : JSON.stringify(result, null, 2),
    `\`\`\``,
    ``,
    `## 📝 Validation Log`,
    `\`\`\``,
    ...logEntries,
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

/**
 * Create standard troubleshooting steps for different operation types
 */
export function getStandardTroubleshootingSteps(operationType: 'apply' | 'delete' | 'get' | 'logs' | 'expose' | 'patch' | 'create', namespace?: string): string[] {
  const baseSteps = [
    'Review the error details and progress log above',
    'Check cluster connectivity: `oc whoami`',
  ];

  const namespaceParam = namespace || '<namespace>';

  switch (operationType) {
    case 'apply':
      return [
        ...baseSteps,
        'Validate YAML syntax: `oc apply --dry-run=client -f <file>`',
        `Check namespace permissions: \`oc auth can-i create <resource> -n ${namespaceParam}\``,
        'Verify resource dependencies and CRDs exist',
        `Check resource quotas and limits: \`oc describe quota -n ${namespaceParam}\``,
      ];

    case 'delete':
      return [
        ...baseSteps,
        `Check if resources exist: \`oc get <resource> -n ${namespaceParam}\``,
        `Verify delete permissions: \`oc auth can-i delete <resource> -n ${namespaceParam}\``,
        'Check for finalizers that may prevent deletion',
        'Review resource dependencies and cascading deletes',
      ];

    case 'get':
      return [
        ...baseSteps,
        `Verify resource type exists: \`oc api-resources | grep <resource>\``,
        `Check namespace access: \`oc auth can-i get <resource> -n ${namespaceParam}\``,
        'Verify resource names and selectors are correct',
      ];

    case 'logs':
      return [
        ...baseSteps,
        `Verify resource exists: \`oc get <resource> <name> -n ${namespaceParam}\``,
        `Check resource status: \`oc describe <resource> <name> -n ${namespaceParam}\``,
        `Verify container name (if specified): \`oc get <resource> <name> -o jsonpath='{.spec.containers[*].name}' -n ${namespaceParam}\``,
        `Verify namespace access: \`oc auth can-i get pods -n ${namespaceParam}\``,
      ];

    case 'expose':
      return [
        ...baseSteps,
        `Verify the source resource exists: \`oc get <resource-type> <name> -n ${namespaceParam}\``,
        `Check namespace permissions: \`oc auth can-i create routes -n ${namespaceParam}\``,
        'Verify TLS certificate files are readable and valid',
        'Check if a route with the same name already exists',
        'Ensure the target port exists on the source resource',
      ];

    case 'patch':
      return [
        ...baseSteps,
        `Verify the resource exists: \`oc get <resource> <name> -n ${namespaceParam}\``,
        'Check patch syntax and field names',
        'Ensure you have proper permissions for the operation',
        'For JSON patches, verify the path exists in the resource',
      ];

    case 'create':
      return [
        ...baseSteps,
        `Check namespace permissions: \`oc auth can-i create <resource> -n ${namespaceParam}\``,
        'Verify resource specification and required fields',
        'Check for naming conflicts with existing resources',
        `Check resource quotas: \`oc describe quota -n ${namespaceParam}\``,
      ];

    default:
      return [
        ...baseSteps,
        'Verify resource permissions and existence',
        'Check namespace access and quotas',
      ];
  }
}

/**
 * Analyze common OpenShift errors and provide categorized suggestions
 */
export function analyzeError(errorMessage: string, operationType?: string): ErrorAnalysis {
  const error = errorMessage.toLowerCase();

  // Permission errors
  if (error.includes('forbidden') || error.includes('unauthorized')) {
    return {
      category: 'Permission Error',
      suggestions: [
        'Check if you have the required permissions for this operation',
        'Verify your user/service account has the necessary RBAC roles',
        'Contact your cluster administrator for access',
        'Use `oc auth can-i <verb> <resource>` to check permissions',
      ],
    };
  }

  // Resource not found errors
  if (error.includes('not found') || error.includes('notfound')) {
    return {
      category: 'Resource Not Found',
      suggestions: [
        'Verify the resource name and type are correct',
        'Check if the resource exists in the specified namespace',
        'Ensure you are connected to the correct cluster',
        'Use `oc get <resource-type>` to list available resources',
      ],
    };
  }

  // Network/connectivity errors
  if (error.includes('connection refused') || error.includes('timeout') || error.includes('network')) {
    return {
      category: 'Connectivity Error',
      suggestions: [
        'Check your network connection to the OpenShift cluster',
        'Verify the cluster API endpoint is accessible',
        'Check if you are logged in: `oc whoami`',
        'Try logging in again: `oc login <cluster-url>`',
      ],
    };
  }

  // Validation errors
  if (error.includes('invalid') || error.includes('validation') || error.includes('schema')) {
    return {
      category: 'Validation Error',
      suggestions: [
        'Check the resource specification for syntax errors',
        'Verify all required fields are provided',
        'Use `oc apply --dry-run=client` to validate before applying',
        'Check the API version and resource schema documentation',
      ],
    };
  }

  // Quota/limit errors
  if (error.includes('quota') || error.includes('limit') || error.includes('exceeded')) {
    return {
      category: 'Resource Quota/Limit Error',
      suggestions: [
        'Check namespace resource quotas: `oc describe quota`',
        'Verify resource limits are not exceeded',
        'Consider reducing resource requests or increasing quotas',
        'Contact your cluster administrator about quota limits',
      ],
    };
  }

  // Conflict errors
  if (error.includes('conflict') || error.includes('already exists')) {
    return {
      category: 'Resource Conflict',
      suggestions: [
        'Check if a resource with the same name already exists',
        'Use a different name or delete the existing resource',
        'Consider using `oc apply` instead of `oc create` for updates',
        'Use `--force` flag if you want to override (use with caution)',
      ],
    };
  }

  // Default categorization
  return {
    category: 'General Error',
    suggestions: [
      'Review the error message for specific details',
      'Check cluster connectivity and authentication',
      'Verify resource names, types, and namespaces',
      'Consult OpenShift documentation for the specific operation',
    ],
  };
}

/**
 * Format a simple success message (for backward compatibility)
 */
export function formatSimpleSuccess(message: string): MCPResponse {
  return {
    content: [
      {
        type: 'text' as const,
        text: message,
      },
    ],
  };
}

/**
 * Format a simple error message (for backward compatibility)
 */
export function formatSimpleError(message: string): MCPResponse {
  return {
    content: [
      {
        type: 'text' as const,
        text: message,
      },
    ],
    isError: true,
  };
}
