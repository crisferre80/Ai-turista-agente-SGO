(async () => {
  const { chromium } = await import('playwright');
  console.log('Starting Playwright test script');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ bypassCSP: true });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Try to find consent prompt by partial text
    const promptSelectors = [
      'text=¿Recibir notificaciones?',
      'text=Recibir notificaciones',
      'text=notificaciones',
      'text=Activar'
    ];

    let promptFound = false;
    for (const sel of promptSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        console.log('Found selector:', sel);
        promptFound = true;
        break;
      } catch {
        // continue
      }
    }

    if (!promptFound) {
      // Dump body HTML for debugging
      const body = await page.content();
      console.log('Page HTML length:', body.length);
      throw new Error('Consent prompt not found on the page');
    }

    // Click Activate (Activar) if exists
    try {
      await page.click('text=Activar', { timeout: 2000 });
      console.log('Clicked Activar');
    } catch {
      // Try generic click on first button inside the consent
      const btn = await page.waitForSelector('div[style] >> text=Activar, button >> :text-is("Activar")', { timeout: 2000 }).catch(()=>null);
      if (btn) { await btn.click(); console.log('Clicked fallback Activar'); }
    }

    // Wait for OneSignal SDK script tag to be present
    await page.waitForSelector('script[src*="OneSignalSDK.page.js"]', { timeout: 10000 });
    console.log('OneSignal SDK script loaded');

    // Wait a bit for initialization
    await page.waitForTimeout(3000);

    // Check window.OneSignal or OneSignalDeferred
    const oneSignalExists = await page.evaluate(() => {
      // @ts-expect-error - window typings not available in this evaluation context
      return !!(window.OneSignal || window.OneSignalDeferred);
    });
    console.log('OneSignal present:', oneSignalExists);

    // Check service worker registration
    const registrations = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return [];
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.map(r => r.scriptURL);
    });
    console.log('Service worker registrations:', registrations);

    const hasOneSignalWorker = registrations.some(url => url.includes('OneSignalSDK'));

    if (!oneSignalExists) throw new Error('OneSignal object not present after activation');
    if (!hasOneSignalWorker) throw new Error('OneSignal service worker not registered');

    console.log('✅ OneSignal initialized and service worker registered successfully');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    await browser.close();
    process.exit(2);
  }
})();