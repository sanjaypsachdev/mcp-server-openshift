# OpenShift MCP Server

[![CI Pipeline](https://github.com/sanjaypsachdev/mcp-server-openshift/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sanjaypsachdev/mcp-server-openshift/actions/workflows/ci.yml)
[![CodeQL](https://github.com/sanjaypsachdev/mcp-server-openshift/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/sanjaypsachdev/mcp-server-openshift/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.0-blue.svg)](https://www.typescriptlang.org/)
[![OpenShift](https://img.shields.io/badge/OpenShift-4.x-red.svg)](https://www.redhat.com/en/technologies/cloud-computing/openshift)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.25%2B-blue.svg)](https://kubernetes.io/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-purple.svg)](https://modelcontextprotocol.io/)
[![Test Coverage](https://img.shields.io/badge/coverage-80%25-green.svg)](./coverage)
[![Tests](https://img.shields.io/badge/tests-99%20passing-brightgreen.svg)](#testing)
[![npm version](https://img.shields.io/npm/v/mcp-server-openshift.svg)](https://www.npmjs.com/package/mcp-server-openshift)
[![npm downloads](https://img.shields.io/npm/dm/mcp-server-openshift.svg)](https://www.npmjs.com/package/mcp-server-openshift)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](https://hub.docker.com/r/sanjaypsachdev/mcp-server-openshift)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/sanjaypsachdev/mcp-server-openshift/graphs/commit-activity)

A Model Context Protocol (MCP) server that provides AI assistants with comprehensive OpenShift/Kubernetes cluster management capabilities through the `oc` command-line interface.

## Demo Video

Watch the `oc-new-app` tool deploy a complete Spring Boot application from GitHub to OpenShift:

https://github.com/user-attachments/assets/f4bace3f-755b-462f-8a8a-680e4dc02129

## Features

- **Cluster Information**: Access comprehensive cluster status, nodes and configuration via MCP resources
- **Resource Description**: Describe any resource with multiple output formats including human-readable summaries
- **Complete Resource Management**: Create, read, update, delete, and patch all OpenShift/Kubernetes resources
- **Application Deployment**: Deploy applications from Git repositories with S2I builds and automatic route creation
- **Operator Management**: Install operators via OLM, Helm, or direct manifests
- **Cluster Operations**: Scaling, monitoring, troubleshooting and management
- **Build Operations**: Start and monitor OpenShift builds
- **Scaling Operations**: Scale deployments, replicasets and statefulsets
- **Logging**: Retrieve logs from pods and builds
- **Multi-Transport Support**: STDIO and HTTP/SSE transports for different integration scenarios
- **Comprehensive Testing**: 99 unit tests ensuring production reliability
- **Rich Error Handling**: Detailed troubleshooting guidance and actionable error messages
- **Troubleshooting Prompts**: Interactive troubleshooting guides for common OpenShift scenarios
- **Log Sampling**: Sample and analyze pod logs with intelligent pattern detection and context

## Prerequisites

- Node.js 18+
- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster

## Installation

```bash
git clone https://github.com/sanjaypsachdev/mcp-server-openshift.git
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

### Authentication & Access
- **`oc_login`** - Securely log into OpenShift clusters using token or username/password authentication

### API Discovery & Documentation
- **`oc_api_resources`** - List all available API resources in the cluster with categorization
- **`oc_explain`** - Explain resource schemas, fields, and API documentation

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

- **`troubleshoot-openshift-prompt`** - Comprehensive OpenShift troubleshooting guide for all resource types and cluster issues
- **`monitoring-prompts`** - Monitoring and observability guidance for different scenarios

## Sampling

Intelligent log analysis and pattern detection:

- **Pod Logs Sampling** - Automatic log sampling with error pattern detection and context analysis

## Usage Examples

### Login to Cluster

```bash
# Login with token (recommended)
oc_login with server: "https://api.cluster.example.com:6443", 
         authMethod: "token", 
         token: "sha256~your-token-here"

# Login with username/password
oc_login with server: "https://api.cluster.example.com:6443", 
         authMethod: "password", 
         username: "developer", 
         password: "your-password"
```

### Discover API Resources

```bash
# List all available API resources
oc_api_resources

# List resources for specific API group
oc_api_resources with apiGroup: "apps"

# List only namespaced resources
oc_api_resources with namespaced: true

# Explain a resource schema
oc_explain with resource: "deployment"

# Explain specific field
oc_explain with resource: "pod", field: "spec.containers"
```

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

### Troubleshoot Issues

```bash
# Get pod troubleshooting guidance
Use prompt: troubleshoot-openshift-prompt
Arguments: issueType: "pod", resourceName: "my-app-12345", namespace: "my-project"

# Get deployment troubleshooting guidance
Use prompt: troubleshoot-openshift-prompt
Arguments: issueType: "deployment", resourceName: "my-app", namespace: "my-project"

# Get general cluster troubleshooting guidance
Use prompt: troubleshoot-openshift-prompt
Arguments: issueType: "cluster", symptoms: "nodes not ready"
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

### Authentication Security
- **Token Authentication**: Preferred method for automation and production use
- **Password Authentication**: Available but token authentication is recommended
- **HTTPS Enforcement**: All cluster connections must use HTTPS
- **URL Validation**: Server URLs validated to prevent SSRF attacks
- **Private IP Blocking**: Prevents connections to internal/metadata services

### Operational Security
- **RBAC Compliance**: Respects OpenShift RBAC permissions
- **No Credential Storage**: Credentials are not stored or transmitted by the server
- **User Permissions**: Executes with the same permissions as the authenticated user
- **Input Validation**: Comprehensive validation of all inputs and parameters
- **Secure Defaults**: Conservative security settings by default

### Best Practices
- **Use Service Account Tokens**: For automation and CI/CD pipelines
- **Regular Token Rotation**: Rotate authentication tokens regularly
- **TLS Certificate Validation**: Always validate TLS certificates in production
- **Least Privilege**: Use accounts with minimal required permissions
- **Session Management**: Use `oc logout` to clear credentials when done

## License

MIT License - see LICENSE file for details.
