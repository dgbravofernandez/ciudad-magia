/* Genérico: renderiza un HTML a PDF A4 (+ PNG preview opcional) con Chromium.
   Uso: node scripts/html2pdf.cjs <input.html> <output.pdf> [preview.png] */
const { chromium } = require('@playwright/test')
const path = require('path')

;(async () => {
  const [, , inHtml, outPdf, outPng] = process.argv
  if (!inHtml || !outPdf) { console.error('Uso: node html2pdf.cjs <in.html> <out.pdf> [preview.png]'); process.exit(1) }
  const abs = (p) => 'file://' + path.resolve(p).replace(/\\/g, '/')
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
  await page.goto(abs(inHtml), { waitUntil: 'networkidle' })
  await page.pdf({ path: outPdf, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  if (outPng) await page.screenshot({ path: outPng, fullPage: true })
  await browser.close()
  console.log('OK →', outPdf)
})()
