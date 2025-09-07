import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcNewAppSchema, type OcNewAppParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocNewAppTool: Tool = {
  name: 'oc_new_app',
  description:
    'Create a new application from a GitHub repository using S2I build and expose it with an edge-terminated route',
  inputSchema: {
    type: 'object',
    properties: {
      gitRepo: {
        type: 'string',
        format: 'uri',
        description: 'GitHub repository URL for the source code',
      },
      appName: {
        type: 'string',
        description: 'Name for the application (if not specified, derives from repo name)',
      },
      namespace: {
        type: 'string',
        default: 'default',
        description: 'Target namespace for the application',
      },
      context: {
        type: 'string',
        default: '',
        description: 'OpenShift context to use (optional)',
      },
      builderImage: {
        type: 'string',
        description: 'Builder image for S2I build (e.g., "nodejs:18-ubi8", "python:3.9-ubi8")',
      },
      env: {
        type: 'array',
        items: { type: 'string' },
        description: 'Environment variables in KEY=VALUE format',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels in KEY=VALUE format',
      },
      createNamespace: {
        type: 'boolean',
        default: true,
        description: 'Create namespace if it does not exist',
      },
      exposeRoute: {
        type: 'boolean',
        default: true,
        description: 'Create an edge-terminated route to expose the application',
      },
      routeHostname: {
        type: 'string',
        description: 'Custom hostname for the route (if not specified, uses default)',
      },
      gitRef: {
        type: 'string',
        description: 'Git reference (branch, tag, or commit) to build from (default: main/master)',
      },
      contextDir: {
        type: 'string',
        description: 'Context directory within the Git repository',
      },
      strategy: {
        type: 'string',
        enum: ['source', 'docker'],
        default: 'source',
        description: 'Build strategy: source (S2I) or docker',
      },
    },
    required: ['gitRepo'],
  },
};

export async function handleOcNewApp(params: OcNewAppParams) {
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
    const validated = OcNewAppSchema.parse(params);
    addProgress('🚀 Starting application deployment process');
    addProgress(`📋 Parameters validated successfully`);

    // Extract app name from Git repo URL if not provided
    const appName = validated.appName || extractAppNameFromGitUrl(validated.gitRepo);
    addProgress(`📝 Application name: ${appName}`);
    addProgress(`📂 Target namespace: ${validated.namespace}`);
    addProgress(`🔗 Source repository: ${validated.gitRepo}`);
    addProgress(`⚙️  Build strategy: ${validated.strategy}`);

    // Create namespace if requested
    if (validated.createNamespace) {
      addProgress(`🏗️  Checking/creating namespace: ${validated.namespace}`);
      const namespaceResult = await createNamespaceIfNotExists(
        manager,
        validated.namespace,
        validated.context
      );
      if (!namespaceResult.success) {
        addProgress(
          `❌ Failed to create namespace: ${namespaceResult.error || 'Unknown error'}`,
          'ERROR'
        );
        return formatErrorResponse(
          progressLog,
          `Failed to create namespace ${validated.namespace}`,
          namespaceResult.error
        );
      }
      addProgress(`✅ Namespace ready: ${validated.namespace}`, 'SUCCESS');
    } else {
      addProgress(`📁 Using existing namespace: ${validated.namespace}`);
    }

    // Build the oc new-app command
    addProgress(`🔨 Executing oc new-app command...`);
    const newAppResult = await executeNewApp(manager, validated, appName);

    if (!newAppResult.success) {
      addProgress(`❌ Application creation failed: ${newAppResult.error}`, 'ERROR');
      return formatErrorResponse(progressLog, 'Failed to create application', newAppResult.error);
    }

    addProgress(`✅ Application resources created successfully`, 'SUCCESS');
    addProgress(`📦 Resources: ImageStream, BuildConfig, Deployment, Service`);

    // Monitor build progress
    addProgress(`👀 Monitoring build progress...`);
    const buildStatus = await monitorBuildProgress(
      manager,
      appName,
      validated.namespace,
      validated.context
    );
    buildStatus.forEach(status => addProgress(status.message, status.level));

    // Create edge-terminated route if requested
    let routeResult = null;
    if (validated.exposeRoute) {
      addProgress(`🌐 Creating edge-terminated route...`);
      routeResult = await createEdgeRoute(
        manager,
        appName,
        validated.namespace,
        validated.context,
        validated.routeHostname
      );
      if (routeResult?.success) {
        addProgress(`✅ Route created successfully`, 'SUCCESS');

        // Extract route URL from result
        const routeUrl = extractRouteUrl(routeResult.data);
        if (routeUrl) {
          addProgress(`🔗 Application URL: ${routeUrl}`, 'SUCCESS');
        }
      } else {
        addProgress(`⚠️  Route creation failed: ${routeResult?.error}`, 'WARNING');
      }
    }

    // Monitor deployment progress
    addProgress(`🚀 Monitoring deployment progress...`);
    const deploymentStatus = await monitorDeploymentProgress(
      manager,
      appName,
      validated.namespace,
      validated.context
    );
    deploymentStatus.forEach(status => addProgress(status.message, status.level));

    // Final status check
    addProgress(`🔍 Performing final status check...`);
    const finalStatus = await getFinalApplicationStatus(
      manager,
      appName,
      validated.namespace,
      validated.context
    );

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    addProgress(`🎉 Deployment process completed in ${totalTime}s`, 'SUCCESS');

    return formatSuccessResponse(progressLog, validated, appName, routeResult, finalStatus);
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

async function createNamespaceIfNotExists(
  manager: OpenShiftManager,
  namespace: string,
  context?: string
) {
  // Check if namespace exists
  const checkResult = await manager.executeCommand(['get', 'namespace', namespace], { context });

  if (checkResult.success) {
    return { success: true, data: `Namespace ${namespace} already exists` };
  }

  // Create namespace
  const createResult = await manager.executeCommand(['create', 'namespace', namespace], {
    context,
  });
  return createResult;
}

function extractAppNameFromGitUrl(gitUrl: string): string {
  try {
    const url = new URL(gitUrl);
    const pathParts = url.pathname.split('/');
    let repoName = pathParts[pathParts.length - 1];

    // Remove .git extension if present
    if (repoName.endsWith('.git')) {
      repoName = repoName.slice(0, -4);
    }

    // Replace invalid characters for OpenShift resource names
    return repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  } catch {
    return 'my-app';
  }
}

async function executeNewApp(manager: OpenShiftManager, params: OcNewAppParams, appName: string) {
  const args = ['new-app'];

  // Add namespace
  args.push('-n', params.namespace);

  // Add name
  args.push('--name', appName);

  // Add strategy
  if (params.strategy === 'source') {
    args.push('--strategy=source');
  } else if (params.strategy === 'docker') {
    args.push('--strategy=docker');
  }

  // Add builder image if specified
  if (params.builderImage) {
    args.push(`${params.builderImage}~${params.gitRepo}`);
  } else {
    args.push(params.gitRepo);
  }

  // Add git reference
  if (params.gitRef) {
    args.push(`--source-secret=${params.gitRef}`);
  }

  // Add context directory
  if (params.contextDir) {
    args.push(`--context-dir=${params.contextDir}`);
  }

  // Add environment variables
  if (params.env && params.env.length > 0) {
    params.env.forEach(envVar => {
      args.push('-e', envVar);
    });
  }

  // Add labels
  if (params.labels && params.labels.length > 0) {
    params.labels.forEach(label => {
      args.push('-l', label);
    });
  }

  return manager.executeCommand(args, { context: params.context });
}

async function createEdgeRoute(
  manager: OpenShiftManager,
  appName: string,
  namespace: string,
  context?: string,
  hostname?: string
) {
  const args = ['create', 'route', 'edge', `${appName}-route`];

  // Add namespace
  args.push('-n', namespace);

  // Add service
  args.push('--service', appName);

  // Add custom hostname if specified
  if (hostname) {
    args.push('--hostname', hostname);
  }

  return manager.executeCommand(args, { context });
}

async function monitorBuildProgress(
  manager: OpenShiftManager,
  appName: string,
  namespace: string,
  context?: string
) {
  const status: Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }> = [];

  try {
    // Check if build was created
    const buildResult = await manager.executeCommand(
      ['get', 'builds', '-n', namespace, '--no-headers'],
      { context }
    );
    if (buildResult.success && buildResult.data && typeof buildResult.data === 'string') {
      const buildLines = buildResult.data
        .trim()
        .split('\n')
        .filter((line: string) => line.trim());
      const appBuilds = buildLines.filter((line: string) => line.includes(appName));

      if (appBuilds.length > 0) {
        status.push({
          message: `🔨 Build initiated: Found ${appBuilds.length} build(s)`,
          level: 'SUCCESS',
        });

        // Get latest build status
        const latestBuild = appBuilds[appBuilds.length - 1].split(/\s+/)[0];
        const buildStatusResult = await manager.executeCommand(
          ['get', 'build', latestBuild, '-n', namespace, '-o', 'jsonpath={.status.phase}'],
          { context }
        );

        if (buildStatusResult.success) {
          const buildPhase = buildStatusResult.data;
          switch (buildPhase) {
            case 'New':
              status.push({ message: `⏳ Build queued: ${latestBuild}`, level: 'INFO' });
              break;
            case 'Running':
              status.push({ message: `🔄 Build in progress: ${latestBuild}`, level: 'INFO' });
              break;
            case 'Complete':
              status.push({
                message: `✅ Build completed successfully: ${latestBuild}`,
                level: 'SUCCESS',
              });
              break;
            case 'Failed':
              status.push({ message: `❌ Build failed: ${latestBuild}`, level: 'ERROR' });
              break;
            default:
              status.push({
                message: `📊 Build status: ${buildPhase} (${latestBuild})`,
                level: 'INFO',
              });
          }
        }

        // Provide build monitoring command
        status.push({
          message: `📝 Monitor build: oc logs -f build/${latestBuild} -n ${namespace}`,
          level: 'INFO',
        });
      } else {
        status.push({
          message: `⚠️  No builds found for application ${appName}`,
          level: 'WARNING',
        });
      }
    }
  } catch (error) {
    status.push({
      message: `⚠️  Build monitoring error: ${error instanceof Error ? error.message : String(error)}`,
      level: 'WARNING',
    });
  }

  return status;
}

async function monitorDeploymentProgress(
  manager: OpenShiftManager,
  appName: string,
  namespace: string,
  context?: string
) {
  const status: Array<{ message: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' }> = [];

  try {
    // Check deployment status
    const deploymentResult = await manager.executeCommand(
      ['get', 'deployment', appName, '-n', namespace, '-o', 'json'],
      { context }
    );

    if (deploymentResult.success) {
      const deployment =
        typeof deploymentResult.data === 'string'
          ? JSON.parse(deploymentResult.data)
          : deploymentResult.data;
      const spec = deployment.spec || {};
      const status_obj = deployment.status || {};

      const desired = spec.replicas || 0;
      const ready = status_obj.readyReplicas || 0;
      const available = status_obj.availableReplicas || 0;
      const updated = status_obj.updatedReplicas || 0;

      status.push({
        message: `📊 Deployment status: ${ready}/${desired} ready, ${available}/${desired} available`,
        level: 'INFO',
      });

      if (ready === desired && available === desired) {
        status.push({ message: `✅ Deployment fully ready and available`, level: 'SUCCESS' });
      } else if (ready > 0) {
        status.push({
          message: `🔄 Deployment partially ready (${ready}/${desired})`,
          level: 'INFO',
        });
      } else {
        status.push({ message: `⏳ Deployment starting up...`, level: 'INFO' });
      }

      // Check for deployment conditions
      const conditions = status_obj.conditions || [];
      conditions.forEach((condition: any) => {
        if (condition.type === 'Available' && condition.status === 'True') {
          status.push({
            message: `✅ Deployment available: ${condition.reason}`,
            level: 'SUCCESS',
          });
        } else if (condition.type === 'Progressing' && condition.status === 'False') {
          status.push({
            message: `⚠️  Deployment not progressing: ${condition.reason}`,
            level: 'WARNING',
          });
        }
      });
    } else {
      status.push({
        message: `⚠️  Could not check deployment status: ${deploymentResult.error}`,
        level: 'WARNING',
      });
    }

    // Check pod status
    const podsResult = await manager.executeCommand(
      ['get', 'pods', '-n', namespace, '-l', `deployment=${appName}`, '--no-headers'],
      { context }
    );
    if (podsResult.success && podsResult.data && typeof podsResult.data === 'string') {
      const podLines = podsResult.data
        .trim()
        .split('\n')
        .filter((line: string) => line.trim());
      if (podLines.length > 0) {
        const runningPods = podLines.filter((line: string) => line.includes('Running')).length;
        const totalPods = podLines.length;
        status.push({
          message: `🎯 Pods: ${runningPods}/${totalPods} running`,
          level: runningPods === totalPods ? 'SUCCESS' : 'INFO',
        });
      }
    }
  } catch (error) {
    status.push({
      message: `⚠️  Deployment monitoring error: ${error instanceof Error ? error.message : String(error)}`,
      level: 'WARNING',
    });
  }

  return status;
}

async function getFinalApplicationStatus(
  manager: OpenShiftManager,
  appName: string,
  namespace: string,
  context?: string
) {
  const finalStatus: any = {};

  try {
    // Get final deployment status
    const deploymentResult = await manager.executeCommand(
      ['get', 'deployment', appName, '-n', namespace, '-o', 'json'],
      { context }
    );
    if (deploymentResult.success) {
      const deployment =
        typeof deploymentResult.data === 'string'
          ? JSON.parse(deploymentResult.data)
          : deploymentResult.data;
      finalStatus.deployment = {
        replicas: deployment.status?.replicas || 0,
        readyReplicas: deployment.status?.readyReplicas || 0,
        availableReplicas: deployment.status?.availableReplicas || 0,
      };
    }

    // Get route information
    const routeResult = await manager.executeCommand(
      ['get', 'route', `${appName}-route`, '-n', namespace, '-o', 'jsonpath={.spec.host}'],
      { context }
    );
    if (routeResult.success && routeResult.data) {
      finalStatus.url = `https://${routeResult.data}`;
    }

    // Get service information
    const serviceResult = await manager.executeCommand(
      ['get', 'service', appName, '-n', namespace, '-o', 'json'],
      { context }
    );
    if (serviceResult.success) {
      const service =
        typeof serviceResult.data === 'string'
          ? JSON.parse(serviceResult.data)
          : serviceResult.data;
      finalStatus.service = {
        clusterIP: service.spec?.clusterIP,
        ports:
          service.spec?.ports?.map(
            (port: any) => `${port.port}:${port.targetPort}/${port.protocol}`
          ) || [],
      };
    }
  } catch (error) {
    finalStatus.error = error instanceof Error ? error.message : String(error);
  }

  return finalStatus;
}

function extractRouteUrl(routeData: any): string | null {
  try {
    if (typeof routeData === 'string') {
      // Extract hostname from route creation output
      const hostMatch = routeData.match(/host:\s*([^\s]+)/);
      if (hostMatch) {
        return `https://${hostMatch[1]}`;
      }

      // Look for route name pattern
      const routeMatch = routeData.match(/route\.route\.openshift\.io\/([^\s]+)\s+created/);
      if (routeMatch) {
        return `Route ${routeMatch[1]} created`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function formatSuccessResponse(
  progressLog: string[],
  params: any,
  appName: string,
  routeResult: any,
  finalStatus: any
) {
  const response = [
    `# 🎉 Application Deployment Successful`,
    ``,
    `## 📋 Deployment Summary`,
    `- **Application**: ${appName}`,
    `- **Namespace**: ${params.namespace}`,
    `- **Source**: ${params.gitRepo}`,
    `- **Build Strategy**: ${params.strategy}`,
    `- **Route**: ${params.exposeRoute ? 'Created' : 'Not created'}`,
    ``,
  ];

  if (finalStatus.url) {
    response.push(`## 🌐 Access Information`);
    response.push(`- **URL**: ${finalStatus.url}`);
    response.push(``);
  }

  if (finalStatus.deployment) {
    response.push(`## 📊 Final Status`);
    response.push(
      `- **Replicas**: ${finalStatus.deployment.readyReplicas}/${finalStatus.deployment.replicas} ready`
    );
    response.push(
      `- **Available**: ${finalStatus.deployment.availableReplicas}/${finalStatus.deployment.replicas} available`
    );
    response.push(``);
  }

  response.push(`## 📝 Deployment Progress Log`);
  response.push(`\`\`\``);
  response.push(...progressLog);
  response.push(`\`\`\``);

  response.push(``);
  response.push(`## 🔧 Useful Commands`);
  response.push(`\`\`\`bash`);
  response.push(`# Check application status`);
  response.push(`oc get all -l app=${appName} -n ${params.namespace}`);
  response.push(``);
  response.push(`# View application logs`);
  response.push(`oc logs deployment/${appName} -n ${params.namespace} -f`);
  response.push(``);
  response.push(`# Scale application`);
  response.push(`oc scale deployment/${appName} --replicas=3 -n ${params.namespace}`);
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
    `# ❌ Application Deployment Failed`,
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
  response.push(`2. Verify cluster connectivity: \`oc whoami\``);
  response.push(
    `3. Check namespace permissions: \`oc auth can-i create deployments -n <namespace>\``
  );
  response.push(`4. Verify source repository accessibility`);
  response.push(`5. Check available builder images: \`oc get imagestreams -n openshift\``);

  return {
    content: [
      {
        type: 'text' as const,
        text: response.filter(line => line !== '').join('\n'),
      },
    ],
  };
}
