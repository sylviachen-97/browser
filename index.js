// 1) REQUIRE EXPRESS & PUPPETEER
const express = require('express');
const puppeteer = require('puppeteer');

// 2) CREATE THE EXPRESS APP
const app = express();
app.use(express.json()); // Parse JSON if needed

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
      headless: true, // Puppeteer v18 uses `true` for headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for Render
    });

    // 3B) CREATE NEW PAGE
    const page = await browser.newPage();

    // 3C) GOTO THE URL
    await page.goto(url, {
      waitUntil: 'networkidle2', // Wait for network to idle (page fully loaded)
      timeout: 30000, // 30 seconds timeout
    });

    // 3D) HANDLE CONSENT PAGES IF ANY
    if (page.url().includes('consent.google.com')) {
      console.log('Consent page detected. Searching for "agree/accept" button...');
      try {
        // Wait for button or input elements to appear
        await page.waitForSelector('button, input[type="button"], input[type="submit"]', {
          timeout: 5000,
        });

        const allButtons = await page.$$('button, input[type="button"], input[type="submit"]');
        let clicked = false;

        for (const btn of allButtons) {
          const text = await page.evaluate(el => el.innerText || el.value || '', btn);
          if (text.trim().toLowerCase().includes('agree') || text.trim().toLowerCase().includes('accept')) {
            console.log('Clicking button:', text);
            await Promise.all([
              btn.click(),
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            ]);
            clicked = true;
            break;
          }
        }

        if (!clicked) {
          console.warn("No 'agree'/'accept' button found. Custom logic might be needed.");
        }
      } catch (err) {
        console.warn('No clickable elements found or timeout expired.');
      }
    }

    // 3E) GET FINAL URL AFTER NAVIGATION
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    // 3F) SEND THE RESPONSE
    res.json({ finalUrl });

  } catch (err) {
    console.error('Error during Puppeteer navigation:', err);
    res.status(500).json({ error: 'Failed to resolve URL.', details: err.message });
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