import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleOcApiResources,
  ocApiResourcesTool,
  type OcApiResourcesArgs,
} from '../src/tools/oc-api-resources.js';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';

// Mock the OpenShiftManager
vi.mock('../src/utils/openshift-manager.js');

describe('oc-api-resources tool', () => {
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      executeCommand: vi.fn(),
    };
    vi.mocked(OpenShiftManager.getInstance).mockReturnValue(mockManager);
  });

  describe('tool definition', () => {
    it('should have correct tool definition', () => {
      expect(ocApiResourcesTool.name).toBe('oc_api_resources');
      expect(ocApiResourcesTool.description).toBe(
        'List all available API resources in the OpenShift cluster with their details'
      );
      expect(ocApiResourcesTool.inputSchema.type).toBe('object');
      expect(ocApiResourcesTool.inputSchema.required).toBeUndefined();
    });

    it('should have all properties in schema', () => {
      const properties = ocApiResourcesTool.inputSchema.properties;
      expect(properties).toHaveProperty('context');
      expect(properties).toHaveProperty('apiGroup');
      expect(properties).toHaveProperty('namespaced');
      expect(properties).toHaveProperty('verbs');
      expect(properties).toHaveProperty('output');
      expect(properties).toHaveProperty('categories');
    });

    it('should have correct output format enum', () => {
      const outputProperty = ocApiResourcesTool.inputSchema.properties.output;
      expect(outputProperty.enum).toEqual(['table', 'json', 'yaml', 'wide']);
      expect(outputProperty.default).toBe('table');
    });
  });

  describe('handleOcApiResources function', () => {
    const mockTableOutput = `NAME                              SHORTNAMES   APIVERSION                        NAMESPACED   KIND
pods                              po           v1                                true         Pod
services                          svc          v1                                true         Service
deployments                       deploy       apps/v1                           true         Deployment
routes                                         route.openshift.io/v1             true         Route`;

    describe('basic functionality', () => {
      it('should list all API resources with default settings', async () => {
        const args: OcApiResourcesArgs = {};

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockTableOutput,
        });

        const result = await handleOcApiResources(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('OpenShift API Resources');
        expect(result.content[0].text).toContain('**Context**: current');
        expect(result.content[0].text).toContain('**Output Format**: table');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(['api-resources'], {
          context: undefined,
          timeout: 30000,
        });
      });

      it('should handle API group filtering', async () => {
        const args: OcApiResourcesArgs = {
          apiGroup: 'apps',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockTableOutput,
        });

        await handleOcApiResources(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['api-resources', '--api-group', 'apps'],
          expect.any(Object)
        );
      });

      it('should handle namespaced filtering', async () => {
        const args: OcApiResourcesArgs = {
          namespaced: true,
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockTableOutput,
        });

        await handleOcApiResources(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['api-resources', '--namespaced', 'true'],
          expect.any(Object)
        );
      });

      it('should handle verbs filtering', async () => {
        const args: OcApiResourcesArgs = {
          verbs: ['get', 'list', 'create'],
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockTableOutput,
        });

        await handleOcApiResources(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['api-resources', '--verbs', 'get,list,create'],
          expect.any(Object)
        );
      });

      it('should handle different output formats', async () => {
        const args: OcApiResourcesArgs = {
          output: 'json',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: '{"resources": []}',
        });

        await handleOcApiResources(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['api-resources', '-o', 'json'],
          expect.any(Object)
        );
      });
    });

    describe('output formatting', () => {
      it('should format table output with categories', async () => {
        const args: OcApiResourcesArgs = {
          categories: true,
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockTableOutput,
        });

        const result = await handleOcApiResources(args);

        expect(result.content[0].text).toContain('API Resources by Category');
        expect(result.content[0].text).toContain('Core Resources');
        expect(result.content[0].text).toContain('Apps & Deployments');
        expect(result.content[0].text).toContain('Resource Summary');
      });

      it('should format JSON output correctly', async () => {
        const args: OcApiResourcesArgs = {
          output: 'json',
        };

        const jsonOutput = '{"resources": [{"name": "pods", "kind": "Pod"}]}';
        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: jsonOutput,
        });

        const result = await handleOcApiResources(args);

        expect(result.content[0].text).toContain('API Resources (JSON)');
        expect(result.content[0].text).toContain('```json');
        expect(result.content[0].text).toContain(jsonOutput);
      });

      it('should include useful commands in response', async () => {
        const args: OcApiResourcesArgs = {};

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockTableOutput,
        });

        const result = await handleOcApiResources(args);

        expect(result.content[0].text).toContain('Useful Commands');
        expect(result.content[0].text).toContain('oc api-resources');
        expect(result.content[0].text).toContain('oc explain');
        expect(result.content[0].text).toContain('Next Steps');
      });
    });

    describe('error handling', () => {
      it('should handle command execution failure', async () => {
        const args: OcApiResourcesArgs = {};

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'error: You must be logged in to the server',
        });

        const result = await handleOcApiResources(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Failed to List API Resources');
        expect(result.content[0].text).toContain('You must be logged in');
        expect(result.content[0].text).toContain('Troubleshooting Tips');
      });

      it('should handle unexpected errors', async () => {
        const args: OcApiResourcesArgs = {};

        mockManager.executeCommand.mockRejectedValue(new Error('Network timeout'));

        const result = await handleOcApiResources(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unexpected Error Listing API Resources');
        expect(result.content[0].text).toContain('Network timeout');
      });
    });

    describe('context handling', () => {
      it('should pass context to command execution', async () => {
        const args: OcApiResourcesArgs = {
          context: 'test-cluster',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: mockTableOutput,
        });

        await handleOcApiResources(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(expect.any(Array), {
          context: 'test-cluster',
          timeout: 30000,
        });
      });
    });
  });
});
