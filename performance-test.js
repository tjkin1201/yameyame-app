const http = require('http');

console.log('🔍 API 성능 테스트 시작...');

const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.request(url, options, (res) => {
      const endTime = Date.now();
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          responseTime: endTime - startTime,
          data: data,
          headers: res.headers
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
};

// 부하 테스트 함수
const loadTest = async (endpoint, concurrency = 5, requests = 15) => {
  console.log('\n🚀 부하 테스트:', endpoint, '- 동시 요청:', concurrency, ', 총 요청:', requests);
  
  const results = [];
  
  // 동시 요청 실행
  const promises = [];
  for (let i = 0; i < requests; i++) {
    promises.push(
      makeRequest(endpoint).then(result => {
        results.push(result);
        return result;
      }).catch(error => {
        console.log('요청 오류:', error.message);
        return null;
      })
    );
  }
  
  await Promise.all(promises);
  
  const validResults = results.filter(r => r !== null);
  if (validResults.length === 0) return;
  
  const responseTimes = validResults.map(r => r.responseTime);
  const successCount = validResults.filter(r => r.statusCode < 400).length;
  
  const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const min = Math.min(...responseTimes);
  const max = Math.max(...responseTimes);
  responseTimes.sort((a, b) => a - b);
  const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
  
  console.log('📊 부하 테스트 결과:');
  console.log('- 총 요청:', requests, '| 성공:', successCount, '| 실패:', requests - successCount);
  console.log('- 성공률:', Math.round(successCount / requests * 100) + '%');
  console.log('- 평균 응답시간:', Math.round(avg), 'ms');
  console.log('- 최소 응답시간:', min, 'ms');
  console.log('- 최대 응답시간:', max, 'ms');
  console.log('- 95th percentile:', p95, 'ms');
  
  return { avg, min, max, p95, successRate: successCount / requests };
};

(async () => {
  try {
    // 단일 요청 성능 테스트
    console.log('📡 단일 요청 성능 테스트...');
    const endpoints = [
      'http://localhost:3000/api/health',
      'http://localhost:3000/api/clubs',
      'http://localhost:3000/api/members',
      'http://localhost:3000/api/posts',
      'http://localhost:3000/api/games'
    ];
    
    for (const endpoint of endpoints) {
      const result = await makeRequest(endpoint);
      const endpointName = endpoint.split('/').pop();
      console.log('- ' + endpointName + ':', result.responseTime + 'ms', '(상태: ' + result.statusCode + ')');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 부하 테스트
    console.log('\n' + '='.repeat(60));
    console.log('🔥 부하 테스트 시작...');
    
    await loadTest('http://localhost:3000/api/health', 5, 15);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await loadTest('http://localhost:3000/api/clubs', 5, 15);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await loadTest('http://localhost:3000/api/posts', 5, 15);
    
    console.log('\n✅ 성능 테스트 완료');
    
  } catch (error) {
    console.log('❌ 성능 테스트 오류:', error.message);
  }
})();