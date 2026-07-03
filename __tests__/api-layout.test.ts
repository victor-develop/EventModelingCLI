import * as http from 'node:http';
import type { Server } from 'node:http';
import { createServerApp } from '../src/cli/serve';
import { createOrderWorkspace } from './helpers/order-workspace';

describe('/api/layout', () => {
  let server: Server | undefined;

  afterEach((done) => {
    if (!server) {
      done();
      return;
    }
    server.close(() => {
      server = undefined;
      done();
    });
  });

  test('returns a VisualizationSnapshot', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, '/api/layout?focus=cmd.submit-order&direction=both&hops=2');

      expect(body.status).toBe(200);
      expect(body.json.focusNodeId).toBe('cmd.submit-order');
      expect(body.json.projectName).toBe('Order Management');
      expect(Array.isArray(body.json.occurrences)).toBe(true);
      expect(Array.isArray(body.json.renderedEdges)).toBe(true);
      expect(body.json.laneMap).toEqual({
        shared: 'shared',
        commandViewModel: 'command / viewModel',
        event: 'event',
      });
    } finally {
      cleanup();
    }
  });

  test('returns structured NOT_FOUND errors', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, '/api/layout?focus=cmd.missing&direction=both&hops=2');

      expect(body.status).toBe(404);
      expect(body.json).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Focus node not found: cmd.missing',
          details: { focus: 'cmd.missing' },
        },
      });
    } finally {
      cleanup();
    }
  });
});

function getJson(server: Server, path: string): Promise<{ status: number; json: any }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server has no port');

  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: address.port, path }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode ?? 0,
          json: JSON.parse(data),
        });
      });
    }).on('error', reject);
  });
}
