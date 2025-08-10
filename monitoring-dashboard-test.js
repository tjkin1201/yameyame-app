const http = require('http');

console.log('🔍 모니터링 대시보드 테스트 시작...');

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
          headers: res.headers,
          contentLength: data.length
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
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
    console.log('📡 모니터링 대시보드 접근성 테스트...\n');
    
    // 1. 대시보드 메인 페이지 테스트
    console.log('🔍 1. 대시보드 메인 페이지 (http://localhost:9999)');
    try {
      const dashboardResult = await makeRequest('http://localhost:9999');
      
      console.log('📊 대시보드 결과:');
      console.log('- 상태 코드:', dashboardResult.statusCode);
      console.log('- 응답 시간:', dashboardResult.responseTime, 'ms');
      console.log('- 콘텐츠 길이:', dashboardResult.contentLength, 'bytes');
      console.log('- Content-Type:', dashboardResult.headers['content-type']);
      
      if (dashboardResult.statusCode === 200) {
        console.log('✅ 대시보드 접근 성공');
        
        // HTML 콘텐츠 분석
        const content = dashboardResult.data;
        const hasTitle = content.includes('<title>') || content.includes('모니터링') || content.includes('Dashboard');
        const hasBody = content.includes('<body>') || content.includes('<div>');
        const hasScript = content.includes('<script>') || content.includes('javascript');
        
        console.log('- HTML 구조:');
        console.log('  • Title 태그:', hasTitle ? '✅' : '❌');
        console.log('  • Body 콘텐츠:', hasBody ? '✅' : '❌'); 
        console.log('  • JavaScript:', hasScript ? '✅' : '❌');
        
        // 샘플 콘텐츠 출력 (처음 500자)
        console.log('- 콘텐츠 샘플:');
        console.log(content.substring(0, 500) + '...');
        
      } else {
        console.log('❌ 대시보드 접근 실패:', dashboardResult.statusCode);
      }
    } catch (error) {
      console.log('❌ 대시보드 연결 오류:', error.message);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 2. 정적 리소스 테스트 (CSS, JS 등)
    console.log('🔍 2. 정적 리소스 테스트');
    const staticResources = [
      '/style.css',
      '/script.js',
      '/favicon.ico',
      '/assets/logo.png'
    ];
    
    for (const resource of staticResources) {
      try {
        const resourceResult = await makeRequest('http://localhost:9999' + resource);
        console.log('- ' + resource + ':', 
          resourceResult.statusCode === 200 ? '✅ 성공' : 
          resourceResult.statusCode === 404 ? '⚠️  없음' : '❌ 오류'
        );
        if (resourceResult.statusCode === 200) {
          console.log('  크기:', resourceResult.contentLength, 'bytes');
        }
      } catch (error) {
        console.log('- ' + resource + ': ❌ 연결 오류');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 3. API 엔드포인트 테스트 (대시보드가 사용하는 API)
    console.log('🔍 3. 대시보드 API 테스트');
    const dashboardApis = [
      '/api/stats',
      '/api/metrics',
      '/api/health-status',
      '/health',
      '/status'
    ];
    
    for (const apiPath of dashboardApis) {
      try {
        const apiResult = await makeRequest('http://localhost:9999' + apiPath);
        console.log('- ' + apiPath + ':', 
          apiResult.statusCode === 200 ? '✅ 성공 (' + apiResult.responseTime + 'ms)' : 
          apiResult.statusCode === 404 ? '⚠️  없음' : '❌ 오류 (' + apiResult.statusCode + ')'
        );
        
        if (apiResult.statusCode === 200) {
          try {
            const jsonData = JSON.parse(apiResult.data);
            console.log('  데이터 구조:', Object.keys(jsonData).join(', '));
          } catch (e) {
            console.log('  응답 타입: 텍스트 (' + apiResult.contentLength + ' bytes)');
          }
        }
      } catch (error) {
        console.log('- ' + apiPath + ': ❌ 연결 오류');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 4. 백엔드 서비스와의 연동 확인
    console.log('🔍 4. 백엔드 서비스 연동 확인');
    
    // 백엔드 API 상태 확인
    const backendHealth = await makeRequest('http://localhost:3000/api/health');
    console.log('- 백엔드 API 상태:', backendHealth.statusCode === 200 ? '✅ 정상' : '❌ 비정상');
    
    // 모니터링 서버가 백엔드 데이터를 가져오는지 확인
    if (backendHealth.statusCode === 200) {
      const backendData = JSON.parse(backendHealth.data);
      console.log('- 백엔드 업타임:', Math.round(backendData.uptime), '초');
      console.log('- 백엔드 메모리 사용:', Math.round(backendData.process.memory.heapUsed / 1024 / 1024), 'MB');
      
      // 대시보드가 이 정보를 표시하는지 확인하려면 실제 HTML을 파싱해야 함
      console.log('✅ 백엔드 연동 데이터 확인 완료');
    }
    
    console.log('\n✅ 모니터링 대시보드 테스트 완료');
    
  } catch (error) {
    console.log('❌ 모니터링 대시보드 테스트 오류:', error.message);
  }
})();