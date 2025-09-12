import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOcLogin, ocLoginTool, type OcLoginArgs } from '../src/tools/oc-login.js';
import { OpenShiftManager } from '../src/utils/openshift-manager.js';

// Mock the OpenShiftManager
vi.mock('../src/utils/openshift-manager.js');

describe('oc-login tool', () => {
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      executeCommand: vi.fn(),
    };
    vi.mocked(OpenShiftManager.getInstance).mockReturnValue(mockManager);
  });

  describe('tool definition', () => {
    it('should have correct tool definition', () => {
      expect(ocLoginTool.name).toBe('oc_login');
      expect(ocLoginTool.description).toBe(
        'Securely log into an OpenShift cluster using username/password or token authentication'
      );
      expect(ocLoginTool.inputSchema.type).toBe('object');
      expect(ocLoginTool.inputSchema.required).toEqual(['server', 'authMethod']);
    });

    it('should have all required properties in schema', () => {
      const properties = ocLoginTool.inputSchema.properties;
      expect(properties).toHaveProperty('server');
      expect(properties).toHaveProperty('authMethod');
      expect(properties).toHaveProperty('token');
      expect(properties).toHaveProperty('username');
      expect(properties).toHaveProperty('password');
      expect(properties).toHaveProperty('context');
      expect(properties).toHaveProperty('insecureSkipTlsVerify');
      expect(properties).toHaveProperty('certificateAuthority');
      expect(properties).toHaveProperty('namespace');
      expect(properties).toHaveProperty('timeout');
    });

    it('should have correct auth method enum values', () => {
      const authMethodProperty = ocLoginTool.inputSchema.properties.authMethod;
      expect(authMethodProperty.enum).toEqual(['token', 'password']);
      expect(authMethodProperty.default).toBe('token');
    });

    it('should have proper server URL format validation', () => {
      const serverProperty = ocLoginTool.inputSchema.properties.server;
      expect(serverProperty.format).toBe('uri');
    });
  });

  describe('handleOcLogin function', () => {
    describe('argument validation', () => {
      it('should reject missing required fields', async () => {
        const args: OcLoginArgs = {
          server: '',
          authMethod: 'token',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Missing required fields');
      });

      it('should reject invalid auth method', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'invalid' as any,
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid authMethod');
      });

      it('should reject token auth without token', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Token is required when authMethod is "token"');
      });

      it('should reject password auth without username', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'password',
          password: 'test-password',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain(
          'Username is required when authMethod is "password"'
        );
      });

      it('should reject password auth without password', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'password',
          username: 'test-user',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain(
          'Password is required when authMethod is "password"'
        );
      });

      it('should reject invalid timeout values', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token',
          timeout: 400,
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Timeout must be between 5 and 300 seconds');
      });

      it('should reject short tokens', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'short',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Token appears to be too short');
      });
    });

    describe('server URL validation', () => {
      it('should reject non-HTTPS URLs', async () => {
        const args: OcLoginArgs = {
          server: 'http://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid Server URL');
        expect(result.content[0].text).toContain('Must use HTTPS protocol');
      });

      it('should reject localhost URLs', async () => {
        const args: OcLoginArgs = {
          server: 'https://localhost:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid Server URL');
      });

      it('should reject private IP addresses', async () => {
        const args: OcLoginArgs = {
          server: 'https://192.168.1.100:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid Server URL');
      });

      it('should accept valid OpenShift server URLs', async () => {
        const validUrls = [
          'https://api.cluster.example.com:6443',
          'https://api.openshift.example.com:6443',
          'https://cluster.k8s.example.com:6443',
          'https://openshift.company.com:6443',
        ];

        for (const server of validUrls) {
          const args: OcLoginArgs = {
            server,
            authMethod: 'token',
            token: 'valid-token-12345',
          };

          mockManager.executeCommand.mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          });
          mockManager.executeCommand.mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          });
          mockManager.executeCommand.mockResolvedValueOnce({
            success: true,
            data: 'test-cluster',
          });

          const result = await handleOcLogin(args);
          expect(result.isError).toBeFalsy();
        }
      });
    });

    describe('token authentication', () => {
      it('should handle successful token login', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'sha256~valid-token-12345',
          context: 'test-cluster',
          namespace: 'my-project',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful. Using project "my-project".',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'Set namespace to my-project',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'system:serviceaccount:my-project:my-sa',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-cluster',
          });

        const result = await handleOcLogin(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('OpenShift Login Successful');
        expect(result.content[0].text).toContain(
          '**Server**: https://api.cluster.example.com:6443'
        );
        expect(result.content[0].text).toContain('**Auth Method**: token');
        expect(result.content[0].text).toContain('**Context**: test-cluster');
        expect(result.content[0].text).toContain(
          '**User**: system:serviceaccount:my-project:my-sa'
        );

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          [
            'login',
            'https://api.cluster.example.com:6443',
            '--token',
            'sha256~valid-token-12345',
            '--context',
            'test-cluster',
          ],
          { timeout: 30000 }
        );
      });

      it('should handle service account token format', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjU5...', // JWT token format
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'system:serviceaccount:default:default',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'api-cluster-example-com:6443',
          });

        const result = await handleOcLogin(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('OpenShift Login Successful');
      });
    });

    describe('password authentication', () => {
      it('should handle successful password login', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'password',
          username: 'developer',
          password: 'secure-password',
          namespace: 'development',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful. Using project "development".',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'Set namespace to development',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'developer',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'api-cluster-example-com:6443/developer',
          });

        const result = await handleOcLogin(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('OpenShift Login Successful');
        expect(result.content[0].text).toContain('**Auth Method**: password');
        expect(result.content[0].text).toContain('**User**: developer');

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          [
            'login',
            'https://api.cluster.example.com:6443',
            '--username',
            'developer',
            '--password',
            'secure-password',
          ],
          { timeout: 30000 }
        );
      });
    });

    describe('login options', () => {
      it('should handle insecure TLS skip option', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
          insecureSkipTlsVerify: true,
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        await handleOcLogin(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--insecure-skip-tls-verify=true']),
          expect.any(Object)
        );
      });

      it('should handle certificate authority option', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
          certificateAuthority: '/path/to/ca.crt',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        await handleOcLogin(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          expect.arrayContaining(['--certificate-authority', '/path/to/ca.crt']),
          expect.any(Object)
        );
      });

      it('should handle custom timeout', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
          timeout: 60,
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        await handleOcLogin(args);

        expect(mockManager.executeCommand).toHaveBeenCalledWith(expect.any(Array), {
          timeout: 60000,
        });
      });
    });

    describe('error handling', () => {
      it('should handle login command failure', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'invalid-token',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: "error: couldn't get current server API group list: Unauthorized",
        });

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('OpenShift Login Failed');
        expect(result.content[0].text).toContain('Authentication Error');
        expect(result.content[0].text).toContain('Verify token');
      });

      it('should handle certificate errors', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'error: x509: certificate signed by unknown authority',
        });

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('TLS/Certificate Error');
        expect(result.content[0].text).toContain('Certificate Authority');
        expect(result.content[0].text).toContain('insecureSkipTlsVerify');
      });

      it('should handle connection timeout errors', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.unreachable.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'error: dial tcp: i/o timeout',
        });

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Timeout Error');
        expect(result.content[0].text).toContain('Network connectivity');
      });

      it('should handle connection refused errors', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'error: dial tcp: connection refused',
        });

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Connection Error');
        expect(result.content[0].text).toContain('Server accessibility');
      });

      it('should handle unexpected errors', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        mockManager.executeCommand.mockRejectedValue(new Error('Network error'));

        const result = await handleOcLogin(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Unexpected Error During Login');
        expect(result.content[0].text).toContain('Network error');
      });
    });

    describe('namespace handling', () => {
      it('should set custom namespace after login', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
          namespace: 'custom-namespace',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'Set namespace to custom-namespace',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        const result = await handleOcLogin(args);

        expect(result.isError).toBeFalsy();
        expect(mockManager.executeCommand).toHaveBeenCalledWith(
          ['config', 'set-context', '--current', '--namespace', 'custom-namespace'],
          { timeout: 10000 }
        );
      });

      it('should skip namespace setting for default namespace', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
          namespace: 'default',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        await handleOcLogin(args);

        // Should not call set-context for default namespace
        expect(mockManager.executeCommand).not.toHaveBeenCalledWith(
          expect.arrayContaining(['config', 'set-context']),
          expect.any(Object)
        );
      });

      it('should handle namespace setting failure gracefully', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
          namespace: 'nonexistent-namespace',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: false,
            error: 'namespace "nonexistent-namespace" not found',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        // Mock console.warn to avoid actual console output
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await handleOcLogin(args);

        expect(result.isError).toBeFalsy(); // Login should still succeed
        expect(result.content[0].text).toContain('OpenShift Login Successful');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Warning: Failed to set default namespace to nonexistent-namespace'
          )
        );

        consoleSpy.mockRestore();
      });
    });

    describe('response formatting', () => {
      it('should format successful response with all details', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
          context: 'production-cluster',
          namespace: 'my-app',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful. Using project "my-app".',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'Set namespace to my-app',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'developer@company.com',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'production-cluster',
          });

        const result = await handleOcLogin(args);

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain(
          '**Server**: https://api.cluster.example.com:6443'
        );
        expect(result.content[0].text).toContain('**Auth Method**: token');
        expect(result.content[0].text).toContain('**Context**: production-cluster');
        expect(result.content[0].text).toContain('**Namespace**: my-app');
        expect(result.content[0].text).toContain('**User**: developer@company.com');
        expect(result.content[0].text).toContain('Verification Commands');
        expect(result.content[0].text).toContain('Next Steps');
        expect(result.content[0].text).toContain('Security Reminders');
      });

      it('should include troubleshooting commands in response', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        const result = await handleOcLogin(args);

        expect(result.content[0].text).toContain('oc whoami');
        expect(result.content[0].text).toContain('oc config current-context');
        expect(result.content[0].text).toContain('oc get projects');
        expect(result.content[0].text).toContain('oc cluster-info');
      });
    });

    describe('security features', () => {
      it('should include security reminders in success response', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'valid-token-12345',
        };

        mockManager.executeCommand
          .mockResolvedValueOnce({
            success: true,
            data: 'Login successful',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-user',
          })
          .mockResolvedValueOnce({
            success: true,
            data: 'test-context',
          });

        const result = await handleOcLogin(args);

        expect(result.content[0].text).toContain('Security Reminders');
        expect(result.content[0].text).toContain('Session expires');
        expect(result.content[0].text).toContain('oc logout');
      });

      it('should include security notes in error responses', async () => {
        const args: OcLoginArgs = {
          server: 'https://api.cluster.example.com:6443',
          authMethod: 'token',
          token: 'invalid-token',
        };

        mockManager.executeCommand.mockResolvedValue({
          success: false,
          error: 'Unauthorized',
        });

        const result = await handleOcLogin(args);

        expect(result.content[0].text).toContain('Never share authentication tokens');
        expect(result.content[0].text).toContain('Use service account tokens for automation');
        expect(result.content[0].text).toContain('Always use HTTPS in production');
      });
    });
  });
});
