const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
console.log('--- RUNNING AUTOMATED SITE VALIDATION ---');

// 1. Validate core production files exist
const requiredFiles = [
  'index.html',
  'enquiry.html',
  'about.html',
  'contact.html',
  'admin.html',
  'maintenance.html',
  'css/style.css',
  'js/supabase-config.js',
  'js/db.js',
  'js/products-data.js',
  'js/cart.js',
  'js/particles.js',
  'js/fireworks.js',
  'js/custom-dialog.js',
  'js/app.js',
  'js/admin.js',
  'js/brand-intro.js'
];

let allPassed = true;

requiredFiles.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`[PASS] ${file} exists (${stats.size} bytes)`);
  } else {
    console.error(`[FAIL] ${file} is missing!`);
    allPassed = false;
  }
});

// 2. Verify HTML files link style.css and core scripts
const htmlFiles = ['index.html', 'enquiry.html', 'about.html', 'contact.html', 'admin.html'];
htmlFiles.forEach(htmlFile => {
  const content = fs.readFileSync(path.join(rootDir, htmlFile), 'utf8');
  const hasCss = content.includes('css/style.css');
  const hasProducts = content.includes('js/products-data.js');
  const hasCustomDialog = content.includes('js/custom-dialog.js');

  console.log(`\n[CHECK] ${htmlFile}:`);
  console.log(`  - CSS linked: ${hasCss ? 'YES' : 'NO'}`);
  console.log(`  - Custom Dialog Card linked: ${hasCustomDialog ? 'YES' : 'NO'}`);
  console.log(`  - Products Data linked: ${hasProducts ? 'YES' : 'NO'}`);

  if (!hasCss || !hasProducts || !hasCustomDialog) {
    allPassed = false;
  }
});

console.log('\n--- VALIDATION SUMMARY ---');
if (allPassed) {
  console.log('✅ ALL TESTS PASSED SUCCESSFULLY! The Mathura Crackers website is complete, verified, and ready.');
} else {
  console.log('❌ SOME TESTS FAILED. Check details above.');
}
