import { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const troubleshootOpenshiftPrompt: Prompt = {
  name: 'troubleshoot-openshift-prompt',
  description:
    'Comprehensive OpenShift troubleshooting guide covering pods, deployments, services, routes, builds, and cluster-wide issues',
  arguments: [
    {
      name: 'issueType',
      description:
        'Type of issue to troubleshoot (pod, deployment, service, route, build, networking, storage, cluster, performance)',
      required: true,
    },
    {
      name: 'resourceName',
      description: 'Name of the specific resource having issues (if applicable)',
      required: false,
    },
    {
      name: 'namespace',
      description: 'Namespace/project where the issue is occurring',
      required: false,
    },
    {
      name: 'symptoms',
      description: 'Observed symptoms or error messages',
      required: false,
    },
    {
      name: 'context',
      description: 'Additional context about when the issue occurs or what was being attempted',
      required: false,
    },
  ],
};

export function generateTroubleshootOpenshiftPrompt(args: {
  issueType: string;
  resourceName?: string;
  namespace?: string;
  symptoms?: string;
  context?: string;
}): string {
  const { issueType, resourceName, namespace, symptoms, context } = args;

  return `# OpenShift Comprehensive Troubleshooting Guide

You are troubleshooting an OpenShift/Kubernetes issue. Follow this systematic troubleshooting methodology:

## 🎯 **Current Situation**
- **Issue Type**: ${issueType}
- **Resource**: ${resourceName || 'Not specified - cluster-wide or general issue'}
- **Namespace**: ${namespace || 'Not specified - may be cluster-wide'}
- **Symptoms**: ${symptoms || 'Not specified - investigate all areas'}
- **Context**: ${context || 'Not specified - general troubleshooting'}

## 📋 **Troubleshooting Framework**

${generateIssueSpecificGuide(issueType, resourceName, namespace, symptoms, context)}

## 🔍 **General OpenShift Troubleshooting Process**

### **Phase 1: Initial Assessment**

1. **Check Overall Cluster Health**
   - \`oc get nodes\` - Verify all nodes are Ready
   - \`oc get clusteroperators\` - Check cluster operator status
   - \`oc get events --all-namespaces --sort-by='.lastTimestamp'\` - Recent cluster events

2. **Verify Authentication and Context**
   - \`oc whoami\` - Confirm current user
   - \`oc config current-context\` - Verify cluster context
   - \`oc auth can-i <verb> <resource>\` - Check permissions

3. **Namespace/Project Analysis**
   - \`oc get projects\` - List available projects
   - \`oc project ${namespace || '<namespace>'}\` - Switch to target project
   - \`oc get all -n ${namespace || '<namespace>'}\` - Overview of all resources

### **Phase 2: Resource-Specific Investigation**

#### **For Resource Issues:**
1. **Basic Resource Status**
   - \`oc get ${issueType} ${resourceName || '<resource-name>'} -n ${namespace || '<namespace>'} -o wide\`
   - \`oc describe ${issueType} ${resourceName || '<resource-name>'} -n ${namespace || '<namespace>'}\`

2. **Resource Events and Logs**
   - \`oc get events --field-selector involvedObject.name=${resourceName || '<resource-name>'} -n ${namespace || '<namespace>'}\`
   - \`oc logs ${issueType}/${resourceName || '<resource-name>'} -n ${namespace || '<namespace>'}\` (if applicable)

3. **Resource Dependencies**
   - Check related resources (services, configmaps, secrets, PVCs)
   - Verify network policies and security contexts
   - Check resource quotas and limits

### **Phase 3: Advanced Diagnostics**

#### **Resource Usage and Performance**
- \`oc top nodes\` - Node resource usage
- \`oc top pods --all-namespaces\` - Pod resource consumption
- \`oc describe node <node-name>\` - Detailed node information

#### **Network Troubleshooting**
- \`oc get svc,endpoints -n ${namespace || '<namespace>'}\` - Service and endpoint status
- \`oc get routes -n ${namespace || '<namespace>'}\` - Route configuration
- \`oc get networkpolicies -n ${namespace || '<namespace>'}\` - Network policies

#### **Storage Investigation**
- \`oc get pvc -n ${namespace || '<namespace>'}\` - Persistent volume claims
- \`oc get pv\` - Persistent volumes
- \`oc get storageclass\` - Available storage classes

### **Phase 4: OpenShift-Specific Diagnostics**

#### **Security Context Constraints (SCC)**
- \`oc get scc\` - List security context constraints
- \`oc describe scc restricted\` - Default SCC details
- \`oc get pod ${resourceName || '<pod-name>'} -n ${namespace || '<namespace>'} -o yaml | grep -A5 securityContext\`

#### **Image and Build Issues**
- \`oc get imagestreams -n ${namespace || '<namespace>'}\` - Image streams
- \`oc get builds -n ${namespace || '<namespace>'}\` - Build status
- \`oc describe build <build-name> -n ${namespace || '<namespace>'}\` - Build details

#### **Operator and Custom Resources**
- \`oc get operators\` - Installed operators
- \`oc get crd\` - Custom resource definitions
- \`oc api-resources\` - Available API resources

## 🚨 **Common Issue Patterns & Solutions**

### **Resource Stuck or Failing**
1. Check resource events for error messages
2. Verify dependencies (secrets, configmaps, PVCs)
3. Check RBAC permissions and security contexts
4. Validate resource specifications and limits

### **Network Connectivity Issues**
1. Test service endpoints and DNS resolution
2. Check network policies and firewall rules
3. Verify route configuration and TLS settings
4. Test pod-to-pod and external connectivity

### **Performance Problems**
1. Monitor resource usage (CPU, memory, storage)
2. Check for resource constraints and quotas
3. Analyze scaling behavior and limits
4. Review application logs for bottlenecks

### **Build and Deployment Failures**
1. Check build logs and image pull status
2. Verify source code accessibility and credentials
3. Review build configuration and triggers
4. Check storage and resource availability

## 🔧 **Emergency Procedures**

### **Force Resource Recreation**
\`\`\`bash
# Scale to zero and back (for deployments)
oc scale deployment <name> --replicas=0 -n ${namespace || '<namespace>'}
oc scale deployment <name> --replicas=<original-count> -n ${namespace || '<namespace>'}

# Force delete stuck resources
oc delete <resource> <name> -n ${namespace || '<namespace>'} --grace-period=0 --force

# Restart deployment
oc rollout restart deployment/<name> -n ${namespace || '<namespace>'}
\`\`\`

### **Cluster Recovery**
\`\`\`bash
# Check cluster operator status
oc get clusteroperators

# Restart degraded operators (if safe)
oc delete pod -l app=<operator-name> -n openshift-<operator-namespace>

# Check etcd health
oc get pods -n openshift-etcd
\`\`\`

## 📚 **Additional Resources**

- **OpenShift Documentation**: https://docs.openshift.com/container-platform/latest/support/troubleshooting/
- **Kubernetes Troubleshooting**: https://kubernetes.io/docs/tasks/debug-application-cluster/
- **OpenShift CLI Reference**: https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/

## 🎯 **Systematic Troubleshooting Checklist**

Use this checklist for any OpenShift issue:

- [ ] Verify cluster and node health
- [ ] Check authentication and permissions
- [ ] Review resource status and events
- [ ] Examine logs and error messages
- [ ] Validate configuration and dependencies
- [ ] Test network connectivity
- [ ] Check resource quotas and limits
- [ ] Review security contexts and policies
- [ ] Analyze performance metrics
- [ ] Check for recent changes or deployments
- [ ] Review operator and custom resource status
- [ ] Validate storage and persistent volumes

Remember: Start with the basics (status, describe, logs) and work systematically through the layers of the OpenShift stack.`;
}

function generateIssueSpecificGuide(
  issueType: string,
  resourceName?: string,
  namespace?: string,
  _symptoms?: string,
  _context?: string
): string {
  const ns = namespace || '<namespace>';
  const resource = resourceName || '<resource-name>';

  switch (issueType.toLowerCase()) {
    case 'pod':
      return `### **🚀 Pod Troubleshooting Guide**

#### **Common Pod Issues & Solutions**

**🔴 Pod Status: Pending**
- **Resource Constraints**: \`oc describe node\`, \`oc get resourcequota -n ${ns}\`
- **Scheduling Issues**: Check node selectors, affinity rules, taints
- **Storage Issues**: \`oc get pvc -n ${ns}\`, verify storage class

**🔴 Pod Status: CrashLoopBackOff**
- **Application Errors**: \`oc logs ${resource} -n ${ns}\`, \`oc logs ${resource} -n ${ns} --previous\`
- **Configuration Issues**: Check environment variables, secrets, configmaps
- **Resource Limits**: Check for OOMKilled events, adjust memory limits

**🔴 Pod Status: ImagePullBackOff**
- **Image Issues**: Verify image name, tag, and registry accessibility
- **Authentication**: Check pull secrets and registry credentials
- **Network**: Test registry connectivity from cluster

#### **Pod Investigation Commands**
\`\`\`bash
# Pod status and details
oc get pod ${resource} -n ${ns} -o wide
oc describe pod ${resource} -n ${ns}

# Pod logs (current and previous)
oc logs ${resource} -n ${ns} --tail=100
oc logs ${resource} -n ${ns} --previous

# Interactive debugging
oc exec -it ${resource} -n ${ns} -- /bin/sh

# Pod events
oc get events --field-selector involvedObject.name=${resource} -n ${ns}
\`\`\``;

    case 'deployment':
      return `### **📦 Deployment Troubleshooting Guide**

#### **Common Deployment Issues & Solutions**

**🔴 Deployment Not Rolling Out**
- **Replica Issues**: \`oc get deployment ${resource} -n ${ns}\` - check desired vs ready replicas
- **Pod Template Issues**: Check pod template spec for errors
- **Resource Constraints**: Verify CPU/memory requests and limits

**🔴 Deployment Stuck**
- **Rolling Update Issues**: \`oc rollout status deployment/${resource} -n ${ns}\`
- **Pod Failures**: Check individual pod status and logs
- **Image Pull Issues**: Verify image availability and pull secrets

#### **Deployment Investigation Commands**
\`\`\`bash
# Deployment status
oc get deployment ${resource} -n ${ns} -o wide
oc describe deployment ${resource} -n ${ns}

# Rollout status and history
oc rollout status deployment/${resource} -n ${ns}
oc rollout history deployment/${resource} -n ${ns}

# Related resources
oc get replicaset -n ${ns} -l app=${resource}
oc get pods -n ${ns} -l app=${resource}

# Restart deployment
oc rollout restart deployment/${resource} -n ${ns}
\`\`\``;

    case 'service':
      return `### **🌐 Service Troubleshooting Guide**

#### **Common Service Issues & Solutions**

**🔴 Service Not Accessible**
- **Endpoint Issues**: \`oc get endpoints ${resource} -n ${ns}\` - check if pods are selected
- **Selector Problems**: Verify service selector matches pod labels
- **Port Configuration**: Check service ports vs container ports

**🔴 Load Balancing Issues**
- **Pod Readiness**: Ensure pods are ready and healthy
- **Service Type**: Verify ClusterIP, NodePort, or LoadBalancer configuration
- **Network Policies**: Check if network policies block traffic

#### **Service Investigation Commands**
\`\`\`bash
# Service details
oc get service ${resource} -n ${ns} -o wide
oc describe service ${resource} -n ${ns}

# Endpoints and pod selection
oc get endpoints ${resource} -n ${ns}
oc get pods -n ${ns} --show-labels

# Test connectivity
oc exec <test-pod> -n ${ns} -- curl http://${resource}.<service-port>
oc port-forward service/${resource} <local-port>:<service-port> -n ${ns}
\`\`\``;

    case 'route':
      return `### **🛣️ Route Troubleshooting Guide**

#### **Common Route Issues & Solutions**

**🔴 Route Not Accessible**
- **DNS Issues**: Verify hostname resolution and DNS configuration
- **TLS Problems**: Check certificate validity and TLS termination
- **Backend Service**: Ensure target service exists and is healthy

**🔴 SSL/TLS Errors**
- **Certificate Issues**: Check certificate validity and chain
- **TLS Termination**: Verify edge, passthrough, or re-encrypt configuration
- **Security Policies**: Check if security policies block HTTPS traffic

#### **Route Investigation Commands**
\`\`\`bash
# Route configuration
oc get route ${resource} -n ${ns} -o wide
oc describe route ${resource} -n ${ns}

# Test route accessibility
curl -I https://$(oc get route ${resource} -n ${ns} -o jsonpath='{.spec.host}')
oc get route ${resource} -n ${ns} -o jsonpath='{.spec.host}' | xargs nslookup

# Backend service check
oc get service $(oc get route ${resource} -n ${ns} -o jsonpath='{.spec.to.name}') -n ${ns}
\`\`\``;

    case 'build':
      return `### **🔨 Build Troubleshooting Guide**

#### **Common Build Issues & Solutions**

**🔴 Build Failures**
- **Source Issues**: Verify Git repository accessibility and credentials
- **Builder Image**: Check if builder image is available and compatible
- **Build Strategy**: Verify S2I, Docker, or custom build strategy configuration

**🔴 Build Timeout or Hanging**
- **Resource Limits**: Check build pod resource limits
- **Network Issues**: Verify internet connectivity for dependency downloads
- **Storage**: Check if build storage is sufficient

#### **Build Investigation Commands**
\`\`\`bash
# Build status and logs
oc get builds -n ${ns}
oc describe build ${resource} -n ${ns}
oc logs build/${resource} -n ${ns}

# BuildConfig analysis
oc get buildconfig -n ${ns}
oc describe buildconfig <buildconfig-name> -n ${ns}

# Image stream status
oc get imagestream -n ${ns}
oc describe imagestream <imagestream-name> -n ${ns}
\`\`\``;

    case 'networking':
      return `### **🌐 Network Troubleshooting Guide**

#### **Common Network Issues & Solutions**

**🔴 Pod-to-Pod Communication**
- **Network Policies**: \`oc get networkpolicies -n ${ns}\` - check for blocking policies
- **DNS Resolution**: Test service discovery and DNS from pods
- **Firewall Rules**: Verify cluster network configuration

**🔴 External Connectivity**
- **Ingress Controllers**: Check router pods and configuration
- **Load Balancers**: Verify external load balancer status
- **Security Groups**: Check cloud provider security group rules

#### **Network Investigation Commands**
\`\`\`bash
# Network policies and services
oc get networkpolicies -n ${ns}
oc get services -n ${ns}
oc get endpoints -n ${ns}

# DNS and connectivity testing
oc exec <test-pod> -n ${ns} -- nslookup kubernetes.default
oc exec <test-pod> -n ${ns} -- ping <target-service>
oc exec <test-pod> -n ${ns} -- curl -v http://<service>:<port>

# Router and ingress
oc get pods -n openshift-ingress
oc get ingresscontroller -n openshift-ingress-operator
\`\`\``;

    case 'storage':
      return `### **💾 Storage Troubleshooting Guide**

#### **Common Storage Issues & Solutions**

**🔴 PVC Binding Issues**
- **Storage Class**: \`oc get storageclass\` - verify available storage classes
- **Provisioner**: Check if storage provisioner is running
- **Capacity**: Verify sufficient storage capacity

**🔴 Mount Failures**
- **Permissions**: Check pod security context and volume permissions
- **Node Issues**: Verify storage is accessible from target node
- **Volume Conflicts**: Check for conflicting volume mounts

#### **Storage Investigation Commands**
\`\`\`bash
# Storage overview
oc get pvc -n ${ns}
oc get pv
oc get storageclass

# PVC and PV details
oc describe pvc ${resource} -n ${ns}
oc describe pv <pv-name>

# Storage provisioner status
oc get pods -n <storage-namespace>
oc logs -n <storage-namespace> -l app=<provisioner>
\`\`\``;

    case 'cluster':
      return `### **🏗️ Cluster Troubleshooting Guide**

#### **Common Cluster Issues & Solutions**

**🔴 Cluster Operators Degraded**
- **Operator Status**: \`oc get clusteroperators\` - identify degraded operators
- **Operator Logs**: Check operator pod logs for specific errors
- **Resource Constraints**: Verify cluster has sufficient resources

**🔴 Node Issues**
- **Node Status**: \`oc get nodes\` - check for NotReady nodes
- **Node Resources**: \`oc describe node <node-name>\` - check capacity and conditions
- **System Pods**: Verify system pods are running on all nodes

#### **Cluster Investigation Commands**
\`\`\`bash
# Cluster health overview
oc get clusteroperators
oc get nodes
oc get pods --all-namespaces | grep -v Running

# Critical system components
oc get pods -n openshift-etcd
oc get pods -n openshift-kube-apiserver
oc get pods -n openshift-authentication

# Resource utilization
oc adm top nodes
oc adm top pods --all-namespaces --sort-by=cpu
\`\`\``;

    case 'performance':
      return `### **⚡ Performance Troubleshooting Guide**

#### **Common Performance Issues & Solutions**

**🔴 Slow Application Response**
- **Resource Limits**: Check if pods are hitting CPU/memory limits
- **Scaling Issues**: Verify HPA configuration and metrics
- **Database Performance**: Check database connection pools and queries

**🔴 High Resource Usage**
- **Memory Leaks**: Monitor memory usage trends over time
- **CPU Throttling**: Check for CPU limit throttling
- **I/O Bottlenecks**: Monitor storage performance and network throughput

#### **Performance Investigation Commands**
\`\`\`bash
# Resource usage monitoring
oc top pods -n ${ns} --sort-by=cpu
oc top pods -n ${ns} --sort-by=memory
oc describe pod ${resource} -n ${ns} | grep -A10 Limits

# Horizontal Pod Autoscaler
oc get hpa -n ${ns}
oc describe hpa -n ${ns}

# Performance metrics (if monitoring is enabled)
oc get servicemonitor -n ${ns}
oc get prometheusrules -n ${ns}
\`\`\``;

    default:
      return `### **🔍 General Issue Investigation**

Since the issue type "${issueType}" is not specifically recognized, follow this general troubleshooting approach:

#### **Step 1: Identify the Problem Scope**
- **Single Resource**: Focus on specific resource investigation
- **Namespace-wide**: Check all resources in the namespace
- **Cluster-wide**: Investigate cluster-level issues

#### **Step 2: Gather Information**
- **Resource Status**: \`oc get all -n ${ns}\`
- **Events**: \`oc get events -n ${ns} --sort-by='.lastTimestamp'\`
- **Logs**: \`oc logs <resource> -n ${ns}\`

#### **Step 3: Analyze Dependencies**
- **Related Resources**: Check services, configmaps, secrets, PVCs
- **Network Connectivity**: Test service-to-service communication
- **Security Policies**: Verify RBAC and security contexts

#### **Step 4: Check External Factors**
- **Cluster Health**: \`oc get nodes\`, \`oc get clusteroperators\`
- **Resource Availability**: \`oc top nodes\`, quota usage
- **Recent Changes**: Review recent deployments or configuration changes`;
  }
}
