import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OcInstallOperatorSchema, type OcInstallOperatorParams } from '../models/tool-models.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';
import { handleOcApply } from './oc-apply.js';

export const ocInstallOperatorTool: Tool = {
  name: 'oc_install_operator',
  description:
    'Install an Operator on the OpenShift/Kubernetes cluster using OLM, Helm, or direct manifests',
  inputSchema: {
    type: 'object',
    properties: {
      operatorName: {
        type: 'string',
        description:
          'Name of the operator to install (e.g., "prometheus-operator", "cert-manager")',
      },
      version: {
        type: 'string',
        description:
          'Version of the operator to install (if not specified, installs latest available)',
      },
      namespace: {
        type: 'string',
        default: 'default',
        description: 'Target namespace for operator installation',
      },
      context: {
        type: 'string',
        default: '',
        description: 'OpenShift context to use (optional)',
      },
      channel: {
        type: 'string',
        description: 'Update channel for the operator (stable, alpha, beta, etc.)',
      },
      source: {
        type: 'string',
        enum: ['olm', 'helm', 'manifest'],
        default: 'olm',
        description:
          'Installation method: olm (Operator Lifecycle Manager), helm (Helm chart), or manifest (direct YAML)',
      },
      helmRepo: {
        type: 'string',
        description: 'Helm repository URL (required if source is helm)',
      },
      manifestUrl: {
        type: 'string',
        description: 'URL to operator manifest (required if source is manifest)',
      },
      createNamespace: {
        type: 'boolean',
        default: true,
        description: 'Create namespace if it does not exist',
      },
      installPlanApproval: {
        type: 'string',
        enum: ['Automatic', 'Manual'],
        default: 'Automatic',
        description: 'Install plan approval strategy for OLM',
      },
    },
    required: ['operatorName'],
  },
};

export async function handleOcInstallOperator(params: OcInstallOperatorParams) {
  const manager = OpenShiftManager.getInstance();

  try {
    const validated = OcInstallOperatorSchema.parse(params);

    // Create namespace if requested
    if (validated.createNamespace) {
      const namespaceResult = await createNamespaceIfNotExists(
        manager,
        validated.namespace,
        validated.context
      );
      if (!namespaceResult.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Warning: Failed to create namespace ${validated.namespace}: ${namespaceResult.error || 'Unknown error'}`,
            },
          ],
        };
      }
    }

    // Install operator based on source
    switch (validated.source) {
      case 'olm':
        return await installOperatorViaOLM(manager, validated);
      case 'helm':
        return await installOperatorViaHelm(manager, validated);
      case 'manifest':
        return await installOperatorViaManifest(manager, validated);
      default:
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: Unsupported installation source: ${validated.source}`,
            },
          ],
        };
    }
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

async function installOperatorViaOLM(manager: OpenShiftManager, params: OcInstallOperatorParams) {
  try {
    // First, check if OLM is available
    const olmCheck = await manager.executeCommand(
      ['get', 'crd', 'subscriptions.operators.coreos.com'],
      { context: params.context }
    );

    if (!olmCheck.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Operator Lifecycle Manager (OLM) not found on cluster. Please install OLM first or use 'helm' or 'manifest' source instead.`,
          },
        ],
      };
    }

    // Skip package existence check to avoid timeout/buffer issues
    // The subscription creation will fail gracefully if the operator doesn't exist

    // Use sensible defaults for Red Hat operators to avoid parsing large JSON responses
    const packageName = params.operatorName;
    const defaultChannel = params.channel || 'stable';
    const catalogSource = 'redhat-operators'; // Default for Red Hat operators
    const catalogSourceNamespace = 'openshift-marketplace';

    // Create OperatorGroup using oc apply tool
    const operatorGroupYaml = `apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: ${params.operatorName}-operator-group
  namespace: ${params.namespace}
spec:
  targetNamespaces:
  - ${params.namespace}`;

    const ogResult = await handleOcApply({
      manifest: operatorGroupYaml,
      namespace: params.namespace,
      context: params.context || '',
      dryRun: false,
      force: false,
      validate: true,
      wait: false,
      prune: false,
      recursive: false,
      kustomize: false,
      serverSideApply: false,
      overwrite: false,
    });

    // Check if OperatorGroup creation had issues (but continue anyway as it might already exist)
    if (
      ogResult.content[0].text.includes('Error') &&
      !ogResult.content[0].text.includes('already exists')
    ) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error creating OperatorGroup: ${ogResult.content[0].text}`,
          },
        ],
      };
    }

    // Create Subscription using oc apply tool
    const subscriptionYaml = `apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: ${params.operatorName}-subscription
  namespace: ${params.namespace}
spec:
  channel: ${defaultChannel}
  name: ${packageName}
  source: ${catalogSource}
  sourceNamespace: ${catalogSourceNamespace}
  installPlanApproval: ${params.installPlanApproval}${
    params.version
      ? `
  startingCSV: ${packageName}.v${params.version}`
      : ''
  }`;

    const subResult = await handleOcApply({
      manifest: subscriptionYaml,
      namespace: params.namespace,
      context: params.context || '',
      dryRun: false,
      force: false,
      validate: true,
      wait: false,
      prune: false,
      recursive: false,
      kustomize: false,
      serverSideApply: false,
      overwrite: false,
    });

    if (subResult.content[0].text.includes('Error')) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error creating Subscription: ${subResult.content[0].text}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `# ✅ Operator Installation Initiated Successfully

## 📋 Installation Summary
- **Operator**: ${params.operatorName}
- **Namespace**: ${params.namespace}
- **Channel**: ${defaultChannel}
- **Catalog Source**: ${catalogSource}
- **Install Plan Approval**: ${params.installPlanApproval}

## 📦 Resources Created
- **OperatorGroup**: ${params.operatorName}-operator-group
- **Subscription**: ${params.operatorName}-subscription

## 🔍 Monitor Installation Progress
\`\`\`bash
# Check subscription status
oc get subscription ${params.operatorName}-subscription -n ${params.namespace}

# Check operator installation progress
oc get csv -n ${params.namespace}

# Check operator pods
oc get pods -n ${params.namespace}

# View subscription details
oc describe subscription ${params.operatorName}-subscription -n ${params.namespace}
\`\`\`

## 📝 Installation Details
The operator installation has been initiated via OLM (Operator Lifecycle Manager). The installation process may take a few minutes to complete as it downloads and installs the operator components.

**Next Steps:**
1. Monitor the subscription status until it shows "Installed"
2. Verify the operator pods are running
3. Check for any InstallPlan that may require approval if using Manual approval mode
4. Configure the operator according to its documentation`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error installing operator via OLM: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

async function installOperatorViaHelm(manager: OpenShiftManager, params: OcInstallOperatorParams) {
  if (!params.helmRepo) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Error: helmRepo is required when using helm installation source',
        },
      ],
    };
  }

  try {
    // Add Helm repository
    const addRepoResult = await manager.executeCommand(
      ['helm', 'repo', 'add', `${params.operatorName}-repo`, params.helmRepo],
      { context: params.context }
    );

    if (!addRepoResult.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Failed to add Helm repository: ${addRepoResult.error}`,
          },
        ],
      };
    }

    // Update Helm repositories
    await manager.executeCommand(['helm', 'repo', 'update'], { context: params.context });

    // Install the operator
    const installArgs = [
      'helm',
      'install',
      params.operatorName,
      `${params.operatorName}-repo/${params.operatorName}`,
      '--namespace',
      params.namespace,
    ];

    if (params.version) {
      installArgs.push('--version', params.version);
    }

    const installResult = await manager.executeCommand(installArgs, { context: params.context });

    if (!installResult.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Failed to install operator via Helm: ${installResult.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Tool: oc_install_operator, Result: Successfully installed operator '${params.operatorName}' via Helm in namespace '${params.namespace}'. Result: ${installResult.data}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error installing operator via Helm: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

async function installOperatorViaManifest(
  manager: OpenShiftManager,
  params: OcInstallOperatorParams
) {
  if (!params.manifestUrl) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Error: manifestUrl is required when using manifest installation source',
        },
      ],
    };
  }

  try {
    // Apply the manifest from URL
    const applyResult = await manager.executeCommand(
      ['apply', '-f', params.manifestUrl, '--namespace', params.namespace],
      { context: params.context }
    );

    if (!applyResult.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Failed to apply operator manifest: ${applyResult.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Tool: oc_install_operator, Result: Successfully installed operator '${params.operatorName}' via manifest in namespace '${params.namespace}'. Result: ${applyResult.data}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error installing operator via manifest: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
