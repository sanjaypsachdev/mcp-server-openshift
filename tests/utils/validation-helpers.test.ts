import { describe, it, expect } from 'vitest';
import {
  validateRequiredParams,
  validateResourceName,
  validateNamespace,
  validateLabelSelector,
  validateUrl,
  validateGitUrl,
  validateFilePath,
  validatePort,
  validateResourceType,
  validateTimeout,
  validateKeyValuePairs,
  validateMultiple,
  validateManifestContent,
} from '../../src/utils/validation-helpers.js';

describe('validation-helpers', () => {
  describe('validateRequiredParams', () => {
    it('should pass when all required params are provided', () => {
      const result = validateRequiredParams({ name: 'test', type: 'pod' }, ['name', 'type']);
      expect(result.valid).toBe(true);
    });

    it('should fail when required params are missing', () => {
      const result = validateRequiredParams({ name: 'test' }, ['name', 'type', 'namespace']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required fields: type, namespace');
    });

    it('should fail when required params are empty strings', () => {
      const result = validateRequiredParams({ name: '', type: 'pod' }, ['name', 'type']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required fields: name');
    });
  });

  describe('validateResourceName', () => {
    it('should pass for valid resource names', () => {
      expect(validateResourceName('my-app').valid).toBe(true);
      expect(validateResourceName('test123').valid).toBe(true);
      expect(validateResourceName('a').valid).toBe(true);
      expect(validateResourceName('my-app-v2').valid).toBe(true);
    });

    it('should fail for invalid resource names', () => {
      expect(validateResourceName('').valid).toBe(false);
      expect(validateResourceName('My-App').valid).toBe(false); // uppercase
      expect(validateResourceName('-my-app').valid).toBe(false); // starts with hyphen
      expect(validateResourceName('my-app-').valid).toBe(false); // ends with hyphen
      expect(validateResourceName('my_app').valid).toBe(false); // underscore
      expect(validateResourceName('my.app').valid).toBe(false); // dot
    });

    it('should fail for names that are too long', () => {
      const longName = 'a'.repeat(254);
      expect(validateResourceName(longName).valid).toBe(false);
    });
  });

  describe('validateNamespace', () => {
    it('should use same rules as resource names', () => {
      expect(validateNamespace('my-namespace').valid).toBe(true);
      expect(validateNamespace('My-Namespace').valid).toBe(false);
    });
  });

  describe('validateLabelSelector', () => {
    it('should pass for valid label selectors', () => {
      expect(validateLabelSelector('app=test').valid).toBe(true);
      expect(validateLabelSelector('app=test,version=v1').valid).toBe(true);
      expect(validateLabelSelector('environment').valid).toBe(true);
      expect(validateLabelSelector('').valid).toBe(true); // empty is valid
    });

    it('should fail for invalid label selectors', () => {
      expect(validateLabelSelector('app=').valid).toBe(false);
      expect(validateLabelSelector('=value').valid).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should pass for valid URLs', () => {
      expect(validateUrl('https://example.com').valid).toBe(true);
      expect(validateUrl('http://localhost:8080').valid).toBe(true);
      expect(validateUrl('https://api.github.com/repos/user/repo').valid).toBe(true);
    });

    it('should fail for invalid URLs', () => {
      expect(validateUrl('').valid).toBe(false);
      expect(validateUrl('not-a-url').valid).toBe(false);
      expect(validateUrl('ftp://example.com').valid).toBe(false); // wrong protocol
    });
  });

  describe('validateGitUrl', () => {
    it('should pass for valid Git URLs', () => {
      expect(validateGitUrl('https://github.com/user/repo.git').valid).toBe(true);
      expect(validateGitUrl('https://gitlab.com/user/repo').valid).toBe(true);
      expect(validateGitUrl('https://bitbucket.org/user/repo').valid).toBe(true);
    });

    it('should pass with warnings for non-obvious Git URLs', () => {
      const result = validateGitUrl('https://example.com/repo');
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('does not appear to be a Git repository');
    });

    it('should fail for invalid URLs', () => {
      expect(validateGitUrl('not-a-url').valid).toBe(false);
    });
  });

  describe('validateFilePath', () => {
    it('should pass for valid file paths', () => {
      expect(validateFilePath('/path/to/file.txt').valid).toBe(true);
      expect(validateFilePath('relative/path.yaml').valid).toBe(true);
      expect(validateFilePath('./config.json').valid).toBe(true);
    });

    it('should fail for potentially unsafe paths', () => {
      expect(validateFilePath('../../../etc/passwd').valid).toBe(false);
      expect(validateFilePath('~/secret').valid).toBe(false);
    });

    it('should fail for empty paths', () => {
      expect(validateFilePath('').valid).toBe(false);
    });
  });

  describe('validatePort', () => {
    it('should pass for valid port numbers', () => {
      expect(validatePort(80).valid).toBe(true);
      expect(validatePort('8080').valid).toBe(true);
      expect(validatePort(65535).valid).toBe(true);
    });

    it('should pass for valid port names', () => {
      expect(validatePort('http').valid).toBe(true);
      expect(validatePort('https').valid).toBe(true);
      expect(validatePort('web-port').valid).toBe(true);
    });

    it('should fail for invalid port numbers', () => {
      expect(validatePort(0).valid).toBe(false);
      expect(validatePort(65536).valid).toBe(false);
      expect(validatePort(-1).valid).toBe(false);
    });

    it('should fail for invalid port names', () => {
      expect(validatePort('HTTP').valid).toBe(false); // uppercase
      expect(validatePort('web_port').valid).toBe(false); // underscore
    });

    it('should pass for empty port (optional)', () => {
      expect(validatePort('').valid).toBe(true);
    });
  });

  describe('validateResourceType', () => {
    it('should pass for valid resource types', () => {
      expect(validateResourceType('pod').valid).toBe(true);
      expect(validateResourceType('deployment').valid).toBe(true);
      expect(validateResourceType('route.openshift.io').valid).toBe(true);
    });

    it('should fail for invalid resource types', () => {
      expect(validateResourceType('').valid).toBe(false);
      expect(validateResourceType('Pod').valid).toBe(false); // uppercase
      expect(validateResourceType('my_resource').valid).toBe(false); // underscore
    });
  });

  describe('validateTimeout', () => {
    it('should pass for valid timeout formats', () => {
      expect(validateTimeout('30s').valid).toBe(true);
      expect(validateTimeout('5m').valid).toBe(true);
      expect(validateTimeout('1h').valid).toBe(true);
    });

    it('should fail for invalid timeout formats', () => {
      expect(validateTimeout('30').valid).toBe(false); // no unit
      expect(validateTimeout('5d').valid).toBe(false); // invalid unit
      expect(validateTimeout('0s').valid).toBe(false); // zero value
      expect(validateTimeout('-5s').valid).toBe(false); // negative
    });

    it('should fail for values that are too large', () => {
      expect(validateTimeout('3601s').valid).toBe(false); // > 1 hour in seconds
      expect(validateTimeout('61m').valid).toBe(false); // > 60 minutes
      expect(validateTimeout('25h').valid).toBe(false); // > 24 hours
    });

    it('should pass for empty timeout (optional)', () => {
      expect(validateTimeout('').valid).toBe(true);
    });
  });

  describe('validateKeyValuePairs', () => {
    it('should pass for valid key-value pairs', () => {
      const result = validateKeyValuePairs(['key=value', 'app=test']);
      expect(result.valid).toBe(true);
    });

    it('should pass for values with equals signs', () => {
      const result = validateKeyValuePairs(['config=key=value']);
      expect(result.valid).toBe(true);
    });

    it('should fail for invalid formats', () => {
      expect(validateKeyValuePairs(['keyvalue']).valid).toBe(false);
      expect(validateKeyValuePairs(['=value']).valid).toBe(false);
      expect(validateKeyValuePairs(['key=']).valid).toBe(true); // empty value is valid
    });

    it('should warn for potentially invalid keys', () => {
      const result = validateKeyValuePairs(['key@=value']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should pass for empty array (optional)', () => {
      expect(validateKeyValuePairs([]).valid).toBe(true);
    });
  });

  describe('validateMultiple', () => {
    it('should pass when all validations pass', () => {
      const result = validateMultiple([
        () => ({ valid: true }),
        () => ({ valid: true, warnings: ['warning1'] }),
      ]);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('warning1');
    });

    it('should fail when any validation fails', () => {
      const result = validateMultiple([
        () => ({ valid: true }),
        () => ({ valid: false, error: 'error1' }),
        () => ({ valid: false, error: 'error2' }),
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('error1; error2');
    });

    it('should collect warnings from all validations', () => {
      const result = validateMultiple([
        () => ({ valid: true, warnings: ['warning1'] }),
        () => ({ valid: true, warnings: ['warning2'] }),
      ]);
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(['warning1', 'warning2']);
    });
  });

  describe('validateManifestContent', () => {
    it('should pass for valid JSON', () => {
      const json = JSON.stringify({ apiVersion: 'v1', kind: 'Pod' });
      expect(validateManifestContent(json).valid).toBe(true);
    });

    it('should pass for basic YAML-like content', () => {
      const yaml = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: test';
      expect(validateManifestContent(yaml).valid).toBe(true);
    });

    it('should fail for empty content', () => {
      expect(validateManifestContent('').valid).toBe(false);
    });

    it('should fail for content with template syntax', () => {
      expect(validateManifestContent('apiVersion: {{ .version }}').valid).toBe(false);
      expect(validateManifestContent('name: <%= name %>').valid).toBe(false);
    });

    it('should fail for content that is neither JSON nor YAML-like', () => {
      expect(validateManifestContent('this is just plain text').valid).toBe(false);
    });
  });
});
