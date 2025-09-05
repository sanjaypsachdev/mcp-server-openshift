import { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const troubleshootPodPrompt: Prompt = {
  name: 'troubleshoot-pod-prompt',
  description: 'Comprehensive pod troubleshooting guide for OpenShift clusters covering all possible scenarios',
  arguments: [
    {
      name: 'podName',
      description: 'Name of the pod to troubleshoot',
      required: true
    },
    {
      name: 'namespace',
      description: 'Namespace/project where the pod is located',
      required: true
    },
    {
      name: 'symptoms',
      description: 'Observed symptoms (e.g., CrashLoopBackOff, Pending, ImagePullBackOff)',
      required: false
    },
    {
      name: 'containerName',
      description: 'Specific container name if multi-container pod',
      required: false
    }
  ]
};

export function generateTroubleshootPodPrompt(args: {
  podName: string;
  namespace: string;
  symptoms?: string;
  containerName?: string;
}): string {
  const { podName, namespace, symptoms, containerName } = args;
  
  return `# OpenShift Pod Troubleshooting Guide

You are troubleshooting a pod in an OpenShift cluster. Follow this comprehensive troubleshooting methodology:

## 🎯 **Current Situation**
- **Pod Name**: ${podName}
- **Namespace**: ${namespace}
- **Symptoms**: ${symptoms || 'Not specified - investigate all areas'}
- **Container**: ${containerName || 'All containers in pod'}

## 📋 **Step-by-Step Troubleshooting Process**

### **Phase 1: Initial Assessment**

1. **Get Pod Status Overview**
   - Use: \`oc get pod ${podName} -n ${namespace} -o wide\`
   - Check: Status, Ready count, Restarts, Age, Node assignment
   - Look for: Pending, CrashLoopBackOff, ImagePullBackOff, Error, Terminating

2. **Describe Pod for Detailed Information**
   - Use: \`oc describe pod ${podName} -n ${namespace}\`
   - Focus on: Events section (bottom), Conditions, Container statuses
   - Key indicators: Failed scheduling, Image pull failures, Probe failures

### **Phase 2: Common Pod Status Issues**

#### **🔴 Status: Pending**
**Possible Causes & Solutions:**

**A. Resource Constraints**
- Check: Node resources, namespace quotas, pod resource requests
- Commands:
  - \`oc describe node\` (check allocatable resources)
  - \`oc get resourcequota -n ${namespace}\`
  - \`oc get limitrange -n ${namespace}\`
- Solutions: Adjust requests/limits, scale cluster, modify quotas

**B. Scheduling Issues**
- Check: Node selectors, affinity rules, taints/tolerations
- Commands:
  - \`oc get pod ${podName} -n ${namespace} -o yaml | grep -A10 nodeSelector\`
  - \`oc get nodes --show-labels\`
- Solutions: Fix selectors, add tolerations, remove taints

**C. Storage Issues**
- Check: PVC binding, storage class availability
- Commands:
  - \`oc get pvc -n ${namespace}\`
  - \`oc get storageclass\`
- Solutions: Fix PVC, check storage provisioner

#### **🔴 Status: CrashLoopBackOff**
**Possible Causes & Solutions:**

**A. Application Errors**
- Check: Container logs, exit codes, startup probes
- Commands:
  - \`oc logs ${podName} -n ${namespace} ${containerName ? `-c ${containerName}` : ''}\`
  - \`oc logs ${podName} -n ${namespace} --previous ${containerName ? `-c ${containerName}` : ''}\`
- Solutions: Fix application code, adjust probes, check dependencies

**B. Configuration Issues**
- Check: Environment variables, config maps, secrets
- Commands:
  - \`oc get pod ${podName} -n ${namespace} -o yaml | grep -A20 env\`
  - \`oc get configmap -n ${namespace}\`
  - \`oc get secrets -n ${namespace}\`
- Solutions: Fix configs, update secrets, verify mounts

**C. Resource Limits**
- Check: Memory/CPU limits, OOMKilled events
- Commands:
  - \`oc describe pod ${podName} -n ${namespace} | grep -i oom\`
  - \`oc top pod ${podName} -n ${namespace}\`
- Solutions: Increase limits, optimize application

#### **🔴 Status: ImagePullBackOff**
**Possible Causes & Solutions:**

**A. Image Issues**
- Check: Image name, tag existence, registry accessibility
- Commands:
  - \`oc get pod ${podName} -n ${namespace} -o yaml | grep image:\`
  - \`oc get imagestream -n ${namespace}\`
- Solutions: Fix image name/tag, check registry, update image

**B. Authentication Issues**
- Check: Pull secrets, registry credentials
- Commands:
  - \`oc get secrets -n ${namespace} | grep docker\`
  - \`oc describe pod ${podName} -n ${namespace} | grep -i pull\`
- Solutions: Add pull secrets, fix credentials

#### **🔴 Status: Error/Terminating**
**Possible Causes & Solutions:**

**A. Termination Issues**
- Check: Grace period, finalizers, stuck resources
- Commands:
  - \`oc get pod ${podName} -n ${namespace} -o yaml | grep finalizers\`
  - \`oc get pod ${podName} -n ${namespace} -o yaml | grep gracePeriod\`
- Solutions: Remove finalizers, force delete if needed

### **Phase 3: Container-Level Troubleshooting**

#### **🔍 Container Analysis**
1. **Check Container Status**
   - \`oc get pod ${podName} -n ${namespace} -o jsonpath='{.status.containerStatuses}'\`
   - Look for: waiting, running, terminated states

2. **Examine Container Logs**
   - Recent logs: \`oc logs ${podName} -n ${namespace} ${containerName ? `-c ${containerName}` : ''} --tail=100\`
   - Previous logs: \`oc logs ${podName} -n ${namespace} ${containerName ? `-c ${containerName}` : ''} --previous\`
   - Follow logs: \`oc logs ${podName} -n ${namespace} ${containerName ? `-c ${containerName}` : ''} -f\`

3. **Interactive Debugging**
   - Access container: \`oc exec -it ${podName} -n ${namespace} ${containerName ? `-c ${containerName}` : ''} -- /bin/sh\`
   - Check filesystem: \`oc exec ${podName} -n ${namespace} -- ls -la /\`
   - Test connectivity: \`oc exec ${podName} -n ${namespace} -- ping google.com\`

### **Phase 4: OpenShift-Specific Issues**

#### **🔐 Security Context Constraints (SCC)**
- Check: SCC violations, privileged access needs
- Commands:
  - \`oc get pod ${podName} -n ${namespace} -o yaml | grep -A5 securityContext\`
  - \`oc get scc\`
  - \`oc describe scc restricted\`
- Solutions: Adjust SCC, modify security context

#### **🌐 Network Issues**
- Check: Network policies, service connectivity, DNS
- Commands:
  - \`oc get networkpolicy -n ${namespace}\`
  - \`oc get svc -n ${namespace}\`
  - \`oc exec ${podName} -n ${namespace} -- nslookup kubernetes.default\`
- Solutions: Fix network policies, check service endpoints

#### **📦 Build-Related Issues (S2I/BuildConfigs)**
- Check: Build status, image stream tags, triggers
- Commands:
  - \`oc get builds -n ${namespace}\`
  - \`oc get imagestream -n ${namespace}\`
  - \`oc describe build <build-name> -n ${namespace}\`
- Solutions: Rebuild image, fix build config, update triggers

### **Phase 5: Advanced Troubleshooting**

#### **🔬 Deep Dive Analysis**
1. **Resource Usage**
   - \`oc top pod ${podName} -n ${namespace}\`
   - \`oc describe node <node-name>\` (where pod is scheduled)

2. **Events Analysis**
   - \`oc get events -n ${namespace} --sort-by='.lastTimestamp'\`
   - \`oc get events --field-selector involvedObject.name=${podName} -n ${namespace}\`

3. **YAML Inspection**
   - \`oc get pod ${podName} -n ${namespace} -o yaml\`
   - Check: spec vs status differences, annotations, labels

#### **🚨 Emergency Procedures**
1. **Force Delete Stuck Pods**
   - \`oc delete pod ${podName} -n ${namespace} --grace-period=0 --force\`

2. **Recreate from Deployment**
   - \`oc rollout restart deployment <deployment-name> -n ${namespace}\`

3. **Scale to Zero and Back**
   - \`oc scale deployment <deployment-name> --replicas=0 -n ${namespace}\`
   - \`oc scale deployment <deployment-name> --replicas=<original-count> -n ${namespace}\`

### **Phase 6: Prevention & Monitoring**

#### **🛡️ Health Checks**
- Configure: Liveness and readiness probes
- Monitor: Probe success rates and timing
- Adjust: Probe intervals and thresholds

#### **📊 Monitoring Setup**
- Enable: Resource monitoring and alerting
- Track: Pod restart patterns, resource usage trends
- Set up: Log aggregation and analysis

## 🎯 **Troubleshooting Checklist**

Use this checklist for systematic troubleshooting:

- [ ] Check pod status and basic information
- [ ] Review pod events and error messages
- [ ] Examine container logs (current and previous)
- [ ] Verify resource requests and limits
- [ ] Check image availability and pull secrets
- [ ] Validate configuration (ConfigMaps, Secrets)
- [ ] Test network connectivity and DNS
- [ ] Review security contexts and SCCs
- [ ] Analyze node capacity and scheduling
- [ ] Check for quota and limit constraints
- [ ] Verify storage and volume mounts
- [ ] Review build status (if S2I deployed)
- [ ] Test application-specific health endpoints
- [ ] Check dependencies and external services
- [ ] Review recent cluster events

## 📚 **Additional Resources**

- **OpenShift Documentation**: https://docs.openshift.com/container-platform/latest/support/troubleshooting/
- **Pod Troubleshooting**: https://kubernetes.io/docs/tasks/debug-application-cluster/debug-pod-replication-controller/
- **Common Issues**: https://docs.openshift.com/container-platform/latest/support/troubleshooting/troubleshooting-pods.html

## 🎪 **Quick Commands Reference**

\`\`\`bash
# Basic pod info
oc get pod ${podName} -n ${namespace} -o wide
oc describe pod ${podName} -n ${namespace}

# Logs
oc logs ${podName} -n ${namespace} ${containerName ? `-c ${containerName}` : ''}
oc logs ${podName} -n ${namespace} --previous

# Interactive access
oc exec -it ${podName} -n ${namespace} -- /bin/bash

# Events
oc get events -n ${namespace} --field-selector involvedObject.name=${podName}

# Resource usage
oc top pod ${podName} -n ${namespace}
\`\`\`

Remember: Always start with the basics (status, describe, logs) before moving to advanced troubleshooting techniques.`;
}
