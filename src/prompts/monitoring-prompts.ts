import { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const monitoringPromptsPrompt: Prompt = {
  name: 'monitoring-prompts',
  description: 'Comprehensive monitoring and observability guidance for OpenShift clusters covering metrics, logging, alerting, and performance analysis',
  arguments: [
    {
      name: 'scenario',
      description: 'Monitoring scenario (cluster, application, performance, troubleshooting, capacity, security)',
      required: true
    },
    {
      name: 'target',
      description: 'Target to monitor (pod, deployment, service, node, namespace, or cluster-wide)',
      required: false
    },
    {
      name: 'namespace',
      description: 'Namespace/project to focus monitoring on',
      required: false
    },
    {
      name: 'timeRange',
      description: 'Time range for monitoring (1h, 6h, 24h, 7d)',
      required: false
    }
  ]
};

export function generateMonitoringPrompts(args: {
  scenario: string;
  target?: string;
  namespace?: string;
  timeRange?: string;
}): string {
  const { scenario, target, namespace, timeRange } = args;
  
  return `# OpenShift Monitoring & Observability Guide

You are setting up monitoring and observability for an OpenShift cluster. Follow this comprehensive monitoring methodology:

## 🎯 **Monitoring Scenario**
- **Scenario**: ${scenario}
- **Target**: ${target || 'Cluster-wide'}
- **Namespace**: ${namespace || 'All namespaces'}
- **Time Range**: ${timeRange || '24h (default)'}

## 📊 **Monitoring Framework Overview**

### **Core Monitoring Components**
1. **Prometheus** - Metrics collection and storage
2. **Grafana** - Visualization and dashboards
3. **AlertManager** - Alert routing and notifications
4. **Node Exporter** - Node-level metrics
5. **Cluster Monitoring Operator** - OpenShift monitoring stack

### **Log Aggregation Stack**
1. **Elasticsearch** - Log storage and indexing
2. **Fluentd/Vector** - Log collection and forwarding
3. **Kibana** - Log visualization and analysis
4. **OpenShift Logging Operator** - Centralized logging

## 🔍 **Monitoring Scenarios**

### **Scenario: Cluster Monitoring**

#### **📈 Cluster Health Metrics**
\`\`\`bash
# Check cluster operator status
oc get clusteroperators

# Monitor cluster resource usage
oc adm top nodes
oc adm top pods --all-namespaces

# Check cluster events
oc get events --all-namespaces --sort-by='.lastTimestamp'

# Monitor etcd health
oc get pods -n openshift-etcd
oc logs -n openshift-etcd -l app=etcd --tail=100
\`\`\`

#### **🎯 Key Metrics to Monitor**
- **Node CPU/Memory utilization** (target: <80%)
- **Pod restart rates** (target: <5 restarts/hour)
- **Cluster operator availability** (target: 100% Available)
- **etcd performance** (target: <100ms latency)
- **API server response times** (target: <500ms)

#### **🚨 Critical Alerts to Set Up**
- Node resource exhaustion (CPU >90%, Memory >85%)
- Pod crash loops (>5 restarts in 10 minutes)
- Cluster operator degraded status
- etcd disk space (>80% full)
- Certificate expiration warnings (30 days)

### **Scenario: Application Monitoring**

#### **📱 Application Performance Metrics**
\`\`\`bash
# Monitor specific application
${namespace ? `oc get pods -n ${namespace}` : 'oc get pods -n <namespace>'}
${namespace ? `oc top pods -n ${namespace}` : 'oc top pods -n <namespace>'}

# Check application logs
${target && namespace ? `oc logs deployment/${target} -n ${namespace} --tail=100` : 'oc logs deployment/<app-name> -n <namespace> --tail=100'}

# Monitor application scaling
${namespace ? `oc get hpa -n ${namespace}` : 'oc get hpa -n <namespace>'}
${namespace ? `oc describe hpa -n ${namespace}` : 'oc describe hpa -n <namespace>'}

# Check service endpoints
${namespace ? `oc get endpoints -n ${namespace}` : 'oc get endpoints -n <namespace>'}
\`\`\`

#### **🎯 Application Metrics to Track**
- **Response times** and latency percentiles
- **Request rates** and throughput
- **Error rates** and status codes
- **Resource utilization** (CPU, memory, disk)
- **Database connection pools** and query performance

#### **📊 Custom Application Monitoring Setup**
\`\`\`yaml
# ServiceMonitor for Prometheus scraping
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${target || 'app-name'}-metrics
  namespace: ${namespace || 'monitoring'}
spec:
  selector:
    matchLabels:
      app: ${target || 'app-name'}
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    scheme: http
\`\`\`

### **Scenario: Performance Analysis**

#### **🔬 Performance Debugging Commands**
\`\`\`bash
# Resource usage analysis
oc adm top nodes --sort-by=cpu
oc adm top pods --all-namespaces --sort-by=cpu

# Network performance
oc get networkpolicies --all-namespaces
oc describe network.config/cluster

# Storage performance
oc get persistentvolumes
oc get storageclass
oc describe persistentvolumeclaim --all-namespaces

# Build performance
oc get builds --all-namespaces --sort-by='.status.startTimestamp'
\`\`\`

#### **📈 Performance Optimization Areas**
1. **Pod Resource Requests/Limits**
   - Set appropriate CPU/memory requests
   - Configure realistic limits
   - Monitor resource utilization patterns

2. **Node Optimization**
   - Monitor node capacity and allocation
   - Check for resource fragmentation
   - Optimize pod scheduling and affinity

3. **Storage Performance**
   - Use appropriate storage classes
   - Monitor I/O patterns and latency
   - Optimize persistent volume configurations

### **Scenario: Troubleshooting Monitoring**

#### **🐛 Common Monitoring Issues**
\`\`\`bash
# Prometheus issues
oc get pods -n openshift-monitoring
oc logs -n openshift-monitoring -l app.kubernetes.io/name=prometheus

# Grafana access issues
oc get route -n openshift-monitoring
oc describe oauth

# Missing metrics
oc get servicemonitors --all-namespaces
oc get podmonitors --all-namespaces

# Alert manager issues
oc logs -n openshift-monitoring -l app.kubernetes.io/name=alertmanager
\`\`\`

### **Scenario: Capacity Planning**

#### **📊 Capacity Analysis Commands**
\`\`\`bash
# Cluster capacity overview
oc describe nodes | grep -A5 "Allocated resources"

# Resource quota usage
oc get resourcequota --all-namespaces
oc describe resourcequota --all-namespaces

# Storage capacity
oc get persistentvolumes
oc get persistentvolumeclaims --all-namespaces

# Historical resource trends (if monitoring is set up)
# Access Grafana dashboards for historical data analysis
\`\`\`

#### **🎯 Capacity Planning Metrics**
- **Node utilization trends** over time
- **Pod density** and scheduling efficiency
- **Storage growth rates** and usage patterns
- **Network traffic** and bandwidth utilization
- **Build frequency** and resource consumption

### **Scenario: Security Monitoring**

#### **🔒 Security Monitoring Commands**
\`\`\`bash
# Security context violations
oc get pods --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{" "}{.spec.securityContext}{"\n"}{end}'

# RBAC monitoring
oc get rolebindings --all-namespaces
oc get clusterrolebindings

# Network policy compliance
oc get networkpolicies --all-namespaces
oc describe networkpolicies --all-namespaces

# Image security scanning
oc get images
oc describe images | grep -i vulnerabilit
\`\`\`

## 📋 **Monitoring Best Practices**

### **🎯 Essential Dashboards to Create**
1. **Cluster Overview**
   - Node health and resource utilization
   - Pod distribution and status
   - Critical component availability

2. **Application Performance**
   - Request rates, latency, and error rates
   - Resource consumption trends
   - Scaling metrics and patterns

3. **Infrastructure Health**
   - Storage utilization and performance
   - Network throughput and latency
   - Build and deployment frequency

### **🚨 Critical Alerts to Configure**

#### **Cluster-Level Alerts**
- Node down or unschedulable
- High resource utilization (CPU >85%, Memory >90%)
- etcd performance degradation
- API server high latency
- Persistent volume space exhaustion

#### **Application-Level Alerts**
- Pod crash loops or restart spikes
- High error rates (>5% of requests)
- Response time degradation (>2x baseline)
- Memory leaks or OOM kills
- Failed deployments or builds

#### **Security Alerts**
- Unauthorized access attempts
- Privilege escalation events
- Network policy violations
- Image vulnerability detections
- Certificate expiration warnings

### **📊 Monitoring Tools Integration**

#### **Prometheus Configuration**
\`\`\`yaml
# PrometheusRule for custom alerts
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ${target || 'application'}-alerts
  namespace: ${namespace || 'monitoring'}
spec:
  groups:
  - name: ${target || 'application'}.rules
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
\`\`\`

#### **Grafana Dashboard Setup**
\`\`\`bash
# Access Grafana console
oc get route grafana -n openshift-monitoring

# Import dashboard JSON
# Create custom dashboards for application metrics
# Set up alert notifications
\`\`\`

### **🔧 Monitoring Commands Cheat Sheet**

#### **Resource Monitoring**
\`\`\`bash
# Real-time resource usage
oc adm top nodes
oc adm top pods ${namespace ? `-n ${namespace}` : '--all-namespaces'}

# Resource quotas and limits
oc describe quota ${namespace ? `-n ${namespace}` : '--all-namespaces'}
oc describe limitrange ${namespace ? `-n ${namespace}` : '--all-namespaces'}
\`\`\`

#### **Log Analysis**
\`\`\`bash
# Application logs with filtering
${target && namespace ? `oc logs deployment/${target} -n ${namespace} --since=${timeRange || '1h'}` : 'oc logs deployment/<app> -n <namespace> --since=1h'}

# System component logs
oc logs -n openshift-monitoring -l app.kubernetes.io/name=prometheus
oc logs -n openshift-logging -l component=fluentd

# Event monitoring
oc get events ${namespace ? `-n ${namespace}` : '--all-namespaces'} --sort-by='.lastTimestamp'
\`\`\`

#### **Performance Analysis**
\`\`\`bash
# Network performance
oc get pods -o wide ${namespace ? `-n ${namespace}` : '--all-namespaces'}
oc describe service ${namespace ? `-n ${namespace}` : ''}

# Storage performance
oc get persistentvolumeclaims ${namespace ? `-n ${namespace}` : '--all-namespaces'}
oc describe persistentvolume

# Build performance
oc get builds ${namespace ? `-n ${namespace}` : '--all-namespaces'} --sort-by='.status.duration'
\`\`\`

## 🎪 **Quick Setup Commands**

### **Enable User Workload Monitoring**
\`\`\`bash
# Enable monitoring for user projects
oc apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    enableUserWorkload: true
EOF
\`\`\`

### **Deploy Custom Metrics Endpoint**
\`\`\`yaml
# Add metrics endpoint to your application
apiVersion: v1
kind: Service
metadata:
  name: ${target || 'app-name'}-metrics
  namespace: ${namespace || 'default'}
  labels:
    app: ${target || 'app-name'}
spec:
  ports:
  - name: metrics
    port: 8080
    targetPort: 8080
  selector:
    app: ${target || 'app-name'}
\`\`\`

### **Set Up Log Forwarding**
\`\`\`yaml
# Forward logs to external system
apiVersion: logging.openshift.io/v1
kind: ClusterLogForwarder
metadata:
  name: instance
  namespace: openshift-logging
spec:
  outputs:
  - name: remote-elasticsearch
    type: elasticsearch
    url: https://elasticsearch.example.com
  pipelines:
  - name: application-logs
    inputRefs:
    - application
    outputRefs:
    - remote-elasticsearch
\`\`\`

## 📚 **Additional Resources**

- **OpenShift Monitoring**: https://docs.openshift.com/container-platform/latest/monitoring/
- **Prometheus Operator**: https://prometheus-operator.dev/
- **Grafana Dashboards**: https://grafana.com/grafana/dashboards/
- **Alert Manager**: https://prometheus.io/docs/alerting/latest/alertmanager/

## 🎯 **Monitoring Checklist**

### **Infrastructure Monitoring**
- [ ] Node resource utilization tracking
- [ ] Cluster operator health monitoring
- [ ] etcd performance and disk usage
- [ ] Network performance and connectivity
- [ ] Storage capacity and performance

### **Application Monitoring**
- [ ] Application metrics exposure (/metrics endpoint)
- [ ] Service monitor configuration
- [ ] Custom dashboards for application KPIs
- [ ] Application-specific alerts
- [ ] Log aggregation and analysis

### **Security Monitoring**
- [ ] RBAC and access monitoring
- [ ] Network policy compliance
- [ ] Image vulnerability scanning
- [ ] Security context violations
- [ ] Certificate expiration tracking

### **Performance Monitoring**
- [ ] Response time and latency tracking
- [ ] Throughput and request rate monitoring
- [ ] Resource efficiency analysis
- [ ] Scaling behavior monitoring
- [ ] Build and deployment performance

Remember: Start with basic cluster monitoring, then add application-specific metrics, and finally implement advanced observability features.`;
}
