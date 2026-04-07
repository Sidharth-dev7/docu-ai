// docu-ai/services/playwright.js
const { chromium } = require('playwright');

/**
 * Logs into a product using dedicated AI credentials and captures screenshots
 * of the specified pages.
 *
 * @param {Object} productConfig - Product config including url, loginPath, credentials
 * @param {Array<{name: string, path: string}>} affectedPages
 * @returns {Promise<Array<{pageName: string, base64: string}>>}
 */
async function captureScreenshots(productConfig, affectedPages) {
  if (!affectedPages || affectedPages.length === 0) return [];

  const { url, loginPath, credentials } = productConfig;
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(`${url}${loginPath}`);
    await page.waitForLoadState('networkidle');
    await page.fill(credentials.usernameSelector, credentials.username);
    await page.fill(credentials.passwordSelector, credentials.password);
    await page.click(credentials.submitSelector);
    // Wait for redirect away from login page
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Capture each affected page using known page paths from config
    const pages = productConfig.pages || {};
    const results = [];
    for (const affectedPage of affectedPages) {
      // Match affected page name to a known path (case-insensitive partial match)
      const matchedKey = Object.keys(pages).find(k =>
        k.toLowerCase().includes(affectedPage.name.toLowerCase()) ||
        affectedPage.name.toLowerCase().includes(k.toLowerCase())
      );
      const path = matchedKey ? pages[matchedKey] : null;
      if (!path) {
        console.log(`[Docu AI] No known path for "${affectedPage.name}", skipping screenshot`);
        continue;
      }
      await page.goto(`${url}${path}`);
      await page.waitForLoadState('networkidle');
      const bodyText = await page.innerText('body').catch(() => '');
      if (bodyText.includes('404') && bodyText.includes('Not Found')) {
        console.log(`[Docu AI] ${affectedPage.name} returned 404, skipping`);
        continue;
      }
      const buffer = await page.screenshot({ fullPage: true });
      results.push({
        pageName: affectedPage.name,
        base64: buffer.toString('base64'),
      });
    }

    return results;
  } finally {
    await browser.close();
  }
}

module.exports = { captureScreenshots };
