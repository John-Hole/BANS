const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser to check autoplay behavior on startup...');
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();
  
  let playCalled = false;
  let playedSource = null;

  // Intercept browser logs and media play calls
  page.on('console', msg => {
    const text = msg.text();
    console.log('BROWSER LOG:', text);
  });
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  await page.exposeFunction('onPlayTriggered', (id, src) => {
    playCalled = true;
    playedSource = src;
    console.log(`!!! PLAY TRIGGERED ON ELEMENT ${id} WITH SRC: ${src}`);
  });

  console.log('Navigating to http://127.0.0.1:8080 ...');
  await page.goto('http://127.0.0.1:8080');

  // Inject a listener on the audio elements to detect when play() is called
  await page.evaluateOnNewDocument(() => {
    // Wrap HTMLAudioElement.prototype.play to spy on play calls
    const originalPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function() {
      window.onPlayTriggered(this.id, this.src);
      return originalPlay.apply(this, arguments);
    };
  });

  // Reload page to make sure the evaluateOnNewDocument runs
  await page.reload();

  // Wait for 5 seconds to observe if any play call happens automatically
  console.log('Waiting for 5 seconds to observe autoplay...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (playCalled) {
    console.log(`TEST RESULT: AUTOPLAY DETECTED. Song started playing: ${playedSource}`);
  } else {
    console.log('TEST RESULT: No autoplay detected. The app remained silent on load.');
  }

  console.log('Closing browser...');
  await browser.close();
})();
