const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser with standard autoplay restrictions...');
  const browser = await puppeteer.launch({
    headless: true,
    // Note: no autoplay bypass args
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  console.log('Navigating to http://127.0.0.1:8080 ...');
  await page.goto('http://127.0.0.1:8080');

  // Inject a listener on the audio elements to print detailed errors
  await page.evaluate(() => {
    const handleMediaError = (id, event) => {
      const audio = event.target;
      if (audio.error) {
        console.log(`DETAILED AUDIO ERROR on ${id}: code=${audio.error.code}, message="${audio.error.message}"`);
      }
    };
    document.getElementById('audio-1').addEventListener('error', e => handleMediaError('audio-1', e));
    document.getElementById('audio-2').addEventListener('error', e => handleMediaError('audio-2', e));
  });

  // Wait for the track list to load
  console.log('Waiting for track list to be populated...');
  await page.waitForSelector('.track-item', { timeout: 10000 });

  // Click the first track
  console.log('Clicking the first track...');
  await page.click('.track-item');

  // Wait for 3 seconds to see if it starts playing or throws errors
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Closing browser...');
  await browser.close();
})();
