# OpenShift MCP Server

A Model Context Protocol (MCP) server that provides tools for managing and interacting with OpenShift clusters. This server enables AI assistants to perform OpenShift operations through the `oc` command-line interface.

## Demo Video

### oc-new-app in Action

Watch the `oc-new-app` tool deploy a complete Spring Boot application from GitHub to OpenShift with automatic build monitoring, route creation, and deployment tracking:

![oc-new-app Demo](oc-new-app.mov)

*The video demonstrates the complete application deployment workflow including:*
- *Automatic namespace creation and validation*
- *Real-time build progress monitoring with timestamps*
- *S2I (Source-to-Image) build process*
- *Automatic route creation with edge-terminated TLS*
- *Deployment status tracking and readiness verification*
- *Comprehensive progress logging and final status summary*

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

- Node.js 18 or higher
- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster

## Dependencies

### Core Dependencies
- **`@modelcontextprotocol/sdk`** `^0.6.0` - MCP server framework with tools, resources, prompts, and dual transport support
- **`zod`** `^3.23.8` - Runtime type validation and schema definition

### Development Dependencies
- **`typescript`** `^5.5.0` - Type-safe JavaScript development
- **`eslint`** `^9.0.0` - Code linting and quality enforcement
- **`vitest`** `^2.0.0` - Fast unit testing framework
- **`tsx`** `^4.19.0` - TypeScript execution for development

### External Dependencies
- **OpenShift CLI (`oc`)** - Required for cluster operations. Install via `brew install openshift-cli` or download from OpenShift releases


### Requirements
- **Node.js**: 18.0.0 or higher
- **OpenShift CLI**: 4.x compatible
- **Kubernetes**: 1.25+ compatible

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

Add the server to your MCP client configuration. Choose the configuration that matches your client:

### Claude Desktop

Add to your Claude Desktop configuration file (`~/.claude/mcp.json` on macOS/Linux or `%APPDATA%\Claude\mcp.json` on Windows):

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

### Cursor

**STDIO Transport (Recommended)**:
Add to your Cursor MCP configuration file (`~/.cursor/mcp.json`):

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

**HTTP/SSE Transport** (for remote or web-based access):
1. Start the server: `npm run start:http`
2. Add to your Cursor configuration:

```json
{
  "mcpServers": {
    "openshift-remote": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", 
        "http://localhost:3000/sse", 
        "--transport", "sse-only"
      ]
    }
  }
}
```

### Visual Studio Code

For VS Code with MCP extensions, add to your VS Code settings (`settings.json`):

```json
{
  "mcp.servers": {
    "openshift": {
      "command": "node",
      "args": ["/path/to/mcp-server-openshift/dist/index.js"],
      "env": {
        "OPENSHIFT_CONTEXT": "your-context-name",
        "OPENSHIFT_NAMESPACE": "your-default-namespace"
      },
      "description": "Openshift cluster management and operations"
    }
  }
}
```

### Generic MCP Client

For other MCP clients, use this standard configuration:

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

### Configuration Notes

- **Path**: Replace `/path/to/mcp-server-openshift/dist/index.js` with the actual absolute path to your built server
- **Context**: Set `OPENSHIFT_CONTEXT` to your OpenShift cluster context name, or leave empty to use the current context
- **Namespace**: Set `OPENSHIFT_NAMESPACE` to your default project/namespace, or use "default"
- **Restart**: After adding the configuration, restart your MCP client to load the server

## Transport Modes

The MCP OpenShift server supports two transport modes for different use cases:

### STDIO Transport (Default)
**Best for**: Direct integration with MCP clients (Claude Desktop, Cursor, VS Code)
**Characteristics**:
- Direct process communication
- Lower latency
- Automatic lifecycle management
- Recommended for local development

**Usage**:
```bash
# Start with STDIO (default)
npm start
node dist/index.js
```

### HTTP/SSE Transport (Streamable)
**Best for**: Web-based access, remote clients, containerized deployments
**Characteristics**:
- HTTP-based communication
- Streamable responses
- Remote accessibility
- Web integration friendly
- Container deployment ready

**Usage**:
```bash
# Start HTTP server on port 3000
npm run start:http
node dist/index.js --http --port=3000

# Start with custom port
node dist/index.js --transport=sse --port=8080

# Start with environment variables
MCP_TRANSPORT=sse MCP_PORT=3000 npm start
```

**Connection**: `http://localhost:3000/sse`

### Transport Selection
The server automatically detects the transport mode based on:
1. **Environment Variables**: `MCP_TRANSPORT=sse|stdio`
2. **Command Arguments**: `--transport=sse`, `--http`, `--sse`
3. **Port Arguments**: `--port=<number>` (implies HTTP mode)
4. **Default**: STDIO for backward compatibility

### Use Cases by Transport

**STDIO Transport**:
- Local development with AI assistants
- Direct MCP client integration
- Low-latency operations
- Single-user scenarios

**HTTP/SSE Transport**:
- Remote OpenShift cluster management
- Web-based dashboards and interfaces
- Multi-user access scenarios
- Containerized MCP server deployments
- Integration with web applications
- Load balancing and scaling scenarios

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

### `oc_new_app`
Create a new application from a GitHub repository using S2I build and expose it with an edge-terminated route. Includes comprehensive logging, progress tracking, and deployment monitoring.

**Parameters:**
- `gitRepo` (required): GitHub repository URL for the source code
- `appName` (optional): Name for the application (if not specified, derives from repo name)
- `namespace` (optional): Target namespace for the application (default: "default")
- `context` (optional): OpenShift context to use
- `builderImage` (optional): Builder image for S2I build (e.g., "nodejs:18-ubi8", "python:3.9-ubi8")
- `env` (optional): Array of environment variables in KEY=VALUE format
- `labels` (optional): Array of labels in KEY=VALUE format
- `createNamespace` (optional): Create namespace if it doesn't exist (default: true)
- `exposeRoute` (optional): Create an edge-terminated route to expose the application (default: true)
- `routeHostname` (optional): Custom hostname for the route
- `gitRef` (optional): Git reference (branch, tag, or commit) to build from
- `contextDir` (optional): Context directory within the Git repository
- `strategy` (optional): Build strategy - "source" (S2I) or "docker" (default: "source")

**Enhanced Features:**
- **Progress Logging**: Real-time progress tracking with timestamps and elapsed time
- **Build Monitoring**: Automatic build status monitoring and progress updates
- **Deployment Tracking**: Pod and deployment readiness monitoring
- **Route Validation**: Route creation verification and URL extraction
- **Error Handling**: Comprehensive error reporting with troubleshooting guidance
- **Final Status**: Complete application status summary with useful commands
- **Performance Metrics**: Deployment timing and performance tracking

**Examples:**

Simple Node.js app deployment:
```json
{
  "name": "oc_new_app",
  "arguments": {
    "gitRepo": "https://github.com/sclorg/nodejs-ex.git",
    "namespace": "my-apps"
  }
}
```

Python app with custom builder image and environment variables:
```json
{
  "name": "oc_new_app",
  "arguments": {
    "gitRepo": "https://github.com/sclorg/django-ex.git",
    "appName": "my-django-app",
    "namespace": "python-apps",
    "builderImage": "python:3.9-ubi8",
    "env": ["DJANGO_SECRET_KEY=mysecret", "DEBUG=False"],
    "labels": ["app=django", "tier=web"],
    "routeHostname": "my-django-app.example.com"
  }
}
```

Docker strategy deployment:
```json
{
  "name": "oc_new_app",
  "arguments": {
    "gitRepo": "https://github.com/openshift/ruby-hello-world.git",
    "appName": "ruby-app",
    "namespace": "ruby-apps",
    "strategy": "docker",
    "gitRef": "main",
    "contextDir": "app"
  }
}
```

**Enhanced Output Example:**

The enhanced oc_new_app tool now provides detailed progress tracking and status information:

```
# 🎉 Application Deployment Successful

## 📋 Deployment Summary
- **Application**: my-nodejs-app
- **Namespace**: my-apps
- **Source**: https://github.com/sclorg/nodejs-ex.git
- **Build Strategy**: source
- **Route**: Created

## 🌐 Access Information
- **URL**: https://my-nodejs-app-route-my-apps.apps.cluster.example.com

## 📊 Final Status
- **Replicas**: 1/1 ready
- **Available**: 1/1 available

## 📝 Deployment Progress Log
[0.1s] INFO: 🚀 Starting application deployment process
[0.2s] INFO: 📋 Parameters validated successfully
[0.2s] INFO: 📝 Application name: my-nodejs-app
[0.3s] INFO: 📂 Target namespace: my-apps
[0.3s] INFO: 🔗 Source repository: https://github.com/sclorg/nodejs-ex.git
[0.4s] INFO: ⚙️  Build strategy: source
[0.5s] INFO: 🏗️  Checking/creating namespace: my-apps
[1.2s] SUCCESS: ✅ Namespace ready: my-apps
[1.3s] INFO: 🔨 Executing oc new-app command...
[3.8s] SUCCESS: ✅ Application resources created successfully
[3.9s] INFO: 📦 Resources: ImageStream, BuildConfig, Deployment, Service
[4.0s] INFO: 👀 Monitoring build progress...
[4.2s] SUCCESS: 🔨 Build initiated: Found 1 build(s)
[4.5s] INFO: 🔄 Build in progress: my-nodejs-app-1
[4.6s] INFO: 📝 Monitor build: oc logs -f build/my-nodejs-app-1 -n my-apps
[4.7s] INFO: 🌐 Creating edge-terminated route...
[5.1s] SUCCESS: ✅ Route created successfully
[5.2s] SUCCESS: 🔗 Application URL: https://my-nodejs-app-route-my-apps.apps.cluster.example.com
[5.3s] INFO: 🚀 Monitoring deployment progress...
[5.5s] INFO: 📊 Deployment status: 1/1 ready, 1/1 available
[5.6s] SUCCESS: ✅ Deployment fully ready and available
[5.7s] SUCCESS: ✅ Deployment available: MinimumReplicasAvailable
[5.8s] SUCCESS: 🎯 Pods: 1/1 running
[5.9s] INFO: 🔍 Performing final status check...
[6.2s] SUCCESS: 🎉 Deployment process completed in 6.2s

## 🔧 Useful Commands
# Check application status
oc get all -l app=my-nodejs-app -n my-apps

# View application logs
oc logs deployment/my-nodejs-app -n my-apps -f

# Scale application
oc scale deployment/my-nodejs-app --replicas=3 -n my-apps
```

### `oc_scale`
Scale the number of pods in a deployment, deploymentconfig, replicaset, or statefulset to the specified number of replicas.

**Parameters:**
- `name` (required): Name of the resource to scale
- `replicas` (required): Number of replicas to scale to
- `resourceType` (optional): Resource type to scale - "deployment", "deploymentconfig", "replicaset", or "statefulset" (default: "deployment")
- `namespace` (optional): Target namespace/project (default: "default")
- `context` (optional): OpenShift context to use

**Examples:**

Scale a deployment to 3 replicas:
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

Scale a deploymentconfig to 0 replicas (stop the app):
```json
{
  "name": "oc_scale",
  "arguments": {
    "name": "legacy-app",
    "replicas": 0,
    "resourceType": "deploymentconfig",
    "namespace": "legacy-apps"
  }
}
```

Scale a statefulset to 5 replicas:
```json
{
  "name": "oc_scale",
  "arguments": {
    "name": "database-cluster",
    "replicas": 5,
    "resourceType": "statefulset",
    "namespace": "databases"
  }
}
```

### `oc_describe`
Describe any OpenShift resource and share the output in various formats including human-readable summary.

**Parameters:**
- `resourceType` (required): Type of resource to describe (pod, deployment, service, route, etc.)
- `name` (required): Name of the resource to describe
- `namespace` (optional): Target namespace/project (default: "default")
- `context` (optional): OpenShift context to use
- `output` (optional): Output format - "text", "yaml", "json", or "human-readable" (default: "human-readable")

**Output Formats:**
- **`text`**: Standard `oc describe` output with detailed information
- **`yaml`**: Resource definition in YAML format
- **`json`**: Resource definition in JSON format  
- **`human-readable`**: Concise, pointwise summary with emojis and key information

**Examples:**

Get human-readable summary of a deployment:
```json
{
  "name": "oc_describe",
  "arguments": {
    "resourceType": "deployment",
    "name": "my-app",
    "namespace": "my-project"
  }
}
```

Get detailed text description of a pod:
```json
{
  "name": "oc_describe",
  "arguments": {
    "resourceType": "pod",
    "name": "my-app-12345-abcde",
    "namespace": "my-project",
    "output": "text"
  }
}
```

Get service definition in YAML format:
```json
{
  "name": "oc_describe",
  "arguments": {
    "resourceType": "service",
    "name": "my-service",
    "namespace": "my-project",
    "output": "yaml"
  }
}
```

Get route information in JSON format:
```json
{
  "name": "oc_describe",
  "arguments": {
    "resourceType": "route",
    "name": "my-route",
    "namespace": "my-project",
    "output": "json"
  }
}
```

## Available Resources

MCP Resources provide read-only access to cluster information and configuration data.

### `cluster-info`
**URI**: `openshift://cluster-info`
**Description**: Comprehensive information about the OpenShift cluster including version, nodes, namespaces, and recent events.

**Content**: JSON format containing:
- **Version Information**: Client and server versions, Kubernetes version
- **Node Details**: Node count, status, roles, capacity, and system information
- **Namespace Summary**: Total namespaces, active count, and namespace details
- **Storage Classes**: Available storage classes and their configurations
- **Recent Events**: Latest cluster events with warnings and normal events
- **Current Context**: Active OpenShift context
- **Metadata**: Retrieval timestamp and context information

**Example Usage**: 
MCP clients can access this resource to get comprehensive cluster status without needing to make multiple tool calls.

### `project-list`
**URI**: `openshift://project-list`
**Description**: Comprehensive list of all projects/namespaces with detailed information, quotas, and usage statistics.

**Content**: JSON format containing:
- **Summary**: Total, system, user, active, and terminating project counts
- **System Projects**: Core OpenShift and Kubernetes system namespaces with descriptions
- **User Projects**: Detailed information for user-created projects including:
  - Resource quotas and limit ranges
  - Pod counts by status (running, pending, failed, succeeded)
  - Service, deployment, and route counts
  - ConfigMap and Secret counts
  - Labels and annotations
  - Creation timestamps and status
- **Cluster Resource Usage**: Cluster-wide resource utilization and pod distribution

**Use Cases**:
- Project management and organization
- Resource usage monitoring and planning
- Quota analysis and capacity planning
- Security and compliance auditing
- Multi-tenancy management

### `app-templates`
**URI**: `openshift://app-templates`
**Description**: Comprehensive collection of application deployment templates for common OpenShift scenarios and frameworks.

**Content**: JSON format containing:
- **Web Applications**: Node.js, Python, Java, .NET, PHP, Ruby templates with S2I examples
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis deployment templates
- **Messaging**: Kafka, RabbitMQ, and message broker configurations
- **Monitoring**: Prometheus, Grafana, and observability stack templates
- **CI/CD**: Jenkins, Tekton Pipelines, and automation templates
- **Microservices**: Service mesh, API gateway, and distributed system patterns
- **Big Data**: Spark, Elasticsearch, and analytics platform templates
- **Security**: Vault, Cert Manager, and security tooling templates
- **Builder Images**: Available S2I builder images with language detection
- **Deployment Patterns**: Blue-Green, Canary, Rolling Update strategies
- **Route Templates**: Edge, Passthrough, Re-encrypt TLS configurations
- **Storage Templates**: PVC patterns for different access modes
- **Networking Templates**: Network policies and service monitoring

**Use Cases**:
- Application deployment guidance
- Technology stack selection
- Best practices implementation
- Template-based rapid deployment
- Architecture pattern selection
- Security and compliance templates

## Available Prompts

MCP Prompts provide interactive troubleshooting and operational guidance templates.

### `troubleshoot-pod-prompt`
**Name**: `troubleshoot-pod-prompt`
**Description**: Comprehensive pod troubleshooting guide covering all possible scenarios in OpenShift clusters.

**Arguments:**
- `podName` (required): Name of the pod to troubleshoot
- `namespace` (required): Namespace/project where the pod is located  
- `symptoms` (optional): Observed symptoms (e.g., CrashLoopBackOff, Pending, ImagePullBackOff)
- `containerName` (optional): Specific container name if multi-container pod

**Coverage**: This prompt provides systematic troubleshooting for:
- **Pod Status Issues**: Pending, CrashLoopBackOff, ImagePullBackOff, Error, Terminating
- **Resource Constraints**: CPU/memory limits, node capacity, quotas
- **Configuration Problems**: Environment variables, ConfigMaps, Secrets, volumes
- **Network Issues**: Connectivity, DNS, network policies, services
- **Security Context**: SCC violations, privileged access, security policies
- **OpenShift-Specific**: S2I builds, image streams, routes, build configs
- **Storage Issues**: PVC binding, storage classes, volume mounts
- **Application Errors**: Startup failures, health check failures, dependencies

**Example Usage**:
```
Use prompt: troubleshoot-pod-prompt
Arguments: 
- podName: "my-app-12345-abcde"
- namespace: "my-project" 
- symptoms: "CrashLoopBackOff"
- containerName: "web-server"
```

The prompt generates a comprehensive, step-by-step troubleshooting guide customized for the specific pod and symptoms.

### `monitoring-prompts`
**Name**: `monitoring-prompts`
**Description**: Comprehensive monitoring and observability guidance for OpenShift clusters covering metrics, logging, alerting, and performance analysis.

**Arguments:**
- `scenario` (required): Monitoring scenario - "cluster", "application", "performance", "troubleshooting", "capacity", "security"
- `target` (optional): Target to monitor (pod, deployment, service, node, namespace, or cluster-wide)
- `namespace` (optional): Namespace/project to focus monitoring on
- `timeRange` (optional): Time range for monitoring (1h, 6h, 24h, 7d)

**Coverage**: This prompt provides monitoring guidance for:
- **Cluster Monitoring**: Node health, resource utilization, operator status, etcd performance
- **Application Monitoring**: Performance metrics, scaling behavior, custom dashboards
- **Performance Analysis**: Resource optimization, bottleneck identification, capacity planning
- **Security Monitoring**: RBAC compliance, network policies, vulnerability scanning
- **Troubleshooting**: Monitoring stack issues, missing metrics, alert configuration
- **Capacity Planning**: Resource trends, growth analysis, scaling recommendations

**Example Usage**:
```
Use prompt: monitoring-prompts
Arguments:
- scenario: "application"
- target: "my-webapp"
- namespace: "production"
- timeRange: "24h"
```

The prompt generates customized monitoring setup and analysis guidance based on the specific scenario and requirements.

## Available Sampling

MCP Sampling allows the server to intelligently sample and analyze log data for troubleshooting and monitoring.

### Pod Logs Sampling
**Description**: Automatically sample recent pod logs with intelligent analysis and context.

**Usage**: Ask the MCP client to sample pod logs using natural language:
- "Sample pod logs for my-pod-12345 in namespace my-app"
- "Sample pod logs for web-server-67890 in namespace frontend container nginx since 30m lines 100"
- "Analyze pod logs for database-pod in namespace backend"

**Features**:
- **Current Logs**: Recent log entries with timestamps
- **Previous Logs**: Logs from before the last restart (for crash analysis)
- **Container Status**: Current state, restart count, exit codes
- **Recent Events**: Pod-related events for context
- **Pattern Analysis**: Automatic detection of common error patterns
- **Intelligent Formatting**: Markdown-formatted output with syntax highlighting

**Sampling Options**:
- **Time Range**: `5m`, `30m`, `1h`, `2h`, `1d` (default: 1h)
- **Max Lines**: 1-1000 lines (default: 100)
- **Container**: Specific container name for multi-container pods
- **Include Previous**: Previous container logs before restart (default: true)

**Analysis Patterns Detected**:
- Application errors and exceptions
- Memory issues (OOMKilled)
- Configuration problems
- Network/dependency failures
- Resource constraint indicators

**Example Output**:
```
# Pod Logs Sample Analysis
# Pod: my-app-12345
# Namespace: my-project
# Container: web-server
# Max Lines: 100
# Time Range: Last 1h
# Sampled At: 2024-01-15T10:30:00Z

## 📋 CURRENT CONTAINER LOGS
[Timestamped log entries with syntax highlighting]

## 📜 PREVIOUS CONTAINER LOGS (Before Last Restart)
[Previous container logs for crash analysis]

## 🔍 POD STATUS CONTEXT
[Container statuses, restart counts, exit codes]

## 📅 RECENT EVENTS
[Pod-related events for additional context]

## 💡 ANALYSIS HINTS
[Common patterns and what to look for]
```

### `oc_apply`
Apply YAML manifests to OpenShift cluster with comprehensive error handling and validation for all scenarios.

**Parameters:**
- `manifest` (optional): YAML manifest content to apply
- `filename` (optional): Path to YAML file to apply  
- `url` (optional): URL to YAML manifest to apply
- `namespace` (optional): Target namespace/project (default: "default")
- `context` (optional): OpenShift context to use
- `dryRun` (optional): Validate only, don't apply (default: false)
- `force` (optional): Force apply, ignore conflicts (default: false)
- `validate` (optional): Validate resources before applying (default: true)
- `wait` (optional): Wait for resources to be ready (default: false)
- `timeout` (optional): Timeout for wait operation (e.g., "60s", "5m")
- `prune` (optional): Prune resources not in current configuration (default: false)
- `pruneWhitelist` (optional): Resource types to include in pruning
- `selector` (optional): Label selector for pruning
- `recursive` (optional): Process directory recursively (default: false)
- `kustomize` (optional): Apply kustomization directory (default: false)
- `serverSideApply` (optional): Use server-side apply (default: false)
- `fieldManager` (optional): Field manager name for server-side apply
- `overwrite` (optional): Overwrite existing resources (default: false)
- `cascade` (optional): Deletion cascade strategy ("background", "foreground", "orphan")
- `gracePeriod` (optional): Grace period for resource deletion (seconds)

**Enhanced Features:**
- **Comprehensive Error Analysis**: Categorizes errors (Permission, Conflict, Validation, etc.) with specific solutions
- **Pre-apply Validation**: Namespace checks, conflict detection, YAML syntax validation
- **Progress Tracking**: Real-time progress with timestamps and detailed logging
- **Resource Monitoring**: Tracks applied resources and their readiness status
- **Wait Functionality**: Monitors resource readiness with configurable timeouts
- **Conflict Resolution**: Intelligent conflict detection and resolution guidance
- **Multiple Input Sources**: Support for inline manifests, files, and URLs

**Examples:**

Apply inline manifest:
```json
{
  "name": "oc_apply",
  "arguments": {
    "manifest": "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-config\ndata:\n  key: value",
    "namespace": "my-project"
  }
}
```

Apply from file with validation:
```json
{
  "name": "oc_apply",
  "arguments": {
    "filename": "/path/to/deployment.yaml",
    "namespace": "production",
    "wait": true,
    "timeout": "300s",
    "validate": true
  }
}
```

Dry run validation:
```json
{
  "name": "oc_apply",
  "arguments": {
    "url": "https://raw.githubusercontent.com/example/repo/main/k8s/app.yaml",
    "namespace": "staging",
    "dryRun": true
  }
}
```

Server-side apply with field manager:
```json
{
  "name": "oc_apply",
  "arguments": {
    "manifest": "...",
    "namespace": "production",
    "serverSideApply": true,
    "fieldManager": "my-controller",
    "force": true
  }
}
```

Apply with pruning:
```json
{
  "name": "oc_apply",
  "arguments": {
    "filename": "/path/to/app-manifests/",
    "namespace": "production",
    "recursive": true,
    "prune": true,
    "selector": "app=my-application"
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

### Start Server (Multiple Transport Options)

**STDIO Transport (Default)**:
```bash
npm start
# or
npm run start:stdio
# or
node dist/index.js
```

**HTTP/SSE Transport**:
```bash
npm run start:http
# or
npm run start:sse
# or
node dist/index.js --http --port=3000
```

### Development Mode

**STDIO Development**:
```bash
npm run dev
```

**HTTP Development**:
```bash
npm run dev:http
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
