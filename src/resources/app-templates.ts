import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { OpenShiftManager } from '../utils/openshift-manager.js';

export const appTemplatesResource: Resource = {
  uri: 'openshift://app-templates',
  name: 'OpenShift Application Templates',
  description:
    'Comprehensive collection of application deployment templates for common OpenShift scenarios and frameworks',
  mimeType: 'application/json',
};

export async function getAppTemplates(context?: string): Promise<string> {
  const manager = OpenShiftManager.getInstance();
  const templatesInfo: any = {};

  try {
    // Get available OpenShift templates
    const templatesResult = await manager.executeCommand(
      ['get', 'templates', '-n', 'openshift', '-o', 'json'],
      { context }
    );
    let openshiftTemplates: any[] = [];

    if (templatesResult.success) {
      const templatesData =
        typeof templatesResult.data === 'string'
          ? JSON.parse(templatesResult.data)
          : templatesResult.data;
      openshiftTemplates = templatesData.items || [];
    }

    // Get image streams for builder images
    const imageStreamsResult = await manager.executeCommand(
      ['get', 'imagestreams', '-n', 'openshift', '-o', 'json'],
      { context }
    );
    let builderImages: any[] = [];

    if (imageStreamsResult.success) {
      const imageStreamsData =
        typeof imageStreamsResult.data === 'string'
          ? JSON.parse(imageStreamsResult.data)
          : imageStreamsResult.data;
      builderImages = imageStreamsData.items || [];
    }

    templatesInfo.categories = {
      webApplications: getWebApplicationTemplates(),
      databases: getDatabaseTemplates(),
      messaging: getMessagingTemplates(),
      monitoring: getMonitoringTemplates(),
      cicd: getCICDTemplates(),
      microservices: getMicroservicesTemplates(),
      bigData: getBigDataTemplates(),
      security: getSecurityTemplates(),
    };

    templatesInfo.builderImages = builderImages
      .filter(
        (img: any) => img.metadata?.labels?.['samples.operator.openshift.io/managed'] !== 'false'
      )
      .map((img: any) => ({
        name: img.metadata?.name,
        displayName:
          img.spec?.tags?.[0]?.annotations?.['openshift.io/display-name'] || img.metadata?.name,
        description: img.spec?.tags?.[0]?.annotations?.description || 'No description available',
        tags: img.spec?.tags?.map((tag: any) => tag.name) || [],
        language: detectLanguage(img.metadata?.name || ''),
        category: categorizeBuilderImage(img.metadata?.name || ''),
        sampleRepo: img.spec?.tags?.[0]?.annotations?.['sampleRepo'] || null,
        supports: img.spec?.tags?.[0]?.annotations?.['supports'] || null,
      }));

    templatesInfo.openshiftTemplates = openshiftTemplates.map((template: any) => ({
      name: template.metadata?.name,
      displayName:
        template.metadata?.annotations?.['openshift.io/display-name'] || template.metadata?.name,
      description: template.metadata?.annotations?.description || 'No description available',
      iconClass: template.metadata?.annotations?.['iconClass'] || 'fa fa-cube',
      tags: template.metadata?.annotations?.tags?.split(',') || [],
      parameters:
        template.parameters?.map((param: any) => ({
          name: param.name,
          description: param.description || '',
          required: param.required || false,
          value: param.value || null,
        })) || [],
    }));

    templatesInfo.deploymentPatterns = getDeploymentPatterns();
    templatesInfo.routeTemplates = getRouteTemplates();
    templatesInfo.storageTemplates = getStorageTemplates();
    templatesInfo.networkingTemplates = getNetworkingTemplates();

    templatesInfo.metadata = {
      retrievedAt: new Date().toISOString(),
      context: context || 'current',
      totalBuilderImages: builderImages.length,
      totalOpenshiftTemplates: openshiftTemplates.length,
    };

    return JSON.stringify(templatesInfo, null, 2);
  } catch (error) {
    const errorInfo = {
      error: 'Failed to retrieve application templates',
      message: error instanceof Error ? error.message : String(error),
      retrievedAt: new Date().toISOString(),
    };
    return JSON.stringify(errorInfo, null, 2);
  }
}

function getWebApplicationTemplates() {
  return {
    nodejs: {
      name: 'Node.js Application',
      description: 'Deploy Node.js applications with Express, React, or Vue.js',
      builderImage: 'nodejs:18-ubi8',
      examples: [
        {
          name: 'Express API Server',
          gitRepo: 'https://github.com/sclorg/nodejs-ex.git',
          ports: [8080],
          env: ['NODE_ENV=production'],
        },
        {
          name: 'React Frontend',
          gitRepo: 'https://github.com/sclorg/react-web-app.git',
          ports: [8080],
          buildScript: 'npm run build',
        },
      ],
    },
    python: {
      name: 'Python Application',
      description: 'Deploy Python applications with Django, Flask, or FastAPI',
      builderImage: 'python:3.9-ubi8',
      examples: [
        {
          name: 'Django Web App',
          gitRepo: 'https://github.com/sclorg/django-ex.git',
          ports: [8080],
          env: ['DJANGO_SETTINGS_MODULE=myproject.settings'],
        },
        {
          name: 'Flask API',
          gitRepo: 'https://github.com/sclorg/flask-ex.git',
          ports: [8080],
          env: ['FLASK_ENV=production'],
        },
      ],
    },
    java: {
      name: 'Java Application',
      description: 'Deploy Java applications with Spring Boot, Quarkus, or traditional WAR files',
      builderImage: 'openjdk:11-ubi8',
      examples: [
        {
          name: 'Spring Boot App',
          gitRepo: 'https://github.com/spring-guides/gs-spring-boot.git',
          ports: [8080],
          env: ['SPRING_PROFILES_ACTIVE=production'],
        },
        {
          name: 'Quarkus Native',
          gitRepo: 'https://github.com/quarkusio/quarkus-quickstarts.git',
          ports: [8080],
          buildType: 'native',
        },
      ],
    },
    dotnet: {
      name: '.NET Application',
      description: 'Deploy .NET Core and .NET Framework applications',
      builderImage: 'dotnet:6.0-ubi8',
      examples: [
        {
          name: 'ASP.NET Core Web API',
          gitRepo: 'https://github.com/redhat-developer/s2i-dotnetcore-ex.git',
          ports: [8080],
          env: ['ASPNETCORE_ENVIRONMENT=Production'],
        },
      ],
    },
    php: {
      name: 'PHP Application',
      description: 'Deploy PHP applications with Laravel, Symfony, or custom frameworks',
      builderImage: 'php:8.0-ubi8',
      examples: [
        {
          name: 'PHP Web Application',
          gitRepo: 'https://github.com/sclorg/cakephp-ex.git',
          ports: [8080],
        },
      ],
    },
    ruby: {
      name: 'Ruby Application',
      description: 'Deploy Ruby applications with Rails or Sinatra',
      builderImage: 'ruby:3.0-ubi8',
      examples: [
        {
          name: 'Ruby on Rails App',
          gitRepo: 'https://github.com/sclorg/ruby-ex.git',
          ports: [8080],
          env: ['RAILS_ENV=production'],
        },
      ],
    },
  };
}

function getDatabaseTemplates() {
  return {
    postgresql: {
      name: 'PostgreSQL Database',
      description: 'Deploy PostgreSQL database with persistent storage',
      image: 'postgresql:13-el8',
      ports: [5432],
      env: ['POSTGRESQL_USER', 'POSTGRESQL_PASSWORD', 'POSTGRESQL_DATABASE'],
      storage: '1Gi',
      example: {
        name: 'PostgreSQL with Persistent Volume',
        manifest: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgresql
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgresql
        image: postgresql:13-el8
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRESQL_USER
          value: "user"
        - name: POSTGRESQL_PASSWORD
          value: "password"
        - name: POSTGRESQL_DATABASE
          value: "sampledb"
        volumeMounts:
        - name: postgresql-data
          mountPath: /var/lib/pgsql/data
      volumes:
      - name: postgresql-data
        persistentVolumeClaim:
          claimName: postgresql-pvc
`,
      },
    },
    mysql: {
      name: 'MySQL Database',
      description: 'Deploy MySQL database with persistent storage',
      image: 'mysql:8.0-el8',
      ports: [3306],
      env: ['MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_ROOT_PASSWORD'],
      storage: '1Gi',
    },
    mongodb: {
      name: 'MongoDB Database',
      description: 'Deploy MongoDB NoSQL database',
      image: 'mongodb:4.4-el8',
      ports: [27017],
      env: ['MONGODB_USER', 'MONGODB_PASSWORD', 'MONGODB_DATABASE'],
      storage: '1Gi',
    },
    redis: {
      name: 'Redis Cache',
      description: 'Deploy Redis in-memory cache and message broker',
      image: 'redis:6-el8',
      ports: [6379],
      env: ['REDIS_PASSWORD'],
    },
  };
}

function getMessagingTemplates() {
  return {
    kafka: {
      name: 'Apache Kafka',
      description: 'Deploy Kafka cluster using Strimzi operator',
      operator: 'strimzi-kafka-operator',
      examples: [
        {
          name: 'Basic Kafka Cluster',
          manifest: `
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: my-cluster
spec:
  kafka:
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
    storage:
      type: ephemeral
  zookeeper:
    replicas: 3
    storage:
      type: ephemeral
`,
        },
      ],
    },
    rabbitmq: {
      name: 'RabbitMQ',
      description: 'Deploy RabbitMQ message broker',
      image: 'rabbitmq:3.8-management',
      ports: [5672, 15672],
      env: ['RABBITMQ_DEFAULT_USER', 'RABBITMQ_DEFAULT_PASS'],
    },
  };
}

function getMonitoringTemplates() {
  return {
    prometheus: {
      name: 'Prometheus Monitoring',
      description: 'Deploy Prometheus monitoring stack',
      operator: 'prometheus-operator',
      components: ['prometheus', 'grafana', 'alertmanager'],
    },
    grafana: {
      name: 'Grafana Dashboard',
      description: 'Deploy Grafana for metrics visualization',
      image: 'grafana/grafana:latest',
      ports: [3000],
      storage: '1Gi',
    },
  };
}

function getCICDTemplates() {
  return {
    jenkins: {
      name: 'Jenkins CI/CD',
      description: 'Deploy Jenkins for continuous integration and deployment',
      template: 'jenkins-persistent',
      storage: '1Gi',
      plugins: ['git', 'workflow-aggregator', 'kubernetes'],
    },
    tekton: {
      name: 'Tekton Pipelines',
      description: 'Cloud-native CI/CD with Tekton',
      operator: 'openshift-pipelines-operator',
    },
  };
}

function getMicroservicesTemplates() {
  return {
    serviceMesh: {
      name: 'Service Mesh (Istio)',
      description: 'Deploy service mesh for microservices communication',
      operator: 'servicemeshoperator',
    },
    apiGateway: {
      name: 'API Gateway',
      description: 'Deploy API gateway for microservices routing',
      examples: ['Kong', '3scale', 'Ambassador'],
    },
  };
}

function getBigDataTemplates() {
  return {
    spark: {
      name: 'Apache Spark',
      description: 'Deploy Spark cluster for big data processing',
      operator: 'spark-operator',
    },
    elasticsearch: {
      name: 'Elasticsearch',
      description: 'Deploy Elasticsearch cluster for search and analytics',
      operator: 'elastic-cloud-eck',
    },
  };
}

function getSecurityTemplates() {
  return {
    vault: {
      name: 'HashiCorp Vault',
      description: 'Deploy Vault for secrets management',
      operator: 'vault-operator',
    },
    certManager: {
      name: 'Cert Manager',
      description: 'Automated certificate management',
      operator: 'cert-manager',
    },
  };
}

function getDeploymentPatterns() {
  return {
    blueGreen: {
      name: 'Blue-Green Deployment',
      description: 'Zero-downtime deployment pattern with two identical environments',
      manifest: `
# Blue-Green Deployment Pattern
apiVersion: v1
kind: Service
metadata:
  name: app-service
spec:
  selector:
    app: myapp
    version: blue  # Switch to 'green' for deployment
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: blue
  template:
    metadata:
      labels:
        app: myapp
        version: blue
    spec:
      containers:
      - name: app
        image: myapp:v1
        ports:
        - containerPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
      - name: app
        image: myapp:v2
        ports:
        - containerPort: 8080
`,
    },
    canary: {
      name: 'Canary Deployment',
      description: 'Gradual rollout pattern with traffic splitting',
      manifest: `
# Canary Deployment Pattern
apiVersion: v1
kind: Service
metadata:
  name: app-service
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9  # 90% of traffic
  selector:
    matchLabels:
      app: myapp
      version: stable
  template:
    metadata:
      labels:
        app: myapp
        version: stable
    spec:
      containers:
      - name: app
        image: myapp:v1
        ports:
        - containerPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1  # 10% of traffic
  selector:
    matchLabels:
      app: myapp
      version: canary
  template:
    metadata:
      labels:
        app: myapp
        version: canary
    spec:
      containers:
      - name: app
        image: myapp:v2
        ports:
        - containerPort: 8080
`,
    },
    rollingUpdate: {
      name: 'Rolling Update',
      description: 'Standard rolling update deployment pattern',
      strategy: 'RollingUpdate',
      maxUnavailable: '25%',
      maxSurge: '25%',
    },
  };
}

function getRouteTemplates() {
  return {
    edge: {
      name: 'Edge-terminated Route',
      description: 'HTTPS route with TLS termination at the router',
      manifest: `
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: my-app-route
spec:
  host: my-app.example.com
  to:
    kind: Service
    name: my-app-service
  port:
    targetPort: 8080
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
`,
    },
    passthrough: {
      name: 'Passthrough Route',
      description: 'TLS passthrough route for end-to-end encryption',
      manifest: `
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: my-secure-app-route
spec:
  host: secure-app.example.com
  to:
    kind: Service
    name: my-secure-app-service
  port:
    targetPort: 8443
  tls:
    termination: passthrough
`,
    },
    reencrypt: {
      name: 'Re-encrypt Route',
      description: 'TLS re-encryption route for secure backend communication',
      manifest: `
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: my-reencrypt-route
spec:
  host: reencrypt-app.example.com
  to:
    kind: Service
    name: my-app-service
  port:
    targetPort: 8443
  tls:
    termination: reencrypt
    destinationCACertificate: |
      -----BEGIN CERTIFICATE-----
      ...backend certificate...
      -----END CERTIFICATE-----
`,
    },
  };
}

function getStorageTemplates() {
  return {
    persistentVolume: {
      name: 'Persistent Volume Claim',
      description: 'Standard PVC for application data storage',
      manifest: `
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: gp3-csi
`,
    },
    sharedStorage: {
      name: 'Shared Storage (ReadWriteMany)',
      description: 'Shared storage accessible by multiple pods',
      manifest: `
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-data-pvc
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 5Gi
  storageClassName: efs-csi
`,
    },
  };
}

function getNetworkingTemplates() {
  return {
    networkPolicy: {
      name: 'Network Policy',
      description: 'Control traffic flow between pods',
      manifest: `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
spec:
  podSelector: {}
  policyTypes:
  - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-same-namespace
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: current-namespace
`,
    },
    serviceMonitor: {
      name: 'Service Monitor',
      description: 'Prometheus monitoring configuration',
      manifest: `
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: app-metrics
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
`,
    },
  };
}

function detectLanguage(imageName: string): string {
  const languageMap: { [key: string]: string } = {
    nodejs: 'JavaScript/TypeScript',
    python: 'Python',
    openjdk: 'Java',
    dotnet: '.NET/C#',
    php: 'PHP',
    ruby: 'Ruby',
    golang: 'Go',
    nginx: 'Static/HTML',
    httpd: 'Static/HTML',
  };

  for (const [key, language] of Object.entries(languageMap)) {
    if (imageName.toLowerCase().includes(key)) {
      return language;
    }
  }

  return 'Unknown';
}

function categorizeBuilderImage(imageName: string): string {
  if (imageName.includes('nodejs') || imageName.includes('react')) return 'Frontend/API';
  if (imageName.includes('python') || imageName.includes('django')) return 'Backend/API';
  if (imageName.includes('java') || imageName.includes('openjdk')) return 'Enterprise/API';
  if (imageName.includes('dotnet')) return 'Enterprise/API';
  if (imageName.includes('php')) return 'Web/CMS';
  if (imageName.includes('ruby')) return 'Web/API';
  if (imageName.includes('golang')) return 'Microservices/API';
  if (imageName.includes('nginx') || imageName.includes('httpd')) return 'Static/Proxy';

  return 'General';
}
