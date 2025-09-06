import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOcDelete, validateDeleteParameters } from '../src/tools/oc-delete.js';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';
import type { OcDeleteParams } from '../src/models/tool-models.js';

// Mock the OpenShiftManager
vi.mock('../src/utils/openshift-manager.js', () => ({
  OpenShiftManager: {
    getInstance: vi.fn(() => ({
      executeCommand: vi.fn()
    }))
  }
}));

describe('oc-delete tool', () => {
  let mockManager: any;
  
  beforeEach(() => {
    mockManager = {
      executeCommand: vi.fn()
    };
    vi.mocked(OpenShiftManager.getInstance).mockReturnValue(mockManager);
  });

  describe('validateDeleteParameters', () => {
    it('should require at least one resource identifier', () => {
      const params: OcDeleteParams = {
        namespace: 'test'
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Must specify resourceType, manifest, filename, or url');
    });

    it('should require resource selection when using resourceType', () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        namespace: 'test'
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must specify name, labelSelector, fieldSelector, or all=true');
    });

    it('should validate with resourceType and name', () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test'
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(true);
    });

    it('should validate with resourceType and labelSelector', () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        labelSelector: 'app=test',
        namespace: 'test'
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(true);
    });

    it('should validate with manifest', () => {
      const params: OcDeleteParams = {
        manifest: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: test-pod',
        namespace: 'test'
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(true);
    });

    it('should reject multiple sources', () => {
      const params: OcDeleteParams = {
        manifest: 'apiVersion: v1\nkind: Pod',
        filename: '/path/to/file.yaml',
        namespace: 'test'
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot specify multiple sources');
    });

    it('should validate timeout format', () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test',
        timeout: 'invalid-format'
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Timeout must be in format');
    });

    it('should accept valid timeout formats', () => {
      const validTimeouts = ['60s', '5m', '1h'];
      
      validTimeouts.forEach(timeout => {
        const params: OcDeleteParams = {
          resourceType: 'pod',
          name: 'test-pod',
          namespace: 'test',
          timeout
        };
        
        const result = validateDeleteParameters(params);
        expect(result.valid).toBe(true);
      });
    });

    it('should validate grace period', () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test',
        gracePeriodSeconds: -1
      };
      
      const result = validateDeleteParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Grace period must be >= 0');
    });
  });

  describe('handleOcDelete', () => {
    it('should handle successful single resource deletion', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test'
      };

      // Mock successful resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod', namespace: 'test' }
          })
        })
        // Mock successful deletion
        .mockResolvedValueOnce({
          success: true,
          data: 'pod/test-pod deleted'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
      expect(result.content[0].text).toContain('test-pod');
    });

    it('should handle resource not found gracefully', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'nonexistent-pod',
        namespace: 'test'
      };

      // Mock resource not found during discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: false,
          error: 'pods "nonexistent-pod" not found'
        })
        // Mock delete command with not found
        .mockResolvedValueOnce({
          success: false,
          error: 'Error from server (NotFound): pods "nonexistent-pod" not found'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('No Resources Found for Deletion');
      expect(result.content[0].text).toContain('nonexistent-pod');
    });

    it('should handle permission errors', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test'
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod', namespace: 'test' }
          })
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Error from server (Forbidden): pods "test-pod" is forbidden'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Permission Error');
      expect(result.content[0].text).toContain('RBAC permissions');
    });

    it('should handle finalizer blocking deletion', async () => {
      const params: OcDeleteParams = {
        resourceType: 'namespace',
        name: 'test-namespace',
        namespace: 'default',
        confirm: true // Add confirm to bypass safety check
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Namespace',
            metadata: { name: 'test-namespace' }
          })
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'namespace "test-namespace" has finalizers preventing deletion'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Failed');
      expect(result.content[0].text).toContain('Finalizer Blocking Deletion');
    });

    it('should require confirmation for dangerous operations', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        all: true,
        namespace: 'test'
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            items: Array.from({ length: 5 }, (_, i) => ({
              kind: 'Pod',
              metadata: { name: `pod-${i}`, namespace: 'test' }
            }))
          })
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Dangerous Delete Operation');
      expect(result.content[0].text).toContain('confirm=true');
    });

    it('should handle dry run operations', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test',
        dryRun: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod', namespace: 'test' }
          })
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Dry Run: Delete Operation Preview');
      expect(result.content[0].text).toContain('test-pod');
      expect(result.content[0].text).toContain('Would Be Deleted');
    });

    it('should handle label selector deletion', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        labelSelector: 'app=test',
        namespace: 'test',
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            items: [
              { kind: 'Pod', metadata: { name: 'test-pod-1', namespace: 'test' } },
              { kind: 'Pod', metadata: { name: 'test-pod-2', namespace: 'test' } }
            ]
          })
        })
        .mockResolvedValueOnce({
          success: true,
          data: 'pod/test-pod-1 deleted\npod/test-pod-2 deleted'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
      expect(result.content[0].text).toContain('test-pod-1');
      expect(result.content[0].text).toContain('test-pod-2');
    });

    it('should handle manifest-based deletion', async () => {
      const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
  namespace: test
`;
      
      const params: OcDeleteParams = {
        manifest,
        namespace: 'test'
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: 'pod/test-pod deleted'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
    });

    it('should detect system namespace operations as unsafe', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'system-pod',
        namespace: 'kube-system'
      };

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Dangerous Delete Operation');
      expect(result.content[0].text).toContain('system namespace');
    });

    it('should detect critical resource types as unsafe', async () => {
      const params: OcDeleteParams = {
        resourceType: 'namespace',
        name: 'test-namespace',
        namespace: 'default'
      };

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Dangerous Delete Operation');
      expect(result.content[0].text).toContain('critical resource type');
    });

    it('should handle timeout errors', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'stuck-pod',
        namespace: 'test',
        timeout: '10s',
        wait: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'stuck-pod', namespace: 'test' }
          })
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'timeout: timed out waiting for the condition'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Timeout Error');
      expect(result.content[0].text).toContain('Increase timeout value');
    });

    it('should handle force deletion with warnings', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test',
        force: true,
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod', namespace: 'test' }
          })
        })
        .mockResolvedValueOnce({
          success: true,
          data: 'pod/test-pod deleted'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
      // Should have warnings about force deletion in progress log
      expect(result.content[0].text).toContain('Force deletion');
    });

    it('should handle empty resource discovery', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        labelSelector: 'app=nonexistent',
        namespace: 'test'
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({ items: [] })
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('No Resources Found for Deletion');
      expect(result.content[0].text).toContain('app=nonexistent');
    });

    it('should handle all-namespaces deletion with confirmation', async () => {
      const params: OcDeleteParams = {
        resourceType: 'configmap',
        labelSelector: 'temp=true',
        allNamespaces: true,
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            items: [
              { kind: 'ConfigMap', metadata: { name: 'temp-config-1', namespace: 'ns1' } },
              { kind: 'ConfigMap', metadata: { name: 'temp-config-2', namespace: 'ns2' } }
            ]
          })
        })
        .mockResolvedValueOnce({
          success: true,
          data: 'configmap/temp-config-1 deleted\nconfigmap/temp-config-2 deleted'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
      expect(result.content[0].text).toContain('temp-config-1');
      expect(result.content[0].text).toContain('temp-config-2');
    });
  });

  describe('error scenarios', () => {
    it('should categorize permission errors correctly', async () => {
      const params: OcDeleteParams = {
        resourceType: 'secret',
        name: 'protected-secret',
        namespace: 'test'
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Secret',
            metadata: { name: 'protected-secret', namespace: 'test' }
          })
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Error from server (Forbidden): secrets "protected-secret" is forbidden: User "test-user" cannot delete resource "secrets" in API group "" in the namespace "test"'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Permission Error');
      expect(result.content[0].text).toContain('auth can-i delete');
    });

    it('should categorize finalizer errors correctly', async () => {
      const params: OcDeleteParams = {
        resourceType: 'namespace',
        name: 'stuck-namespace',
        namespace: 'default',
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Namespace',
            metadata: { name: 'stuck-namespace' }
          })
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'namespace "stuck-namespace" has finalizers [kubernetes.io/pv-protection] preventing deletion'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Failed');
      expect(result.content[0].text).toContain('Finalizer Blocking Deletion');
    });

    it('should handle dependency errors', async () => {
      const params: OcDeleteParams = {
        resourceType: 'namespace',
        name: 'app-namespace',
        namespace: 'default',
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Namespace',
            metadata: { name: 'app-namespace' }
          })
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'namespace "app-namespace" has dependent resources preventing deletion'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Failed');
      expect(result.content[0].text).toContain('Dependency Error');
    });
  });

  describe('safety features', () => {
    it('should detect dangerous all-resources deletion', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        all: true,
        namespace: 'production'
      };

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Dangerous Delete Operation');
      expect(result.content[0].text).toContain('ALL resources');
    });

    it('should detect dangerous all-namespaces operations', async () => {
      const params: OcDeleteParams = {
        resourceType: 'configmap',
        labelSelector: 'temp=true',
        allNamespaces: true
      };

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Dangerous Delete Operation');
      expect(result.content[0].text).toContain('ALL namespaces');
    });

    it('should allow confirmed dangerous operations', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        all: true,
        namespace: 'test',
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            items: [
              { kind: 'Pod', metadata: { name: 'pod-1', namespace: 'test' } }
            ]
          })
        })
        .mockResolvedValueOnce({
          success: true,
          data: 'pod/pod-1 deleted'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
    });
  });

  describe('advanced scenarios', () => {
    it('should handle cascade deletion strategies', async () => {
      const params: OcDeleteParams = {
        resourceType: 'deployment',
        name: 'test-app',
        namespace: 'test',
        cascade: 'foreground',
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Deployment',
            metadata: { name: 'test-app', namespace: 'test' }
          })
        })
        .mockResolvedValueOnce({
          success: true,
          data: 'deployment.apps/test-app deleted'
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--cascade', 'foreground']),
        expect.any(Object)
      );
    });

    it('should handle wait and timeout options', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'test-pod',
        namespace: 'test',
        wait: true,
        timeout: '60s',
        confirm: true
      };

      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod', namespace: 'test' }
          })
        })
        .mockResolvedValueOnce({
          success: true,
          data: 'pod/test-pod deleted'
        })
        .mockResolvedValueOnce({
          success: true,
          data: ''
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Delete Operation Successful');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--wait', '--timeout', '60s']),
        expect.any(Object)
      );
    });

    it('should handle ignore404 option', async () => {
      const params: OcDeleteParams = {
        resourceType: 'pod',
        name: 'maybe-exists',
        namespace: 'test',
        ignore404: true
      };

      // Mock resource not found during discovery (returns empty result)
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({ items: [] }) // Empty result for discovery
        });

      const result = await handleOcDelete(params);
      
      expect(result.content).toBeDefined();
      // With ignore404, when no resources are found, it should show "No Resources Found"
      expect(result.content[0].text).toContain('No Resources Found for Deletion');
      expect(result.content[0].text).toContain('maybe-exists');
    });
  });
});

