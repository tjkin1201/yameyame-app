#!/usr/bin/env node

/**
 * yameyame Playwright MCP 테스트 실행기
 * Intelligent Test Runner with MCP Integration
 * 
 * 로컬 개발 환경에서 Playwright MCP를 활용한 지능형 테스트 실행
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PlaywrightMCPTestRunner {
  
  constructor() {
    this.config = {
      baseUrl: process.env.E2E_BASE_URL || 'http://localhost:8081',
      apiUrl: process.env.API_BASE_URL || 'http://localhost:3001',
      socketUrl: process.env.SOCKET_URL || 'http://localhost:3002',
      browsers: ['chromium', 'firefox', 'webkit'],
      devices: ['desktop', 'mobile'],
      testSuites: {
        smoke: 'tests/e2e/smoke/',
        userflows: 'tests/e2e/user-journeys/',
        realtime: 'tests/e2e/realtime/',
        performance: 'tests/e2e/performance/',
        visual: 'tests/e2e/visual-regression/',
        accessibility: 'tests/e2e/accessibility/'
      },
      parallel: os.cpus().length > 4 ? 4 : 2,
      retries: 2,
      timeout: 30000
    };
    
    this.services = {
      'database-layer': { port: 5000, health: '/health' },
      'backend-api': { port: 3001, health: '/health' },
      'realtime-socket': { port: 3002, health: '/health' },
      'band-integration': { port: 3003, health: '/health' },
      'frontend-ui': { port: 8081, health: '/' },
      'monitoring': { port: 9999, health: '/health' }
    };
    
    this.mcpServers = {
      playwright: { active: false, port: null },
      sequential: { active: false, port: null },
      context7: { active: false, port: null },
      magic: { active: false, port: null }
    };
    
    this.results = {
      startTime: Date.now(),
      services: {},
      tests: {},
      performance: {},
      coverage: {},
      errors: []
    };
  }

  // 메인 실행 함수
  async run(options = {}) {
    console.log('🎭 yameyame Playwright MCP 테스트 실행기 시작');
    console.log('=' * 60);
    
    try {
      // 1. 환경 검증
      await this.validateEnvironment();
      
      // 2. MCP 서버 활성화
      await this.activateMCPServers(options.mcpServers);
      
      // 3. 서비스 상태 확인
      await this.checkServices();
      
      // 4. 테스트 실행
      await this.executeTests(options);
      
      // 5. 결과 분석 및 리포팅
      await this.generateReport();
      
      console.log('✅ 테스트 실행 완료');
      
    } catch (error) {
      console.error('❌ 테스트 실행 실패:', error.message);
      this.results.errors.push(error);
      process.exit(1);
    }
  }

  // 환경 검증
  async validateEnvironment() {
    console.log('🔍 환경 검증 중...');
    
    // Node.js 버전 확인
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
      throw new Error(`Node.js 18+ 필요 (현재: ${nodeVersion})`);
    }
    
    // Playwright 설치 확인
    const playwrightPath = path.join(__dirname, '../../node_modules/.bin/playwright');
    if (!fs.existsSync(playwrightPath)) {
      throw new Error('Playwright가 설치되지 않았습니다. npm install 후 npx playwright install 실행');
    }
    
    // 브라우저 설치 확인
    for (const browser of this.config.browsers) {
      const browserCheck = await this.runCommand(`npx playwright install --dry-run ${browser}`);
      if (browserCheck.code !== 0) {
        console.log(`⚠️ ${browser} 브라우저 설치 필요`);
        await this.runCommand(`npx playwright install ${browser}`);
      }
    }
    
    // 테스트 디렉토리 존재 확인
    for (const [suite, testPath] of Object.entries(this.config.testSuites)) {
      if (!fs.existsSync(testPath)) {
        console.log(`⚠️ 테스트 디렉토리 없음: ${testPath}`);
      }
    }
    
    console.log('✅ 환경 검증 완료');
  }

  // MCP 서버 활성화
  async activateMCPServers(requestedServers = ['playwright']) {
    console.log('🤖 MCP 서버 활성화 중...');
    
    const serverConfigs = {
      playwright: {
        command: 'npx',
        args: ['@playwright/mcp-server'],
        port: 3333,
        healthCheck: '/health'
      },
      sequential: {
        command: 'npx',
        args: ['@sequential/mcp-server'],
        port: 3334,
        healthCheck: '/health'
      },
      context7: {
        command: 'npx', 
        args: ['@context7/mcp-server'],
        port: 3335,
        healthCheck: '/health'
      },
      magic: {
        command: 'npx',
        args: ['@magic/mcp-server'],
        port: 3336,
        healthCheck: '/health'
      }
    };
    
    for (const serverName of requestedServers) {
      if (serverConfigs[serverName]) {
        console.log(`🔌 ${serverName} MCP 서버 시작 중...`);
        
        try {
          const config = serverConfigs[serverName];
          const process = spawn(config.command, config.args, {
            stdio: 'pipe',
            env: { ...process.env, PORT: config.port }
          });
          
          // 서버 시작 대기
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`${serverName} 서버 시작 타임아웃`));
            }, 10000);
            
            process.stdout.on('data', (data) => {
              if (data.toString().includes('Server running')) {
                clearTimeout(timeout);
                resolve();
              }
            });
          });
          
          this.mcpServers[serverName] = {
            active: true,
            port: config.port,
            process: process
          };
          
          console.log(`✅ ${serverName} MCP 서버 활성화 완료 (포트: ${config.port})`);
          
        } catch (error) {
          console.log(`⚠️ ${serverName} MCP 서버 시작 실패: ${error.message}`);
          this.results.errors.push(`MCP ${serverName}: ${error.message}`);
        }
      }
    }
  }

  // 서비스 상태 확인
  async checkServices() {
    console.log('🔍 서비스 상태 확인 중...');
    
    const axios = require('axios');
    
    for (const [serviceName, config] of Object.entries(this.services)) {
      const healthUrl = `http://localhost:${config.port}${config.health}`;
      
      try {
        const startTime = Date.now();
        const response = await axios.get(healthUrl, { timeout: 5000 });
        const responseTime = Date.now() - startTime;
        
        this.results.services[serviceName] = {
          status: 'healthy',
          responseTime: responseTime,
          statusCode: response.status
        };
        
        console.log(`✅ ${serviceName}: 정상 (${responseTime}ms)`);
        
      } catch (error) {
        this.results.services[serviceName] = {
          status: 'unhealthy',
          error: error.message
        };
        
        console.log(`❌ ${serviceName}: 비정상 (${error.message})`);
        
        // 중요 서비스가 다운된 경우 경고
        if (['frontend-ui', 'backend-api'].includes(serviceName)) {
          console.log(`⚠️ 중요 서비스 ${serviceName} 다운됨. 테스트 결과에 영향 가능`);
        }
      }
    }
  }

  // 테스트 실행
  async executeTests(options) {
    console.log('🧪 테스트 실행 시작...');
    
    const {
      suites = ['smoke'],
      browsers = ['chromium'],
      devices = ['desktop'],
      parallel = this.config.parallel,
      headed = false,
      debug = false
    } = options;
    
    for (const suite of suites) {
      if (!this.config.testSuites[suite]) {
        console.log(`⚠️ 알 수 없는 테스트 스위트: ${suite}`);
        continue;
      }
      
      console.log(`📋 ${suite} 테스트 스위트 실행 중...`);
      
      for (const browser of browsers) {
        for (const device of devices) {
          const testKey = `${suite}-${browser}-${device}`;
          console.log(`🎯 실행: ${testKey}`);
          
          const startTime = Date.now();
          
          try {
            const result = await this.runPlaywrightTest({
              suite,
              browser,
              device,
              parallel,
              headed,
              debug
            });
            
            this.results.tests[testKey] = {
              status: result.code === 0 ? 'passed' : 'failed',
              duration: Date.now() - startTime,
              output: result.output,
              coverage: result.coverage,
              performance: result.performance
            };
            
            if (result.code === 0) {
              console.log(`✅ ${testKey} 통과 (${Date.now() - startTime}ms)`);
            } else {
              console.log(`❌ ${testKey} 실패`);
              this.results.errors.push(`Test ${testKey} failed: ${result.output}`);
            }
            
          } catch (error) {
            this.results.tests[testKey] = {
              status: 'error',
              duration: Date.now() - startTime,
              error: error.message
            };
            
            console.log(`💥 ${testKey} 오류: ${error.message}`);
            this.results.errors.push(`Test ${testKey} error: ${error.message}`);
          }
        }
      }
    }
  }

  // Playwright 테스트 실행
  async runPlaywrightTest(config) {
    const {
      suite,
      browser,
      device,
      parallel,
      headed,
      debug
    } = config;
    
    const testPath = this.config.testSuites[suite];
    const args = [
      'playwright',
      'test',
      testPath,
      `--project=${browser}`,
      `--workers=${parallel}`,
      '--reporter=json',
      '--output-dir=test-results'
    ];
    
    // 디바이스별 설정
    if (device === 'mobile') {
      process.env.PLAYWRIGHT_VIEWPORT_WIDTH = '375';
      process.env.PLAYWRIGHT_VIEWPORT_HEIGHT = '667';
      process.env.DEVICE_TYPE = 'mobile';
    } else {
      process.env.PLAYWRIGHT_VIEWPORT_WIDTH = '1920';
      process.env.PLAYWRIGHT_VIEWPORT_HEIGHT = '1080';
      process.env.DEVICE_TYPE = 'desktop';
    }
    
    // MCP 서버 정보 전달
    process.env.MCP_SERVERS = JSON.stringify(this.mcpServers);
    process.env.BROWSER_NAME = browser;
    process.env.TEST_SUITE = suite;
    
    // 디버그 모드
    if (debug) {
      args.push('--debug');
    }
    
    // 헤드리스 모드
    if (!headed) {
      args.push('--headless');
    }
    
    // 성능 테스트 특별 설정
    if (suite === 'performance') {
      args.push('--timeout=60000');
      args.push('--retries=1');
    }
    
    const result = await this.runCommand(`npx ${args.join(' ')}`);
    
    // 결과 파싱
    const outputPath = 'test-results/results.json';
    let testResults = {};
    
    if (fs.existsSync(outputPath)) {
      try {
        testResults = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      } catch (parseError) {
        console.log('결과 파일 파싱 실패:', parseError.message);
      }
    }
    
    return {
      code: result.code,
      output: result.output,
      coverage: testResults.coverage,
      performance: testResults.performance
    };
  }

  // 명령어 실행 헬퍼
  runCommand(command) {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], { 
        stdio: 'pipe',
        env: process.env 
      });
      
      let output = '';
      let error = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          code,
          output: output + error
        });
      });
    });
  }

  // 결과 리포트 생성
  async generateReport() {
    console.log('📊 테스트 결과 리포트 생성 중...');
    
    const totalDuration = Date.now() - this.results.startTime;
    
    // 테스트 통계
    const totalTests = Object.keys(this.results.tests).length;
    const passedTests = Object.values(this.results.tests).filter(t => t.status === 'passed').length;
    const failedTests = Object.values(this.results.tests).filter(t => t.status === 'failed').length;
    const errorTests = Object.values(this.results.tests).filter(t => t.status === 'error').length;
    
    // 서비스 통계
    const healthyServices = Object.values(this.results.services).filter(s => s.status === 'healthy').length;
    const totalServices = Object.keys(this.results.services).length;
    
    // MCP 서버 통계
    const activeMCPServers = Object.values(this.mcpServers).filter(s => s.active).length;
    
    const report = {
      summary: {
        startTime: new Date(this.results.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Math.round(totalDuration / 1000) + 's',
        totalTests,
        passedTests,
        failedTests,
        errorTests,
        successRate: Math.round((passedTests / totalTests) * 100) + '%'
      },
      services: {
        total: totalServices,
        healthy: healthyServices,
        healthRate: Math.round((healthyServices / totalServices) * 100) + '%'
      },
      mcp: {
        active: activeMCPServers,
        servers: Object.keys(this.mcpServers).filter(name => this.mcpServers[name].active)
      },
      tests: this.results.tests,
      errors: this.results.errors
    };
    
    // 콘솔 출력
    console.log('\n📋 테스트 실행 결과 요약');
    console.log('=' * 50);
    console.log(`⏱️  총 실행 시간: ${report.summary.duration}`);
    console.log(`🧪 테스트 결과: ${passedTests}/${totalTests} 통과 (${report.summary.successRate})`);
    console.log(`🏥 서비스 상태: ${healthyServices}/${totalServices} 정상 (${report.services.healthRate})`);
    console.log(`🤖 MCP 서버: ${activeMCPServers}개 활성화`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ 발생한 오류들:');
      this.results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    // 파일로 저장
    const reportPath = 'test-results/test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 상세 리포트: ${reportPath}`);
    
    // HTML 리포트 생성
    await this.generateHTMLReport(report);
    
    return report;
  }

  // HTML 리포트 생성
  async generateHTMLReport(report) {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>yameyame E2E 테스트 리포트</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { padding: 20px; background: #f8f9fa; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .stat-value { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .stat-label { color: #666; font-size: 0.9em; }
        .test-results { margin-top: 30px; }
        .test-item { padding: 15px; margin: 10px 0; border-radius: 6px; }
        .test-passed { background: #d4edda; border-left: 4px solid #28a745; }
        .test-failed { background: #f8d7da; border-left: 4px solid #dc3545; }
        .test-error { background: #fff3cd; border-left: 4px solid #ffc107; }
        .errors { margin-top: 30px; padding: 20px; background: #f8d7da; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎭 yameyame E2E 테스트 리포트</h1>
          <p>생성 시간: ${report.summary.endTime}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${report.summary.totalTests}</div>
            <div class="stat-label">총 테스트</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: #28a745">${report.summary.passedTests}</div>
            <div class="stat-label">통과</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: #dc3545">${report.summary.failedTests}</div>
            <div class="stat-label">실패</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${report.summary.successRate}</div>
            <div class="stat-label">성공률</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${report.summary.duration}</div>
            <div class="stat-label">실행 시간</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${report.mcp.active}</div>
            <div class="stat-label">MCP 서버</div>
          </div>
        </div>
        
        <div class="test-results">
          <h2>📊 상세 테스트 결과</h2>
          ${Object.entries(report.tests).map(([testName, result]) => `
            <div class="test-item test-${result.status}">
              <strong>${testName}</strong>
              <div>상태: ${result.status} | 시간: ${result.duration}ms</div>
              ${result.error ? `<div style="color: #721c24; margin-top: 10px;">오류: ${result.error}</div>` : ''}
            </div>
          `).join('')}
        </div>
        
        ${report.errors.length > 0 ? `
          <div class="errors">
            <h2>❌ 오류 목록</h2>
            <ul>
              ${report.errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
    `;
    
    fs.writeFileSync('test-results/test-report.html', htmlContent);
    console.log('🌐 HTML 리포트: test-results/test-report.html');
  }

  // 정리 작업
  async cleanup() {
    console.log('🧹 정리 작업 중...');
    
    // MCP 서버 종료
    for (const [serverName, config] of Object.entries(this.mcpServers)) {
      if (config.active && config.process) {
        console.log(`🔌 ${serverName} MCP 서버 종료 중...`);
        config.process.kill();
      }
    }
    
    console.log('✅ 정리 작업 완료');
  }
}

// CLI 인터페이스
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // 인자 파싱
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--suites':
        options.suites = args[++i]?.split(',') || ['smoke'];
        break;
      case '--browsers':
        options.browsers = args[++i]?.split(',') || ['chromium'];
        break;
      case '--devices':
        options.devices = args[++i]?.split(',') || ['desktop'];
        break;
      case '--mcp':
        options.mcpServers = args[++i]?.split(',') || ['playwright'];
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--help':
        console.log(`
yameyame Playwright MCP 테스트 실행기

사용법:
  node playwright-test-runner.js [옵션]

옵션:
  --suites <suite1,suite2>     테스트 스위트 (smoke,userflows,realtime,performance,visual,accessibility)
  --browsers <browser1,browser2>  브라우저 (chromium,firefox,webkit)  
  --devices <device1,device2>   디바이스 (desktop,mobile)
  --mcp <server1,server2>      MCP 서버 (playwright,sequential,context7,magic)
  --headed                     헤드 모드 실행
  --debug                      디버그 모드
  --help                       도움말 표시

예시:
  node playwright-test-runner.js --suites smoke,userflows --browsers chromium,firefox
  node playwright-test-runner.js --suites performance --mcp playwright,sequential --headed
        `);
        process.exit(0);
    }
  }
  
  // 테스트 실행
  const runner = new PlaywrightMCPTestRunner();
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 테스트 중단됨');
    await runner.cleanup();
    process.exit(130);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 테스트 종료됨');
    await runner.cleanup();
    process.exit(143);
  });
  
  runner.run(options)
    .then(async () => {
      await runner.cleanup();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('💥 치명적 오류:', error);
      await runner.cleanup();
      process.exit(1);
    });
}

module.exports = PlaywrightMCPTestRunner;