import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const ocLoginTool: Tool = {
  name: 'oc_login',
  description: 'Securely log into an OpenShift cluster using username/password or token authentication',
  inputSchema: {
    type: 'object',
    properties: {
      server: {
        type: 'string',
        description: 'OpenShift cluster server URL (e.g., https://api.cluster.example.com:6443)',
        format: 'uri'
      },
      authMethod: {
        type: 'string',
        description: 'Authentication method to use',
        enum: ['token', 'password'],
        default: 'token'
      },
      token: {
        type: 'string',
        description: 'OpenShift authentication token (required if authMethod is token)'
      },
      username: {
        type: 'string',
        description: 'Username for password authentication (required if authMethod is password)'
      },
      password: {
        type: 'string',
        description: 'Password for password authentication (required if authMethod is password)'
      },
      context: {
        type: 'string',
        description: 'Context name to save the login session (optional)',
        default: ''
      },
      insecureSkipTlsVerify: {
        type: 'boolean',
        description: 'Skip TLS certificate verification (not recommended for production)',
        default: false
      },
      certificateAuthority: {
        type: 'string',
        description: 'Path to certificate authority file for TLS verification'
      },
      namespace: {
        type: 'string',
        description: 'Default namespace to set after login',
        default: 'default'
      },
      timeout: {
        type: 'number',
        description: 'Login timeout in seconds',
        default: 30,
        minimum: 5,
        maximum: 300
      }
    },
    required: ['server', 'authMethod'],
    additionalProperties: false
  }
};

export interface OcLoginArgs {
  server: string;
  authMethod: 'token' | 'password';
  token?: string;
  username?: string;
  password?: string;
  context?: string;
  insecureSkipTlsVerify?: boolean;
  certificateAuthority?: string;
  namespace?: string;
  timeout?: number;
}

export async function handleOcLogin(args: OcLoginArgs) {
  const manager = OpenShiftManager.getInstance();
  
  try {
    // Validate arguments
    const validationResult = validateLoginArgs(args);
    if (!validationResult.valid) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ **Validation Error**\n\n${validationResult.error}`,
          },
        ],
        isError: true,
      };
    }

    // Validate server URL for security
    if (!isValidServerUrl(args.server)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ **Invalid Server URL**\n\nServer URL must be a valid HTTPS URL to an OpenShift API server.\n\n**Security Requirements**:\n- Must use HTTPS protocol\n- Must not be a private/local IP address\n- Must be a properly formatted URL\n\n**Example**: \`https://api.cluster.example.com:6443\``,
          },
        ],
        isError: true,
      };
    }

    // Build the login command
    const command = buildLoginCommand(args);
    
    // Execute the login command
    const result = await manager.executeCommand(command, { 
      timeout: (args.timeout || 30) * 1000,
      // Don't pass context for login command as we're establishing it
    });

    if (!result.success) {
      return {
        content: [
          {
            type: 'text' as const,
            text: formatLoginError(args, result.error || 'Unknown error'),
          },
        ],
        isError: true,
      };
    }

    // Set default namespace if specified
    if (args.namespace && args.namespace !== 'default') {
      const namespaceResult = await manager.executeCommand(
        ['config', 'set-context', '--current', '--namespace', args.namespace],
        { timeout: 10000 }
      );
      
      if (!namespaceResult.success) {
        // Log warning but don't fail the login
        console.warn(`Warning: Failed to set default namespace to ${args.namespace}: ${namespaceResult.error}`);
      }
    }

    // Get user information to confirm login
    const whoamiResult = await manager.executeCommand(['whoami'], { timeout: 10000 });
    const currentUserResult = await manager.executeCommand(['config', 'current-context'], { timeout: 10000 });
    
    // Format success response
    const responseText = formatLoginSuccess(args, result.data, whoamiResult.data, currentUserResult.data);

    return {
      content: [
        {
          type: 'text' as const,
          text: responseText,
        },
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: `❌ **Unexpected Error During Login**\n\n**Server**: ${args.server}\n**Error**: ${errorMessage}\n\n**Please check**:\n- Network connectivity to the OpenShift cluster\n- Server URL format and accessibility\n- Authentication credentials\n- Firewall and proxy settings`,
        },
      ],
      isError: true,
    };
  }
}

function validateLoginArgs(args: OcLoginArgs): { valid: boolean; error?: string } {
  // Check required fields
  if (!args.server || !args.authMethod) {
    return {
      valid: false,
      error: 'Missing required fields: server and authMethod are required.'
    };
  }

  // Validate authentication method and required credentials
  if (args.authMethod === 'token') {
    if (!args.token || args.token.trim().length === 0) {
      return {
        valid: false,
        error: 'Token is required when authMethod is "token".'
      };
    }
    
    // Basic token format validation
    if (args.token.length < 10) {
      return {
        valid: false,
        error: 'Token appears to be too short. Please provide a valid OpenShift authentication token.'
      };
    }
  } else if (args.authMethod === 'password') {
    if (!args.username || args.username.trim().length === 0) {
      return {
        valid: false,
        error: 'Username is required when authMethod is "password".'
      };
    }
    
    if (!args.password || args.password.trim().length === 0) {
      return {
        valid: false,
        error: 'Password is required when authMethod is "password".'
      };
    }
  } else {
    return {
      valid: false,
      error: 'Invalid authMethod. Must be either "token" or "password".'
    };
  }

  // Validate timeout
  if (args.timeout && (args.timeout < 5 || args.timeout > 300)) {
    return {
      valid: false,
      error: 'Timeout must be between 5 and 300 seconds.'
    };
  }

  return { valid: true };
}

function isValidServerUrl(server: string): boolean {
  try {
    const url = new URL(server);
    
    // Must be HTTPS for security
    if (url.protocol !== 'https:') {
      return false;
    }
    
    // Must have a hostname
    if (!url.hostname || url.hostname.length === 0) {
      return false;
    }
    
    // Block private IP ranges and localhost for security
    const hostname = url.hostname.toLowerCase();
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'metadata.google.internal',
      '169.254.169.254', // AWS metadata
    ];
    
    if (blockedHosts.some(blocked => hostname === blocked || hostname.endsWith('.' + blocked))) {
      return false;
    }
    
    // Block private IP ranges
    if (hostname.match(/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/)) {
      return false;
    }
    
    // Common OpenShift API server patterns
    const validPatterns = [
      /^api\./,  // api.cluster.example.com
      /\.openshift\./,  // cluster.openshift.example.com
      /\.k8s\./,  // cluster.k8s.example.com
      /\.ocp\./,  // cluster.ocp.example.com
    ];
    
    // Allow if matches common patterns or is a valid FQDN
    return validPatterns.some(pattern => pattern.test(hostname)) || hostname.includes('.');
    
  } catch {
    return false;
  }
}

function buildLoginCommand(args: OcLoginArgs): string[] {
  const command = ['login'];
  
  // Add server URL
  command.push(args.server);
  
  // Add authentication method
  if (args.authMethod === 'token') {
    command.push('--token', args.token!);
  } else if (args.authMethod === 'password') {
    command.push('--username', args.username!);
    command.push('--password', args.password!);
  }
  
  // Add context if specified
  if (args.context && args.context.trim().length > 0) {
    command.push('--context', args.context);
  }
  
  // Add TLS options
  if (args.insecureSkipTlsVerify) {
    command.push('--insecure-skip-tls-verify=true');
  }
  
  if (args.certificateAuthority) {
    command.push('--certificate-authority', args.certificateAuthority);
  }
  
  return command;
}

function formatLoginError(args: OcLoginArgs, error: string): string {
  let response = `❌ **OpenShift Login Failed**\n\n`;
  
  response += `**Connection Details**:\n`;
  response += `- **Server**: ${args.server}\n`;
  response += `- **Auth Method**: ${args.authMethod}\n`;
  response += `- **Context**: ${args.context || 'default'}\n`;
  response += `- **Namespace**: ${args.namespace || 'default'}\n\n`;
  
  response += `**Error Details**:\n\`\`\`\n${error}\n\`\`\`\n\n`;
  
  // Categorize common errors and provide solutions
  if (error.includes('certificate') || error.includes('TLS') || error.includes('SSL')) {
    response += `**🔒 TLS/Certificate Error**\n\n`;
    response += `**Possible Solutions**:\n`;
    response += `1. **Verify server URL**: Ensure the URL is correct and accessible\n`;
    response += `2. **Certificate Authority**: Provide CA certificate with \`certificateAuthority\` parameter\n`;
    response += `3. **Skip TLS Verification**: Use \`insecureSkipTlsVerify: true\` (not recommended for production)\n`;
    response += `4. **Check certificates**: \`openssl s_client -connect ${new URL(args.server).host}\`\n\n`;
  } else if (error.includes('unauthorized') || error.includes('Unauthorized') || error.includes('401')) {
    response += `**🔐 Authentication Error**\n\n`;
    response += `**Possible Solutions**:\n`;
    if (args.authMethod === 'token') {
      response += `1. **Verify token**: Ensure the token is valid and not expired\n`;
      response += `2. **Token format**: Check token format (should start with 'sha256~' for service account tokens)\n`;
      response += `3. **Get new token**: Obtain a fresh token from OpenShift web console\n`;
      response += `4. **Service account**: Ensure service account has proper permissions\n\n`;
    } else {
      response += `1. **Verify credentials**: Check username and password are correct\n`;
      response += `2. **Account status**: Ensure account is not locked or disabled\n`;
      response += `3. **LDAP/OAuth**: Check if external authentication is configured\n`;
      response += `4. **Try web console**: Test login via OpenShift web console first\n\n`;
    }
  } else if (error.includes('timeout') || error.includes('Timeout')) {
    response += `**⏱️ Timeout Error**\n\n`;
    response += `**Possible Solutions**:\n`;
    response += `1. **Network connectivity**: Check if server is reachable\n`;
    response += `2. **Increase timeout**: Use a higher timeout value\n`;
    response += `3. **Proxy settings**: Configure proxy if behind corporate firewall\n`;
    response += `4. **DNS resolution**: Verify server hostname resolves correctly\n\n`;
  } else if (error.includes('connection') || error.includes('Connection')) {
    response += `**🌐 Connection Error**\n\n`;
    response += `**Possible Solutions**:\n`;
    response += `1. **Server accessibility**: Verify server URL is reachable\n`;
    response += `2. **Network connectivity**: Check internet connection\n`;
    response += `3. **Firewall rules**: Ensure port 6443 (or custom port) is accessible\n`;
    response += `4. **VPN connection**: Connect to VPN if cluster is behind private network\n\n`;
  }
  
  response += `**🔧 Troubleshooting Commands**:\n`;
  response += `\`\`\`bash\n`;
  response += `# Test server connectivity\n`;
  response += `curl -k ${args.server}/healthz\n\n`;
  response += `# Check current context\n`;
  response += `oc config current-context\n\n`;
  response += `# List available contexts\n`;
  response += `oc config get-contexts\n\n`;
  response += `# Manual login for testing\n`;
  if (args.authMethod === 'token') {
    response += `oc login ${args.server} --token=<your-token>\n`;
  } else {
    response += `oc login ${args.server} --username=<username>\n`;
  }
  response += `\`\`\`\n\n`;
  
  response += `**🔒 Security Notes**:\n`;
  response += `- Never share authentication tokens or passwords\n`;
  response += `- Use service account tokens for automation\n`;
  response += `- Prefer token authentication over password authentication\n`;
  response += `- Always use HTTPS in production environments\n`;
  
  return response;
}

function formatLoginSuccess(args: OcLoginArgs, loginOutput: string, whoami?: string, currentContext?: string): string {
  let response = `✅ **OpenShift Login Successful**\n\n`;
  
  response += `**Connection Details**:\n`;
  response += `- **Server**: ${args.server}\n`;
  response += `- **Auth Method**: ${args.authMethod}\n`;
  response += `- **Context**: ${currentContext?.trim() || args.context || 'default'}\n`;
  response += `- **Namespace**: ${args.namespace || 'default'}\n`;
  response += `- **User**: ${whoami?.trim() || 'Unknown'}\n\n`;
  
  // Parse login output for additional information
  if (loginOutput.includes('Login successful')) {
    response += `**✅ Authentication Status**: Login successful\n\n`;
  }
  
  if (loginOutput.includes('Using project')) {
    const projectMatch = loginOutput.match(/Using project "([^"]+)"/);
    if (projectMatch) {
      response += `**📂 Active Project**: ${projectMatch[1]}\n\n`;
    }
  }
  
  response += `**🔧 Verification Commands**:\n`;
  response += `\`\`\`bash\n`;
  response += `# Check current user\n`;
  response += `oc whoami\n\n`;
  response += `# Check current context\n`;
  response += `oc config current-context\n\n`;
  response += `# Check available projects\n`;
  response += `oc get projects\n\n`;
  response += `# Check cluster info\n`;
  response += `oc cluster-info\n`;
  response += `\`\`\`\n\n`;
  
  response += `**🎯 Next Steps**:\n`;
  response += `- **Explore cluster**: Use \`oc get nodes\` to see cluster nodes\n`;
  response += `- **List projects**: Use \`oc get projects\` to see available projects\n`;
  response += `- **Set project**: Use \`oc project <project-name>\` to switch projects\n`;
  response += `- **Get resources**: Use other MCP tools like \`oc_get\` to explore resources\n\n`;
  
  response += `**🔒 Security Reminders**:\n`;
  response += `- **Session expires**: OpenShift tokens have expiration times\n`;
  response += `- **Re-authentication**: You may need to login again when tokens expire\n`;
  response += `- **Context isolation**: Each context maintains separate authentication\n`;
  response += `- **Logout**: Use \`oc logout\` when done to clear credentials\n\n`;
  
  response += `**🎪 Quick Start Examples**:\n`;
  response += `\`\`\`bash\n`;
  response += `# Get all pods in current namespace\n`;
  response += `oc get pods\n\n`;
  response += `# Get all resources in a specific namespace\n`;
  response += `oc get all -n <namespace>\n\n`;
  response += `# Create a new project\n`;
  response += `oc new-project my-project\n`;
  response += `\`\`\`\n`;
  
  return response;
}
