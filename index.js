const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.get('/resolve', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let browser;
  try {
    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true, // Use 'true' for Puppeteer v18
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Handle consent page if detected
    if (page.url().includes('consent.google.com')) {
      console.log('Consent page detected. Searching for "agree/accept" button...');

      try {
        await page.waitForSelector('button, input[type="button"], input[type="submit"]', { timeout: 5000 });

        const allButtons = await page.$$('button, input[type="button"], input[type="submit"]');
        let clicked = false;

        for (const btn of allButtons) {
          const text = await page.evaluate(el => el.innerText || el.value || '', btn);
          const lowerText = text.trim().toLowerCase();
          console.log('Found button/input with text:', lowerText);

          if (lowerText.includes('agree') || lowerText.includes('accept')) {
            console.log('Clicking button:', text);

            await Promise.all([
              btn.click(),
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
                console.warn('Navigation did not occur after clicking consent button.');
              }),
            ]);

            clicked = true;
            break;
          }
        }

        if (!clicked) {
          console.warn('No clickable "agree/accept" button found.');
        }
      } catch (e) {
        console.warn('Error handling consent page:', e.message);
      }
    }

    // Capture the final URL
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Puppeteer service running on port ${PORT}`);
});