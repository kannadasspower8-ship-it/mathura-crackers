/**
 * Mathura Crackers - Products Dataset Placeholder
 * SUPABASE CLOUD DATABASE IS THE STRICT SINGLE SOURCE OF TRUTH.
 * No hardcoded, seeded, sample, or duplicate product arrays.
 * All product records are fetched live from Supabase PostgreSQL.
 */

const PRODUCTS_DATA = [];

if (typeof window !== 'undefined') {
  window.PRODUCTS_DATA = PRODUCTS_DATA;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRODUCTS_DATA;
}
