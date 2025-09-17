/**
 * Base utility functions for OpenShift tools
 * Provides common patterns and workflows using shared utilities
 */

import { OpenShiftManager } from './openshift-manager.js';
import { createProgressLogger, type LogLevel } from './progress-logger.js';
import {
  formatSuccessResponse,
  formatErrorResponse,
  getStandardTroubleshootingSteps,
  analyzeError,
  type MCPResponse,
  type SuccessResponseOptions,
  type ErrorResponseOptions,
} from './response-formatter.js';
import { validateResourceForOperation } from './resource-helpers.js';
import {
  validateRequiredParams,
  validateMultiple,
  type ValidationResult,
} from './validation-helpers.js';

export interface ToolContext {
  manager: OpenShiftManager;
  logger: ReturnType<typeof createProgressLogger>;
}

export interface OperationOptions {
  operationType: string;
  resourceType?: string;
  resourceName?: string;
  namespace?: string;
  context?: string;
}

/**
 * Create a new tool context with progress logging
 */
export function createToolContext(): ToolContext {
  return {
    manager: OpenShiftManager.getInstance(),
    logger: createProgressLogger(),
  };
}

/**
 * Standard tool initialization pattern
 */
export function initializeTool(
  ctx: ToolContext,
  operationName: string,
  params: any,
  schema: any
): { success: true; validated: any } | { success: false; response: MCPResponse } {
  try {
    const validated = schema.parse(params);
    ctx.logger.addOperationStart(operationName);
    ctx.logger.addValidationStart();
    return { success: true, validated };
  } catch (error) {
    ctx.logger.addValidationError(error instanceof Error ? error.message : String(error));
    const errorAnalysis = analyzeError(error instanceof Error ? error.message : String(error));
    return {
      success: false,
      response: formatErrorResponse(
        ctx.logger,
        'Parameter validation failed',
        error instanceof Error ? error.message : String(error),
        {
          title: `${operationName} Failed`,
          operationType: operationName,
          errorAnalysis,
        }
      ),
    };
  }
}

/**
 * Standard resource verification pattern
 */
export async function verifyResource(
  ctx: ToolContext,
  resourceType: string,
  name: string,
  namespace: string,
  operationType: string,
  context?: string
): Promise<{ success: true; resourceInfo: any } | { success: false; response: MCPResponse }> {
  ctx.logger.addResourceVerification(resourceType, name);

  const validation = await validateResourceForOperation(
    ctx.manager,
    resourceType,
    name,
    namespace,
    operationType,
    context
  );

  if (!validation.valid) {
    ctx.logger.addResourceNotFound(resourceType, name, validation.error);
    const errorAnalysis = analyzeError(validation.error || 'Resource not found');
    return {
      success: false,
      response: formatErrorResponse(ctx.logger, 'Resource verification failed', validation.error, {
        title: `${operationType} Failed`,
        operationType,
        errorAnalysis,
        troubleshootingSteps: getStandardTroubleshootingSteps(
          operationType.toLowerCase() as any,
          namespace
        ),
      }),
    };
  }

  ctx.logger.addResourceVerified(resourceType, name);

  // Log any warnings
  if (validation.warnings) {
    validation.warnings.forEach(warning => ctx.logger.addProgress(`⚠️  ${warning}`, 'WARNING'));
  }

  return { success: true, resourceInfo: validation.resourceInfo };
}

/**
 * Standard success response pattern
 */
export function createSuccessResponse(
  ctx: ToolContext,
  options: SuccessResponseOptions
): MCPResponse {
  ctx.logger.addCompletion(options.operationType || 'Operation', true);
  return formatSuccessResponse(ctx.logger, options);
}

/**
 * Standard error response pattern
 */
export function createErrorResponse(
  ctx: ToolContext,
  errorTitle: string,
  errorDetails?: string,
  options: ErrorResponseOptions = {}
): MCPResponse {
  ctx.logger.addCompletion(options.operationType || 'Operation', false);

  const errorAnalysis = options.errorAnalysis || analyzeError(errorDetails || errorTitle);

  return formatErrorResponse(ctx.logger, errorTitle, errorDetails, {
    ...options,
    errorAnalysis,
    troubleshootingSteps: options.troubleshootingSteps || getStandardTroubleshootingSteps('create'), // default troubleshooting
  });
}

/**
 * Handle unexpected errors in a consistent way
 */
export function handleUnexpectedError(
  ctx: ToolContext,
  error: unknown,
  operationType: string = 'Operation'
): MCPResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  ctx.logger.addProgress(`💥 Unexpected error: ${errorMessage}`, 'ERROR');

  return createErrorResponse(ctx, 'Unexpected error occurred', errorMessage, {
    title: `${operationType} Failed`,
    operationType,
  });
}

/**
 * Validate parameters using multiple validation functions
 */
export function validateParameters(
  ctx: ToolContext,
  validations: Array<() => ValidationResult>,
  operationType: string = 'Operation'
): { success: true } | { success: false; response: MCPResponse } {
  const result = validateMultiple(validations);

  if (!result.valid) {
    ctx.logger.addValidationError(result.error!);
    return {
      success: false,
      response: createErrorResponse(ctx, 'Parameter validation failed', result.error, {
        title: `${operationType} Failed`,
        operationType,
      }),
    };
  }

  // Log any warnings
  if (result.warnings) {
    result.warnings.forEach(warning => ctx.logger.addProgress(`⚠️  ${warning}`, 'WARNING'));
  }

  return { success: true };
}

/**
 * Execute an operation with standard error handling
 */
export async function executeOperation<T>(
  ctx: ToolContext,
  operation: () => Promise<T>,
  operationType: string,
  onSuccess?: (result: T) => MCPResponse,
  onError?: (error: unknown) => MCPResponse
): Promise<MCPResponse> {
  try {
    const result = await operation();

    if (onSuccess) {
      return onSuccess(result);
    }

    return createSuccessResponse(ctx, {
      title: `${operationType} Successful`,
      operationType,
    });
  } catch (error) {
    if (onError) {
      return onError(error);
    }

    return handleUnexpectedError(ctx, error, operationType);
  }
}

/**
 * Common command execution pattern with progress logging
 */
export async function executeCommand(
  ctx: ToolContext,
  args: string[],
  description: string,
  options?: { context?: string; timeout?: number }
): Promise<{ success: boolean; data?: any; error?: string }> {
  ctx.logger.addProgress(`🔨 ${description}...`);
  ctx.logger.addProgress(`📝 Command: oc ${args.join(' ')}`);

  const result = await ctx.manager.executeCommand(args, options);

  if (result.success) {
    ctx.logger.addProgress(`✅ ${description} completed successfully`, 'SUCCESS');
  } else {
    ctx.logger.addProgress(`❌ ${description} failed: ${result.error}`, 'ERROR');
  }

  return result;
}
