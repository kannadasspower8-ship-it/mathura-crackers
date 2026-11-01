# Mathura Crackers - Sivakasi

> Premium Fireworks E-Commerce & Wholesale Storefront  
> Direct Factory Rates • Sivakasi, Tamil Nadu  
> Official Website: [mathuracrackers.com](https://mathuracrackers.com)

---

## 📁 Directory Structure

```text
crackers/
├── css/                                # Production Stylesheets
│   └── style.css                       # Responsive layout, animations, components & mobile CSS
├── js/                                 # Modular Frontend Application Scripts
│   ├── app.js                          # Core interactive storefront & dynamic banner engine
│   ├── admin.js                        # Admin dashboard, inventory & pricing controllers
│   ├── brand-intro.js                  # Cinematic intro & brand video controller
│   ├── cart.js                         # Cart management, orders, discounts & checkout
│   ├── custom-dialog.js                # Custom interactive modal dialogs
│   ├── db.js                           # Supabase cloud database service layer
│   ├── fireworks.js                    # Canvas fireworks interactive animations
│   ├── particles.js                    # Ambient particle effects
│   ├── products-data.js                # Product schema bridge (Supabase single source of truth)
│   └── supabase-config.js              # Supabase API credentials & endpoints
├── images/                             # Web-Optimized Graphical Assets (WebP / PNG)
├── netlify/                            # Netlify Edge Functions & Serverless API
│   └── edge-functions/
│       └── maintenance.js              # Zero-latency edge maintenance guard
├── data/                               # Catalog Snapshots & Source Price Lists
│   ├── all_124_products.json           # Canonical JSON snapshot of all 124 products
│   ├── mathura_crackers_products.csv   # Structured product catalog CSV
│   └── MATHURA CRACKERS 2026 2.pdf     # Original reference catalog PDF
├── docs/                               # Project Documentation & Audit Reports
│   ├── improvement.txt                 # Performance & architectural findings
│   └── report.md                       # Mobile optimization & bandwidth audit report
├── tools/                              # Development & Automation Utilities
│   ├── generate_excel.js               # Executive Excel price list workbook generator
│   └── validate_site.js                # Automated file integrity & parity tester
├── archive/                            # Historical Archives (Safely Preserved)
│   ├── raw_images/                     # Original uncompressed 4K artwork & logo assets
│   └── legacy_scratch/                 # Historical test dumps & debug scrapings
├── index.html                          # Homepage & Live Catalog (124 Products)
├── about.html                          # Company History & Sivakasi Legacy
├── contact.html                        # Contact, Direct Factory Location & Hours
├── enquiry.html                        # Wholesale Quick Order / Enquiry Form
├── admin.html                          # Admin Dashboard (Protected by Supabase Auth)
├── maintenance.html                    # Instant Maintenance Mode Landing Page
├── mathura_crackers_price_list.pdf     # Downloadable Wholesale Price List (PDF)
├── Mathura_Crackers_Price_List_2026.xlsx # Downloadable Wholesale Price List (Excel)
├── favicon.ico                         # Browser Favorite Icon
├── robots.txt                          # SEO Crawler Directives
├── sitemap.xml                         # XML Search Engine Sitemap
├── netlify.toml                        # Netlify Headers & Deployment Configuration
├── package.json                        # Node.js project manifest & scripts
├── server.js                           # Local development HTTP server
├── .gitignore                          # Git repository exclusion rules
└── .netlifyignore                      # Netlify build exclusion rules
```

---

## 🚀 Quick Start

### 1. Run Site Locally
```bash
npm start
```
Starts the local development server at `http://localhost:3000`.

### 2. Run Site Integrity Tests
```bash
npm test
```
Validates that all HTML pages, CSS stylesheets, core scripts, and dialogs are correctly linked and intact.

### 3. Generate Executive Excel Price List
```bash
npm run generate:excel
```
Connects to Supabase, queries the live catalog, and builds the executive `Mathura_Crackers_Price_List_2026.xlsx` spreadsheet with categories separated, custom styling, and auto-filters.

---

## 🔒 Database & Single Source of Truth
All catalog data, pricing, and stock levels are dynamically managed via **Supabase PostgreSQL**. No hardcoded product arrays are used.
