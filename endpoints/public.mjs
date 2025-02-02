import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { access } from 'fs/promises';

// Serve files from public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

export default (app) => {
  app.get('/public/:file', async (req, res) => {
    try {
      const filePath = path.join(publicDir, req.params.file);
      
      // Prevent directory traversal attacks
      if (!filePath.startsWith(publicDir)) {
        return res.status(403).send('Forbidden');
      }

      // Check if file exists
      try {
        await access(filePath);
      } catch (err) {
        return res.status(404).send('File not found');
      }

      // Get file mime type
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      // Stream the file
      const fileStream = createReadStream(filePath);
      res.setHeader('Content-Type', contentType);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).send('Internal Server Error');
    }
  });
};