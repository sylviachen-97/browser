// 1) REQUIRE EXPRESS & PUPPETEER
const express = require('express');
const puppeteer = require('puppeteer');

// 2) CREATE THE EXPRESS APP
const app = express();
app.use(express.json()); // parse JSON if needed

// 3) DEFINE YOUR ROUTE /resolve
app.get('/resolve', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let browser;
  try {
    // 3A) LAUNCH PUPPETEER
    browser = await puppeteer.launch({
      headless: true,  // or headless: true if "new" isn't supported
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    // 3B) CREATE NEW PAGE & GOTO
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 3C) IF WE LAND ON CONSENT PAGE, DO A GENERIC BUTTON SEARCH
    if (page.url().includes('consent.google.com')) {
      console.log('Consent page detected. Searching for an "agree/accept" button...');

      // Wait (up to 5s) for ANY button or input to appear
      try {
        await page.waitForSelector('button, input[type="button"], input[type="submit"]', { timeout: 5000 });
      } catch (e) {
        console.warn('No clickable elements found (timeout).');
      }

      // Collect all button-like elements
      const allButtons = await page.$$('button, input[type="button"], input[type="submit"]');
      let clicked = false;

      for (const btn of allButtons) {
        // Get the displayed text
        const text = await page.evaluate(el => el.innerText || el.value || '', btn);
        const lowerText = text.trim().toLowerCase();
        console.log('Found button/input with text:', lowerText);

        // If it says something like "agree" or "accept," click it
        if (lowerText.includes('agree') || lowerText.includes('accept')) {
          console.log('Clicking button:', text);

          await Promise.all([
            btn.click(),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
          ]);

          clicked = true;
          break;
        }
      }

      if (!clicked) {
        console.warn("No 'agree'/'accept' button found. Might need custom logic for your region.");
      }
    }

    // 3D) AFTER POSSIBLE CONSENT CLICK, GET FINAL URL
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    // 3E) SEND IT BACK AS JSON
    res.json({ finalUrl });

  } catch (err) {
    console.error('Error during Puppeteer navigation:', err);
    res.status(500).json({ error: err.toString() });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// 4) START THE EXPRESS SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Puppeteer service running on port ${PORT}`);
});