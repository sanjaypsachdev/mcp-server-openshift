import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocExplainTool: Tool = {
  name: 'oc_explain',
  description: 'Explain OpenShift/Kubernetes resource schemas, fields, and API documentation',
  inputSchema: {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        description:
          'Resource type to explain (e.g., pod, deployment, service, route.route.openshift.io)',
      },
      field: {
        type: 'string',
        description: 'Specific field path to explain (e.g., spec.containers, metadata.labels)',
      },
      context: {
        type: 'string',
        description: 'OpenShift context to use (optional)',
        default: '',
      },
      apiVersion: {
        type: 'string',
        description: 'Specific API version to explain (e.g., apps/v1, route.openshift.io/v1)',
      },
      recursive: {
        type: 'boolean',
        description: 'Show all fields recursively',
        default: false,
      },
      output: {
        type: 'string',
        enum: ['plaintext', 'json'],
        default: 'plaintext',
        description: 'Output format for the explanation',
      },
    },
    required: ['resource'],
    additionalProperties: false,
  },
};

export interface OcExplainArgs {
  resource: string;
  field?: string;
  context?: string;
  apiVersion?: string;
  recursive?: boolean;
  output?: 'plaintext' | 'json';
}

export async function handleOcExplain(args: OcExplainArgs) {
  const manager = OpenShiftManager.getInstance();

  try {
    // Validate resource name
    if (!isValidResourceName(args.resource)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ **Invalid Resource Name**\n\nResource name "${args.resource}" is not valid.\n\n**Valid Examples**:\n- \`pod\` or \`pods\`\n- \`deployment\` or \`deployments.apps\`\n- \`service\` or \`services\`\n- \`route.route.openshift.io\`\n- \`buildconfig.build.openshift.io\`\n\n**Tip**: Use \`oc api-resources\` to see all available resource types.`,
          },
        ],
        isError: true,
      };
    }

    // Build the explain command
    const command = buildExplainCommand(args);

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
            text: formatExplainError(args, result.error || 'Unknown error'),
          },
        ],
        isError: true,
      };
    }

    // Format the explanation based on output type
    return formatExplanationResponse(args, result.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ **Unexpected Error During Resource Explanation**\n\n**Resource**: ${args.resource}${args.field ? `.${args.field}` : ''}\n**Error**: ${errorMessage}\n\n**Please check**:\n- Resource name spelling and format\n- OpenShift CLI connectivity\n- Cluster accessibility`,
        },
      ],
      isError: true,
    };
  }
}

function isValidResourceName(resource: string): boolean {
  // Basic validation for resource names
  if (!resource || resource.trim().length === 0) {
    return false;
  }

  // Resource names should only contain lowercase letters, numbers, dots, and hyphens
  const validPattern = /^[a-z0-9.-]+$/;
  return validPattern.test(resource.trim());
}

function buildExplainCommand(args: OcExplainArgs): string[] {
  const command = ['explain'];

  // Build resource path
  let resourcePath = args.resource;
  if (args.field) {
    resourcePath += `.${args.field}`;
  }
  command.push(resourcePath);

  // Add API version if specified
  if (args.apiVersion) {
    command.push('--api-version', args.apiVersion);
  }

  // Add recursive flag
  if (args.recursive) {
    command.push('--recursive');
  }

  // Add output format
  if (args.output === 'json') {
    command.push('--output', 'json');
  }

  return command;
}

function formatExplainError(args: OcExplainArgs, error: string): string {
  let response = `❌ **Resource Explanation Failed**\n\n`;

  response += `**Resource Details**:\n`;
  response += `- **Resource**: ${args.resource}\n`;
  if (args.field) response += `- **Field**: ${args.field}\n`;
  if (args.apiVersion) response += `- **API Version**: ${args.apiVersion}\n`;
  response += `- **Context**: ${args.context || 'current'}\n\n`;

  response += `**Error Details**:\n\`\`\`\n${error}\n\`\`\`\n\n`;

  // Categorize common errors
  if (error.includes('not found') || error.includes('NotFound')) {
    response += `**🔍 Resource Not Found**\n\n`;
    response += `**Possible Solutions**:\n`;
    response += `1. **Check resource name**: Verify spelling and use correct singular/plural form\n`;
    response += `2. **List available resources**: \`oc api-resources | grep ${args.resource}\`\n`;
    response += `3. **Check API version**: Resource might be in different API group\n`;
    response += `4. **Verify cluster version**: Resource might not be available in this OpenShift version\n\n`;

    response += `**Common Resource Names**:\n`;
    response += `- Pods: \`pod\`, \`pods\`\n`;
    response += `- Deployments: \`deployment\`, \`deployments.apps\`\n`;
    response += `- Services: \`service\`, \`services\`\n`;
    response += `- Routes: \`route.route.openshift.io\`\n`;
    response += `- BuildConfigs: \`buildconfig.build.openshift.io\`\n\n`;
  } else if (error.includes('field') || error.includes('Field')) {
    response += `**📋 Field Not Found**\n\n`;
    response += `**Possible Solutions**:\n`;
    response += `1. **Check field path**: Verify the field path is correct\n`;
    response += `2. **List available fields**: \`oc explain ${args.resource}\` (without field specification)\n`;
    response += `3. **Use recursive**: Try \`oc explain ${args.resource} --recursive\` to see all fields\n`;
    response += `4. **Check API version**: Field might be in different API version\n\n`;
  }

  response += `**🔧 Troubleshooting Commands**:\n`;
  response += `\`\`\`bash\n`;
  response += `# List all API resources\n`;
  response += `oc api-resources\n\n`;
  response += `# Search for resource\n`;
  response += `oc api-resources | grep -i ${args.resource}\n\n`;
  response += `# Explain resource without field\n`;
  response += `oc explain ${args.resource}\n\n`;
  response += `# Show all fields recursively\n`;
  response += `oc explain ${args.resource} --recursive\n`;
  response += `\`\`\`\n`;

  return response;
}

function formatExplanationResponse(args: OcExplainArgs, data: string) {
  let response = `# 📚 OpenShift Resource Explanation\n\n`;

  response += `**Resource Information**:\n`;
  response += `- **Resource**: ${args.resource}\n`;
  if (args.field) response += `- **Field**: ${args.field}\n`;
  if (args.apiVersion) response += `- **API Version**: ${args.apiVersion}\n`;
  response += `- **Context**: ${args.context || 'current'}\n`;
  response += `- **Output Format**: ${args.output || 'plaintext'}\n`;
  response += `- **Recursive**: ${args.recursive ? 'Yes' : 'No'}\n\n`;

  // Add the explanation content
  response += `## 📖 Resource Documentation\n\n`;

  if (args.output === 'json') {
    response += `\`\`\`json\n${data}\n\`\`\`\n\n`;
  } else {
    // Format plaintext explanation with better structure
    const lines = data.split('\n');
    let inFieldSection = false;
    const formattedLines: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('FIELDS:')) {
        inFieldSection = true;
        formattedLines.push(`### 🔧 Available Fields\n`);
        continue;
      }

      if (inFieldSection && line.trim().length > 0) {
        // Format field descriptions with better structure
        if (line.match(/^\s*\w+\s*<\w+>/)) {
          formattedLines.push(`\n**${line.trim()}**`);
        } else if (line.match(/^\s{2,}\w/)) {
          formattedLines.push(`- ${line.trim()}`);
        } else {
          formattedLines.push(line);
        }
      } else if (!inFieldSection) {
        formattedLines.push(line);
      }
    }

    response += `\`\`\`\n${formattedLines.join('\n')}\n\`\`\`\n\n`;
  }

  response += `## 🔧 Related Commands\n\n`;
  response += `\`\`\`bash\n`;
  response += `# Explain specific fields\n`;
  response += `oc explain ${args.resource}.spec\n`;
  response += `oc explain ${args.resource}.status\n`;
  response += `oc explain ${args.resource}.metadata\n\n`;

  response += `# Show all fields recursively\n`;
  response += `oc explain ${args.resource} --recursive\n\n`;

  response += `# Get actual resource instances\n`;
  response += `oc get ${args.resource}\n\n`;

  response += `# Get resource with full details\n`;
  response += `oc get ${args.resource} <name> -o yaml\n`;
  response += `\`\`\`\n\n`;

  response += `## 💡 Usage Tips\n\n`;
  response += `- **Field Navigation**: Use dot notation for nested fields (e.g., \`spec.containers.image\`)\n`;
  response += `- **API Versions**: Specify API version for version-specific fields\n`;
  response += `- **Recursive Exploration**: Use \`--recursive\` to see all available fields at once\n`;
  response += `- **Examples**: Look at existing resources with \`oc get <resource> <name> -o yaml\`\n`;

  return {
    content: [
      {
        type: 'text' as const,
        text: response,
      },
    ],
  };
}
