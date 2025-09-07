import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const projectListResource: Resource = {
  uri: 'openshift://project-list',
  name: 'OpenShift Project List',
  description:
    'Comprehensive list of all projects/namespaces with detailed information, quotas, and usage statistics',
  mimeType: 'application/json',
};

export async function getProjectList(context?: string): Promise<string> {
  const manager = OpenShiftManager.getInstance();
  const projectInfo: any = {};

  try {
    // Get all namespaces/projects
    const namespacesResult = await manager.executeCommand(['get', 'namespaces', '-o', 'json'], {
      context,
    });

    if (!namespacesResult.success) {
      throw new Error(`Failed to get namespaces: ${namespacesResult.error}`);
    }

    const namespacesData =
      typeof namespacesResult.data === 'string'
        ? JSON.parse(namespacesResult.data)
        : namespacesResult.data;
    const namespaces = namespacesData.items || [];

    // Categorize namespaces
    const systemNamespaces = namespaces.filter(
      (ns: any) =>
        ns.metadata.name.startsWith('openshift-') ||
        ns.metadata.name.startsWith('kube-') ||
        ['default', 'olm'].includes(ns.metadata.name)
    );

    const userNamespaces = namespaces.filter(
      (ns: any) =>
        !ns.metadata.name.startsWith('openshift-') &&
        !ns.metadata.name.startsWith('kube-') &&
        !['default', 'olm'].includes(ns.metadata.name)
    );

    // Get detailed information for user projects
    const detailedProjects = await Promise.all(
      userNamespaces.map(async (ns: any) => {
        const projectDetails = await getProjectDetails(manager, ns.metadata.name, context);
        return {
          name: ns.metadata.name,
          status: ns.status?.phase || 'Unknown',
          created: ns.metadata?.creationTimestamp || 'Unknown',
          labels: ns.metadata?.labels || {},
          annotations: ns.metadata?.annotations || {},
          ...projectDetails,
        };
      })
    );

    projectInfo.summary = {
      total: namespaces.length,
      system: systemNamespaces.length,
      user: userNamespaces.length,
      active: namespaces.filter((ns: any) => ns.status?.phase === 'Active').length,
      terminating: namespaces.filter((ns: any) => ns.status?.phase === 'Terminating').length,
    };

    projectInfo.systemProjects = systemNamespaces.map((ns: any) => ({
      name: ns.metadata.name,
      status: ns.status?.phase || 'Unknown',
      created: ns.metadata?.creationTimestamp || 'Unknown',
      description: getSystemProjectDescription(ns.metadata.name),
    }));

    projectInfo.userProjects = detailedProjects;

    // Get cluster-wide resource usage summary
    const resourceSummary = await getClusterResourceSummary(manager, context);
    projectInfo.clusterResourceUsage = resourceSummary;

    projectInfo.metadata = {
      retrievedAt: new Date().toISOString(),
      context: context || 'current',
      totalProjects: namespaces.length,
    };

    return JSON.stringify(projectInfo, null, 2);
  } catch (error) {
    const errorInfo = {
      error: 'Failed to retrieve project list',
      message: error instanceof Error ? error.message : String(error),
      retrievedAt: new Date().toISOString(),
    };
    return JSON.stringify(errorInfo, null, 2);
  }
}

async function getProjectDetails(manager: OpenShiftManager, projectName: string, context?: string) {
  const details: any = {};

  try {
    // Get resource quotas
    const quotaResult = await manager.executeCommand(
      ['get', 'resourcequota', '-n', projectName, '-o', 'json'],
      { context }
    );
    if (quotaResult.success) {
      const quotaData =
        typeof quotaResult.data === 'string' ? JSON.parse(quotaResult.data) : quotaResult.data;
      details.resourceQuotas =
        quotaData.items?.map((quota: any) => ({
          name: quota.metadata?.name,
          hard: quota.status?.hard || {},
          used: quota.status?.used || {},
        })) || [];
    }

    // Get limit ranges
    const limitResult = await manager.executeCommand(
      ['get', 'limitrange', '-n', projectName, '-o', 'json'],
      { context }
    );
    if (limitResult.success) {
      const limitData =
        typeof limitResult.data === 'string' ? JSON.parse(limitResult.data) : limitResult.data;
      details.limitRanges =
        limitData.items?.map((limit: any) => ({
          name: limit.metadata?.name,
          limits: limit.spec?.limits || [],
        })) || [];
    }

    // Get pod count and status
    const podsResult = await manager.executeCommand(
      ['get', 'pods', '-n', projectName, '-o', 'json'],
      { context }
    );
    if (podsResult.success) {
      const podsData =
        typeof podsResult.data === 'string' ? JSON.parse(podsResult.data) : podsResult.data;
      const pods = podsData.items || [];
      details.pods = {
        total: pods.length,
        running: pods.filter((p: any) => p.status?.phase === 'Running').length,
        pending: pods.filter((p: any) => p.status?.phase === 'Pending').length,
        failed: pods.filter((p: any) => p.status?.phase === 'Failed').length,
        succeeded: pods.filter((p: any) => p.status?.phase === 'Succeeded').length,
      };
    }

    // Get services count
    const servicesResult = await manager.executeCommand(
      ['get', 'services', '-n', projectName, '--no-headers'],
      { context }
    );
    if (servicesResult.success && servicesResult.data && typeof servicesResult.data === 'string') {
      const serviceLines = servicesResult.data
        .trim()
        .split('\n')
        .filter((line: string) => line.trim());
      details.services = serviceLines.length;
    } else {
      details.services = 0;
    }

    // Get deployments count
    const deploymentsResult = await manager.executeCommand(
      ['get', 'deployments', '-n', projectName, '--no-headers'],
      { context }
    );
    if (
      deploymentsResult.success &&
      deploymentsResult.data &&
      typeof deploymentsResult.data === 'string'
    ) {
      const deploymentLines = deploymentsResult.data
        .trim()
        .split('\n')
        .filter((line: string) => line.trim());
      details.deployments = deploymentLines.length;
    } else {
      details.deployments = 0;
    }

    // Get routes count
    const routesResult = await manager.executeCommand(
      ['get', 'routes', '-n', projectName, '--no-headers'],
      { context }
    );
    if (routesResult.success && routesResult.data && typeof routesResult.data === 'string') {
      const routeLines = routesResult.data
        .trim()
        .split('\n')
        .filter((line: string) => line.trim());
      details.routes = routeLines.length;
    } else {
      details.routes = 0;
    }

    // Get configmaps and secrets count
    const configsResult = await manager.executeCommand(
      ['get', 'configmaps,secrets', '-n', projectName, '--no-headers'],
      { context }
    );
    if (configsResult.success && configsResult.data && typeof configsResult.data === 'string') {
      const configLines = configsResult.data
        .trim()
        .split('\n')
        .filter((line: string) => line.trim());
      details.configs = {
        configMaps: configLines.filter((line: string) => line.includes('configmap')).length,
        secrets: configLines.filter((line: string) => line.includes('secret')).length,
      };
    } else {
      details.configs = { configMaps: 0, secrets: 0 };
    }
  } catch (error) {
    details.error = error instanceof Error ? error.message : String(error);
  }

  return details;
}

async function getClusterResourceSummary(manager: OpenShiftManager, context?: string) {
  try {
    // Get cluster-wide resource usage
    const nodesResult = await manager.executeCommand(['top', 'nodes'], { context });
    const podsResult = await manager.executeCommand(
      ['get', 'pods', '--all-namespaces', '--no-headers'],
      { context }
    );

    const summary: any = {};

    if (nodesResult.success && nodesResult.data) {
      // Parse node resource usage (if top command works)
      summary.nodeResourceUsage = nodesResult.data;
    }

    if (podsResult.success && podsResult.data && typeof podsResult.data === 'string') {
      const podLines = podsResult.data
        .trim()
        .split('\n')
        .filter((line: string) => line.trim());
      summary.totalPods = podLines.length;

      // Count pods by namespace
      const podsByNamespace: { [key: string]: number } = {};
      podLines.forEach((line: string) => {
        const namespace = line.split(/\s+/)[0];
        podsByNamespace[namespace] = (podsByNamespace[namespace] || 0) + 1;
      });
      summary.podsByNamespace = podsByNamespace;
    }

    return summary;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function getSystemProjectDescription(projectName: string): string {
  const descriptions: { [key: string]: string } = {
    default: 'Default namespace for resources without a specified namespace',
    'kube-system': 'Kubernetes system components and services',
    'kube-public': 'Public namespace readable by all users',
    'kube-node-lease': 'Node lease objects for node heartbeats',
    openshift: 'Core OpenShift platform components',
    'openshift-apiserver': 'OpenShift API server components',
    'openshift-authentication': 'Authentication and OAuth services',
    'openshift-console': 'OpenShift web console components',
    'openshift-dns': 'DNS resolution services',
    'openshift-etcd': 'etcd cluster database components',
    'openshift-image-registry': 'Internal container image registry',
    'openshift-ingress': 'Ingress controllers and routing',
    'openshift-kube-apiserver': 'Kubernetes API server components',
    'openshift-monitoring': 'Cluster monitoring and metrics collection',
    'openshift-network-operator': 'Software-defined networking components',
    'openshift-operator-lifecycle-manager': 'Operator Lifecycle Manager (OLM)',
    'openshift-operators': 'Installed operators and their resources',
    'openshift-marketplace': 'Operator marketplace and catalog sources',
  };

  return descriptions[projectName] || 'OpenShift system component';
}
