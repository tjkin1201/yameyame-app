const http = require('http');

console.log('🔍 API 에러 처리 테스트 시작...');

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

(async () => {
  try {
    console.log('📡 에러 처리 테스트 시작...\n');
    
    // 테스트 케이스들
    const testCases = [
      {
        name: '존재하지 않는 엔드포인트',
        url: 'http://localhost:3000/api/nonexistent',
        method: 'GET',
        expectedStatus: 404
      },
      {
        name: '잘못된 HTTP 메서드',
        url: 'http://localhost:3000/api/health',
        method: 'DELETE',
        expectedStatus: [404, 405, 501]
      },
      {
        name: '잘못된 JSON 데이터',
        url: 'http://localhost:3000/api/posts',
        method: 'POST',
        body: '{"invalid": json}',
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: [400, 422]
      },
      {
        name: '빈 POST 요청',
        url: 'http://localhost:3000/api/posts',
        method: 'POST',
        body: '',
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: [400, 422]
      },
      {
        name: '유효하지 않은 Content-Type',
        url: 'http://localhost:3000/api/posts',
        method: 'POST',
        body: 'plain text data',
        headers: { 'Content-Type': 'text/plain' },
        expectedStatus: [400, 415, 422]
      }
    ];
    
    for (const testCase of testCases) {
      console.log('🧪 테스트:', testCase.name);
      
      try {
        const options = {
          method: testCase.method
        };
        
        if (testCase.headers) {
          options.headers = testCase.headers;
        }
        
        if (testCase.body) {
          options.body = testCase.body;
        }
        
        const result = await makeRequest(testCase.url, options);
        
        console.log('📊 결과:');
        console.log('- 상태 코드:', result.statusCode);
        console.log('- 응답 시간:', result.responseTime, 'ms');
        
        // 예상 상태 코드 확인
        const expectedStatuses = Array.isArray(testCase.expectedStatus) ? 
          testCase.expectedStatus : [testCase.expectedStatus];
        
        if (expectedStatuses.includes(result.statusCode)) {
          console.log('✅ 예상된 에러 처리 - 성공');
        } else {
          console.log('⚠️  예상과 다른 상태 코드. 예상:', testCase.expectedStatus, '실제:', result.statusCode);
        }
        
        // 에러 응답 내용 확인
        try {
          const errorData = JSON.parse(result.data);
          console.log('- 에러 응답:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.log('- 에러 응답 (텍스트):', result.data.substring(0, 200));
        }
        
      } catch (error) {
        console.log('❌ 요청 오류:', error.message);
      }
      
      console.log('\n' + '-'.repeat(50) + '\n');
      
      // 테스트 간 간격
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('✅ 에러 처리 테스트 완료');
    
    // 추가: 서버 상태 확인
    console.log('\n📊 서버 상태 최종 확인...');
    const healthCheck = await makeRequest('http://localhost:3000/api/health');
    console.log('- Health Check:', healthCheck.statusCode === 200 ? '정상' : '비정상');
    console.log('- 응답 시간:', healthCheck.responseTime, 'ms');
    
  } catch (error) {
    console.log('❌ 에러 처리 테스트 실패:', error.message);
  }
})();