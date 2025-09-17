/**
 * Example tool demonstrating the usage of shared utilities
 * This tool provides a comprehensive status check for OpenShift resources
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  createToolContext,
  initializeTool,
  verifyResource,
  createSuccessResponse,
  handleUnexpectedError,
  executeCommand,
} from '../utils/tool-base.js';
import {
  validateRequiredParams,
  validateResourceName,
  validateNamespace,
  validateResourceType,
} from '../utils/validation-helpers.js';
import {
  discoverResourceInfo,
  getResourceStatus,
  isClusterScopedResource,
} from '../utils/resource-helpers.js';

// Schema definition using Zod
const OcStatusSchema = z.object({
  resourceType: z.string().describe('Type of resource to check status for'),
  name: z.string().describe('Name of the resource'),
  namespace: z.string().optional().default('default').describe('OpenShift namespace/project'),
  context: z.string().optional().default('').describe('OpenShift context to use (optional)'),
  detailed: z.boolean().optional().default(false).describe('Include detailed information'),
});

export type OcStatusParams = z.infer<typeof OcStatusSchema>;

export const ocStatusTool: Tool = {
  name: 'oc_status',
  description: 'Check the comprehensive status of an OpenShift resource with detailed information',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        description: 'Type of resource to check status for',
      },
      name: {
        type: 'string',
        description: 'Name of the resource',
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
      detailed: {
        type: 'boolean',
        default: false,
        description: 'Include detailed information',
      },
    },
    required: ['resourceType', 'name'],
  },
};

export async function handleOcStatus(params: OcStatusParams) {
  const ctx = createToolContext();

  // Initialize tool with standard validation
  const init = initializeTool(ctx, 'Status Check', params, OcStatusSchema);
  if (!init.success) {
    return init.response;
  }
  const validated = init.validated;

  try {
    // Additional parameter validation using shared utilities
    const paramValidation = validateParameters(ctx, [
      () => validateRequiredParams(validated, ['resourceType', 'name']),
      () => validateResourceType(validated.resourceType),
      () => validateResourceName(validated.name),
      () =>
        isClusterScopedResource(validated.resourceType)
          ? { valid: true }
          : validateNamespace(validated.namespace),
    ]);

    if (!paramValidation.success) {
      return paramValidation.response;
    }

    // Determine namespace for the operation
    const namespace = isClusterScopedResource(validated.resourceType) ? '' : validated.namespace;

    // Verify resource exists using shared utility
    const resourceVerification = await verifyResource(
      ctx,
      validated.resourceType,
      validated.name,
      namespace,
      'Status Check',
      validated.context
    );

    if (!resourceVerification.success) {
      return resourceVerification.response;
    }

    // Get basic resource information
    ctx.logger.addProgress('📊 Gathering resource information...');
    const resourceInfo = resourceVerification.resourceInfo;

    // Get detailed resource discovery if requested
    let discoveryInfo = null;
    if (validated.detailed) {
      ctx.logger.addProgress('🔍 Performing detailed resource discovery...');
      discoveryInfo = await discoverResourceInfo(
        ctx.manager,
        validated.resourceType,
        validated.name,
        namespace,
        validated.context
      );
    }

    // Get resource events
    ctx.logger.addProgress('📋 Retrieving resource events...');
    const eventsResult = await executeCommand(
      ctx,
      [
        'get',
        'events',
        '--field-selector',
        `involvedObject.name=${validated.name}`,
        ...(namespace ? ['-n', namespace] : []),
        '--sort-by=.lastTimestamp',
        '--limit=5',
      ],
      'Retrieve recent events',
      { context: validated.context }
    );

    // Get resource description if detailed
    let descriptionResult = null;
    if (validated.detailed) {
      descriptionResult = await executeCommand(
        ctx,
        [
          'describe',
          validated.resourceType,
          validated.name,
          ...(namespace ? ['-n', namespace] : []),
        ],
        'Get detailed resource description',
        { context: validated.context }
      );
    }

    // Build response sections
    const additionalSections = [];

    // Basic resource information
    additionalSections.push({
      title: '📊 Resource Information',
      content: [
        `- **Type**: ${validated.resourceType}`,
        `- **Name**: ${validated.name}`,
        ...(namespace ? [`- **Namespace**: ${namespace}`] : []),
        `- **Status**: ${getResourceStatus(resourceInfo.data)}`,
        `- **Created**: ${resourceInfo.metadata?.creationTimestamp || 'Unknown'}`,
        `- **Resource Version**: ${resourceInfo.metadata?.resourceVersion || 'Unknown'}`,
      ],
    });

    // Labels and annotations
    if (resourceInfo.metadata?.labels || resourceInfo.metadata?.annotations) {
      const labelCount = Object.keys(resourceInfo.metadata?.labels || {}).length;
      const annotationCount = Object.keys(resourceInfo.metadata?.annotations || {}).length;

      additionalSections.push({
        title: '🏷️  Labels & Annotations',
        content: [
          `- **Labels**: ${labelCount} labels`,
          `- **Annotations**: ${annotationCount} annotations`,
        ],
      });
    }

    // Container information (if applicable)
    if (discoveryInfo?.containers && discoveryInfo.containers.length > 0) {
      additionalSections.push({
        title: '📦 Container Information',
        content: [
          `- **Containers**: ${discoveryInfo.containers.join(', ')}`,
          ...(discoveryInfo.ports
            ? [
                `- **Exposed Ports**: ${discoveryInfo.ports.map(p => `${p.port}/${p.protocol}`).join(', ')}`,
              ]
            : []),
        ],
      });
    }

    // Recent events
    if (eventsResult.success && eventsResult.data) {
      additionalSections.push({
        title: '📋 Recent Events',
        content: [
          '```',
          typeof eventsResult.data === 'string'
            ? eventsResult.data
            : JSON.stringify(eventsResult.data, null, 2),
          '```',
        ],
      });
    }

    // Detailed description (if requested)
    if (validated.detailed && descriptionResult?.success && descriptionResult.data) {
      additionalSections.push({
        title: '📝 Detailed Description',
        content: [
          '```',
          typeof descriptionResult.data === 'string'
            ? descriptionResult.data
            : JSON.stringify(descriptionResult.data, null, 2),
          '```',
        ],
      });
    }

    // Build useful commands
    const commands = [
      {
        description: 'Get resource details',
        command: `oc get ${validated.resourceType} ${validated.name}${namespace ? ` -n ${namespace}` : ''} -o yaml`,
      },
      {
        description: 'Watch resource changes',
        command: `oc get ${validated.resourceType} ${validated.name}${namespace ? ` -n ${namespace}` : ''} -w`,
      },
      {
        description: 'Get resource events',
        command: `oc get events --field-selector involvedObject.name=${validated.name}${namespace ? ` -n ${namespace}` : ''} --sort-by=.lastTimestamp`,
      },
    ];

    // Add logs command if resource has containers
    if (discoveryInfo?.containers && discoveryInfo.containers.length > 0) {
      commands.push({
        description: 'Get resource logs',
        command: `oc logs ${validated.resourceType}/${validated.name}${namespace ? ` -n ${namespace}` : ''}`,
      });
    }

    return createSuccessResponse(ctx, {
      title: 'Resource Status Retrieved Successfully',
      operationType: 'Status Check',
      resourceType: validated.resourceType,
      resourceName: validated.name,
      namespace,
      additionalSections,
      commands,
    });
  } catch (error) {
    return handleUnexpectedError(ctx, error, 'Status Check');
  }
}

// Helper function for parameter validation (demonstrating shared utility usage)
function validateParameters(
  ctx: any,
  validations: Array<() => any>
): { success: boolean; response?: any } {
  const results = validations.map(validation => validation());
  const errors = results.filter(result => !result.valid);

  if (errors.length > 0) {
    const errorMessage = errors.map(error => error.error).join('; ');
    ctx.logger.addValidationError(errorMessage);
    return {
      success: false,
      response: {
        content: [
          {
            type: 'text' as const,
            text: `❌ Parameter validation failed: ${errorMessage}`,
          },
        ],
        isError: true,
      },
    };
  }

  // Log any warnings
  const warnings = results.flatMap(result => result.warnings || []);
  warnings.forEach(warning => ctx.logger.addProgress(`⚠️  ${warning}`, 'WARNING'));

  return { success: true };
}
