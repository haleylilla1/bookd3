const http = require('http');

const data = JSON.stringify({
  startAddress: "San Francisco, CA",
  endAddress: "Los Angeles, CA",
  roundTrip: false
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/calculate-distance',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Cookie': 'sessionId=' + require('fs').readFileSync('working_cookies.txt', 'utf8').trim()
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
