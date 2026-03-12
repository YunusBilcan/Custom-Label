const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting debug script...");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
  page.on('response', response => {
    if(!response.ok()) console.log('RESPONSE FAIL:', response.status(), response.url())
  });

  try {
    const response = await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log("Status:", response ? response.status() : "UNKNOWN");
    
    const rootHtml = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML : "NO ROOT ELEMENT";
    });
    
    console.log("Root content:", rootHtml.substring(0, 150));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
})();
