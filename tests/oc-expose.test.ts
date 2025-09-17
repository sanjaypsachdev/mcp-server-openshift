import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOcExpose, ocExposeTool } from '../src/tools/oc-expose.js';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';
import type { OcExposeParams } from '../src/models/tool-models.js';
import { existsSync } from 'fs';

// Mock the OpenShiftManager and fs
vi.mock('../src/utils/openshift-manager.js');
vi.mock('fs');

describe('oc-expose tool', () => {
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      executeCommand: vi.fn(),
      getResources: vi.fn(),
    };
    vi.mocked(OpenShiftManager.getInstance).mockReturnValue(mockManager);
    vi.mocked(existsSync).mockReturnValue(true); // Default to files existing
  });

  describe('tool definition', () => {
    it('should have correct tool definition', () => {
      expect(ocExposeTool.name).toBe('oc_expose');
      expect(ocExposeTool.description).toBe(
        'Expose an OpenShift resource (service, deployment, etc.) with secure route endpoints supporting SSL/TLS termination'
      );
      expect(ocExposeTool.inputSchema.type).toBe('object');
      expect(ocExposeTool.inputSchema.required).toEqual(['resourceType', 'name']);
    });

    it('should have all required properties in schema', () => {
      const properties = ocExposeTool.inputSchema.properties;
      expect(properties).toHaveProperty('resourceType');
      expect(properties).toHaveProperty('name');
      expect(properties).toHaveProperty('namespace');
      expect(properties).toHaveProperty('context');
      expect(properties).toHaveProperty('routeName');
      expect(properties).toHaveProperty('hostname');
      expect(properties).toHaveProperty('port');
      expect(properties).toHaveProperty('path');
      expect(properties).toHaveProperty('routeType');
      expect(properties).toHaveProperty('wildcardPolicy');
      expect(properties).toHaveProperty('certificate');
      expect(properties).toHaveProperty('key');
      expect(properties).toHaveProperty('caCertificate');
      expect(properties).toHaveProperty('destinationCaCertificate');
      expect(properties).toHaveProperty('insecureEdgeTerminationPolicy');
      expect(properties).toHaveProperty('labels');
      expect(properties).toHaveProperty('annotations');
      expect(properties).toHaveProperty('weight');
      expect(properties).toHaveProperty('dryRun');
    });

    it('should have correct resource type enum values', () => {
      const resourceTypeProperty = ocExposeTool.inputSchema.properties.resourceType;
      expect(resourceTypeProperty.enum).toEqual([
        'service',
        'svc',
        'deploymentconfig',
        'dc',
        'deployment',
        'deploy',
      ]);
    });

    it('should have correct route type enum values', () => {
      const routeTypeProperty = ocExposeTool.inputSchema.properties.routeType;
      expect(routeTypeProperty.enum).toEqual(['edge', 'passthrough', 'reencrypt']);
      expect(routeTypeProperty.default).toBe('edge');
    });

    it('should have correct wildcard policy enum values', () => {
      const wildcardProperty = ocExposeTool.inputSchema.properties.wildcardPolicy;
      expect(wildcardProperty.enum).toEqual(['None', 'Subdomain']);
      expect(wildcardProperty.default).toBe('None');
    });

    it('should have correct insecure edge termination policy enum values', () => {
      const insecureProperty = ocExposeTool.inputSchema.properties.insecureEdgeTerminationPolicy;
      expect(insecureProperty.enum).toEqual(['None', 'Allow', 'Redirect']);
      expect(insecureProperty.default).toBe('Redirect');
    });
  });

  describe('handleOcExpose function', () => {
    describe('basic functionality', () => {
      it('should expose a service with default edge route', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'test-service',
          namespace: 'default',
        };

        // Mock resource verification
        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: {
            metadata: { name: 'test-service' },
            spec: { ports: [{ name: 'http', port: 8080 }] },
          },
        });

        // Mock route creation
        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/test-service-route created',
        });

        // Mock route information retrieval
        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: {
            metadata: { name: 'test-service-route' },
            spec: { host: 'test-service-route-default.apps.cluster.com', path: '/' },
            status: {},
          },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Successful');
        expect(result.content[0].text).toContain('service/test-service');
        expect(result.content[0].text).toContain('edge (secure)');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['create', 'route', 'edge', 'test-service-route']),
          expect.any(Object)
        );
      });

      it('should expose a deployment with custom route name', async () => {
        const params: OcExposeParams = {
          resourceType: 'deployment',
          name: 'my-app',
          namespace: 'production',
          routeName: 'custom-route',
          routeType: 'passthrough',
        };

        // Mock resource verification
        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'my-app' } },
        });

        // Mock route creation
        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/custom-route created',
        });

        // Mock route information retrieval
        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: {
            metadata: { name: 'custom-route' },
            spec: { host: 'custom-route-production.apps.cluster.com' },
          },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Successful');
        expect(result.content[0].text).toContain('Route Name**: custom-route');
        expect(result.content[0].text).toContain('passthrough (secure)');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['create', 'route', 'passthrough', 'custom-route']),
          expect.any(Object)
        );
      });
    });

    describe('port detection', () => {
      it('should auto-detect port from service', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'web-service',
          namespace: 'default',
        };

        // Mock resource verification with port info
        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: {
            metadata: { name: 'web-service' },
            spec: {
              ports: [
                { name: 'http', port: 8080 },
                { name: 'https', port: 8443 },
              ],
            },
          },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/web-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'web-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Auto-detected port: http');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--port', 'http']),
          expect.any(Object)
        );
      });

      it('should use specified port over auto-detection', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'web-service',
          namespace: 'default',
          port: '8443',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'web-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/web-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'web-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--port', '8443']),
          expect.any(Object)
        );
      });
    });

    describe('TLS certificate validation', () => {
      it('should validate TLS certificates exist', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'secure-service',
          namespace: 'default',
          routeType: 'edge',
          certificate: '/path/to/cert.pem',
          key: '/path/to/key.pem',
        };

        vi.mocked(existsSync).mockReturnValue(false);

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Failed');
        expect(result.content[0].text).toContain('Certificate file not found');
      });

      it('should require both certificate and key for edge termination', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'secure-service',
          namespace: 'default',
          routeType: 'edge',
          certificate: '/path/to/cert.pem',
          // Missing key
        };

        vi.mocked(existsSync).mockReturnValue(true);

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Failed');
        expect(result.content[0].text).toContain('Both certificate and private key are required');
      });

      it('should create route with valid TLS certificates', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'secure-service',
          namespace: 'default',
          routeType: 'edge',
          certificate: '/path/to/cert.pem',
          key: '/path/to/key.pem',
          caCertificate: '/path/to/ca.pem',
        };

        vi.mocked(existsSync).mockReturnValue(true);

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'secure-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/secure-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'secure-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('TLS certificates validated');
        expect(result.content[0].text).toContain('Resource Exposure Successful');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining([
            '--cert',
            '/path/to/cert.pem',
            '--key',
            '/path/to/key.pem',
            '--ca-cert',
            '/path/to/ca.pem',
          ]),
          expect.any(Object)
        );
      });
    });

    describe('route types', () => {
      it('should create passthrough route', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'ssl-service',
          namespace: 'default',
          routeType: 'passthrough',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'ssl-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/ssl-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'ssl-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('passthrough (secure)');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['create', 'route', 'passthrough']),
          expect.any(Object)
        );
      });

      it('should create reencrypt route with destination CA', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'reencrypt-service',
          namespace: 'default',
          routeType: 'reencrypt',
          certificate: '/path/to/cert.pem',
          key: '/path/to/key.pem',
          destinationCaCertificate: '/path/to/dest-ca.pem',
        };

        vi.mocked(existsSync).mockReturnValue(true);

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'reencrypt-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/reencrypt-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'reencrypt-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('reencrypt (secure)');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining([
            'create',
            'route',
            'reencrypt',
            '--dest-ca-cert',
            '/path/to/dest-ca.pem',
          ]),
          expect.any(Object)
        );
      });
    });

    describe('route options', () => {
      it('should handle custom hostname and path', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'api-service',
          namespace: 'default',
          hostname: 'api.example.com',
          path: '/v1',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'api-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/api-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: {
            metadata: { name: 'api-service-route' },
            spec: { host: 'api.example.com', path: '/v1' },
          },
        });

        const result = await handleOcExpose(params);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--hostname', 'api.example.com', '--path', '/v1']),
          expect.any(Object)
        );
      });

      it('should handle wildcard policy', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'wildcard-service',
          namespace: 'default',
          wildcardPolicy: 'Subdomain',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'wildcard-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/wildcard-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'wildcard-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--wildcard-policy', 'Subdomain']),
          expect.any(Object)
        );
      });

      it('should handle insecure edge termination policy', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'insecure-service',
          namespace: 'default',
          insecureEdgeTerminationPolicy: 'Allow',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'insecure-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/insecure-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'insecure-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--insecure-policy', 'Allow']),
          expect.any(Object)
        );
      });

      it('should handle labels and weight', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'labeled-service',
          namespace: 'default',
          labels: ['app=test', 'version=v1'],
          weight: 100,
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'labeled-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/labeled-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'labeled-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['-l', 'app=test', '-l', 'version=v1', '--weight', '100']),
          expect.any(Object)
        );
      });

      it('should handle annotations', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'annotated-service',
          namespace: 'default',
          annotations: ['haproxy.router.openshift.io/timeout=30s'],
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'annotated-service' } },
        });

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'route.route.openshift.io/annotated-service-route created',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'route.route.openshift.io/annotated-service-route annotated',
          });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'annotated-service-route' }, spec: { host: 'test.com' } },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Successful');
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['annotate', 'route', 'annotated-service-route']),
          expect.any(Object)
        );
      });
    });

    describe('dry run mode', () => {
      it('should handle dry run mode', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'test-service',
          namespace: 'default',
          dryRun: true,
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'test-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'apiVersion: route.openshift.io/v1\nkind: Route\n...',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: null, // Route doesn't exist in dry run
        });

        const result = await handleOcExpose(params);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--dry-run=client', '-o', 'yaml']),
          expect.any(Object)
        );
      });
    });

    describe('error handling', () => {
      it('should handle source resource not found', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'nonexistent-service',
          namespace: 'default',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: false,
          error: 'services "nonexistent-service" not found',
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Failed');
        expect(result.content[0].text).toContain('Source resource not found');
        expect(result.content[0].text).toContain('nonexistent-service');
      });

      it('should handle route creation failure', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'test-service',
          namespace: 'default',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'test-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: false,
          error: 'routes.route.openshift.io "test-service-route" already exists',
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Failed');
        expect(result.content[0].text).toContain('Failed to create route');
        expect(result.content[0].text).toContain('already exists');
      });

      it('should handle permission errors', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'test-service',
          namespace: 'restricted',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'test-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: false,
          error:
            'forbidden: User "test-user" cannot create resource "routes" in API group "route.openshift.io"',
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Failed');
        expect(result.content[0].text).toContain('forbidden');
        expect(result.content[0].text).toContain('Troubleshooting Steps');
      });

      it('should handle unexpected errors', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'test-service',
          namespace: 'default',
        };

        mockManager.getResources.mockRejectedValueOnce(new Error('Network timeout'));

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Failed');
        expect(result.content[0].text).toContain('Source resource not found');
        expect(result.content[0].text).toContain('Network timeout');
      });
    });

    describe('response formatting', () => {
      it('should format successful response with route information', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'web-service',
          namespace: 'production',
          routeType: 'edge',
          hostname: 'web.example.com',
          path: '/app',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: { metadata: { name: 'web-service' } },
        });

        mockManager.executeCommand.mockResolvedValueOnce({
          success: true,
          data: 'route.route.openshift.io/web-service-route created',
        });

        mockManager.getResources.mockResolvedValueOnce({
          success: true,
          data: {
            metadata: { name: 'web-service-route' },
            spec: {
              host: 'web.example.com',
              path: '/app',
              tls: { termination: 'edge', insecureEdgeTerminationPolicy: 'Redirect' },
            },
          },
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Resource Exposure Successful');
        expect(result.content[0].text).toContain('service/web-service');
        expect(result.content[0].text).toContain('production');
        expect(result.content[0].text).toContain('web-service-route');
        expect(result.content[0].text).toContain('edge (secure)');
        expect(result.content[0].text).toContain('https://web.example.com/app');
        expect(result.content[0].text).toContain('SSL/TLS**: Enabled');
        expect(result.content[0].text).toContain('Useful Commands');
        expect(result.content[0].text).toContain('curl -k https://web.example.com/app');
      });

      it('should include troubleshooting information in error responses', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'test-service',
          namespace: 'default',
        };

        mockManager.getResources.mockResolvedValueOnce({
          success: false,
          error: 'connection refused',
        });

        const result = await handleOcExpose(params);

        expect(result.content[0].text).toContain('Troubleshooting Steps');
        expect(result.content[0].text).toContain('Verify the source resource exists');
        expect(result.content[0].text).toContain('Check namespace permissions');
        expect(result.content[0].text).toContain('Verify TLS certificate files');
      });
    });

    describe('context handling', () => {
      it('should pass context to all OpenShift commands', async () => {
        const params: OcExposeParams = {
          resourceType: 'service',
          name: 'test-service',
          namespace: 'default',
          context: 'test-cluster',
        };

        mockManager.getResources.mockResolvedValue({
          success: true,
          data: { metadata: { name: 'test-service' } },
        });

        mockManager.executeCommand.mockResolvedValue({
          success: true,
          data: 'route.route.openshift.io/test-service-route created',
        });

        await handleOcExpose(params);

        expect(mockManager.getResources).toHaveBeenCalledWith(
          'service',
          'default',
          'test-service',
          expect.objectContaining({ context: 'test-cluster' })
        );
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({ context: 'test-cluster' })
        );
      });
    });
  });
});
