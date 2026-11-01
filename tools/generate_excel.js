/**
 * Mathura Crackers Sivakasi - Executive Price List Generator (Excel)
 * Generates Mathura_Crackers_Price_List_2026.xlsx with:
 *  - Sheet 1: "Price List 2026" (Categorized, styled with banners, frozen headers, currency format)
 *  - Sheet 2: "Master Data (Filterable)" (Power-user table with AutoFilter enabled)
 *
 * Usage: node tools/generate_excel.js
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { SUPABASE_CONFIG } = require('../js/supabase-config.js');

async function getProducts() {
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/products?select=*&order=sort_order.asc`, {
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (res.ok) {
      const live = await res.json();
      if (live && live.length > 0) {
        console.log(`✓ Fetched ${live.length} live products from Supabase.`);
        return live;
      }
    }
  } catch (err) {
    console.warn('Notice: Supabase fetch error, using local fallback:', err.message);
  }

  const localPath = path.join(__dirname, '..', 'data', 'all_124_products.json');
  if (fs.existsSync(localPath)) {
    console.log(`✓ Loaded products from ${localPath}`);
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
  throw new Error('No product data source available.');
}

async function createProfessionalExcel() {
  console.log('--- Generating Mathura Crackers Wholesale Price List 2026 ---');
  const prods = await getProducts();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Mathura Crackers Sivakasi';
  workbook.lastModifiedBy = 'Mathura Crackers Admin';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = 'Mathura Crackers';
  workbook.title = 'Mathura Crackers - Wholesale Price List 2026';

  // -------------------------------------------------------------
  // SHEET 1: PRICE LIST (WITH CATEGORIES SEPARATED)
  // -------------------------------------------------------------
  const sheet = workbook.addWorksheet('Price List 2026', {
    views: [
      {
        showGridLines: true,
        state: 'frozen',
        ySplit: 5
      }
    ],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  sheet.getColumn(1).width = 10;  // S.NO
  sheet.getColumn(2).width = 46;  // NAME OF THE PRODUCT
  sheet.getColumn(3).width = 16;  // PER
  sheet.getColumn(4).width = 20;  // OUR PRICE

  const NAVY_DARK = 'FF0F172A';
  const NAVY_HEADER = 'FF1E293B';
  const BANNER_BLUE = 'FF1E3A8A';
  const GOLD_TEXT = 'FFFEF08A';
  const SLATE_LIGHT = 'FFCBD5E1';
  const BORDER_LIGHT = 'FFE2E8F0';
  const ZEBRA_EVEN = 'FFF8FAFC';
  const WHITE = 'FFFFFFFF';

  const thinBorder = {
    top: { style: 'thin', color: { argb: BORDER_LIGHT } },
    left: { style: 'thin', color: { argb: BORDER_LIGHT } },
    bottom: { style: 'thin', color: { argb: BORDER_LIGHT } },
    right: { style: 'thin', color: { argb: BORDER_LIGHT } }
  };

  // Row 1: Brand Title
  sheet.mergeCells('A1:D1');
  const r1 = sheet.getCell('A1');
  r1.value = 'MATHURA CRACKERS';
  r1.font = { name: 'Calibri', size: 18, bold: true, color: { argb: WHITE } };
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  sheet.getRow(1).height = 34;

  // Row 2: Subtitle
  sheet.mergeCells('A2:D2');
  const r2 = sheet.getCell('A2');
  r2.value = 'SIVAKASI WHOLESALE PRICE LIST 2026 • DIRECT FACTORY RATES';
  r2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: GOLD_TEXT } };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  sheet.getRow(2).height = 22;

  // Row 3: Contact & Location
  sheet.mergeCells('A3:D3');
  const r3 = sheet.getCell('A3');
  r3.value = 'Phone: +91 7010317389 / +91 7418051084 / +91 7200936916  •  Sivakasi, Tamil Nadu  •  mathuracrackers.com';
  r3.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: SLATE_LIGHT } };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  sheet.getRow(3).height = 20;

  // Row 4: Spacer
  sheet.mergeCells('A4:D4');
  sheet.getRow(4).height = 8;

  // Row 5: Column Headers
  const colHeaders = ['S.NO', 'NAME OF THE PRODUCT', 'PER', 'OUR PRICE'];
  const r5 = sheet.getRow(5);
  r5.height = 26;

  colHeaders.forEach((title, idx) => {
    const cell = r5.getCell(idx + 1);
    cell.value = title;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx === 0 ? 'center' : idx === 1 ? 'left' : idx === 2 ? 'center' : 'right',
      indent: idx === 1 ? 1 : 0
    };
    cell.border = {
      top: { style: 'medium', color: { argb: NAVY_DARK } },
      bottom: { style: 'medium', color: { argb: NAVY_DARK } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  const categoryOrder = [
    'SPARKLERS',
    'FLOWER POTS',
    'GROUND CHAKKARS',
    'ONE SOUND CRACKERS',
    'KIDS',
    'TWINKLING STARS',
    'PENCILS',
    'FOUNTAIN',
    'BIJILI',
    'ROCKETS',
    'BOMBS',
    'GARLANDS',
    'SINGLE SHOTS FANCY - MULTI COLOURS',
    'REPEATING SHOTS',
    'GIFT BOX'
  ];

  let currentRowIdx = 6;
  let globalSno = 1;

  categoryOrder.forEach((catName) => {
    const items = prods.filter(p => p.category === catName);
    if (!items || items.length === 0) return;

    // Category Banner
    sheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
    const bannerCell = sheet.getCell(`A${currentRowIdx}`);
    bannerCell.value = `✦  ${catName}  (${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'})`;
    bannerCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BANNER_BLUE } };
    bannerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    bannerCell.border = {
      top: { style: 'medium', color: { argb: NAVY_DARK } },
      bottom: { style: 'thin', color: { argb: NAVY_DARK } },
      left: { style: 'thin', color: { argb: BANNER_BLUE } },
      right: { style: 'thin', color: { argb: BANNER_BLUE } }
    };
    sheet.getRow(currentRowIdx).height = 24;
    currentRowIdx++;

    items.forEach((p) => {
      const row = sheet.getRow(currentRowIdx);
      row.height = 21;
      const isEven = (globalSno % 2 === 0);
      const rowBg = isEven ? ZEBRA_EVEN : WHITE;

      let finalPrice = Number(p.price);
      if (catName === 'GIFT BOX' && finalPrice < 200) {
        finalPrice = Number(p.original_price);
      }

      const unitStr = (p.unit || '1 Box').toUpperCase();

      // Col A: S.NO
      const c1 = row.getCell(1);
      c1.value = globalSno;
      c1.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
      c1.alignment = { horizontal: 'center', vertical: 'middle' };
      c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      c1.border = thinBorder;

      // Col B: NAME OF THE PRODUCT
      const c2 = row.getCell(2);
      c2.value = p.name.trim().toUpperCase();
      c2.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF0F172A' } };
      c2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      c2.border = thinBorder;

      // Col C: PER
      const c3 = row.getCell(3);
      c3.value = unitStr;
      c3.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
      c3.alignment = { horizontal: 'center', vertical: 'middle' };
      c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      c3.border = thinBorder;

      // Col D: OUR PRICE
      const c4 = row.getCell(4);
      c4.value = finalPrice;
      c4.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      c4.numFmt = '₹#,##0.00;("₹"#,##0.00);"-"';
      c4.alignment = { horizontal: 'right', vertical: 'middle' };
      c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      c4.border = thinBorder;

      currentRowIdx++;
      globalSno++;
    });
  });

  // Footer Summary Row
  const footerRowIdx = currentRowIdx;
  sheet.mergeCells(`A${footerRowIdx}:C${footerRowIdx}`);
  const fText = sheet.getCell(`A${footerRowIdx}`);
  fText.value = `TOTAL PRODUCTS LISTED`;
  fText.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  fText.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  fText.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  fText.border = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'double', color: { argb: NAVY_DARK } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
  };

  const fVal = sheet.getCell(`D${footerRowIdx}`);
  fVal.value = `${globalSno - 1} ITEMS`;
  fVal.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY_DARK } };
  fVal.alignment = { horizontal: 'right', vertical: 'middle' };
  fVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  fVal.border = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'double', color: { argb: NAVY_DARK } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
  };
  sheet.getRow(footerRowIdx).height = 25;

  // -------------------------------------------------------------
  // SHEET 2: MASTER DATA TABLE (POWER USER / FILTERABLE)
  // -------------------------------------------------------------
  const masterSheet = workbook.addWorksheet('Master Data (Filterable)', {
    views: [
      {
        showGridLines: true,
        state: 'frozen',
        ySplit: 1
      }
    ]
  });

  masterSheet.columns = [
    { header: 'S.NO', key: 'sno', width: 10 },
    { header: 'CATEGORY', key: 'category', width: 26 },
    { header: 'NAME OF THE PRODUCT', key: 'name', width: 44 },
    { header: 'PER', key: 'unit', width: 16 },
    { header: 'OUR PRICE (₹)', key: 'price', width: 18 }
  ];

  const mHeaderRow = masterSheet.getRow(1);
  mHeaderRow.height = 26;
  ['A1', 'B1', 'C1', 'D1', 'E1'].forEach((cellRef, idx) => {
    const c = masterSheet.getCell(cellRef);
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
    c.alignment = {
      vertical: 'middle',
      horizontal: idx === 0 ? 'center' : idx === 3 ? 'center' : idx === 4 ? 'right' : 'left',
      indent: (idx === 1 || idx === 2) ? 1 : 0
    };
  });

  let mSno = 1;
  categoryOrder.forEach(catName => {
    const items = prods.filter(p => p.category === catName);
    items.forEach(p => {
      let finalPrice = Number(p.price);
      if (catName === 'GIFT BOX' && finalPrice < 200) {
        finalPrice = Number(p.original_price);
      }
      const addedRow = masterSheet.addRow({
        sno: mSno,
        category: catName,
        name: p.name.trim().toUpperCase(),
        unit: (p.unit || '1 Box').toUpperCase(),
        price: finalPrice
      });
      addedRow.height = 20;

      const isEven = (mSno % 2 === 0);
      const bg = isEven ? ZEBRA_EVEN : WHITE;

      addedRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      addedRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      addedRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      addedRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      addedRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      addedRow.getCell(5).numFmt = '₹#,##0.00;("₹"#,##0.00);"-"';

      for (let i = 1; i <= 5; i++) {
        const cell = addedRow.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = thinBorder;
        if (i === 3) cell.font = { name: 'Calibri', size: 10.5 };
        else if (i === 5) cell.font = { name: 'Calibri', size: 10.5, bold: true };
        else cell.font = { name: 'Calibri', size: 10 };
      }
      mSno++;
    });
  });

  masterSheet.autoFilter = {
    from: 'A1',
    to: `E${mSno}`
  };

  const outputPath = path.join(__dirname, '..', 'Mathura_Crackers_Price_List_2026.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✓ Workbook successfully generated: ${outputPath}`);
}

createProfessionalExcel().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
