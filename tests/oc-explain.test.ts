import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOcExplain, ocExplainTool, type OcExplainArgs } from '../src/tools/oc-explain.js';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';

// Mock the OpenShiftManager
vi.mock('../src/utils/openshift-manager.js');

describe('oc-explain tool', () => {
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      executeCommand: vi.fn(),
    };
    vi.mocked(OpenShiftManager.getInstance).mockReturnValue(mockManager);
  });

  describe('tool definition', () => {
    it('should have correct tool definition', () => {
      expect(ocExplainTool.name).toBe('oc_explain');
      expect(ocExplainTool.description).toBe(
        'Explain OpenShift/Kubernetes resource schemas, fields, and API documentation'
      );
      expect(ocExplainTool.inputSchema.type).toBe('object');
      expect(ocExplainTool.inputSchema.required).toEqual(['resource']);
    });

    it('should have all properties in schema', () => {
      const properties = ocExplainTool.inputSchema.properties;
      expect(properties).toHaveProperty('resource');
      expect(properties).toHaveProperty('field');
      expect(properties).toHaveProperty('context');
      expect(properties).toHaveProperty('apiVersion');
      expect(properties).toHaveProperty('recursive');
      expect(properties).toHaveProperty('output');
    });

    it('should have correct output format enum', () => {
      const outputProperty = ocExplainTool.inputSchema.properties.output;
      expect(outputProperty.enum).toEqual(['plaintext', 'json']);
      expect(outputProperty.default).toBe('plaintext');
    });
  });

  describe('handleOcExplain function', () => {
    const mockExplainOutput = `KIND:     Pod
VERSION:  v1

DESCRIPTION:
     Pod is a collection of containers that can run on a host.

FIELDS:
   apiVersion	<string>
     APIVersion defines the versioned schema of this representation of an
     object.

   kind	<string>
     Kind is a string value representing the REST resource this object
     represents.

   metadata	<Object>
     Standard object's metadata.

   spec	<Object>
     Specification of the desired behavior of the pod.

   status	<Object>
     Most recently observed status of the pod.`;

    describe('basic functionality', () => {
      it('should explain a basic resource', async () => {
        const args: OcExplainArgs = {
          resource: 'pod',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockExplainOutput,
        });

        const result = await handleOcExplain(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('OpenShift Resource Explanation');
        expect(result.content[0].text).toContain('**Resource**: pod');
        expect(result.content[0].text).toContain('Resource Documentation');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(['explain', 'pod'], {
          context: undefined,
          timeout: 30000,
        });
      });

      it('should explain a specific field', async () => {
        const args: OcExplainArgs = {
          resource: 'pod',
          field: 'spec.containers',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: 'FIELD: spec.containers <[]Object>',
        });

        await handleOcExplain(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['explain', 'pod.spec.containers'],
          {
            context: undefined,
            timeout: 30000,
          }
        );
      });

      it('should handle API version specification', async () => {
        const args: OcExplainArgs = {
          resource: 'deployment',
          apiVersion: 'apps/v1',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: 'KIND: Deployment',
        });

        await handleOcExplain(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['explain', 'deployment', '--api-version', 'apps/v1'],
          expect.any(Object)
        );
      });

      it('should handle recursive option', async () => {
        const args: OcExplainArgs = {
          resource: 'pod',
          recursive: true,
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: 'Recursive pod explanation...',
        });

        await handleOcExplain(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['explain', 'pod', '--recursive'],
          expect.any(Object)
        );
      });

      it('should handle JSON output format', async () => {
        const args: OcExplainArgs = {
          resource: 'service',
          output: 'json',
        };

        const jsonOutput = '{"kind": "Service", "apiVersion": "v1"}';
        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: jsonOutput,
        });

        const result = await handleOcExplain(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['explain', 'service', '--output', 'json'],
          expect.any(Object)
        );
        expect(result.content[0].text).toContain('```json');
        expect(result.content[0].text).toContain(jsonOutput);
      });
    });

    describe('resource validation', () => {
      it('should reject empty resource name', async () => {
        const args: OcExplainArgs = {
          resource: '',
        };

        const result = await handleOcExplain(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid Resource Name');
      });

      it('should reject invalid resource name characters', async () => {
        const args: OcExplainArgs = {
          resource: 'invalid@resource!',
        };

        const result = await handleOcExplain(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid Resource Name');
        expect(result.content[0].text).toContain('Valid Examples');
      });

      it('should accept valid resource names', async () => {
        const validResources = [
          'pod',
          'pods',
          'deployment.apps',
          'route.route.openshift.io',
          'buildconfig.build.openshift.io',
        ];

        for (const resource of validResources) {
          const args: OcExplainArgs = { resource };

          mockManager.executeCommand.mockResolvedValue({
            success: true,
            data: `KIND: ${resource}`,
          });

          const result = await handleOcExplain(args);
          expect(result.isError).toBeFalsy();
        }
      });
    });

    describe('error handling', () => {
      it('should handle resource not found errors', async () => {
        const args: OcExplainArgs = {
          resource: 'nonexistent',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'error: resource mapping not found for name "nonexistent"',
        });

        const result = await handleOcExplain(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Resource Explanation Failed');
        expect(result.content[0].text).toContain('Resource Not Found');
        expect(result.content[0].text).toContain('Check resource name');
        expect(result.content[0].text).toContain('oc api-resources');
      });

      it('should handle field not found errors', async () => {
        const args: OcExplainArgs = {
          resource: 'pod',
          field: 'nonexistent.field',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'error: field "nonexistent.field" does not exist',
        });

        const result = await handleOcExplain(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Field Not Found');
        expect(result.content[0].text).toContain('Check field path');
        expect(result.content[0].text).toContain('--recursive');
      });

      it('should handle unexpected errors', async () => {
        const args: OcExplainArgs = {
          resource: 'pod',
        };

        mockManager.executeCommand.mockRejectedValue(new Error('Connection timeout'));

        const result = await handleOcExplain(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unexpected Error During Resource Explanation');
        expect(result.content[0].text).toContain('Connection timeout');
      });
    });

    describe('response formatting', () => {
      it('should format plaintext explanation correctly', async () => {
        const args: OcExplainArgs = {
          resource: 'deployment',
          field: 'spec',
          apiVersion: 'apps/v1',
          recursive: false,
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockExplainOutput,
        });

        const result = await handleOcExplain(args);

        expect(result.content[0].text).toContain('**Resource**: deployment');
        expect(result.content[0].text).toContain('**Field**: spec');
        expect(result.content[0].text).toContain('**API Version**: apps/v1');
        expect(result.content[0].text).toContain('**Recursive**: No');
        expect(result.content[0].text).toContain('Related Commands');
        expect(result.content[0].text).toContain('Usage Tips');
      });

      it('should include helpful commands in response', async () => {
        const args: OcExplainArgs = {
          resource: 'service',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: 'Service explanation...',
        });

        const result = await handleOcExplain(args);

        expect(result.content[0].text).toContain('oc explain service.spec');
        expect(result.content[0].text).toContain('oc explain service.status');
        expect(result.content[0].text).toContain('oc get service');
        expect(result.content[0].text).toContain('Usage Tips');
        expect(result.content[0].text).toContain('Field Navigation');
      });
    });

    describe('context handling', () => {
      it('should pass context to command execution', async () => {
        const args: OcExplainArgs = {
          resource: 'pod',
          context: 'test-cluster',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockExplainOutput,
        });

        await handleOcExplain(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(expect.any(Array), {
          context: 'test-cluster',
          timeout: 30000,
        });
      });
    });
  });
});
