import { getDiscoveryConfiguration } from '../../../lib/discovery';

export function GET() {
  const configuration = getDiscoveryConfiguration();
  return Response.json({ ...configuration, status: configuration.configured ? 'ready' : 'fallback_ready' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
