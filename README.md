# OpenShift MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with comprehensive OpenShift/Kubernetes cluster management capabilities through the `oc` command-line interface.

## Demo Video

Watch the `oc-new-app` tool deploy a complete Spring Boot application from GitHub to OpenShift:

https://github.com/user-attachments/assets/f4bace3f-755b-462f-8a8a-680e4dc02129

## Features

- **Resource Management**: Get, create, delete, and apply OpenShift resources
- **Project Operations**: Create and manage OpenShift projects
- **Deployment Management**: Handle DeploymentConfigs, scaling, and rollouts
- **Route Management**: Create and manage OpenShift routes
- **Build Operations**: Start and monitor OpenShift builds
- **Logging**: Retrieve logs from pods, deploymentconfigs, and builds
- **Multi-Context Support**: Work with multiple OpenShift clusters
- **Operator Management**: Install operators via OLM, Helm, or direct manifests
- **Application Deployment**: Deploy applications from Git repositories using S2I builds with automatic route exposure
- **Scaling Operations**: Scale deployments, deploymentconfigs, replicasets, and statefulsets
- **Resource Description**: Describe any resource with multiple output formats including human-readable summaries
- **Cluster Information**: Access comprehensive cluster status, nodes, and configuration via MCP resources
- **Troubleshooting Prompts**: Interactive troubleshooting guides for common OpenShift scenarios
- **Log Sampling**: Sample and analyze pod logs with intelligent pattern detection and context

## Prerequisites

- Node.js 18+
- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster

## Installation

```bash
git clone https://github.com/your-org/mcp-server-openshift.git
cd mcp-server-openshift
npm install
npm run build
```

## Configuration

Add to your MCP client configuration:

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "openshift": {
      "command": "node",
      "args": ["/path/to/mcp-server-openshift/dist/index.js"],
      "env": {
        "OPENSHIFT_CONTEXT": "your-context-name",
        "OPENSHIFT_NAMESPACE": "your-default-namespace"
      }
    }
  }
}
```

### HTTP/SSE Transport (Remote Access)

```bash
# Start HTTP server
npm run start:http

# Connect via MCP remote
npx -y mcp-remote http://localhost:3000/sse --transport sse-only
```

## Tools

### Core Resource Management
- **`oc_get`** - Get OpenShift resources (pods, deployments, services, routes, etc.)
- **`oc_create`** - Create OpenShift resources from manifests or templates
- **`oc_apply`** - Apply YAML manifests with validation and conflict resolution
- **`oc_delete`** - Delete resources with safety checks and confirmation options
- **`oc_patch`** - Patch resources using strategic merge, JSON merge, or JSON patch operations
- **`oc_describe`** - Describe resources with multiple output formats

### Application Lifecycle
- **`oc_new_app`** - Deploy applications from Git repositories with S2I builds
- **`oc_scale`** - Scale deployments, deploymentconfigs, replicasets, and statefulsets
- **`oc_logs`** - Get logs from pods, deployments, builds with filtering options

### Advanced Operations
- **`oc_install_operator`** - Install operators via OLM, Helm, or direct manifests

## Resources

MCP Resources provide read-only access to cluster information:

- **`openshift://cluster-info`** - Comprehensive cluster status, nodes, namespaces, and events
- **`openshift://project-list`** - Detailed project information with quotas and usage statistics
- **`openshift://app-templates`** - Application deployment templates and patterns

## Prompts

Interactive troubleshooting and operational guidance:

- **`troubleshoot-pod-prompt`** - Comprehensive pod troubleshooting guide
- **`monitoring-prompts`** - Monitoring and observability guidance for different scenarios

## Sampling

Intelligent log analysis and pattern detection:

- **Pod Logs Sampling** - Automatic log sampling with error pattern detection and context analysis

## Usage Examples

### Deploy Application
```bash
# Deploy Node.js app from GitHub
oc_new_app with gitRepo: "https://github.com/sclorg/nodejs-ex.git"
```

### Scale Application
```bash
# Scale deployment to 3 replicas
oc_scale with name: "my-app", replicas: 3
```

### Patch Resource
```bash
# Update deployment labels
oc_patch with resourceType: "deployment", name: "my-app", 
         patch: '{"metadata":{"labels":{"environment":"production"}}}'
```

### Troubleshoot Pod
```bash
# Get troubleshooting guidance
Use prompt: troubleshoot-pod-prompt
Arguments: podName: "my-app-12345", namespace: "my-project"
```

## Development

```bash
# Setup
npm install

# Build
npm run build

# Test
npm test

# Start (STDIO)
npm start

# Start (HTTP)
npm run start:http

# Development mode
npm run dev
```

## Transport Modes

### STDIO (Default)
- Direct MCP client integration
- Lower latency
- Recommended for local development

### HTTP/SSE
- Remote access capability
- Web integration friendly
- Container deployment ready

## Architecture

```
src/
├── index.ts              # Main server entry point
├── tools/                # Tool implementations
├── resources/            # MCP resources
├── prompts/              # Interactive prompts
├── sampling/             # Log sampling and analysis
├── models/               # Zod validation schemas
└── utils/                # OpenShift CLI wrapper
```

## Security

- Respects OpenShift RBAC permissions
- No credential storage or transmission
- Executes with user's existing permissions
- Comprehensive input validation

## License

MIT License - see LICENSE file for details.
