import { spawn } from 'child_process';
import { OpenShiftCommandResult } from '../types.js';

export class OpenShiftManager {
  private static instance: OpenShiftManager;
  private readonly maxBuffer = 1024 * 1024 * 10; // 10MB buffer

  private constructor() {}

  public static getInstance(): OpenShiftManager {
    if (!OpenShiftManager.instance) {
      OpenShiftManager.instance = new OpenShiftManager();
    }
    return OpenShiftManager.instance;
  }

  /**
   * Execute an OpenShift CLI command
   */
  public async executeCommand(
    args: string[],
    options: {
      context?: string;
      timeout?: number;
      input?: string;
    } = {}
  ): Promise<OpenShiftCommandResult> {
    return new Promise((resolve) => {
      const { context, timeout = 30000, input } = options;
      
      // Add context if provided
      const finalArgs = context ? ['--context', context, ...args] : args;
      
      const child = spawn('oc', finalArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;

      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({
            success: false,
            error: `Command timed out after ${timeout}ms`,
            stderr: stderr
          });
        }, timeout);
      }

      // Handle stdout
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > this.maxBuffer) {
          child.kill('SIGTERM');
          resolve({
            success: false,
            error: 'Output buffer exceeded maximum size',
            stderr: stderr
          });
        }
      });

      // Handle stderr
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      child.on('close', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (code === 0) {
          try {
            // Try to parse as JSON first
            const data = stdout.trim() ? JSON.parse(stdout) : {};
            resolve({
              success: true,
              data: data
            });
          } catch {
            // If not JSON, return as string
            resolve({
              success: true,
              data: stdout.trim()
            });
          }
        } else {
          resolve({
            success: false,
            error: stderr || `Command failed with exit code ${code}`,
            stderr: stderr
          });
        }
      });

      // Handle errors
      child.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({
          success: false,
          error: `Failed to execute command: ${error.message}`,
          stderr: stderr
        });
      });

      // Send input if provided
      if (input) {
        child.stdin?.write(input);
        child.stdin?.end();
      } else {
        child.stdin?.end();
      }
    });
  }

  /**
   * Get resources with proper error handling
   */
  public async getResources(
    resourceType: string,
    namespace?: string,
    name?: string,
    options: {
      context?: string;
      output?: string;
      labelSelector?: string;
      fieldSelector?: string;
      allNamespaces?: boolean;
    } = {}
  ): Promise<OpenShiftCommandResult> {
    const args = ['get', resourceType];
    
    if (name) {
      args.push(name);
    }
    
    if (options.allNamespaces) {
      args.push('--all-namespaces');
    } else if (namespace) {
      args.push('-n', namespace);
    }
    
    if (options.output) {
      args.push('-o', options.output);
    }
    
    if (options.labelSelector) {
      args.push('-l', options.labelSelector);
    }
    
    if (options.fieldSelector) {
      args.push('--field-selector', options.fieldSelector);
    }

    return this.executeCommand(args, { context: options.context });
  }

  /**
   * Create resources from manifest or command
   */
  public async createResource(
    options: {
      resourceType?: string;
      name?: string;
      namespace?: string;
      context?: string;
      manifest?: string;
      filename?: string;
      dryRun?: boolean;
      [key: string]: any;
    }
  ): Promise<OpenShiftCommandResult> {
    const args = ['create'];
    
    if (options.dryRun) {
      args.push('--dry-run=client');
    }
    
    if (options.manifest) {
      args.push('-f', '-');
      return this.executeCommand(args, { 
        context: options.context, 
        input: options.manifest 
      });
    }
    
    if (options.filename) {
      args.push('-f', options.filename);
      return this.executeCommand(args, { context: options.context });
    }
    
    // Handle specific resource types
    if (options.resourceType) {
      args.push(options.resourceType);
      
      if (options.name) {
        args.push(options.name);
      }
      
      if (options.namespace) {
        args.push('-n', options.namespace);
      }
      
      // Add resource-specific parameters
      Object.entries(options).forEach(([key, value]) => {
        if (!['resourceType', 'name', 'namespace', 'context', 'dryRun'].includes(key) && value !== undefined) {
          args.push(`--${key}`, value.toString());
        }
      });
    }
    
    return this.executeCommand(args, { context: options.context });
  }

  /**
   * Delete resources
   */
  public async deleteResource(
    resourceType: string,
    name?: string,
    options: {
      namespace?: string;
      context?: string;
      manifest?: string;
      filename?: string;
      labelSelector?: string;
      force?: boolean;
      gracePeriodSeconds?: number;
    } = {}
  ): Promise<OpenShiftCommandResult> {
    const args = ['delete', resourceType];
    
    if (options.manifest) {
      args.push('-f', '-');
      return this.executeCommand(args, { 
        context: options.context, 
        input: options.manifest 
      });
    }
    
    if (options.filename) {
      args.push('-f', options.filename);
      return this.executeCommand(args, { context: options.context });
    }
    
    if (name) {
      args.push(name);
    }
    
    if (options.namespace) {
      args.push('-n', options.namespace);
    }
    
    if (options.labelSelector) {
      args.push('-l', options.labelSelector);
    }
    
    if (options.force) {
      args.push('--force');
    }
    
    if (options.gracePeriodSeconds !== undefined) {
      args.push('--grace-period', options.gracePeriodSeconds.toString());
    }
    
    return this.executeCommand(args, { context: options.context });
  }

  /**
   * Apply resources
   */
  public async applyResource(
    options: {
      manifest?: string;
      filename?: string;
      namespace?: string;
      context?: string;
      dryRun?: boolean;
      force?: boolean;
    }
  ): Promise<OpenShiftCommandResult> {
    const args = ['apply'];
    
    if (options.dryRun) {
      args.push('--dry-run=client');
    }
    
    if (options.force) {
      args.push('--force');
    }
    
    if (options.namespace) {
      args.push('-n', options.namespace);
    }
    
    if (options.manifest) {
      args.push('-f', '-');
      return this.executeCommand(args, { 
        context: options.context, 
        input: options.manifest 
      });
    }
    
    if (options.filename) {
      args.push('-f', options.filename);
    }
    
    return this.executeCommand(args, { context: options.context });
  }

  /**
   * Scale resources
   */
  public async scaleResource(
    resourceType: string,
    name: string,
    replicas: number,
    options: {
      namespace?: string;
      context?: string;
    } = {}
  ): Promise<OpenShiftCommandResult> {
    const args = ['scale', resourceType, name, `--replicas=${replicas}`];
    
    if (options.namespace) {
      args.push('-n', options.namespace);
    }
    
    return this.executeCommand(args, { context: options.context });
  }

  /**
   * Get logs
   */
  public async getLogs(
    resourceType: string,
    name: string,
    options: {
      namespace?: string;
      context?: string;
      container?: string;
      follow?: boolean;
      previous?: boolean;
      since?: string;
      tail?: number;
      timestamps?: boolean;
    } = {}
  ): Promise<OpenShiftCommandResult> {
    const args = ['logs', `${resourceType}/${name}`];
    
    if (options.namespace) {
      args.push('-n', options.namespace);
    }
    
    if (options.container) {
      args.push('-c', options.container);
    }
    
    if (options.follow) {
      args.push('-f');
    }
    
    if (options.previous) {
      args.push('-p');
    }
    
    if (options.since) {
      args.push('--since', options.since);
    }
    
    if (options.tail) {
      args.push('--tail', options.tail.toString());
    }
    
    if (options.timestamps) {
      args.push('--timestamps');
    }
    
    return this.executeCommand(args, { context: options.context });
  }

  /**
   * Check if OpenShift CLI is available
   */
  public async checkCLI(): Promise<boolean> {
    try {
      const result = await this.executeCommand(['version', '--client'], { timeout: 5000 });
      return result.success;
    } catch {
      return false;
    }
  }
}
