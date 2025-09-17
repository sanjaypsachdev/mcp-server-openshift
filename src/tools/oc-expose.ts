import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcExposeSchema, type OcExposeParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';

export const ocExposeTool: Tool = {
  name: 'oc_expose',
  description:
    'Expose an OpenShift resource (service, deployment, etc.) with secure route endpoints supporting SSL/TLS termination',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        enum: ['service', 'svc', 'deploymentconfig', 'dc', 'deployment', 'deploy'],
        description: 'Resource type to expose (service, deploymentconfig, deployment)',
      },
      name: {
        type: 'string',
        description: 'Name of the resource to expose',
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
      routeName: {
        type: 'string',
        description: 'Name for the route (if not specified, derives from resource name)',
      },
      hostname: {
        type: 'string',
        description: 'Custom hostname for the route',
      },
      port: {
        type: 'string',
        description: 'Target port to expose (port name or number)',
      },
      path: {
        type: 'string',
        description: 'Path for the route (e.g., /api)',
      },
      routeType: {
        type: 'string',
        enum: ['edge', 'passthrough', 'reencrypt'],
        default: 'edge',
        description:
          'Type of secure route: edge (SSL termination at router), passthrough (SSL passthrough), reencrypt (SSL re-encryption)',
      },
      wildcardPolicy: {
        type: 'string',
        enum: ['None', 'Subdomain'],
        default: 'None',
        description: 'Wildcard policy for the route',
      },
      tlsTermination: {
        type: 'string',
        enum: ['edge', 'passthrough', 'reencrypt'],
        description: 'TLS termination type (deprecated, use routeType instead)',
      },
      certificate: {
        type: 'string',
        description: 'Path to TLS certificate file',
      },
      key: {
        type: 'string',
        description: 'Path to TLS private key file',
      },
      caCertificate: {
        type: 'string',
        description: 'Path to CA certificate file',
      },
      destinationCaCertificate: {
        type: 'string',
        description: 'Path to destination CA certificate file (for reencrypt)',
      },
      insecureEdgeTerminationPolicy: {
        type: 'string',
        enum: ['None', 'Allow', 'Redirect'],
        default: 'Redirect',
        description:
          'Policy for insecure traffic: None (reject), Allow (allow), Redirect (redirect to secure)',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels to apply to the route in KEY=VALUE format',
      },
      annotations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Annotations to apply to the route in KEY=VALUE format',
      },
      weight: {
        type: 'number',
        minimum: 0,
        maximum: 256,
        description: 'Weight for this route (0-256)',
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Show what would be created without actually creating it',
      },
    },
    required: ['resourceType', 'name'],
  },
};

export async function handleOcExpose(params: OcExposeParams) {
  const manager = OpenShiftManager.getInstance();
  const progressLog: string[] = [];
  const startTime = Date.now();

  // Helper function to add progress logs with timestamps
  function addProgress(message: string, status: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') {
    const timestamp = new Date().toISOString();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    progressLog.push(`[${elapsed}s] ${status}: ${message}`);
  }

  try {
    const validated = OcExposeSchema.parse(params);
    addProgress('🚀 Starting resource exposure process');
    addProgress(`📋 Parameters validated successfully`);

    // Use tlsTermination as fallback for routeType if provided
    const routeType = validated.routeType || validated.tlsTermination || 'edge';

    // Generate route name if not provided
    const routeName = validated.routeName || `${validated.name}-route`;

    addProgress(`📝 Resource: ${validated.resourceType}/${validated.name}`);
    addProgress(`🌐 Route name: ${routeName}`);
    addProgress(`🔒 Route type: ${routeType}`);
    addProgress(`📂 Namespace: ${validated.namespace}`);

    // Validate TLS certificates if provided (before resource verification)
    if (
      validated.certificate ||
      validated.key ||
      validated.caCertificate ||
      validated.destinationCaCertificate
    ) {
      addProgress(`🔐 Validating TLS certificates...`);
      const certValidation = validateTLSCertificates(validated);
      if (!certValidation.valid) {
        addProgress(`❌ Certificate validation failed: ${certValidation.error}`, 'ERROR');
        return formatErrorResponse(
          progressLog,
          'TLS certificate validation failed',
          certValidation.error
        );
      }
      addProgress(`✅ TLS certificates validated`, 'SUCCESS');
    }

    // Verify the source resource exists
    addProgress(`🔍 Verifying source resource exists...`);
    const resourceCheck = await verifyResourceExists(
      manager,
      validated.resourceType,
      validated.name,
      validated.namespace,
      validated.context
    );

    if (!resourceCheck.success) {
      addProgress(`❌ Source resource verification failed: ${resourceCheck.error}`, 'ERROR');
      return formatErrorResponse(progressLog, 'Source resource not found', resourceCheck.error);
    }
    addProgress(
      `✅ Source resource verified: ${validated.resourceType}/${validated.name}`,
      'SUCCESS'
    );

    // Get resource details for port detection if needed
    let targetPort = validated.port;
    if (!targetPort) {
      addProgress(`🔍 Auto-detecting target port...`);
      const portInfo = await detectTargetPort(
        manager,
        validated.resourceType,
        validated.name,
        validated.namespace,
        validated.context,
        resourceCheck.data
      );
      if (portInfo.port) {
        targetPort = portInfo.port;
        addProgress(`✅ Auto-detected port: ${targetPort}`, 'SUCCESS');
      } else {
        addProgress(`⚠️  Could not auto-detect port: ${portInfo.warning}`, 'WARNING');
      }
    }

    // Create the route
    addProgress(`🛣️  Creating ${routeType} route...`);
    const routeResult = await createSecureRoute(manager, validated, routeName, targetPort);

    if (!routeResult.success) {
      addProgress(`❌ Route creation failed: ${routeResult.error}`, 'ERROR');
      return formatErrorResponse(progressLog, 'Failed to create route', routeResult.error);
    }

    addProgress(`✅ Route created successfully`, 'SUCCESS');

    // Get the final route information
    addProgress(`🔍 Retrieving route information...`);
    const routeInfo = await getRouteInformation(
      manager,
      routeName,
      validated.namespace,
      validated.context
    );

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    addProgress(`🎉 Resource exposure completed in ${totalTime}s`, 'SUCCESS');

    return formatSuccessResponse(
      progressLog,
      validated,
      routeName,
      routeType,
      routeInfo,
      targetPort
    );
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

async function verifyResourceExists(
  manager: OpenShiftManager,
  resourceType: string,
  name: string,
  namespace: string,
  context?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const result = await manager.getResources(resourceType, namespace, name, {
      context,
      output: 'json',
    });

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error || 'Resource not found' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function detectTargetPort(
  manager: OpenShiftManager,
  resourceType: string,
  name: string,
  namespace: string,
  context?: string,
  resourceData?: any
): Promise<{ port?: string; warning?: string }> {
  try {
    let resource = resourceData;

    // If resource data wasn't provided, fetch it
    if (!resource) {
      const result = await manager.getResources(resourceType, namespace, name, {
        context,
        output: 'json',
      });

      if (!result.success) {
        return { warning: 'Could not retrieve resource details' };
      }

      resource = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    }

    // For services, get the first port
    if (resourceType === 'service' || resourceType === 'svc') {
      const ports = resource.spec?.ports;
      if (ports && ports.length > 0) {
        return { port: ports[0].name || ports[0].port?.toString() };
      }
    }

    // For deployments/deploymentconfigs, check container ports
    if (resourceType.includes('deployment')) {
      const containers = resource.spec?.template?.spec?.containers || resource.spec?.containers;
      if (containers && containers.length > 0 && containers[0].ports) {
        const firstPort = containers[0].ports[0];
        return { port: firstPort.name || firstPort.containerPort?.toString() };
      }
    }

    return { warning: 'No ports found in resource specification' };
  } catch (error) {
    return {
      warning: `Port detection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function validateTLSCertificates(params: OcExposeParams): { valid: boolean; error?: string } {
  try {
    // Check if certificate files exist and are readable
    if (params.certificate && !existsSync(params.certificate)) {
      return { valid: false, error: `Certificate file not found: ${params.certificate}` };
    }

    if (params.key && !existsSync(params.key)) {
      return { valid: false, error: `Private key file not found: ${params.key}` };
    }

    if (params.caCertificate && !existsSync(params.caCertificate)) {
      return { valid: false, error: `CA certificate file not found: ${params.caCertificate}` };
    }

    if (params.destinationCaCertificate && !existsSync(params.destinationCaCertificate)) {
      return {
        valid: false,
        error: `Destination CA certificate file not found: ${params.destinationCaCertificate}`,
      };
    }

    // Validate certificate and key are provided together for edge and reencrypt
    const routeType = params.routeType || params.tlsTermination || 'edge';
    if ((routeType === 'edge' || routeType === 'reencrypt') && (params.certificate || params.key)) {
      if (!params.certificate || !params.key) {
        return {
          valid: false,
          error: `Both certificate and private key are required for ${routeType} termination`,
        };
      }
    }

    // For reencrypt, destination CA certificate is recommended
    if (routeType === 'reencrypt' && !params.destinationCaCertificate) {
      // This is just a warning, not an error
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Certificate validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function createSecureRoute(
  manager: OpenShiftManager,
  params: OcExposeParams,
  routeName: string,
  targetPort?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const routeType = params.routeType || params.tlsTermination || 'edge';
    const args = ['create', 'route', routeType, routeName];

    // Add namespace
    args.push('-n', params.namespace);

    // Add service reference
    args.push('--service', params.name);

    // Add port if specified
    if (targetPort) {
      args.push('--port', targetPort);
    }

    // Add hostname if specified
    if (params.hostname) {
      args.push('--hostname', params.hostname);
    }

    // Add path if specified
    if (params.path) {
      args.push('--path', params.path);
    }

    // Add wildcard policy
    if (params.wildcardPolicy && params.wildcardPolicy !== 'None') {
      args.push('--wildcard-policy', params.wildcardPolicy);
    }

    // Add insecure edge termination policy
    if (
      params.insecureEdgeTerminationPolicy &&
      params.insecureEdgeTerminationPolicy !== 'Redirect'
    ) {
      args.push('--insecure-policy', params.insecureEdgeTerminationPolicy);
    }

    // Add TLS certificates
    if (params.certificate) {
      args.push('--cert', params.certificate);
    }

    if (params.key) {
      args.push('--key', params.key);
    }

    if (params.caCertificate) {
      args.push('--ca-cert', params.caCertificate);
    }

    if (params.destinationCaCertificate) {
      args.push('--dest-ca-cert', params.destinationCaCertificate);
    }

    // Add labels
    if (params.labels && params.labels.length > 0) {
      params.labels.forEach(label => {
        args.push('-l', label);
      });
    }

    // Add weight if specified
    if (params.weight !== undefined) {
      args.push('--weight', params.weight.toString());
    }

    // Add dry-run if specified
    if (params.dryRun) {
      args.push('--dry-run=client', '-o', 'yaml');
    }

    const result = await manager.executeCommand(args, { context: params.context });

    // If successful and not dry-run, add annotations if specified
    if (result.success && !params.dryRun && params.annotations && params.annotations.length > 0) {
      const annotateArgs = ['annotate', 'route', routeName, '-n', params.namespace];
      params.annotations.forEach(annotation => {
        annotateArgs.push(annotation);
      });

      await manager.executeCommand(annotateArgs, { context: params.context });
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getRouteInformation(
  manager: OpenShiftManager,
  routeName: string,
  namespace: string,
  context?: string
): Promise<any> {
  try {
    const result = await manager.getResources('route', namespace, routeName, {
      context,
      output: 'json',
    });

    if (result.success) {
      const route = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      return {
        name: route.metadata?.name,
        host: route.spec?.host,
        path: route.spec?.path || '/',
        tls: route.spec?.tls,
        wildcardPolicy: route.spec?.wildcardPolicy,
        to: route.spec?.to,
        port: route.spec?.port,
        status: route.status,
        url: `https://${route.spec?.host}${route.spec?.path || ''}`,
      };
    }
    return null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function formatSuccessResponse(
  progressLog: string[],
  params: OcExposeParams,
  routeName: string,
  routeType: string,
  routeInfo: any,
  targetPort?: string
) {
  const response = [
    `# 🎉 Resource Exposure Successful`,
    ``,
    `## 📋 Exposure Summary`,
    `- **Source Resource**: ${params.resourceType}/${params.name}`,
    `- **Namespace**: ${params.namespace}`,
    `- **Route Name**: ${routeName}`,
    `- **Route Type**: ${routeType} (secure)`,
    `- **Target Port**: ${targetPort || 'auto-detected'}`,
    ``,
  ];

  if (routeInfo && !routeInfo.error) {
    response.push(`## 🌐 Route Information`);
    const routeUrl = `https://${routeInfo.host}${routeInfo.path || ''}`;
    response.push(`- **URL**: ${routeUrl}`);
    response.push(`- **Host**: ${routeInfo.host}`);
    response.push(`- **Path**: ${routeInfo.path}`);
    if (routeInfo.tls) {
      response.push(`- **TLS Termination**: ${routeInfo.tls.termination}`);
      response.push(
        `- **Insecure Policy**: ${routeInfo.tls.insecureEdgeTerminationPolicy || 'Redirect'}`
      );
    }
    response.push(``);
  }

  response.push(`## 🔒 Security Features`);
  response.push(`- **SSL/TLS**: Enabled (${routeType} termination)`);
  response.push(`- **Insecure Traffic**: ${params.insecureEdgeTerminationPolicy || 'Redirect'}`);
  if (params.certificate) {
    response.push(`- **Custom Certificate**: Provided`);
  }
  if (params.wildcardPolicy !== 'None') {
    response.push(`- **Wildcard Policy**: ${params.wildcardPolicy}`);
  }
  response.push(``);

  response.push(`## 📝 Deployment Progress Log`);
  response.push(`\`\`\``);
  response.push(...progressLog);
  response.push(`\`\`\``);

  response.push(``);
  response.push(`## 🔧 Useful Commands`);
  response.push(`\`\`\`bash`);
  response.push(`# Check route status`);
  response.push(`oc get route ${routeName} -n ${params.namespace}`);
  response.push(``);
  response.push(`# View route details`);
  response.push(`oc describe route ${routeName} -n ${params.namespace}`);
  response.push(``);
  response.push(`# Test the endpoint`);
  if (routeInfo && !routeInfo.error) {
    const routeUrl = `https://${routeInfo.host}${routeInfo.path || ''}`;
    response.push(`curl -k ${routeUrl}`);
  } else {
    response.push(
      `# Get the route URL first: oc get route ${routeName} -n ${params.namespace} -o jsonpath='{.spec.host}'`
    );
  }
  response.push(``);
  response.push(`# Delete the route`);
  response.push(`oc delete route ${routeName} -n ${params.namespace}`);
  response.push(`\`\`\``);

  return {
    content: [
      {
        type: 'text' as const,
        text: response.join('\n'),
      },
    ],
  };
}

function formatErrorResponse(progressLog: string[], errorTitle: string, errorDetails?: string) {
  const response = [
    `# ❌ Resource Exposure Failed`,
    ``,
    `## 🚨 Error Details`,
    `**Error**: ${errorTitle}`,
    errorDetails ? `**Details**: ${errorDetails}` : '',
    ``,
    `## 📝 Progress Log`,
    `\`\`\``,
  ];

  response.push(...progressLog);
  response.push(`\`\`\``);

  response.push(``);
  response.push(`## 🔧 Troubleshooting Steps`);
  response.push(`1. Check the progress log above for specific error details`);
  response.push(
    `2. Verify the source resource exists: \`oc get <resource-type> <name> -n <namespace>\``
  );
  response.push(`3. Check namespace permissions: \`oc auth can-i create routes -n <namespace>\``);
  response.push(`4. Verify TLS certificate files are readable and valid`);
  response.push(`5. Check if a route with the same name already exists`);
  response.push(`6. Ensure the target port exists on the source resource`);

  return {
    content: [
      {
        type: 'text' as const,
        text: response.filter(line => line !== '').join('\n'),
      },
    ],
  };
}
