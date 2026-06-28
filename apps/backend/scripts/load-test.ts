import http from 'http';

const CONCURRENT_REQUESTS = 100;
const URL = 'http://localhost:5000/api/repos?limit=50&offset=0';

async function fetchTime(): Promise<number> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    http
      .get(URL, { headers: { authorization: 'Bearer dummy-token' } }, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(performance.now() - start));
      })
      .on('error', reject);
  });
}

async function runLoadTest() {
  console.log(`Starting load test: ${CONCURRENT_REQUESTS} concurrent requests to ${URL}`);

  try {
    const promises = Array.from({ length: CONCURRENT_REQUESTS }).map(() => fetchTime());
    const times = await Promise.all(promises);

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(CONCURRENT_REQUESTS * 0.95)];

    console.log(`p95 latency: ${p95.toFixed(2)}ms`);

    if (p95 < 150) {
      console.log('✅ Load test passed!');
    } else {
      console.log('⚠️ Warning: Load test failed p95 latency requirement (<150ms).');
    }
  } catch (error) {
    console.error('❌ Request failed. Ensure the server is running on localhost:3001.');
    console.error(error);
  }
}

runLoadTest();
