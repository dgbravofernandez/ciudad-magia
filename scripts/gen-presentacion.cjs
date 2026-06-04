/* Renderiza la presentación HTML de Cluberly a PDF A4 con Chromium (Playwright). */
const { chromium } = require('@playwright/test')
const path = require('path')

;(async () => {
  const htmlPath = path.join(__dirname, '..', 'docs', 'marketing', 'presentacion-cluberly.html')
  const outPath = path.join(__dirname, '..', 'docs', 'marketing', 'Presentacion-Cluberly.pdf')

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' })
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })
  await browser.close()
  console.log('OK →', outPath)
})()
