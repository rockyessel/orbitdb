// api/index.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import server from '../src/server';

export default async (req: VercelRequest, res: VercelResponse) => {
  // Forward the request to your Express server
  server(req, res);
};
