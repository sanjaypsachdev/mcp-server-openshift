/**
 * Shared resource helper functions for OpenShift tools
 * Provides common patterns for resource verification, discovery, and management
 */

import type { OpenShiftManager } from './openshift-manager.js';
import type { ValidationResult } from './validation-helpers.js';

export interface ResourceInfo {
  success: boolean;
  exists: boolean;
  kind?: string;
  name?: string;
  namespace?: string;
  data?: any;
  error?: string;
  metadata?: {
    creationTimestamp?: string;
    resourceVersion?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
}

export interface ContainerInfo {
  name: string;
  image?: string;
  ports?: Array<{
    name?: string;
    containerPort: number;
    protocol?: string;
  }>;
}

export interface ResourceDiscoveryResult {
  available: boolean;
  kind?: string;
  name?: string;
  namespace?: string;
  containers?: string[];
  ports?: Array<{
    name?: string;
    port: number;
    protocol?: string;
  }>;
  error?: string;
}

/**
 * Verify that a resource exists and return its information
 */
export async function verifyResourceExists(
  manager: OpenShiftManager,
  resourceType: string,
  name: string,
  namespace: string,
  context?: string
): Promise<ResourceInfo> {
  try {
    const result = await manager.getResources(resourceType, namespace, name, {
      context,
      output: 'json',
    });

    if (!result.success) {
      return {
        success: false,
        exists: false,
        error: result.error || 'Resource not found',
      };
    }

    const resource = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;

    return {
      success: true,
      exists: true,
      kind: resource.kind,
      name: resource.metadata?.name,
      namespace: resource.metadata?.namespace,
      data: resource,
      metadata: {
        creationTimestamp: resource.metadata?.creationTimestamp,
        resourceVersion: resource.metadata?.resourceVersion,
        labels: resource.metadata?.labels,
        annotations: resource.metadata?.annotations,
      },
    };
  } catch (error) {
    return {
      success: false,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Discover resource information including containers and ports
 */
export async function discoverResourceInfo(
  manager: OpenShiftManager,
  resourceType: string,
  name: string,
  namespace: string,
  context?: string
): Promise<ResourceDiscoveryResult> {
  try {
    const resourceInfo = await verifyResourceExists(
      manager,
      resourceType,
      name,
      namespace,
      context
    );

    if (!resourceInfo.success || !resourceInfo.exists) {
      return {
        available: false,
        error: resourceInfo.error || 'Resource not found',
      };
    }

    const resource = resourceInfo.data;
    const containers = extractContainers(resource);
    const ports = extractPorts(resource);

    return {
      available: true,
      kind: resourceInfo.kind,
      name: resourceInfo.name,
      namespace: resourceInfo.namespace,
      containers: containers.map(c => c.name),
      ports,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract container information from a resource
 */
export function extractContainers(resource: any): ContainerInfo[] {
  const containers: ContainerInfo[] = [];

  // Check different resource types for container specs
  const containerSpecs =
    resource.spec?.template?.spec?.containers || // Deployment, ReplicaSet
    resource.spec?.containers || // Pod
    resource.spec?.jobTemplate?.spec?.template?.spec?.containers || // CronJob
    [];

  if (Array.isArray(containerSpecs)) {
    containers.push(
      ...containerSpecs.map((container: any) => ({
        name: container.name || 'unnamed',
        image: container.image,
        ports: container.ports || [],
      }))
    );
  }

  return containers;
}

/**
 * Extract port information from a resource
 */
export function extractPorts(
  resource: any
): Array<{ name?: string; port: number; protocol?: string }> {
  const ports: Array<{ name?: string; port: number; protocol?: string }> = [];

  // For services, get ports from spec.ports
  if (resource.kind === 'Service' && resource.spec?.ports) {
    ports.push(
      ...resource.spec.ports.map((port: any) => ({
        name: port.name,
        port: port.port,
        protocol: port.protocol || 'TCP',
      }))
    );
  } else {
    // For other resources, extract from containers
    const containers = extractContainers(resource);
    containers.forEach(container => {
      if (container.ports) {
        ports.push(
          ...container.ports.map(port => ({
            name: port.name,
            port: port.containerPort,
            protocol: port.protocol || 'TCP',
          }))
        );
      }
    });
  }

  return ports;
}

/**
 * Auto-detect target port from a resource
 */
export async function detectTargetPort(
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
      const resourceInfo = await verifyResourceExists(
        manager,
        resourceType,
        name,
        namespace,
        context
      );
      if (!resourceInfo.success || !resourceInfo.exists) {
        return { warning: 'Could not retrieve resource details' };
      }
      resource = resourceInfo.data;
    }

    const ports = extractPorts(resource);

    if (ports.length === 0) {
      return { warning: 'No ports found in resource specification' };
    }

    // Return the first port (name if available, otherwise port number)
    const firstPort = ports[0];
    return { port: firstPort.name || firstPort.port.toString() };
  } catch (error) {
    return {
      warning: `Port detection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if a namespace exists, create if requested
 */
export async function ensureNamespace(
  manager: OpenShiftManager,
  namespace: string,
  context?: string,
  create: boolean = false
): Promise<{ success: boolean; created?: boolean; error?: string }> {
  try {
    // Check if namespace exists
    const checkResult = await manager.executeCommand(['get', 'namespace', namespace], { context });

    if (checkResult.success) {
      return { success: true, created: false };
    }

    if (!create) {
      return {
        success: false,
        error: `Namespace ${namespace} does not exist`,
      };
    }

    // Create namespace
    const createResult = await manager.executeCommand(['create', 'namespace', namespace], {
      context,
    });

    if (!createResult.success) {
      return {
        success: false,
        error: `Failed to create namespace: ${createResult.error}`,
      };
    }

    return { success: true, created: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get resource status information
 */
export function getResourceStatus(resource: any): string {
  if (!resource) return 'Unknown';

  const kind = resource.kind?.toLowerCase();

  switch (kind) {
    case 'pod':
      return resource.status?.phase || 'Unknown';

    case 'deployment':
      const spec = resource.spec || {};
      const status = resource.status || {};
      const desired = spec.replicas || 0;
      const ready = status.readyReplicas || 0;
      return `${ready}/${desired} ready`;

    case 'service':
      const clusterIP = resource.spec?.clusterIP;
      const type = resource.spec?.type || 'ClusterIP';
      return `${type}${clusterIP ? ` (${clusterIP})` : ''}`;

    case 'route':
      const host = resource.spec?.host;
      return host ? `Available at ${host}` : 'No host assigned';

    case 'persistentvolumeclaim':
      return resource.status?.phase || 'Unknown';

    case 'node':
      const conditions = resource.status?.conditions || [];
      const readyCondition = conditions.find((c: any) => c.type === 'Ready');
      return readyCondition?.status === 'True' ? 'Ready' : 'NotReady';

    default:
      // Generic status extraction
      if (resource.status?.phase) return resource.status.phase;
      if (resource.status?.conditions) {
        const readyCondition = resource.status.conditions.find((c: any) => c.type === 'Ready');
        if (readyCondition) {
          return readyCondition.status === 'True' ? 'Ready' : 'NotReady';
        }
      }
      return 'Active';
  }
}

/**
 * Check if a resource type is cluster-scoped
 */
export function isClusterScopedResource(resourceType: string): boolean {
  const clusterScopedResources = [
    'node',
    'nodes',
    'namespace',
    'namespaces',
    'ns',
    'persistentvolume',
    'persistentvolumes',
    'pv',
    'clusterrole',
    'clusterroles',
    'clusterrolebinding',
    'clusterrolebindings',
    'customresourcedefinition',
    'customresourcedefinitions',
    'crd',
    'crds',
    'storageclass',
    'storageclasses',
    'sc',
    'priorityclass',
    'priorityclasses',
    'pc',
  ];

  return clusterScopedResources.includes(resourceType.toLowerCase());
}

/**
 * Extract resource name from various input formats
 */
export function parseResourceReference(resourceRef: string): {
  resourceType?: string;
  name?: string;
  namespace?: string;
} {
  // Handle formats like:
  // - "pod/my-pod"
  // - "deployment.apps/my-deployment"
  // - "my-resource"

  const parts = resourceRef.split('/');

  if (parts.length === 2) {
    return {
      resourceType: parts[0],
      name: parts[1],
    };
  }

  if (parts.length === 1) {
    return {
      name: parts[0],
    };
  }

  return {};
}

/**
 * Build resource selector for listing operations
 */
export function buildResourceSelector(options: {
  labelSelector?: string;
  fieldSelector?: string;
  namespace?: string;
  allNamespaces?: boolean;
}): string[] {
  const args: string[] = [];

  if (options.allNamespaces) {
    args.push('--all-namespaces');
  } else if (options.namespace) {
    args.push('-n', options.namespace);
  }

  if (options.labelSelector) {
    args.push('-l', options.labelSelector);
  }

  if (options.fieldSelector) {
    args.push('--field-selector', options.fieldSelector);
  }

  return args;
}

/**
 * Validate resource exists and has expected properties
 */
export async function validateResourceForOperation(
  manager: OpenShiftManager,
  resourceType: string,
  name: string,
  namespace: string,
  operation: string,
  context?: string
): Promise<ValidationResult & { resourceInfo?: ResourceInfo }> {
  const resourceInfo = await verifyResourceExists(manager, resourceType, name, namespace, context);

  if (!resourceInfo.success) {
    return {
      valid: false,
      error: `Failed to verify resource: ${resourceInfo.error}`,
      resourceInfo,
    };
  }

  if (!resourceInfo.exists) {
    return {
      valid: false,
      error: `Resource ${resourceType}/${name} not found in namespace ${namespace}`,
      resourceInfo,
    };
  }

  // Additional operation-specific validations can be added here
  switch (operation) {
    case 'expose':
      // Check if resource can be exposed (has ports)
      const ports = extractPorts(resourceInfo.data);
      if (ports.length === 0) {
        return {
          valid: true,
          warnings: [`Resource ${resourceType}/${name} has no exposed ports`],
          resourceInfo,
        };
      }
      break;

    case 'logs':
      // Check if resource supports logs (has containers)
      const containers = extractContainers(resourceInfo.data);
      if (containers.length === 0) {
        return {
          valid: false,
          error: `Resource ${resourceType}/${name} does not have containers and cannot provide logs`,
          resourceInfo,
        };
      }
      break;
  }

  return {
    valid: true,
    resourceInfo,
  };
}
