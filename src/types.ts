export interface OpenShiftResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp?: string;
  };
  spec?: any;
  status?: any;
}

export interface OpenShiftContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
}

export interface DeploymentConfig extends OpenShiftResource {
  spec: {
    replicas: number;
    selector: Record<string, string>;
    template: {
      metadata: {
        labels: Record<string, string>;
      };
      spec: {
        containers: Container[];
      };
    };
    triggers?: any[];
    strategy?: any;
  };
}

export interface Container {
  name: string;
  image: string;
  ports?: Port[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
}

export interface Port {
  containerPort: number;
  protocol?: string;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: any;
}

export interface ResourceRequirements {
  limits?: Record<string, string>;
  requests?: Record<string, string>;
}

export interface Route extends OpenShiftResource {
  spec: {
    host?: string;
    to: {
      kind: string;
      name: string;
    };
    port?: {
      targetPort: string | number;
    };
    tls?: {
      termination: string;
    };
  };
}

export interface BuildConfig extends OpenShiftResource {
  spec: {
    source: {
      type: string;
      git?: {
        uri: string;
        ref?: string;
      };
    };
    strategy: {
      type: string;
      sourceStrategy?: {
        from: {
          kind: string;
          name: string;
        };
      };
      dockerStrategy?: {
        from?: {
          kind: string;
          name: string;
        };
      };
    };
    output: {
      to: {
        kind: string;
        name: string;
      };
    };
    triggers?: any[];
  };
}

export interface Project extends OpenShiftResource {
  spec?: {
    finalizers?: string[];
  };
  status?: {
    phase: string;
  };
}

export interface OpenShiftCommandResult {
  success: boolean;
  data?: any;
  error?: string;
  stderr?: string;
}
