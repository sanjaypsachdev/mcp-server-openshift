# MCP Server OpenShift

A Model Context Protocol (MCP) server that provides tools for managing and interacting with OpenShift clusters. This server enables AI assistants to perform OpenShift operations through the `oc` command-line interface.

## Features

- **Resource Management**: Get, create, delete, and apply OpenShift resources
- **Project Operations**: Create and manage OpenShift projects
- **Deployment Management**: Handle DeploymentConfigs, scaling, and rollouts
- **Route Management**: Create and manage OpenShift routes
- **Build Operations**: Start and monitor OpenShift builds
- **Logging**: Retrieve logs from pods, deploymentconfigs, and builds
- **Multi-Context Support**: Work with multiple OpenShift clusters

## Prerequisites

- Node.js 18 or higher
- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster

## Installation

### From Source

```bash
git clone https://github.com/your-org/mcp-server-openshift.git
cd mcp-server-openshift
npm install
npm run build
```

### Global Installation

```bash
npm install -g mcp-server-openshift
```

## Configuration

Add the server to your MCP client configuration:

```json
{
  "servers": {
    "openshift": {
      "command": "mcp-server-openshift",
      "args": [],
      "env": {
        "OPENSHIFT_CONTEXT": "your-context-name",
        "OPENSHIFT_NAMESPACE": "your-default-namespace"
      }
    }
  }
}
```

## Available Tools

### `oc_get`
Get OpenShift resources like pods, deploymentconfigs, routes, projects.

**Parameters:**
- `resourceType` (required): Type of resource (pods, deploymentconfigs, routes, projects, etc.)
- `name` (optional): Specific resource name
- `namespace` (optional): Target namespace/project
- `context` (optional): OpenShift context to use
- `output` (optional): Output format (json, yaml, wide, name)
- `allNamespaces` (optional): List across all namespaces
- `labelSelector` (optional): Filter by labels
- `fieldSelector` (optional): Filter by fields

**Example:**
```json
{
  "name": "oc_get",
  "arguments": {
    "resourceType": "deploymentconfigs",
    "namespace": "my-project"
  }
}
```

### `oc_create`
Create OpenShift resources.

**Parameters:**
- `resourceType` (optional): Type of resource to create
- `name` (optional): Resource name
- `namespace` (optional): Target namespace/project
- `manifest` (optional): YAML manifest content
- `filename` (optional): Path to YAML file
- `image` (optional): Container image for deploymentconfigs
- `replicas` (optional): Number of replicas
- `service` (optional): Service name for routes
- `hostname` (optional): Hostname for routes

**Example:**
```json
{
  "name": "oc_create",
  "arguments": {
    "resourceType": "project",
    "name": "my-new-project",
    "displayName": "My New Project"
  }
}
```

### `oc_install_operator`
Install an Operator on the OpenShift/Kubernetes cluster using OLM, Helm, or direct manifests.

**Parameters:**
- `operatorName` (required): Name of the operator to install (e.g., "prometheus-operator", "cert-manager")
- `version` (optional): Version of the operator to install (if not specified, installs latest available)
- `namespace` (optional): Target namespace for operator installation (default: "default")
- `context` (optional): OpenShift context to use
- `channel` (optional): Update channel for the operator (stable, alpha, beta, etc.)
- `source` (optional): Installation method - "olm", "helm", or "manifest" (default: "olm")
- `helmRepo` (optional): Helm repository URL (required if source is "helm")
- `manifestUrl` (optional): URL to operator manifest (required if source is "manifest")
- `createNamespace` (optional): Create namespace if it doesn't exist (default: true)
- `installPlanApproval` (optional): Install plan approval strategy for OLM - "Automatic" or "Manual" (default: "Automatic")

**Examples:**

Install via OLM (OpenShift):
```json
{
  "name": "oc_install_operator",
  "arguments": {
    "operatorName": "prometheus-operator",
    "namespace": "monitoring",
    "channel": "stable"
  }
}
```

Install via Helm:
```json
{
  "name": "oc_install_operator",
  "arguments": {
    "operatorName": "cert-manager",
    "namespace": "cert-manager",
    "source": "helm",
    "helmRepo": "https://charts.jetstack.io",
    "version": "v1.13.0"
  }
}
```

Install via manifest:
```json
{
  "name": "oc_install_operator",
  "arguments": {
    "operatorName": "cert-manager",
    "namespace": "cert-manager",
    "source": "manifest",
    "manifestUrl": "https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml"
  }
}
```

### `oc_delete`
Delete OpenShift resources.

**Parameters:**
- `resourceType` (required): Type of resource to delete
- `name` (optional): Resource name
- `namespace` (optional): Target namespace/project
- `manifest` (optional): YAML manifest content
- `filename` (optional): Path to YAML file
- `labelSelector` (optional): Delete by label selector
- `force` (optional): Force deletion

### `oc_apply`
Apply OpenShift manifests.

**Parameters:**
- `manifest` (optional): YAML manifest content
- `filename` (optional): Path to YAML file
- `namespace` (optional): Target namespace/project
- `dryRun` (optional): Validate only
- `force` (optional): Force apply

### `oc_scale`
Scale OpenShift deploymentconfigs.

**Parameters:**
- `resourceType` (optional): Resource type (default: deploymentconfig)
- `name` (required): Resource name
- `replicas` (required): Number of replicas
- `namespace` (optional): Target namespace/project

### `oc_logs`
Get logs from OpenShift resources.

**Parameters:**
- `resourceType` (required): Type of resource (pod, deploymentconfig, build)
- `name` (required): Resource name
- `namespace` (optional): Target namespace/project
- `container` (optional): Container name
- `follow` (optional): Follow logs
- `previous` (optional): Previous container logs
- `since` (optional): Show logs since time
- `tail` (optional): Number of lines from end
- `timestamps` (optional): Include timestamps

### `oc_rollout`
Manage rollouts of deploymentconfigs.

**Parameters:**
- `subCommand` (required): Rollout action (status, history, undo, latest, cancel)
- `resourceType` (optional): Resource type (default: deploymentconfig)
- `name` (required): Resource name
- `namespace` (optional): Target namespace/project
- `revision` (optional): Revision number for undo

### `oc_start_build`
Start OpenShift builds.

**Parameters:**
- `buildconfig` (required): BuildConfig name
- `namespace` (optional): Target namespace/project
- `wait` (optional): Wait for completion
- `follow` (optional): Follow build logs

### `oc_expose`
Expose services as routes.

**Parameters:**
- `resourceType` (required): Resource type to expose
- `name` (required): Resource name
- `namespace` (optional): Target namespace/project
- `hostname` (optional): Route hostname
- `port` (optional): Port to expose
- `path` (optional): Route path

## Development

### Setup
```bash
npm install
```

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Project Structure

```
src/
├── index.ts              # Main server entry point
├── types.ts              # TypeScript type definitions
├── models/
│   └── tool-models.ts    # Zod schemas for tool validation
├── tools/                # Individual tool implementations
│   ├── oc-get.ts
│   ├── oc-create.ts
│   └── ...
└── utils/
    └── openshift-manager.ts  # OpenShift CLI wrapper
```

## Error Handling

The server includes comprehensive error handling for:
- Invalid OpenShift CLI commands
- Network timeouts
- Authentication failures
- Resource not found errors
- Validation errors

## Security Considerations

- The server requires the OpenShift CLI to be properly configured
- All operations respect OpenShift RBAC permissions
- No credentials are stored or transmitted by the server
- Commands are executed with the same permissions as the user running the server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Review the OpenShift documentation

## Changelog

### v1.0.0
- Initial release
- Basic resource management tools
- Project and deployment operations
- Route and build management
- Logging and rollout support
