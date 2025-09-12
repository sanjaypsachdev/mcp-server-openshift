import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocApiResourcesTool: Tool = {
  name: 'oc_api_resources',
  description: 'List all available API resources in the OpenShift cluster with their details',
  inputSchema: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'OpenShift context to use (optional)',
        default: '',
      },
      apiGroup: {
        type: 'string',
        description: 'Filter by specific API group (e.g., apps, extensions, networking.k8s.io)',
      },
      namespaced: {
        type: 'boolean',
        description: 'Filter by namespaced resources only',
      },
      verbs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by supported verbs (e.g., ["get", "list", "create", "delete"])',
      },
      output: {
        type: 'string',
        enum: ['table', 'json', 'yaml', 'wide'],
        default: 'table',
        description: 'Output format for the API resources list',
      },
      categories: {
        type: 'boolean',
        description: 'Group resources by categories (core, apps, networking, etc.)',
        default: true,
      },
    },
    additionalProperties: false,
  },
};

export interface OcApiResourcesArgs {
  context?: string;
  apiGroup?: string;
  namespaced?: boolean;
  verbs?: string[];
  output?: 'table' | 'json' | 'yaml' | 'wide';
  categories?: boolean;
}

export async function handleOcApiResources(args: OcApiResourcesArgs) {
  const manager = OpenShiftManager.getInstance();

  try {
    // Build the api-resources command
    const command = buildApiResourcesCommand(args);

    // Execute the command
    const result = await manager.executeCommand(command, {
      context: args.context,
      timeout: 30000,
    });

    if (!result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ **Failed to List API Resources**\n\n**Error Details**:\n\`\`\`\n${result.error}\n\`\`\`\n\n**Troubleshooting Tips**:\n- Verify cluster connectivity: \`oc cluster-info\`\n- Check authentication: \`oc whoami\`\n- Verify context: \`oc config current-context\`\n- Test basic access: \`oc get nodes\``,
          },
        ],
        isError: true,
      };
    }

    // Parse and format the result based on output format
    if (args.output === 'json' || args.output === 'yaml') {
      return formatStructuredApiResources(result.data, args);
    } else {
      return formatTableApiResources(result.data, args);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ **Unexpected Error Listing API Resources**\n\n**Error**: ${errorMessage}\n\n**Please check**:\n- OpenShift CLI connectivity\n- Cluster accessibility\n- Authentication status`,
        },
      ],
      isError: true,
    };
  }
}

function buildApiResourcesCommand(args: OcApiResourcesArgs): string[] {
  const command = ['api-resources'];

  // Add API group filter
  if (args.apiGroup) {
    command.push('--api-group', args.apiGroup);
  }

  // Add namespaced filter
  if (args.namespaced !== undefined) {
    command.push('--namespaced', args.namespaced.toString());
  }

  // Add verbs filter
  if (args.verbs && args.verbs.length > 0) {
    command.push('--verbs', args.verbs.join(','));
  }

  // Add output format
  if (args.output && args.output !== 'table') {
    command.push('-o', args.output);
  }

  return command;
}

function formatTableApiResources(data: string, args: OcApiResourcesArgs) {
  let response = `# 📋 OpenShift API Resources\n\n`;

  response += `**Cluster Information**:\n`;
  response += `- **Context**: ${args.context || 'current'}\n`;
  response += `- **Output Format**: ${args.output || 'table'}\n`;

  if (args.apiGroup) {
    response += `- **API Group Filter**: ${args.apiGroup}\n`;
  }
  if (args.namespaced !== undefined) {
    response += `- **Namespaced Filter**: ${args.namespaced ? 'Namespaced only' : 'Cluster-scoped only'}\n`;
  }
  if (args.verbs && args.verbs.length > 0) {
    response += `- **Verbs Filter**: ${args.verbs.join(', ')}\n`;
  }

  response += `\n`;

  if (args.categories) {
    response += formatCategorizedResources(data);
  } else {
    response += `## 📊 API Resources List\n\n`;
    response += `\`\`\`\n${data}\n\`\`\`\n\n`;
  }

  response += `## 🔧 Useful Commands\n\n`;
  response += `\`\`\`bash\n`;
  response += `# List all API resources\n`;
  response += `oc api-resources\n\n`;
  response += `# List resources for specific API group\n`;
  response += `oc api-resources --api-group=apps\n\n`;
  response += `# List only namespaced resources\n`;
  response += `oc api-resources --namespaced=true\n\n`;
  response += `# List resources with specific verbs\n`;
  response += `oc api-resources --verbs=list,get\n\n`;
  response += `# Get detailed resource information\n`;
  response += `oc explain <resource-name>\n`;
  response += `\`\`\`\n\n`;

  response += `## 💡 Next Steps\n\n`;
  response += `- **Explore Resources**: Use \`oc explain <resource>\` to understand resource schemas\n`;
  response += `- **Check Permissions**: Use \`oc auth can-i <verb> <resource>\` to verify access\n`;
  response += `- **List Instances**: Use \`oc get <resource>\` to see actual resource instances\n`;
  response += `- **Create Resources**: Use \`oc create\` or \`oc apply\` to create new resources\n`;

  return {
    content: [
      {
        type: 'text' as const,
        text: response,
      },
    ],
  };
}

function formatStructuredApiResources(data: string, args: OcApiResourcesArgs) {
  let response = `# 📋 OpenShift API Resources (${args.output?.toUpperCase()})\n\n`;

  response += `**Query Parameters**:\n`;
  response += `- **Context**: ${args.context || 'current'}\n`;
  response += `- **Format**: ${args.output}\n`;
  if (args.apiGroup) response += `- **API Group**: ${args.apiGroup}\n`;
  if (args.namespaced !== undefined) response += `- **Namespaced**: ${args.namespaced}\n`;
  if (args.verbs) response += `- **Verbs**: ${args.verbs.join(', ')}\n`;

  response += `\n## 📊 API Resources Data\n\n`;
  response += `\`\`\`${args.output}\n${data}\n\`\`\`\n\n`;

  response += `## 🔧 Processing Commands\n\n`;
  response += `\`\`\`bash\n`;
  response += `# Parse JSON output with jq\n`;
  response += `oc api-resources -o json | jq '.resources[] | select(.namespaced == true)'\n\n`;
  response += `# Filter YAML output\n`;
  response += `oc api-resources -o yaml | grep -A5 -B5 "kind:"\n`;
  response += `\`\`\`\n`;

  return {
    content: [
      {
        type: 'text' as const,
        text: response,
      },
    ],
  };
}

function formatCategorizedResources(data: string): string {
  const lines = data.split('\n').filter(line => line.trim());
  const resources: Array<{
    name: string;
    shortNames: string;
    apiVersion: string;
    namespaced: string;
    kind: string;
  }> = [];

  // Parse the table data (skip header)
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (parts.length >= 5) {
      resources.push({
        name: parts[0],
        shortNames: parts[1],
        apiVersion: parts[2],
        namespaced: parts[3],
        kind: parts[4],
      });
    }
  }

  // Categorize resources
  const categories = {
    'Core Resources': resources.filter(r => !r.apiVersion.includes('/') || r.apiVersion === 'v1'),
    'Apps & Deployments': resources.filter(
      r => r.apiVersion.includes('apps/') || r.apiVersion.includes('extensions/')
    ),
    Networking: resources.filter(
      r => r.apiVersion.includes('networking') || r.kind.toLowerCase().includes('network')
    ),
    Storage: resources.filter(
      r => r.kind.toLowerCase().includes('volume') || r.kind.toLowerCase().includes('storage')
    ),
    'Security & RBAC': resources.filter(
      r =>
        r.apiVersion.includes('rbac') ||
        r.kind.toLowerCase().includes('role') ||
        r.kind.toLowerCase().includes('security')
    ),
    'OpenShift Specific': resources.filter(
      r => r.apiVersion.includes('openshift.io') || r.apiVersion.includes('route.openshift.io')
    ),
    'Operators & CRDs': resources.filter(
      r => r.apiVersion.includes('operators') || r.apiVersion.includes('apiextensions')
    ),
    Monitoring: resources.filter(
      r => r.apiVersion.includes('monitoring') || r.kind.toLowerCase().includes('metric')
    ),
    Other: resources.filter(r => {
      const apiGroup = r.apiVersion.split('/')[0];
      return ![
        'v1',
        'apps',
        'extensions',
        'networking',
        'rbac',
        'openshift.io',
        'route.openshift.io',
        'operators',
        'apiextensions',
        'monitoring',
      ].some(
        known =>
          apiGroup.includes(known) ||
          r.kind.toLowerCase().includes('volume') ||
          r.kind.toLowerCase().includes('storage') ||
          r.kind.toLowerCase().includes('network') ||
          r.kind.toLowerCase().includes('role') ||
          r.kind.toLowerCase().includes('security') ||
          r.kind.toLowerCase().includes('metric')
      );
    }),
  };

  let response = `## 📊 API Resources by Category\n\n`;

  Object.entries(categories).forEach(([categoryName, categoryResources]) => {
    if (categoryResources.length > 0) {
      response += `### 🔹 ${categoryName} (${categoryResources.length} resources)\n\n`;
      response += `| Resource | Short Names | API Version | Namespaced | Kind |\n`;
      response += `|----------|-------------|-------------|------------|------|\n`;

      categoryResources.forEach(resource => {
        response += `| ${resource.name} | ${resource.shortNames} | ${resource.apiVersion} | ${resource.namespaced} | ${resource.kind} |\n`;
      });

      response += `\n`;
    }
  });

  response += `## 📈 Resource Summary\n\n`;
  response += `- **Total Resources**: ${resources.length}\n`;
  response += `- **Namespaced**: ${resources.filter(r => r.namespaced === 'true').length}\n`;
  response += `- **Cluster-scoped**: ${resources.filter(r => r.namespaced === 'false').length}\n`;
  response += `- **Core API (v1)**: ${resources.filter(r => r.apiVersion === 'v1').length}\n`;
  response += `- **OpenShift Specific**: ${resources.filter(r => r.apiVersion.includes('openshift.io')).length}\n\n`;

  return response;
}
