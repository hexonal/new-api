const TOOL_NAME = 'newapi_health';

const log = (...args) => {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[webmcp]', ...args);
  }
};

async function registerWithFallback(modelContext, toolDef, handler) {
  if (!modelContext || typeof modelContext.registerTool !== 'function') {
    return false;
  }

  // Different WebMCP runtimes use slightly different register signatures.
  const attempts = [
    () => modelContext.registerTool(toolDef, handler),
    () => modelContext.registerTool(toolDef.name, toolDef, handler),
    () => modelContext.registerTool(toolDef.name, handler),
  ];

  for (const run of attempts) {
    try {
      await run();
      return true;
    } catch (error) {
      log('registerTool attempt failed:', error?.message || error);
    }
  }

  return false;
}

export async function setupWebMcpTools() {
  if (typeof window === 'undefined') return;

  const modelContext = window.navigator?.modelContext;
  if (!modelContext) {
    log('navigator.modelContext unavailable');
    return;
  }

  const toolDef = {
    name: TOOL_NAME,
    description: 'new-api web runtime health check',
    inputSchema: {
      type: 'object',
      properties: {
        echo: { type: 'string', description: 'optional echo text' },
      },
    },
  };

  const handler = async (args = {}) => ({
    ok: true,
    app: 'new-api',
    timestamp: new Date().toISOString(),
    echo: args.echo || '',
    href: window.location.href,
  });

  const registered = await registerWithFallback(modelContext, toolDef, handler);
  if (registered) {
    log(`registered tool: ${TOOL_NAME}`);
  } else {
    log(`failed to register tool: ${TOOL_NAME}`);
  }
}
