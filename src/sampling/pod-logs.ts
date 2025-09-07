import { OpenShiftManager } from '../utils/openshift-manager.js';

export interface PodLogsSamplingRequest {
  podName: string;
  namespace: string;
  containerName?: string;
  maxLines?: number;
  since?: string;
  includePrevious?: boolean;
  context?: string;
}

export async function samplePodLogs(request: PodLogsSamplingRequest): Promise<string> {
  const manager = OpenShiftManager.getInstance();
  const {
    podName,
    namespace,
    containerName,
    maxLines = 100,
    since = '1h',
    includePrevious = true,
    context,
  } = request;

  try {
    const logSamples: string[] = [];

    // Add header with sampling information
    logSamples.push(`# Pod Logs Sample Analysis`);
    logSamples.push(`# Pod: ${podName}`);
    logSamples.push(`# Namespace: ${namespace}`);
    logSamples.push(`# Container: ${containerName || 'default'}`);
    logSamples.push(`# Max Lines: ${maxLines}`);
    logSamples.push(`# Time Range: Last ${since}`);
    logSamples.push(`# Include Previous: ${includePrevious}`);
    logSamples.push(`# Sampled At: ${new Date().toISOString()}`);
    logSamples.push('');

    // Sample current logs
    logSamples.push('## 📋 CURRENT CONTAINER LOGS');
    logSamples.push('');

    const currentLogsArgs = [
      'logs',
      podName,
      '-n',
      namespace,
      '--tail',
      maxLines.toString(),
      '--since',
      since,
      '--timestamps',
    ];

    if (containerName) {
      currentLogsArgs.push('-c', containerName);
    }

    const currentLogsResult = await manager.executeCommand(currentLogsArgs, { context });

    if (currentLogsResult.success) {
      if (currentLogsResult.data && currentLogsResult.data.trim()) {
        logSamples.push('```');
        logSamples.push(currentLogsResult.data);
        logSamples.push('```');
      } else {
        logSamples.push('*No current logs available*');
      }
    } else {
      logSamples.push(`*Error retrieving current logs: ${currentLogsResult.error}*`);
    }

    logSamples.push('');

    // Sample previous logs if requested and available
    if (includePrevious) {
      logSamples.push('## 📜 PREVIOUS CONTAINER LOGS (Before Last Restart)');
      logSamples.push('');

      const previousLogsArgs = [
        'logs',
        podName,
        '-n',
        namespace,
        '--previous',
        '--tail',
        maxLines.toString(),
        '--timestamps',
      ];

      if (containerName) {
        previousLogsArgs.push('-c', containerName);
      }

      const previousLogsResult = await manager.executeCommand(previousLogsArgs, { context });

      if (previousLogsResult.success) {
        if (previousLogsResult.data && previousLogsResult.data.trim()) {
          logSamples.push('```');
          logSamples.push(previousLogsResult.data);
          logSamples.push('```');
        } else {
          logSamples.push('*No previous logs available (first run or logs not retained)*');
        }
      } else {
        logSamples.push(`*Previous logs not available: ${previousLogsResult.error}*`);
      }

      logSamples.push('');
    }

    // Add pod status information for context
    logSamples.push('## 🔍 POD STATUS CONTEXT');
    logSamples.push('');

    const podStatusResult = await manager.executeCommand(
      ['get', 'pod', podName, '-n', namespace, '-o', 'jsonpath={.status.containerStatuses[*]}'],
      { context }
    );

    if (podStatusResult.success && podStatusResult.data) {
      try {
        const containerStatuses = JSON.parse(`[${podStatusResult.data}]`);
        containerStatuses.forEach((status: any, index: number) => {
          logSamples.push(`### Container ${index + 1}: ${status.name || 'unknown'}`);
          logSamples.push(`- **State**: ${Object.keys(status.state || {})[0] || 'unknown'}`);
          logSamples.push(`- **Ready**: ${status.ready ? 'Yes' : 'No'}`);
          logSamples.push(`- **Restart Count**: ${status.restartCount || 0}`);
          logSamples.push(`- **Image**: ${status.image || 'unknown'}`);

          if (status.lastState && status.lastState.terminated) {
            logSamples.push(
              `- **Last Exit Code**: ${status.lastState.terminated.exitCode || 'unknown'}`
            );
            logSamples.push(
              `- **Last Exit Reason**: ${status.lastState.terminated.reason || 'unknown'}`
            );
            logSamples.push(
              `- **Last Finished**: ${status.lastState.terminated.finishedAt || 'unknown'}`
            );
          }

          logSamples.push('');
        });
      } catch (parseError) {
        logSamples.push(`*Error parsing container status: ${parseError}*`);
      }
    }

    // Add recent events for additional context
    logSamples.push('## 📅 RECENT EVENTS');
    logSamples.push('');

    const eventsResult = await manager.executeCommand(
      [
        'get',
        'events',
        '-n',
        namespace,
        '--field-selector',
        `involvedObject.name=${podName}`,
        '--sort-by',
        '.lastTimestamp',
        '-o',
        'custom-columns=TIME:.lastTimestamp,TYPE:.type,REASON:.reason,MESSAGE:.message',
        '--no-headers',
      ],
      { context }
    );

    if (eventsResult.success && eventsResult.data && eventsResult.data.trim()) {
      logSamples.push('```');
      logSamples.push(eventsResult.data);
      logSamples.push('```');
    } else {
      logSamples.push('*No recent events found for this pod*');
    }

    logSamples.push('');

    // Add analysis hints based on common patterns
    logSamples.push('## 💡 ANALYSIS HINTS');
    logSamples.push('');
    logSamples.push('**Look for these common CrashLoopBackOff patterns in the logs above:**');
    logSamples.push('');
    logSamples.push('🔍 **Application Errors**:');
    logSamples.push('- Exception stack traces');
    logSamples.push('- "Error:", "Exception:", "Fatal:" messages');
    logSamples.push('- Database connection failures');
    logSamples.push('- Missing environment variables');
    logSamples.push('');
    logSamples.push('🔍 **Resource Issues**:');
    logSamples.push('- "OOMKilled" or memory-related errors');
    logSamples.push('- "signal: killed" messages');
    logSamples.push('- CPU throttling indicators');
    logSamples.push('');
    logSamples.push('🔍 **Configuration Issues**:');
    logSamples.push('- File not found errors');
    logSamples.push('- Permission denied messages');
    logSamples.push('- Invalid configuration format errors');
    logSamples.push('');
    logSamples.push('🔍 **Network/Dependency Issues**:');
    logSamples.push('- Connection timeout errors');
    logSamples.push('- DNS resolution failures');
    logSamples.push('- Service unavailable messages');

    return logSamples.join('\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `# Pod Logs Sampling Error

## Error Details
- **Pod**: ${podName}
- **Namespace**: ${namespace}
- **Error**: ${errorMessage}
- **Timestamp**: ${new Date().toISOString()}

## Troubleshooting
1. Verify the pod exists: \`oc get pod ${podName} -n ${namespace}\`
2. Check namespace exists: \`oc get namespace ${namespace}\`
3. Verify permissions: Ensure you have access to read logs in this namespace
4. Check pod status: \`oc describe pod ${podName} -n ${namespace}\`
`;
  }
}
