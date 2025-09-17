/**
 * Shared validation helper functions for OpenShift tools
 * Provides common validation patterns and utilities
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate that required parameters are provided
 */
export function validateRequiredParams(
  params: Record<string, any>,
  requiredFields: string[]
): ValidationResult {
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (params[field] === undefined || params[field] === null || params[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate OpenShift resource name format
 */
export function validateResourceName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Resource name must be a non-empty string' };
  }

  // OpenShift resource names must follow DNS-1123 label format
  const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  
  if (!nameRegex.test(name)) {
    return {
      valid: false,
      error: 'Resource name must consist of lower case alphanumeric characters or hyphens, and must start and end with an alphanumeric character',
    };
  }

  if (name.length > 253) {
    return {
      valid: false,
      error: 'Resource name must be 253 characters or less',
    };
  }

  return { valid: true };
}

/**
 * Validate OpenShift namespace name format
 */
export function validateNamespace(namespace: string): ValidationResult {
  if (!namespace || typeof namespace !== 'string') {
    return { valid: false, error: 'Namespace must be a non-empty string' };
  }

  // Same rules as resource names for namespaces
  return validateResourceName(namespace);
}

/**
 * Validate label selector format
 */
export function validateLabelSelector(selector: string): ValidationResult {
  if (!selector || typeof selector !== 'string') {
    return { valid: true }; // Label selector is optional
  }

  // Basic validation for label selector format
  // More comprehensive validation would require parsing the entire selector syntax
  const basicLabelRegex = /^[a-zA-Z0-9._/-]+(=[a-zA-Z0-9._/-]+)?(,[a-zA-Z0-9._/-]+(=[a-zA-Z0-9._/-]+)?)*$/;
  
  if (!basicLabelRegex.test(selector.replace(/\s/g, ''))) {
    return {
      valid: false,
      error: 'Invalid label selector format. Use key=value pairs separated by commas',
    };
  }

  return { valid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTP and HTTPS protocols for security
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        valid: false,
        error: 'URL must use HTTP or HTTPS protocol',
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Validate Git repository URL
 */
export function validateGitUrl(gitUrl: string): ValidationResult {
  const urlValidation = validateUrl(gitUrl);
  if (!urlValidation.valid) {
    return urlValidation;
  }

  try {
    const url = new URL(gitUrl);
    
    // Check for common Git hosting patterns
    const gitHostPatterns = [
      /^github\.com$/,
      /^gitlab\.com$/,
      /^bitbucket\.org$/,
      /.*\.git$/,
    ];

    const isGitHost = gitHostPatterns.some(pattern => 
      pattern.test(url.hostname) || pattern.test(url.pathname)
    );

    if (!isGitHost && !url.pathname.includes('.git')) {
      return {
        valid: true,
        warnings: ['URL does not appear to be a Git repository. Ensure it points to a valid Git repository.'],
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid Git URL format' };
  }
}

/**
 * Validate file path existence and readability
 */
export function validateFilePath(filePath: string, description: string = 'File'): ValidationResult {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: `${description} path must be a non-empty string` };
  }

  // Basic path validation - actual file existence should be checked at runtime
  if (filePath.includes('..') || filePath.includes('~')) {
    return {
      valid: false,
      error: `${description} path contains potentially unsafe characters`,
    };
  }

  return { valid: true };
}

/**
 * Validate port number or name
 */
export function validatePort(port: string | number): ValidationResult {
  if (port === undefined || port === null || port === '') {
    return { valid: true }; // Port is often optional
  }

  // If it's a number, validate port range
  if (typeof port === 'number' || /^\d+$/.test(port.toString())) {
    const portNum = typeof port === 'number' ? port : parseInt(port.toString());
    
    if (portNum < 1 || portNum > 65535) {
      return {
        valid: false,
        error: 'Port number must be between 1 and 65535',
      };
    }
    
    return { valid: true };
  }

  // If it's a string, validate as port name
  const portNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!portNameRegex.test(port.toString())) {
    return {
      valid: false,
      error: 'Port name must consist of lowercase alphanumeric characters and hyphens',
    };
  }

  return { valid: true };
}

/**
 * Validate resource type format
 */
export function validateResourceType(resourceType: string): ValidationResult {
  if (!resourceType || typeof resourceType !== 'string') {
    return { valid: false, error: 'Resource type must be a non-empty string' };
  }

  // Basic validation - resource types should be lowercase and may contain dots for API groups
  const resourceTypeRegex = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
  
  if (!resourceTypeRegex.test(resourceType)) {
    return {
      valid: false,
      error: 'Invalid resource type format',
    };
  }

  return { valid: true };
}

/**
 * Validate timeout format (e.g., "30s", "5m", "1h")
 */
export function validateTimeout(timeout: string): ValidationResult {
  if (!timeout || typeof timeout !== 'string') {
    return { valid: true }; // Timeout is often optional
  }

  const timeoutRegex = /^(\d+)([smh])$/;
  const match = timeout.match(timeoutRegex);

  if (!match) {
    return {
      valid: false,
      error: 'Timeout must be in format like "30s", "5m", or "1h"',
    };
  }

  const [, value, unit] = match;
  const numValue = parseInt(value);

  if (numValue <= 0) {
    return {
      valid: false,
      error: 'Timeout value must be greater than 0',
    };
  }

  // Reasonable limits
  const maxValues = { s: 3600, m: 60, h: 24 }; // max 1 hour in seconds, 60 minutes, 24 hours
  if (numValue > maxValues[unit as keyof typeof maxValues]) {
    return {
      valid: false,
      error: `Timeout value too large for unit ${unit}`,
    };
  }

  return { valid: true };
}

/**
 * Validate key-value pairs (for labels, annotations, environment variables)
 */
export function validateKeyValuePairs(
  pairs: string[],
  pairType: string = 'key-value pair'
): ValidationResult {
  if (!pairs || !Array.isArray(pairs)) {
    return { valid: true }; // Often optional
  }

  const warnings: string[] = [];

  for (const pair of pairs) {
    if (typeof pair !== 'string') {
      return {
        valid: false,
        error: `Each ${pairType} must be a string`,
      };
    }

    if (!pair.includes('=')) {
      return {
        valid: false,
        error: `Each ${pairType} must be in KEY=VALUE format`,
      };
    }

    const [key, ...valueParts] = pair.split('=');
    const value = valueParts.join('='); // Handle values with = in them

    if (!key || key.trim() === '') {
      return {
        valid: false,
        error: `${pairType} key cannot be empty`,
      };
    }

    // Validate key format (basic validation)
    const keyRegex = /^[a-zA-Z0-9._/-]+$/;
    if (!keyRegex.test(key)) {
      warnings.push(`Key "${key}" contains potentially invalid characters`);
    }
  }

  return { 
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate multiple parameters at once
 */
export function validateMultiple(validations: Array<() => ValidationResult>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const validation of validations) {
    const result = validation();
    if (!result.valid) {
      errors.push(result.error!);
    }
    if (result.warnings) {
      warnings.push(...result.warnings);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; '),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate JSON or YAML content
 */
export function validateManifestContent(content: string): ValidationResult {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Manifest content must be a non-empty string' };
  }

  // Try to parse as JSON first
  try {
    JSON.parse(content);
    return { valid: true };
  } catch (jsonError) {
    // If JSON parsing fails, assume it might be YAML
    // Basic YAML validation - check for suspicious content
    if (content.includes('{{') || content.includes('<%')) {
      return {
        valid: false,
        error: 'Manifest content contains template syntax that may not be valid',
      };
    }

    // Basic structure check for YAML
    if (!content.includes(':') && !content.includes('-')) {
      return {
        valid: false,
        error: 'Manifest content does not appear to be valid JSON or YAML',
      };
    }

    return { valid: true };
  }
}
