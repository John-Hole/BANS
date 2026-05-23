const http = require('http');

const url = 'http://127.0.0.1:8080/Bans/1%20STROBO.mp3';

console.log(`Sending GET request to ${url}...`);
const req = http.get(url, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
  
  let count = 0;
  res.on('data', (chunk) => {
    count += chunk.length;
    if (count > 100000) {
      console.log(`Received first ${count} bytes successfully!`);
      res.destroy();
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
