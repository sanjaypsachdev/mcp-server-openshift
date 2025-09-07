import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOcPatch, ocPatchTool, type OcPatchArgs } from '../src/tools/oc-patch.js';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';

// Mock the OpenShiftManager
vi.mock('../src/utils/openshift-manager.js');

describe('oc-patch tool', () => {
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      executeCommand: vi.fn(),
    };
    vi.mocked(OpenShiftManager.getInstance).mockReturnValue(mockManager);
  });

  describe('tool definition', () => {
    it('should have correct tool definition', () => {
      expect(ocPatchTool.name).toBe('oc_patch');
      expect(ocPatchTool.description).toBe('Patch OpenShift resources with strategic merge, JSON merge, or JSON patch operations');
      expect(ocPatchTool.inputSchema.type).toBe('object');
      expect(ocPatchTool.inputSchema.required).toEqual(['resourceType', 'name', 'patch']);
    });

    it('should have all required properties in schema', () => {
      const properties = ocPatchTool.inputSchema.properties;
      expect(properties).toHaveProperty('resourceType');
      expect(properties).toHaveProperty('name');
      expect(properties).toHaveProperty('patch');
      expect(properties).toHaveProperty('patchType');
      expect(properties).toHaveProperty('namespace');
      expect(properties).toHaveProperty('context');
      expect(properties).toHaveProperty('dryRun');
      expect(properties).toHaveProperty('force');
      expect(properties).toHaveProperty('fieldManager');
      expect(properties).toHaveProperty('subresource');
      expect(properties).toHaveProperty('recordHistory');
    });

    it('should have correct patch type enum values', () => {
      const patchTypeProperty = ocPatchTool.inputSchema.properties.patchType;
      expect(patchTypeProperty.enum).toEqual(['strategic', 'merge', 'json']);
    });

    it('should include comprehensive resource type enum', () => {
      const resourceTypeProperty = ocPatchTool.inputSchema.properties.resourceType;
      expect(resourceTypeProperty.enum).toContain('pod');
      expect(resourceTypeProperty.enum).toContain('deployment');
      expect(resourceTypeProperty.enum).toContain('service');
      expect(resourceTypeProperty.enum).toContain('route');
      expect(resourceTypeProperty.enum).toContain('configmap');
      expect(resourceTypeProperty.enum).toContain('secret');
      expect(resourceTypeProperty.enum).toContain('namespace');
      expect(resourceTypeProperty.enum).toContain('node');
    });
  });

  describe('handleOcPatch function', () => {
    describe('argument validation', () => {
      it('should reject missing required fields', async () => {
        const args: OcPatchArgs = {
          resourceType: '',
          name: '',
          patch: ''
        };

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Missing required fields');
      });

      it('should reject invalid resource type', async () => {
        const args: OcPatchArgs = {
          resourceType: 'invalidresource',
          name: 'test',
          patch: '{"metadata":{"labels":{"test":"value"}}}'
        };

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid resource type');
      });

      it('should reject invalid patch type', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          patchType: 'invalid' as any
        };

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid patch type');
      });

      it('should reject invalid subresource', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          subresource: 'invalid' as any
        };

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid subresource');
      });

      it('should reject namespace for cluster-scoped resources', async () => {
        const args: OcPatchArgs = {
          resourceType: 'node',
          name: 'test-node',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default'
        };

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('cluster-scoped and does not require a namespace');
      });

      it('should accept valid arguments', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: {
              name: 'test-pod',
              namespace: 'default',
              resourceVersion: '12345',
              generation: 1,
              labels: { test: 'value' }
            }
          })
        });

        const result = await handleOcPatch(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Patch Operation Successful');
      });
    });

    describe('patch format validation', () => {
      it('should accept valid JSON patch', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"environment":"production"}}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: {
              name: 'test-pod',
              namespace: 'default',
              resourceVersion: '12345',
              labels: { environment: 'production' }
            }
          })
        });

        const result = await handleOcPatch(args);

        expect(result.isError).toBeFalsy();
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['patch', 'pod', 'test-pod', '-n', 'default']),
          expect.any(Object)
        );
      });

      it('should accept valid YAML patch when JSON fails', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: `metadata:
  labels:
    environment: staging
spec:
  replicas: 3`,
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: {
              name: 'test-deploy',
              namespace: 'default',
              resourceVersion: '67890',
              labels: { environment: 'staging' }
            },
            spec: { replicas: 3 }
          })
        });

        const result = await handleOcPatch(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Patch Operation Successful');
      });

      it('should handle command execution error gracefully', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default'
        };

        // Mock command execution failure due to OpenShiftManager not being properly initialized
        mockManager.executeCommand.mockResolvedValue(undefined as any);
        
        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unexpected Error During Patch Operation');
      });
    });

    describe('patch types', () => {
      it('should handle strategic merge patch (default)', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: '{"spec":{"replicas":5}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-deploy', resourceVersion: '12345' },
            spec: { replicas: 5 }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--type', 'strategic']),
          expect.any(Object)
        );
      });

      it('should handle merge patch', async () => {
        const args: OcPatchArgs = {
          resourceType: 'service',
          name: 'test-svc',
          patch: '{"spec":{"ports":[{"port":8080}]}}',
          patchType: 'merge',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-svc', resourceVersion: '12345' },
            spec: { ports: [{ port: 8080 }] }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--type', 'merge']),
          expect.any(Object)
        );
      });

      it('should handle JSON patch', async () => {
        const args: OcPatchArgs = {
          resourceType: 'configmap',
          name: 'test-cm',
          patch: '[{"op":"add","path":"/data/newkey","value":"newvalue"}]',
          patchType: 'json',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-cm', resourceVersion: '12345' },
            data: { newkey: 'newvalue' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--type', 'json']),
          expect.any(Object)
        );
      });
    });

    describe('command options', () => {
      it('should handle dry run option', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default',
          dryRun: true
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-pod', resourceVersion: '12345' }
          })
        });

        const result = await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--dry-run=client']),
          expect.any(Object)
        );
        expect(result.content[0].text).toContain('(DRY RUN)');
      });

      it('should handle force option', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: '{"spec":{"replicas":3}}',
          namespace: 'default',
          force: true
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-deploy', resourceVersion: '12345' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--force']),
          expect.any(Object)
        );
      });

      it('should handle field manager option', async () => {
        const args: OcPatchArgs = {
          resourceType: 'service',
          name: 'test-svc',
          patch: '{"spec":{"type":"ClusterIP"}}',
          namespace: 'default',
          fieldManager: 'custom-manager'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-svc', resourceVersion: '12345' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--field-manager', 'custom-manager']),
          expect.any(Object)
        );
      });

      it('should handle subresource option', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: '{"replicas":5}',
          namespace: 'default',
          subresource: 'scale'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-deploy', resourceVersion: '12345' },
            spec: { replicas: 5 }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--subresource', 'scale']),
          expect.any(Object)
        );
      });

      it('should handle record history option', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: '{"spec":{"replicas":3}}',
          namespace: 'default',
          recordHistory: true
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-deploy', resourceVersion: '12345' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--record']),
          expect.any(Object)
        );
      });
    });

    describe('cluster-scoped resources', () => {
      it('should not add namespace for cluster-scoped resources', async () => {
        const args: OcPatchArgs = {
          resourceType: 'node',
          name: 'test-node',
          patch: '{"metadata":{"labels":{"environment":"production"}}}'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-node', resourceVersion: '12345' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.not.arrayContaining(['-n']),
          expect.any(Object)
        );
      });

      it('should handle namespace resource patching', async () => {
        const args: OcPatchArgs = {
          resourceType: 'namespace',
          name: 'test-namespace',
          patch: '{"metadata":{"labels":{"environment":"test"}}}'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-namespace', resourceVersion: '12345' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['patch', 'namespace', 'test-namespace']),
          expect.any(Object)
        );
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.not.arrayContaining(['-n']),
          expect.any(Object)
        );
      });
    });

    describe('error handling', () => {
      it('should handle command execution failure', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'nonexistent-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'pods "nonexistent-pod" not found'
        });

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Patch Operation Failed');
        expect(result.content[0].text).toContain('nonexistent-pod');
        expect(result.content[0].text).toContain('not found');
      });

      it('should handle permission errors', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: '{"spec":{"replicas":5}}',
          namespace: 'restricted-namespace'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'forbidden: User "test-user" cannot patch resource "deployments" in API group "apps" in the namespace "restricted-namespace"'
        });

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Patch Operation Failed');
        expect(result.content[0].text).toContain('forbidden');
        expect(result.content[0].text).toContain('Troubleshooting Tips');
      });

      it('should handle unexpected errors', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockRejectedValue(new Error('Network timeout'));

        const result = await handleOcPatch(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unexpected Error During Patch Operation');
        expect(result.content[0].text).toContain('Network timeout');
      });
    });

    describe('response formatting', () => {
      it('should format successful response with resource details', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: '{"spec":{"replicas":3}}',
          namespace: 'production',
          patchType: 'strategic'
        };

        const mockResponse = {
          metadata: {
            name: 'test-deploy',
            namespace: 'production',
            resourceVersion: '12345',
            generation: 5,
            labels: { app: 'test', environment: 'production' },
            annotations: { 'deployment.kubernetes.io/revision': '3' }
          },
          status: {
            replicas: 3,
            readyReplicas: 3,
            conditions: [
              { type: 'Available', status: 'True', reason: 'MinimumReplicasAvailable' }
            ]
          }
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify(mockResponse)
        });

        const result = await handleOcPatch(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Patch Operation Successful');
        expect(result.content[0].text).toContain('**Type**: deployment');
        expect(result.content[0].text).toContain('**Name**: test-deploy');
        expect(result.content[0].text).toContain('**Namespace**: production');
        expect(result.content[0].text).toContain('**Patch Type**: strategic');
        expect(result.content[0].text).toContain('**Resource Version**: 12345');
        expect(result.content[0].text).toContain('**Generation**: 5');
        expect(result.content[0].text).toContain('2 labels');
        expect(result.content[0].text).toContain('1 annotations');
        expect(result.content[0].text).toContain('**Replicas**: 3/3 ready');
        expect(result.content[0].text).toContain('**Ready**: True');
        expect(result.content[0].text).toContain('Verification Commands');
      });

      it('should handle response when JSON parsing fails', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: 'pod/test-pod patched'
        });

        const result = await handleOcPatch(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Patch Operation Successful');
        expect(result.content[0].text).toContain('Raw Output');
        expect(result.content[0].text).toContain('pod/test-pod patched');
      });

      it('should include patch examples in response', async () => {
        const args: OcPatchArgs = {
          resourceType: 'service',
          name: 'test-svc',
          patch: '{"spec":{"type":"NodePort"}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-svc', resourceVersion: '12345' }
          })
        });

        const result = await handleOcPatch(args);

        expect(result.content[0].text).toContain('Common Patch Examples');
        expect(result.content[0].text).toContain('Strategic merge patch');
        expect(result.content[0].text).toContain('JSON patch');
        expect(result.content[0].text).toContain('Merge patch');
      });
    });

    describe('context and timeout handling', () => {
      it('should pass context to command execution', async () => {
        const args: OcPatchArgs = {
          resourceType: 'pod',
          name: 'test-pod',
          patch: '{"metadata":{"labels":{"test":"value"}}}',
          namespace: 'default',
          context: 'test-cluster'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-pod', resourceVersion: '12345' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.any(Array),
          { context: 'test-cluster', timeout: 30000 }
        );
      });

      it('should use default timeout of 30 seconds', async () => {
        const args: OcPatchArgs = {
          resourceType: 'deployment',
          name: 'test-deploy',
          patch: '{"spec":{"replicas":5}}',
          namespace: 'default'
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: JSON.stringify({
            metadata: { name: 'test-deploy', resourceVersion: '12345' }
          })
        });

        await handleOcPatch(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.any(Array),
          { context: undefined, timeout: 30000 }
        );
      });
    });
  });
});
