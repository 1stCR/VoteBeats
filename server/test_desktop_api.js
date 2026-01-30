const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Test 1: Desktop auth
  console.log('=== Test 1: Desktop Auth ===');
  const auth = await post('/api/desktop/auth', {
    email: 'regtest_session26@test.com',
    password: 'TestPass123'
  });
  console.log('Status:', auth.status);
  console.log('Has token:', !!auth.data.token);
  console.log('Source:', auth.data.source);

  if (!auth.data.token) {
    console.log('Auth failed, stopping');
    return;
  }

  const token = auth.data.token;

  // Test 2: Now playing update
  console.log('\n=== Test 2: Now Playing Update ===');
  const np = await post('/api/events/6c38c993-c235-47f1-a3d4-d097cac2a125/now-playing', {
    songTitle: 'Bohemian Rhapsody',
    artistName: 'Queen',
    position: 120000,
    duration: 354000
  }, token);
  console.log('Status:', np.status);
  console.log('Response:', JSON.stringify(np.data, null, 2));

  // Test 3: Sync endpoint
  console.log('\n=== Test 3: Sync Endpoint ===');
  const sync = await post('/api/events/6c38c993-c235-47f1-a3d4-d097cac2a125/sync', {
    updates: [
      { songTitle: 'Bohemian Rhapsody', artistName: 'Queen', status: 'played', timestamp: Date.now() }
    ]
  }, token);
  console.log('Status:', sync.status);
  console.log('Response:', JSON.stringify(sync.data, null, 2));

  console.log('\n=== All Tests Complete ===');
}

main().catch(console.error);
