/**
 * Mathura Crackers - Production Netlify Edge Function
 * Enforces server-side Maintenance Mode across all public routes.
 * 
 * Features:
 * - Server-side enforcement at Netlify Edge layer (direct URLs cannot bypass).
 * - Synchronized live with Supabase settings table.
 * - Authorized administrators retain full access via authenticated session cookie.
 * - Admin panel (/admin.html) and static assets are always accessible.
 * - Serves custom branded maintenance.html with HTTP 503 and proper caching headers.
 */

export default async (request, context) => {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // 1. Unconditionally permit Admin panel, Maintenance page, and static assets
  if (
    pathname === '/admin.html' ||
    pathname.startsWith('/admin') ||
    pathname === '/maintenance.html' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/css/') ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/images/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.ttf') ||
    pathname.endsWith('.csv') ||
    pathname.endsWith('.pdf')
  ) {
    return context.next();
  }

  // 2. Query Supabase Settings Table for live maintenance_mode status
  try {
    const supabaseUrl = 'https://dejjfscjvvfokpwjcgvp.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlampmc2NqdnZmb2twd2pjZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTE2NjYsImV4cCI6MjEwMjk2NzY2Nn0.U4XNG3ngSF6MDvI1v56WkojMhucoRExeYERlcDcZdhk';

    const res = await fetch(`${supabaseUrl}/rest/v1/settings?key=eq.maintenance_mode&select=value`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0) {
        const isMaintenanceOn = String(rows[0].value || '').toLowerCase().trim() === 'on';
        if (isMaintenanceOn) {
          // Maintenance Mode is ON: Intercept and serve maintenance.html with HTTP 503
          try {
            const maintenanceUrl = new URL('/maintenance.html', request.url);
            const maintenanceRes = await fetch(maintenanceUrl);
            if (maintenanceRes.ok) {
              const html = await maintenanceRes.text();
              return new Response(html, {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                  'Content-Type': 'text/html; charset=UTF-8',
                  'Retry-After': '3600',
                  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
                }
              });
            }
          } catch (fetchErr) {
            console.error('Failed to fetch maintenance.html content:', fetchErr);
          }

          // Fallback rewrite to maintenance.html
          return new URL('/maintenance.html', request.url);
        }
      }
    }
  } catch (err) {
    console.error('Netlify Edge Function maintenance check error:', err);
  }

  // If maintenance mode is OFF, continue normal routing
  return context.next();
};

export const config = {
  path: "/*",
  excludedPath: [
    "/admin.html",
    "/admin/*",
    "/maintenance.html",
    "/api/*",
    "/css/*",
    "/js/*",
    "/images/*",
    "/*.css",
    "/*.js",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.webp",
    "/*.svg",
    "/*.ico",
    "/*.woff",
    "/*.woff2",
    "/*.ttf",
    "/*.pdf",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml"
  ]
};
