import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export async function createFixtureServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const fixturesDir = path.resolve('tests/fixtures');

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';

    if (url.startsWith('/files/')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="mock.pdf"');
      res.end('%PDF-1.4 mock');
      return;
    }

    const route = url === '/' ? '/download.html' : url;
    const filePath = path.join(fixturesDir, route.replace(/^\//, ''));

    try {
      const content = await fs.readFile(filePath);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(content);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve server address');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
