import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const clusterInfoResource: Resource = {
  uri: 'openshift://cluster-info',
  name: 'OpenShift Cluster Information',
  description:
    'Comprehensive information about the OpenShift cluster including version, nodes, and status',
  mimeType: 'application/json',
};

export async function getClusterInfo(context?: string): Promise<string> {
  const manager = OpenShiftManager.getInstance();
  const clusterInfo: any = {};

  try {
    // Get cluster version information with JSON output
    const versionResult = await manager.executeCommand(['version', '-o', 'json'], { context });
    if (versionResult.success) {
      try {
        const versionData =
          typeof versionResult.data === 'string'
            ? JSON.parse(versionResult.data)
            : versionResult.data;
        clusterInfo.version = {
          client: versionData.clientVersion?.gitVersion || 'Unknown',
          server:
            versionData.openshiftVersion || versionData.serverVersion?.gitVersion || 'Unknown',
          kubernetes: versionData.serverVersion?.gitVersion || 'Unknown',
          clientDetails: {
            version: versionData.clientVersion?.gitVersion || 'Unknown',
            gitCommit: versionData.clientVersion?.gitCommit || 'Unknown',
            buildDate: versionData.clientVersion?.buildDate || 'Unknown',
            platform: versionData.clientVersion?.platform || 'Unknown',
          },
          serverDetails: {
            openshiftVersion: versionData.openshiftVersion || 'Unknown',
            kubernetesVersion: versionData.serverVersion?.gitVersion || 'Unknown',
            gitCommit: versionData.serverVersion?.gitCommit || 'Unknown',
            buildDate: versionData.serverVersion?.buildDate || 'Unknown',
            platform: versionData.serverVersion?.platform || 'Unknown',
          },
          kustomizeVersion: versionData.kustomizeVersion || 'Unknown',
        };
      } catch (parseError) {
        // Fallback: try text version command
        const textVersionResult = await manager.executeCommand(['version'], { context });
        clusterInfo.version = {
          raw: textVersionResult.success ? textVersionResult.data : 'Failed to get version',
          error: `JSON parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        };
      }
    } else {
      clusterInfo.version = {
        error: `Version command failed: ${versionResult.error}`,
      };
    }

    // Get cluster info
    const clusterResult = await manager.executeCommand(['cluster-info'], { context });
    if (clusterResult.success) {
      clusterInfo.endpoints = clusterResult.data;
    }

    // Get node information
    const nodesResult = await manager.executeCommand(['get', 'nodes', '-o', 'json'], { context });
    if (nodesResult.success) {
      const nodesData =
        typeof nodesResult.data === 'string' ? JSON.parse(nodesResult.data) : nodesResult.data;
      const nodes = nodesData.items || [];

      clusterInfo.nodes = {
        total: nodes.length,
        ready: nodes.filter((node: any) =>
          node.status?.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True')
        ).length,
        details: nodes.map((node: any) => ({
          name: node.metadata?.name || 'Unknown',
          role: getNodeRole(node),
          status: getNodeStatus(node),
          version: node.status?.nodeInfo?.kubeletVersion || 'Unknown',
          os: node.status?.nodeInfo?.osImage || 'Unknown',
          architecture: node.status?.nodeInfo?.architecture || 'Unknown',
          capacity: {
            cpu: node.status?.capacity?.cpu || 'Unknown',
            memory: node.status?.capacity?.memory || 'Unknown',
            pods: node.status?.capacity?.pods || 'Unknown',
          },
          addresses:
            node.status?.addresses?.map((addr: any) => ({
              type: addr.type,
              address: addr.address,
            })) || [],
        })),
      };
    }

    // Get namespace information
    const namespacesResult = await manager.executeCommand(['get', 'namespaces', '-o', 'json'], {
      context,
    });
    if (namespacesResult.success) {
      const namespacesData =
        typeof namespacesResult.data === 'string'
          ? JSON.parse(namespacesResult.data)
          : namespacesResult.data;
      const namespaces = namespacesData.items || [];

      clusterInfo.namespaces = {
        total: namespaces.length,
        active: namespaces.filter((ns: any) => ns.status?.phase === 'Active').length,
        list: namespaces.map((ns: any) => ({
          name: ns.metadata?.name || 'Unknown',
          status: ns.status?.phase || 'Unknown',
          created: ns.metadata?.creationTimestamp || 'Unknown',
          labels: ns.metadata?.labels || {},
        })),
      };
    }

    // Get storage classes
    const storageClassResult = await manager.executeCommand(['get', 'storageclass', '-o', 'json'], {
      context,
    });
    if (storageClassResult.success) {
      const storageData =
        typeof storageClassResult.data === 'string'
          ? JSON.parse(storageClassResult.data)
          : storageClassResult.data;
      const storageClasses = storageData.items || [];

      clusterInfo.storage = {
        classes: storageClasses.map((sc: any) => ({
          name: sc.metadata?.name || 'Unknown',
          provisioner: sc.provisioner || 'Unknown',
          default:
            sc.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
          reclaimPolicy: sc.reclaimPolicy || 'Unknown',
        })),
      };
    }

    // Get current context
    const contextResult = await manager.executeCommand(['config', 'current-context'], { context });
    if (contextResult.success) {
      clusterInfo.currentContext = contextResult.data.trim();
    }

    // Get cluster events (recent)
    const eventsResult = await manager.executeCommand(
      ['get', 'events', '--all-namespaces', '--sort-by=.lastTimestamp', '-o', 'json'],
      { context }
    );
    if (eventsResult.success) {
      const eventsData =
        typeof eventsResult.data === 'string' ? JSON.parse(eventsResult.data) : eventsResult.data;
      const events = eventsData.items || [];

      clusterInfo.recentEvents = {
        total: events.length,
        warnings: events.filter((e: any) => e.type === 'Warning').length,
        normal: events.filter((e: any) => e.type === 'Normal').length,
        recent: events.slice(-10).map((event: any) => ({
          type: event.type || 'Unknown',
          reason: event.reason || 'Unknown',
          message: event.message || 'Unknown',
          namespace: event.namespace || 'Unknown',
          object: `${event.involvedObject?.kind || 'Unknown'}/${event.involvedObject?.name || 'Unknown'}`,
          timestamp: event.lastTimestamp || event.firstTimestamp || 'Unknown',
        })),
      };
    }

    // Add metadata with debug information
    clusterInfo.metadata = {
      retrievedAt: new Date().toISOString(),
      context: context || 'current',
      serverType: 'OpenShift/Kubernetes',
      debug: {
        versionCommandExecuted: !!clusterInfo.version,
        nodesCommandExecuted: !!clusterInfo.nodes,
        namespacesCommandExecuted: !!clusterInfo.namespaces,
        storageCommandExecuted: !!clusterInfo.storage,
        eventsCommandExecuted: !!clusterInfo.recentEvents,
      },
    };

    return JSON.stringify(clusterInfo, null, 2);
  } catch (error) {
    const errorInfo = {
      error: 'Failed to retrieve cluster information',
      message: error instanceof Error ? error.message : String(error),
      retrievedAt: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
    };
    return JSON.stringify(errorInfo, null, 2);
  }
}

function getNodeRole(node: any): string {
  const labels = node.metadata?.labels || {};

  if (labels['node-role.kubernetes.io/master'] || labels['node-role.kubernetes.io/control-plane']) {
    return 'master/control-plane';
  }
  if (labels['node-role.kubernetes.io/worker']) {
    return 'worker';
  }
  if (labels['node-role.kubernetes.io/infra']) {
    return 'infra';
  }

  // Check for any node-role labels
  const roleLabels = Object.keys(labels).filter(key => key.startsWith('node-role.kubernetes.io/'));
  if (roleLabels.length > 0) {
    return roleLabels.map(label => label.replace('node-role.kubernetes.io/', '')).join(',');
  }

  return 'unknown';
}

function getNodeStatus(node: any): string {
  const conditions = node.status?.conditions || [];
  const readyCondition = conditions.find((c: any) => c.type === 'Ready');

  if (readyCondition?.status === 'True') {
    return 'Ready';
  } else if (readyCondition?.status === 'False') {
    return 'NotReady';
  } else {
    return 'Unknown';
  }
}
