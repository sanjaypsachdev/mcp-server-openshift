import { z } from 'zod';

// Common parameter schemas
export const NamespaceSchema = z.string().optional().default('default');
export const ContextSchema = z.string().optional().default('');
export const OutputFormatSchema = z
  .enum(['json', 'yaml', 'wide', 'name'])
  .optional()
  .default('json');

// OpenShift CLI tool schemas
export const OcGetSchema = z.object({
  resourceType: z
    .string()
    .describe('Type of resource to get (e.g., pods, deploymentconfigs, routes, projects)'),
  name: z
    .string()
    .optional()
    .describe('Name of the resource (optional - if not provided, lists all resources)'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  output: OutputFormatSchema.describe('Output format'),
  allNamespaces: z
    .boolean()
    .optional()
    .default(false)
    .describe('List resources across all namespaces'),
  labelSelector: z.string().optional().describe('Filter resources by label selector'),
  fieldSelector: z.string().optional().describe('Filter resources by field selector'),
});

export const OcCreateSchema = z.object({
  resourceType: z.string().optional().describe('Type of resource to create'),
  name: z.string().optional().describe('Name of the resource'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  manifest: z.string().optional().describe('YAML manifest to create resources from'),
  filename: z.string().optional().describe('Path to YAML file to create resources from'),
  dryRun: z.boolean().optional().default(false).describe("Validate only, don't create"),
  // DeploymentConfig specific
  image: z.string().optional().describe('Container image for deploymentconfig'),
  replicas: z.number().optional().default(1).describe('Number of replicas'),
  // Route specific
  service: z.string().optional().describe('Service name for route'),
  hostname: z.string().optional().describe('Hostname for route'),
  // Project specific
  displayName: z.string().optional().describe('Display name for project'),
  description: z.string().optional().describe('Description for project'),
});

export const OcDeleteSchema = z.object({
  resourceType: z
    .string()
    .optional()
    .describe('Type of resource to delete (required if not using manifest/filename)'),
  name: z.string().optional().describe('Name of the resource to delete'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  manifest: z.string().optional().describe('YAML manifest defining resources to delete'),
  filename: z.string().optional().describe('Path to YAML file to delete resources from'),
  url: z.string().optional().describe('URL to YAML manifest defining resources to delete'),
  labelSelector: z.string().optional().describe('Delete resources matching label selector'),
  fieldSelector: z.string().optional().describe('Delete resources matching field selector'),
  all: z.boolean().optional().default(false).describe('Delete all resources of the specified type'),
  allNamespaces: z
    .boolean()
    .optional()
    .default(false)
    .describe('Delete resources across all namespaces'),
  force: z.boolean().optional().default(false).describe('Force deletion (bypass finalizers)'),
  gracePeriodSeconds: z.number().optional().describe('Grace period for deletion in seconds'),
  timeout: z.string().optional().describe('Timeout for deletion operation (e.g., "60s", "5m")'),
  wait: z.boolean().optional().default(false).describe('Wait for deletion to complete'),
  cascade: z
    .enum(['background', 'foreground', 'orphan'])
    .optional()
    .default('background')
    .describe('Deletion cascade strategy'),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Show what would be deleted without actually deleting'),
  confirm: z
    .boolean()
    .optional()
    .default(false)
    .describe('Require explicit confirmation for destructive operations'),
  recursive: z.boolean().optional().default(false).describe('Process directory recursively'),
  ignore404: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignore 404 errors if resource does not exist'),
});

export const OcApplySchema = z.object({
  manifest: z.string().optional().describe('YAML manifest content to apply'),
  filename: z.string().optional().describe('Path to YAML file to apply'),
  url: z.string().optional().describe('URL to YAML manifest to apply'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe("Validate only, don't apply (client or server)"),
  force: z.boolean().optional().default(false).describe('Force apply, ignore conflicts'),
  validate: z.boolean().optional().default(true).describe('Validate resources before applying'),
  wait: z.boolean().optional().default(false).describe('Wait for resources to be ready'),
  timeout: z.string().optional().describe('Timeout for wait operation (e.g., "60s", "5m")'),
  prune: z
    .boolean()
    .optional()
    .default(false)
    .describe('Prune resources not in current configuration'),
  pruneWhitelist: z.array(z.string()).optional().describe('Resource types to include in pruning'),
  selector: z.string().optional().describe('Label selector for pruning'),
  recursive: z.boolean().optional().default(false).describe('Process directory recursively'),
  kustomize: z.boolean().optional().default(false).describe('Apply kustomization directory'),
  serverSideApply: z.boolean().optional().default(false).describe('Use server-side apply'),
  fieldManager: z.string().optional().describe('Field manager name for server-side apply'),
  overwrite: z.boolean().optional().default(false).describe('Overwrite existing resources'),
  cascade: z
    .enum(['background', 'foreground', 'orphan'])
    .optional()
    .describe('Deletion cascade strategy'),
  gracePeriod: z.number().optional().describe('Grace period for resource deletion (seconds)'),
});

export const OcScaleSchema = z.object({
  resourceType: z
    .enum(['deployment', 'deploymentconfig', 'replicaset', 'statefulset'])
    .optional()
    .default('deployment')
    .describe('Resource type to scale (deployment, deploymentconfig, replicaset, statefulset)'),
  name: z.string().describe('Name of the resource to scale'),
  replicas: z.number().min(0).describe('Number of replicas to scale to'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
});

export const OcLogsSchema = z.object({
  resourceType: z
    .enum(['pod', 'deploymentconfig', 'deployment', 'build', 'buildconfig', 'job'])
    .optional()
    .default('pod')
    .describe('Type of resource to get logs from'),
  name: z.string().describe('Name of the resource'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  container: z.string().optional().describe('Container name (for pods with multiple containers)'),
  follow: z.boolean().optional().default(false).describe('Follow logs output (stream live logs)'),
  previous: z
    .boolean()
    .optional()
    .default(false)
    .describe('Show logs from previous terminated container'),
  since: z
    .string()
    .optional()
    .describe('Show logs since relative time (e.g. 5s, 2m, 3h) or absolute time'),
  sinceTime: z.string().optional().describe('Show logs since absolute timestamp (RFC3339)'),
  tail: z
    .number()
    .min(0)
    .optional()
    .describe('Number of lines to show from end of logs (-1 for all)'),
  timestamps: z.boolean().optional().default(false).describe('Include timestamps in log output'),
  limitBytes: z.number().min(1).optional().describe('Maximum bytes to return'),
  allContainers: z
    .boolean()
    .optional()
    .default(false)
    .describe('Get logs from all containers in the pod'),
  selector: z.string().optional().describe('Label selector to filter pods'),
  maxLogRequests: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Maximum number of concurrent log requests when using selectors'),
});

export const OcRolloutSchema = z.object({
  subCommand: z
    .enum(['status', 'history', 'undo', 'latest', 'cancel'])
    .describe('Rollout subcommand'),
  resourceType: z.string().default('deploymentconfig').describe('Resource type'),
  name: z.string().describe('Name of the resource'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  revision: z.number().optional().describe('Revision number (for undo)'),
  watch: z.boolean().optional().default(false).describe('Watch rollout status'),
});

export const OcStartBuildSchema = z.object({
  buildconfig: z.string().describe('Name of the BuildConfig'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  wait: z.boolean().optional().default(false).describe('Wait for build completion'),
  follow: z.boolean().optional().default(false).describe('Follow build logs'),
});

export const OcExposeSchema = z.object({
  resourceType: z.string().describe('Resource type to expose (service, deploymentconfig)'),
  name: z.string().describe('Name of the resource to expose'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  hostname: z.string().optional().describe('Hostname for the route'),
  port: z.string().optional().describe('Port to expose'),
  path: z.string().optional().describe('Path for the route'),
});

export const OcInstallOperatorSchema = z.object({
  operatorName: z
    .string()
    .describe('Name of the operator to install (e.g., "prometheus-operator", "cert-manager")'),
  version: z
    .string()
    .optional()
    .describe('Version of the operator to install (if not specified, installs latest available)'),
  namespace: NamespaceSchema.describe('Target namespace for operator installation'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  channel: z
    .string()
    .optional()
    .describe('Update channel for the operator (stable, alpha, beta, etc.)'),
  source: z
    .enum(['olm', 'helm', 'manifest'])
    .optional()
    .default('olm')
    .describe(
      'Installation method: olm (Operator Lifecycle Manager), helm (Helm chart), or manifest (direct YAML)'
    ),
  helmRepo: z.string().optional().describe('Helm repository URL (required if source is helm)'),
  manifestUrl: z
    .string()
    .optional()
    .describe('URL to operator manifest (required if source is manifest)'),
  createNamespace: z
    .boolean()
    .optional()
    .default(true)
    .describe('Create namespace if it does not exist'),
  installPlanApproval: z
    .enum(['Automatic', 'Manual'])
    .optional()
    .default('Automatic')
    .describe('Install plan approval strategy for OLM'),
});

export const OcNewAppSchema = z.object({
  gitRepo: z.string().url().describe('GitHub repository URL for the source code'),
  appName: z
    .string()
    .optional()
    .describe('Name for the application (if not specified, derives from repo name)'),
  namespace: NamespaceSchema.describe('Target namespace for the application'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  builderImage: z
    .string()
    .optional()
    .describe('Builder image for S2I build (e.g., "nodejs:18-ubi8", "python:3.9-ubi8")'),
  env: z.array(z.string()).optional().describe('Environment variables in KEY=VALUE format'),
  labels: z.array(z.string()).optional().describe('Labels in KEY=VALUE format'),
  createNamespace: z
    .boolean()
    .optional()
    .default(true)
    .describe('Create namespace if it does not exist'),
  exposeRoute: z
    .boolean()
    .optional()
    .default(true)
    .describe('Create an edge-terminated route to expose the application'),
  routeHostname: z
    .string()
    .optional()
    .describe('Custom hostname for the route (if not specified, uses default)'),
  gitRef: z
    .string()
    .optional()
    .describe('Git reference (branch, tag, or commit) to build from (default: main/master)'),
  contextDir: z.string().optional().describe('Context directory within the Git repository'),
  strategy: z
    .enum(['source', 'docker'])
    .optional()
    .default('source')
    .describe('Build strategy: source (S2I) or docker'),
});

export const OcDescribeSchema = z.object({
  resourceType: z
    .string()
    .describe('Type of resource to describe (pod, deployment, service, route, etc.)'),
  name: z.string().describe('Name of the resource to describe'),
  namespace: NamespaceSchema.describe('OpenShift namespace/project'),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  output: z
    .enum(['text', 'yaml', 'json', 'human-readable'])
    .optional()
    .default('human-readable')
    .describe(
      'Output format: text (default oc describe), yaml, json, or human-readable (concise summary)'
    ),
});

export const OcPatchSchema = z.object({
  resourceType: z
    .enum([
      'pod',
      'pods',
      'deployment',
      'deployments',
      'deploy',
      'deploymentconfig',
      'deploymentconfigs',
      'dc',
      'service',
      'services',
      'svc',
      'route',
      'routes',
      'configmap',
      'configmaps',
      'cm',
      'secret',
      'secrets',
      'persistentvolumeclaim',
      'persistentvolumeclaims',
      'pvc',
      'persistentvolume',
      'persistentvolumes',
      'pv',
      'serviceaccount',
      'serviceaccounts',
      'sa',
      'role',
      'roles',
      'rolebinding',
      'rolebindings',
      'clusterrole',
      'clusterroles',
      'clusterrolebinding',
      'clusterrolebindings',
      'networkpolicy',
      'networkpolicies',
      'ingress',
      'ingresses',
      'horizontalpodautoscaler',
      'hpa',
      'job',
      'jobs',
      'cronjob',
      'cronjobs',
      'daemonset',
      'daemonsets',
      'ds',
      'statefulset',
      'statefulsets',
      'sts',
      'replicaset',
      'replicasets',
      'rs',
      'node',
      'nodes',
      'namespace',
      'namespaces',
      'ns',
      'imagestream',
      'imagestreams',
      'is',
      'buildconfig',
      'buildconfigs',
      'bc',
      'build',
      'builds',
    ])
    .describe(
      'Type of resource to patch (pod, deployment, service, route, configmap, secret, etc.)'
    ),
  name: z.string().describe('Name of the resource to patch'),
  patch: z
    .string()
    .describe(
      'Patch content as JSON string or YAML. For strategic merge patch (default), provide the fields to update. For JSON patch, use RFC 6902 format.'
    ),
  patchType: z
    .enum(['strategic', 'merge', 'json'])
    .optional()
    .default('strategic')
    .describe('Type of patch operation'),
  namespace: NamespaceSchema.describe(
    'Namespace/project for the resource (not required for cluster-scoped resources)'
  ),
  context: ContextSchema.describe('OpenShift context to use (optional)'),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Perform a dry run without making actual changes'),
  force: z
    .boolean()
    .optional()
    .default(false)
    .describe('Force the patch operation, ignoring conflicts'),
  fieldManager: z
    .string()
    .optional()
    .default('mcp-openshift-client')
    .describe('Field manager name for server-side apply tracking'),
  subresource: z
    .enum(['status', 'scale', 'spec'])
    .optional()
    .describe('Subresource to patch (e.g., status, scale)'),
  recordHistory: z
    .boolean()
    .optional()
    .default(false)
    .describe('Record the patch operation in the resource annotation for rollback purposes'),
});

// Type exports
export type OcGetParams = z.infer<typeof OcGetSchema>;
export type OcCreateParams = z.infer<typeof OcCreateSchema>;
export type OcDeleteParams = z.infer<typeof OcDeleteSchema>;
export type OcApplyParams = z.infer<typeof OcApplySchema>;
export type OcScaleParams = z.infer<typeof OcScaleSchema>;
export type OcLogsParams = z.infer<typeof OcLogsSchema>;
export type OcRolloutParams = z.infer<typeof OcRolloutSchema>;
export type OcStartBuildParams = z.infer<typeof OcStartBuildSchema>;
export type OcExposeParams = z.infer<typeof OcExposeSchema>;
export type OcInstallOperatorParams = z.infer<typeof OcInstallOperatorSchema>;
export type OcNewAppParams = z.infer<typeof OcNewAppSchema>;
export type OcDescribeParams = z.infer<typeof OcDescribeSchema>;
export type OcPatchParams = z.infer<typeof OcPatchSchema>;
