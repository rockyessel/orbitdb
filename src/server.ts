import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { createLibp2p } from 'libp2p';
import { createHelia } from 'helia';
// @ts-ignore
import { createOrbitDB } from '@orbitdb/core';
import { LevelBlockstore } from 'blockstore-level';
import { Libp2pOptions } from './config/libp2p.js';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('Dir: ', path.join(__dirname, '../public'));

const PORT = process.env.PORT || 8000;

const server = express();

server.use(morgan('dev'));
server.use(cors());

server.use(express.json());
server.use(express.urlencoded({ extended: false }));
server.use(express.static(path.join(__dirname, '../public')));

// server.use('/api/v1/tts', TTS);

// Set custom storage path for IPFS and OrbitDB
const storagePath = path.join(__dirname, '../public/tmp');

let db: any
let orbitdb: any;
let ipfs: any;

// Initialize IPFS, Helia, and OrbitDB once and keep them running
const initialize = async () => {
  const blockstore = new LevelBlockstore(path.join(storagePath, 'ipfs/blocks'));
  const libp2p = await createLibp2p(Libp2pOptions);
  ipfs = await createHelia({ libp2p, blockstore });

  orbitdb = await createOrbitDB({
    ipfs,
    directory: path.join(storagePath, 'orbitdb'),
  });
  db = await orbitdb.open('deconnect-orbitdb', { type: 'documents' });

  console.log('deconnect-orbitdb:-:address: ', db.address);
};

// Ensure the services are initialized before handling requests
initialize()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  });

// API endpoint to get all documents
server.get('/api/documents', async (_req, res) => {
  try {
    console.log('db: ', db);
    const allDocs = await db.all();
    console.log('allDocs: ', allDocs);
    res.json(allDocs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// API endpoint to add a new document
server.post('/api/documents', async (req, res) => {
  try {
    console.log(req.body);
    const { doc } = req.body;
    console.log('doc: ', doc);
    const cid = await db.put(doc);
    console.log('cid: ', cid);
    res.json({ cid });
  } catch (error) {
    res.status(500).json({ error });
  }
});

// API endpoint to get a document by CID
server.get('/api/documents/:cid', async (req, res) => {
  try {
    console.log('req.params.cid: ', req.params.cid);
    const doc = await db.get(req.params.cid);
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Gracefully handle shutdown
const shutdown = async () => {
  if (db) await db.close();
  if (orbitdb) await orbitdb.stop();
  if (ipfs) await ipfs.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
