/**
 * Ashwanth Crackers - Supabase Cloud Database Configuration
 * Connected to project: crackers (dejjfscjvvfokpwjcgvp)
 */

const SUPABASE_CONFIG = {
  url: 'https://dejjfscjvvfokpwjcgvp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlampmc2NqdnZmb2twd2pjZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTE2NjYsImV4cCI6MjEwMjk2NzY2Nn0.U4XNG3ngSF6MDvI1v56WkojMhucoRExeYERlcDcZdhk'
};

// Initialize Supabase Client
let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    return supabaseClient;
  }

  // Fallback REST fetch client if CDN fails or in headless node environment
  return {
    async from(table) {
      return {
        select: async () => {
          const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${table}?select=*`, {
            headers: {
              'apikey': SUPABASE_CONFIG.anonKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
            }
          });
          const data = await res.json();
          return { data, error: res.ok ? null : data };
        }
      };
    }
  };
}

if (typeof window !== 'undefined') {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.getSupabaseClient = getSupabaseClient;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPABASE_CONFIG };
}
