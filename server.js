const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

// Supabase Configuration for Server-Side State (Reads environment variables)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dejjfscjvvfokpwjcgvp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlampmc2NqdnZmb2twd2pjZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTE2NjYsImV4cCI6MjEwMjk2NzY2Nn0.U4XNG3ngSF6MDvI1v56WkojMhucoRExeYERlcDcZdhk';

// In-memory cache for maintenance mode with 2.5s TTL
let maintenanceCache = {
  value: 'off',
  lastChecked: 0
};

async function checkMaintenanceMode() {
  const now = Date.now();
  if (now - maintenanceCache.lastChecked < 2500) {
    return maintenanceCache.value === 'on';
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.maintenance_mode&select=value`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0) {
        maintenanceCache.value = String(rows[0].value || '').toLowerCase().trim();
      } else {
        maintenanceCache.value = 'off';
      }
    }
  } catch (err) {
    console.warn('[server.js] Could not refresh maintenance mode from Supabase:', err.message);
  }

  maintenanceCache.lastChecked = now;
  return maintenanceCache.value === 'on';
}

const server = http.createServer(async (req, res) => {
  // 1. API: Get Current Products directly from Supabase (Single Source of Truth)
  if (req.method === 'GET' && req.url === '/api/products') {
    try {
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=sort_order.asc,code.asc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (!dbRes.ok) {
        throw new Error(`Supabase query failed with status ${dbRes.status}`);
      }
      const products = await dbRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(products));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1b. API: Upload Price List PDF (Admin Setting)
  if (req.method === 'POST' && req.url === '/api/upload-pdf') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (!buffer || buffer.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'No PDF file content received' }));
        }

        // 1. Write to local project directory
        const targetPath1 = path.join(__dirname, 'mathura_crackers_price_list.pdf');
        const targetPath2 = path.join(__dirname, 'mathura crackers_price_list.pdf');
        fs.writeFileSync(targetPath1, buffer);
        fs.writeFileSync(targetPath2, buffer);

        // 2. Upload to Supabase Storage bucket 'pricelists'
        let storageUrl = '/mathura_crackers_price_list.pdf';
        try {
          const timestamp = Date.now();
          const storageFilename = `mathura_price_list_${timestamp}.pdf`;
          const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/pricelists/${storageFilename}`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/pdf'
            },
            body: buffer
          });
          if (storageRes.ok) {
            storageUrl = `${SUPABASE_URL}/storage/v1/object/public/pricelists/${storageFilename}`;
          }
        } catch (storageErr) {
          console.warn('[server.js] Supabase storage upload warning:', storageErr.message);
        }

        // 3. Update Supabase settings table
        const fileSizeKb = Math.round(buffer.length / 1024) + ' KB';
        const nowIso = new Date().toISOString();
        const settingsUpdate = [
          { key: 'pdf_url', value: storageUrl, updated_at: nowIso },
          { key: 'pdf_filename', value: 'Mathura_Crackers_Price_List_2026.pdf', updated_at: nowIso },
          { key: 'pdf_filesize', value: fileSizeKb, updated_at: nowIso },
          { key: 'pdf_updated_at', value: nowIso, updated_at: nowIso },
          { key: 'pdf_enabled', value: 'true', updated_at: nowIso }
        ];

        try {
          await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(settingsUpdate)
          });
        } catch (settingsErr) {
          console.warn('[server.js] Settings update warning:', settingsErr.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          url: storageUrl,
          size: fileSizeKb,
          updated_at: nowIso,
          enabled: true
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 1c. API: Delete / Remove Price List PDF (Admin Setting)
  if (req.method === 'POST' && req.url === '/api/delete-pdf') {
    try {
      const nowIso = new Date().toISOString();
      const settingsUpdate = [
        { key: 'pdf_url', value: '', updated_at: nowIso },
        { key: 'pdf_filename', value: '', updated_at: nowIso },
        { key: 'pdf_filesize', value: '', updated_at: nowIso },
        { key: 'pdf_updated_at', value: nowIso, updated_at: nowIso },
        { key: 'pdf_enabled', value: 'false', updated_at: nowIso }
      ];

      await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(settingsUpdate)
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deleted: true, enabled: false }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. Static File Server (with path traversal protection)
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  // Prevent path traversal attacks
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  // Ensure resolved path is within the project directory
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    return res.end('<h1>403 Forbidden</h1>', 'utf-8');
  }

  // Block access to sensitive files
  const blockedPaths = ['server.js', '.env', '.git', 'scratch'];
  if (blockedPaths.some(blocked => safePath.includes(blocked))) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    return res.end('<h1>403 Forbidden</h1>', 'utf-8');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // 3. SERVER-SIDE MAINTENANCE MODE ENFORCEMENT
  // HTML page requests are strictly intercepted unless:
  // - It is admin.html or maintenance.html
  // - It has an authorized admin session cookie or bypass header
  if (ext === '.html' || reqPath === '/index.html' || reqPath === '/') {
    const cleanPath = safePath.replace(/^[\\\/]+/, '').toLowerCase();
    const isSpecialPath = cleanPath === 'admin.html' || cleanPath === 'maintenance.html';
    
    if (!isSpecialPath) {
      // Check for authorized admin session cookie bypass
      const cookies = req.headers['cookie'] || '';
      const hasAdminBypass = cookies.includes('mathura_admin_auth=mathuracracker') || cookies.includes('mathura_admin_auth=mathuracrackers');
      
      if (!hasAdminBypass) {
        const isMaintenanceOn = await checkMaintenanceMode();
        if (isMaintenanceOn) {
          const maintenanceFilePath = path.join(__dirname, 'maintenance.html');
          fs.readFile(maintenanceFilePath, (err, content) => {
            if (err) {
              res.writeHead(503, { 'Content-Type': 'text/html' });
              res.end('<h1>503 Service Unavailable - Scheduled Maintenance</h1>');
            } else {
              res.writeHead(503, {
                'Content-Type': 'text/html; charset=UTF-8',
                'Retry-After': '3600',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'X-Frame-Options': 'SAMEORIGIN',
                'X-Content-Type-Options': 'nosniff'
              });
              res.end(content, 'utf-8');
            }
          });
          return;
        }
      }
    }
  }

  // 4. Serve requested static file with security headers
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`, 'utf-8');
      }
    } else {
      const headers = {
        'Content-Type': contentType,
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      };
      if (ext === '.pdf') {
        headers['Content-Disposition'] = 'attachment; filename="mathura_crackers_price_list_2026.pdf"';
      }
      res.writeHead(200, headers);
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/ (with Server-Side Maintenance Mode Enforcer)`);
});
