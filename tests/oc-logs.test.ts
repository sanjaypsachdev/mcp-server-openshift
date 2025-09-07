import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOcLogs, validateLogsParameters } from '../src/tools/oc-logs.js';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';
import type { OcLogsParams } from '../src/models/tool-models.js';

// Mock the OpenShiftManager
vi.mock('../src/utils/openshift-manager.js', () => ({
  OpenShiftManager: {
    getInstance: vi.fn(() => ({
      executeCommand: vi.fn(),
    })),
  },
}));

describe('oc-logs tool', () => {
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      executeCommand: vi.fn(),
    };
    vi.mocked(OpenShiftManager.getInstance).mockReturnValue(mockManager);
  });

  describe('validateLogsParameters', () => {
    it('should validate basic parameters successfully', () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(true);
    });

    it('should reject both since and sinceTime', () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        since: '5m',
        sinceTime: '2023-01-01T12:00:00Z',
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot specify both "since" and "sinceTime"');
    });

    it('should validate since format', () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        since: 'invalid-format',
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Since must be in format');
    });

    it('should accept valid since formats', () => {
      const validFormats = ['5s', '2m', '3h', '1d'];

      validFormats.forEach(since => {
        const params: OcLogsParams = {
          name: 'test-pod',
          namespace: 'test',
          since,
        };

        const result = validateLogsParameters(params);
        expect(result.valid).toBe(true);
      });
    });

    it('should validate sinceTime RFC3339 format', () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        sinceTime: 'invalid-time',
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sinceTime must be in RFC3339 format');
    });

    it('should accept valid RFC3339 sinceTime', () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        sinceTime: '2023-01-01T12:00:00Z',
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(true);
    });

    it('should validate tail value', () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        tail: -5,
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tail must be >= -1');
    });

    it('should accept valid tail values', () => {
      const validTails = [-1, 0, 10, 100];

      validTails.forEach(tail => {
        const params: OcLogsParams = {
          name: 'test-pod',
          namespace: 'test',
          tail,
        };

        const result = validateLogsParameters(params);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject previous with follow', () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        previous: true,
        follow: true,
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot use "previous" and "follow" together');
    });

    it('should reject allContainers with non-pod resource', () => {
      const params: OcLogsParams = {
        name: 'test-deployment',
        namespace: 'test',
        resourceType: 'deployment',
        allContainers: true,
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('allContainers option only works with resourceType "pod"');
    });

    it('should reject selector with non-pod resource', () => {
      const params: OcLogsParams = {
        name: 'test-deployment',
        namespace: 'test',
        resourceType: 'deployment',
        selector: 'app=test',
      };

      const result = validateLogsParameters(params);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('selector option only works with resourceType "pod"');
    });
  });

  describe('handleOcLogs', () => {
    it('should retrieve logs from single container pod successfully', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: {
              containers: [{ name: 'main' }],
            },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Log line 1\nLog line 2\nLog line 3',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Log line 1');
      expect(result.content[0].text).toContain('**Total Lines**: 3');
    });

    it('should handle multi-container pod requiring container selection', async () => {
      const params: OcLogsParams = {
        name: 'multi-container-pod',
        namespace: 'test',
      };

      // Mock resource discovery with multiple containers
      mockManager.executeCommand.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({
          kind: 'Pod',
          metadata: { name: 'multi-container-pod' },
          spec: {
            containers: [{ name: 'web' }, { name: 'sidecar' }],
          },
          status: { phase: 'Running' },
        }),
      });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Container Selection Required');
      expect(result.content[0].text).toContain('web');
      expect(result.content[0].text).toContain('sidecar');
      expect(result.content[0].text).toContain('allContainers');
    });

    it('should handle multi-container pod with specific container selection', async () => {
      const params: OcLogsParams = {
        name: 'multi-container-pod',
        namespace: 'test',
        container: 'web',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'multi-container-pod' },
            spec: {
              containers: [{ name: 'web' }, { name: 'sidecar' }],
            },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Web container log line 1\nWeb container log line 2',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Web container log line 1');
      expect(result.content[0].text).toContain('**Selected Container**: web');
    });

    it('should handle multi-container pod with allContainers option', async () => {
      const params: OcLogsParams = {
        name: 'multi-container-pod',
        namespace: 'test',
        allContainers: true,
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'multi-container-pod' },
            spec: {
              containers: [{ name: 'web' }, { name: 'sidecar' }],
            },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval for web container
        .mockResolvedValueOnce({
          success: true,
          data: 'Web container logs',
        })
        // Mock logs retrieval for sidecar container
        .mockResolvedValueOnce({
          success: true,
          data: 'Sidecar container logs',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Web container logs');
      expect(result.content[0].text).toContain('Sidecar container logs');
      expect(result.content[0].text).toContain('**Sources**: 1'); // Both containers are from same pod source
    });

    it('should handle resource not found', async () => {
      const params: OcLogsParams = {
        name: 'nonexistent-pod',
        namespace: 'test',
      };

      // Mock resource discovery failure
      mockManager.executeCommand.mockResolvedValueOnce({
        success: false,
        error: 'pods "nonexistent-pod" not found',
      });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Log Retrieval Failed');
      expect(result.content[0].text).toContain('Resource not available');
    });

    it('should handle selector-based pod logs', async () => {
      const params: OcLogsParams = {
        name: 'dummy', // Required but not used with selector
        namespace: 'test',
        selector: 'app=web',
      };

      // Mock pod discovery with selector
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            items: [
              { kind: 'Pod', metadata: { name: 'web-1' } },
              { kind: 'Pod', metadata: { name: 'web-2' } },
            ],
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Logs from selector-based query',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Logs from selector-based query');
    });

    it('should handle empty selector results', async () => {
      const params: OcLogsParams = {
        name: 'dummy',
        namespace: 'test',
        selector: 'app=nonexistent',
      };

      // Mock empty pod discovery
      mockManager.executeCommand.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify({ items: [] }),
      });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Log Retrieval Failed');
      expect(result.content[0].text).toContain('No pods found matching selector');
    });

    it('should handle deployment logs', async () => {
      const params: OcLogsParams = {
        name: 'test-deployment',
        namespace: 'test',
        resourceType: 'deployment',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Deployment',
            metadata: { name: 'test-deployment' },
            spec: {
              template: {
                spec: {
                  containers: [{ name: 'app' }],
                },
              },
            },
            status: { readyReplicas: 2, replicas: 2 },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Deployment log line 1\nDeployment log line 2',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Deployment log line 1');
    });

    it('should handle build logs', async () => {
      const params: OcLogsParams = {
        name: 'test-build-1',
        namespace: 'test',
        resourceType: 'build',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Build',
            metadata: { name: 'test-build-1' },
            status: { phase: 'Complete' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Build started\nBuild step 1\nBuild completed successfully',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Build started');
      expect(result.content[0].text).toContain('Build completed successfully');
    });

    it('should handle logs with timestamps', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        timestamps: true,
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval with timestamps
        .mockResolvedValueOnce({
          success: true,
          data: '2023-01-01T12:00:00Z Log line 1\n2023-01-01T12:00:01Z Log line 2',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('**Include Timestamps**: Yes');
      expect(result.content[0].text).toContain('2023-01-01T12:00:00Z');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--timestamps']),
        expect.any(Object)
      );
    });

    it('should handle logs with tail option', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        tail: 10,
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Last 10 lines of logs',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--tail', '10']),
        expect.any(Object)
      );
    });

    it('should handle logs with since option', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        since: '5m',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Recent logs from last 5 minutes',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--since', '5m']),
        expect.any(Object)
      );
    });

    it('should handle previous container logs', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        previous: true,
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Previous container logs',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Previous container logs');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['-p']),
        expect.any(Object)
      );
    });

    it('should handle no logs found', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock empty logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: '',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      // When no logs are returned but command succeeds, it shows success with 0 lines
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('**Total Lines**: 0');
    });

    it('should handle logs retrieval errors', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval failure
        .mockResolvedValueOnce({
          success: false,
          error: 'container "main" in pod "test-pod" is not running',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Errors Encountered');
      expect(result.content[0].text).toContain('container "main" in pod "test-pod" is not running');
    });

    it('should handle follow mode indication', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        follow: true,
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Streaming logs...',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('**Follow Mode**: Yes (streaming)');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['-f']),
        expect.any(Object)
      );
    });

    it('should handle limit bytes option', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        limitBytes: 1024,
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval with limited bytes
        .mockResolvedValueOnce({
          success: true,
          data: 'Limited logs content...',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--limit-bytes', '1024']),
        expect.any(Object)
      );
    });

    it('should handle buildconfig logs', async () => {
      const params: OcLogsParams = {
        name: 'test-buildconfig',
        namespace: 'test',
        resourceType: 'buildconfig',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'BuildConfig',
            metadata: { name: 'test-buildconfig' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'BuildConfig logs from latest build',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('BuildConfig logs from latest build');
    });

    it('should handle job logs', async () => {
      const params: OcLogsParams = {
        name: 'test-job',
        namespace: 'test',
        resourceType: 'job',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Job',
            metadata: { name: 'test-job' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Job execution logs',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Job execution logs');
    });
  });

  describe('advanced scenarios', () => {
    it('should handle maxLogRequests with selector', async () => {
      const params: OcLogsParams = {
        name: 'dummy',
        namespace: 'test',
        selector: 'app=test',
        maxLogRequests: 3,
      };

      // Mock pod discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            items: [
              { kind: 'Pod', metadata: { name: 'pod-1' } },
              { kind: 'Pod', metadata: { name: 'pod-2' } },
            ],
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Logs with limited concurrent requests',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--max-log-requests', '3']),
        expect.any(Object)
      );
    });

    it('should handle sinceTime with RFC3339 format', async () => {
      const params: OcLogsParams = {
        name: 'test-pod',
        namespace: 'test',
        sinceTime: '2023-01-01T12:00:00Z',
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'test-pod' },
            spec: { containers: [{ name: 'main' }] },
            status: { phase: 'Running' },
          }),
        })
        // Mock logs retrieval
        .mockResolvedValueOnce({
          success: true,
          data: 'Logs since specific timestamp',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(mockManager.executeCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['--since-time', '2023-01-01T12:00:00Z']),
        expect.any(Object)
      );
    });

    it('should handle mixed success and error results', async () => {
      const params: OcLogsParams = {
        name: 'multi-container-pod',
        namespace: 'test',
        allContainers: true,
      };

      // Mock resource discovery
      mockManager.executeCommand
        .mockResolvedValueOnce({
          success: true,
          data: JSON.stringify({
            kind: 'Pod',
            metadata: { name: 'multi-container-pod' },
            spec: {
              containers: [{ name: 'web' }, { name: 'sidecar' }],
            },
            status: { phase: 'Running' },
          }),
        })
        // Mock successful logs retrieval for web container
        .mockResolvedValueOnce({
          success: true,
          data: 'Web container logs',
        })
        // Mock failed logs retrieval for sidecar container
        .mockResolvedValueOnce({
          success: false,
          error: 'container "sidecar" is not ready',
        });

      const result = await handleOcLogs(params);

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Logs Retrieved Successfully');
      expect(result.content[0].text).toContain('Web container logs');
      expect(result.content[0].text).toContain('Errors Encountered');
      expect(result.content[0].text).toContain('container "sidecar" is not ready');
    });
  });
});
