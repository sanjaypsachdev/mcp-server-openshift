# Quick Start Guide

This guide will help you get started with the MCP OpenShift server.

## Prerequisites

1. **OpenShift CLI**: Install the `oc` command-line tool

   ```bash
   # On macOS
   brew install openshift-cli

   # On Linux (download from OpenShift releases)
   curl -L https://github.com/openshift/origin/releases/latest/download/openshift-origin-client-tools-*.tar.gz | tar xz
   ```

2. **OpenShift Cluster Access**: Login to your OpenShift cluster
   ```bash
   oc login https://your-cluster-url:6443
   ```

## Installation

1. Clone and build the server:

   ```bash
   git clone https://github.com/your-org/mcp-server-openshift.git
   cd mcp-server-openshift
   npm install
   npm run build
   ```

2. Test the server:
   ```bash
   npm start
   ```

## Configuration with Claude Desktop

Add the server to your Claude Desktop configuration file (`~/.claude/mcp.json`):

```json
{
  "servers": {
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

## Basic Usage Examples

### List all projects

```json
{
  "name": "oc_get",
  "arguments": {
    "resourceType": "projects"
  }
}
```

### Get pods in a specific namespace

```json
{
  "name": "oc_get",
  "arguments": {
    "resourceType": "pods",
    "namespace": "my-project"
  }
}
```

### Create a new project

```json
{
  "name": "oc_create",
  "arguments": {
    "resourceType": "project",
    "name": "my-new-project",
    "displayName": "My New Project",
    "description": "A project created via MCP"
  }
}
```

### Scale a deployment config

```json
{
  "name": "oc_scale",
  "arguments": {
    "name": "my-app",
    "replicas": 3,
    "namespace": "my-project"
  }
}
```

### Get application logs

```json
{
  "name": "oc_logs",
  "arguments": {
    "resourceType": "deploymentconfig",
    "name": "my-app",
    "namespace": "my-project",
    "tail": 100
  }
}
```

## Troubleshooting

### Common Issues

1. **"oc command not found"**
   - Ensure OpenShift CLI is installed and in your PATH
   - Test with: `oc version --client`

2. **Authentication errors**
   - Login to your cluster: `oc login`
   - Check current context: `oc whoami`

3. **Permission denied**
   - Verify your OpenShift permissions
   - Check if you have access to the namespace/project

4. **Server not responding**
   - Check if the server process is running
   - Verify the configuration in your MCP client

### Debug Mode

Run the server with debug output:

```bash
DEBUG=* npm start
```

### Testing CLI Commands

Test OpenShift commands directly:

```bash
# Test basic connectivity
oc whoami

# List available resources
oc api-resources

# Get cluster info
oc cluster-info
```
