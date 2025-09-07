import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcScaleSchema, type OcScaleParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocScaleTool: Tool = {
  name: 'oc_scale',
  description:
    'Scale the number of pods in a deployment, deploymentconfig, replicaset, or statefulset to the specified number of replicas',
  inputSchema: {
    type: 'object',
    properties: {
      resourceType: {
        type: 'string',
        enum: ['deployment', 'deploymentconfig', 'replicaset', 'statefulset'],
        default: 'deployment',
        description:
          'Resource type to scale (deployment, deploymentconfig, replicaset, statefulset)',
      },
      name: {
        type: 'string',
        description: 'Name of the resource to scale',
      },
      replicas: {
        type: 'number',
        minimum: 0,
        description: 'Number of replicas to scale to',
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
    },
    required: ['name', 'replicas'],
  },
};

export async function handleOcScale(params: OcScaleParams) {
  const manager = OpenShiftManager.getInstance();

  try {
    const validated = OcScaleSchema.parse(params);

    // Get current resource information before scaling
    const currentResult = await manager.getResources(
      validated.resourceType,
      validated.namespace,
      validated.name,
      {
        context: validated.context,
        output: 'json',
      }
    );

    if (!currentResult.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Could not find ${validated.resourceType} '${validated.name}' in namespace '${validated.namespace}': ${currentResult.error}`,
          },
        ],
      };
    }

    // Extract current replica count
    let currentReplicas = 0;
    if (currentResult.data && typeof currentResult.data === 'object') {
      if (currentResult.data.spec && currentResult.data.spec.replicas !== undefined) {
        currentReplicas = currentResult.data.spec.replicas;
      } else if (currentResult.data.items && currentResult.data.items.length > 0) {
        currentReplicas = currentResult.data.items[0].spec?.replicas || 0;
      }
    }

    // Perform the scaling operation
    const scaleResult = await manager.scaleResource(
      validated.resourceType,
      validated.name,
      validated.replicas,
      {
        namespace: validated.namespace,
        context: validated.context,
      }
    );

    if (!scaleResult.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error scaling ${validated.resourceType} '${validated.name}': ${scaleResult.error}`,
          },
        ],
      };
    }

    // Determine scaling action
    let scalingAction = '';
    if (validated.replicas > currentReplicas) {
      scalingAction = `Scaled up from ${currentReplicas} to ${validated.replicas} replicas`;
    } else if (validated.replicas < currentReplicas) {
      scalingAction = `Scaled down from ${currentReplicas} to ${validated.replicas} replicas`;
    } else {
      scalingAction = `No change needed - already at ${validated.replicas} replicas`;
    }

    // Get updated resource information
    const updatedResult = await manager.getResources(
      validated.resourceType,
      validated.namespace,
      validated.name,
      {
        context: validated.context,
        output: 'json',
      }
    );

    let statusInfo = '';
    if (updatedResult.success && updatedResult.data) {
      if (typeof updatedResult.data === 'object' && updatedResult.data.status) {
        const status = updatedResult.data.status;
        const readyReplicas = status.readyReplicas || 0;
        const availableReplicas = status.availableReplicas || 0;
        statusInfo = `\nCurrent status: ${readyReplicas}/${validated.replicas} ready, ${availableReplicas}/${validated.replicas} available`;
      } else if (updatedResult.data.items && updatedResult.data.items.length > 0) {
        const status = updatedResult.data.items[0].status;
        const readyReplicas = status?.readyReplicas || 0;
        const availableReplicas = status?.availableReplicas || 0;
        statusInfo = `\nCurrent status: ${readyReplicas}/${validated.replicas} ready, ${availableReplicas}/${validated.replicas} available`;
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Tool: oc_scale, Result: Successfully scaled ${validated.resourceType} '${validated.name}' in namespace '${validated.namespace}'\n${scalingAction}${statusInfo}\n\nCommand executed: oc scale ${validated.resourceType}/${validated.name} --replicas=${validated.replicas} -n ${validated.namespace}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
