const express = require('express');
const puppeteer = require('puppeteer'); // v18.2.1 pinned

const app = express();
app.use(express.json());

// Example route: GET /resolve?url=<GoogleNewsURL>
app.get('/resolve', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter.' });
  }

  let browser;
  try {
    // 1) Launch Puppeteer (older style)
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 2) If we land on a Google consent page, attempt a generic approach to click "agree"
    if (page.url().includes('consent.google.com')) {
      console.log('Consent page detected. Searching for "agree/accept" button...');
      try {
        await page.waitForSelector('button, input[type="button"], input[type="submit"]', { timeout: 5000 });
        const allButtons = await page.$$('button, input[type="button"], input[type="submit"]');
        let clicked = false;
        for (const btn of allButtons) {
          const text = await page.evaluate(el => el.innerText || el.value || '', btn);
          const lower = text.trim().toLowerCase();
          if (lower.includes('agree') || lower.includes('accept')) {
            console.log('Clicking consent button:', text);
            await Promise.all([
              btn.click(),
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            ]);
            clicked = true;
            break;
          }
        }
        if (!clicked) console.warn("No 'agree'/'accept' button found.");
      } catch (e) {
        console.warn('Consent handling failed or timed out.', e);
      }
    }

    // 3) Final URL
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    res.json({ finalUrl });
  } catch (err) {
    console.error('Error during Puppeteer navigation:', err);
    res.status(500).json({ error: err.toString() });
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Puppeteer service running on port ${PORT}`);
});
