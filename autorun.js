#!/usr/bin/env node

/**
 * YAMEYAME 통합 AutoRun 시스템
 * 
 * 특징:
 * - 언어 중립적 서비스 관리
 * - PowerShell과 Node.js 통합
 * - 실시간 모니터링 연동
 * - 확장 가능한 플러그인 아키텍처
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn, exec } = require('child_process');
const axios = require('axios');

class YameYameAutoRun {
  constructor(configPath = './config/services.json') {
    this.configPath = configPath;
    this.config = null;
    this.services = new Map();
    this.processes = new Map();
    this.metrics = new Map();
    this.startTime = null;
    this.plugins = new Map();
    
    // 상태 추적
    this.isRunning = false;
    this.shutdownInProgress = false;
    
    this.loadConfiguration();
    this.setupEventHandlers();
  }

  /**
   * 설정 파일 로드 및 검증
   */
  async loadConfiguration() {
    try {
      this.config = await fs.readJson(this.configPath);
      this.validateConfiguration();
      console.log(`✅ 설정 로드 완료: ${Object.keys(this.config.services).length}개 서비스`);
    } catch (error) {
      console.error(`❌ 설정 로드 실패: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * 설정 유효성 검사
   */
  validateConfiguration() {
    if (!this.config.services || Object.keys(this.config.services).length === 0) {
      throw new Error('서비스 정의가 없습니다');
    }

    // 의존성 순환 참조 검사
    const visited = new Set();
    const recursion = new Set();
    
    const hasCycle = (serviceId) => {
      if (recursion.has(serviceId)) return true;
      if (visited.has(serviceId)) return false;
      
      visited.add(serviceId);
      recursion.add(serviceId);
      
      const service = this.config.services[serviceId];
      if (service.dependencies) {
        for (const dep of service.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }
      
      recursion.delete(serviceId);
      return false;
    };

    for (const serviceId of Object.keys(this.config.services)) {
      if (hasCycle(serviceId)) {
        throw new Error(`순환 의존성 발견: ${serviceId}`);
      }
    }
  }

  /**
   * 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error('❌ 처리되지 않은 예외:', error);
      this.gracefulShutdown('EXCEPTION');
    });
  }

  /**
   * 메인 시작 함수
   */
  async start(options = {}) {
    console.log('\n🚀 YameYame AutoRun 시작');
    console.log('='.repeat(50));
    
    this.startTime = Date.now();
    this.isRunning = true;
    
    const {
      mockMode = false,
      turboMode = false,
      skipPrerequisites = false,
      parallelStartup = true,
      monitoringEnabled = true
    } = options;

    try {
      // 1. 사전 요구사항 검사
      if (!skipPrerequisites) {
        await this.checkPrerequisites();
      }

      // 2. 기존 프로세스 정리
      await this.cleanup(turboMode);

      // 3. 모니터링 서버 시작 (선택적)
      if (monitoringEnabled && this.config.integrations?.monitoring?.enabled) {
        await this.startMonitoring();
      }

      // 4. 서비스 시작 (병렬 또는 순차)
      if (parallelStartup) {
        await this.startServicesParallel(mockMode, turboMode);
      } else {
        await this.startServicesSequential(mockMode);
      }

      // 5. 최종 헬스체크
      await this.finalHealthCheck();

      // 6. 성공 요약 출력
      this.printSuccessSummary();

      return true;

    } catch (error) {
      console.error(`❌ 시작 실패: ${error.message}`);
      await this.cleanup(true);
      return false;
    }
  }

  /**
   * 사전 요구사항 검사
   */
  async checkPrerequisites() {
    console.log('🔍 사전 요구사항 검사...');
    
    const checks = [
      { name: 'Node.js', command: 'node --version' },
      { name: 'npm', command: 'npm --version' }
    ];

    for (const check of checks) {
      try {
        const version = await this.executeCommand(check.command);
        console.log(`  ✅ ${check.name}: ${version.trim()}`);
      } catch (error) {
        throw new Error(`${check.name}이 설치되지 않았습니다`);
      }
    }

    // 서비스 경로 검사
    for (const [serviceId, service] of Object.entries(this.config.services)) {
      if (!await fs.pathExists(service.path)) {
        console.warn(`  ⚠️ ${service.name} 경로 없음: ${service.path}`);
      } else {
        console.log(`  ✅ ${service.name} 경로 확인`);
      }
    }
  }

  /**
   * 기존 프로세스 정리
   */
  async cleanup(quickMode = false) {
    console.log('🧹 기존 프로세스 정리...');
    
    if (quickMode) {
      // 터보 모드: 포트 기반으로만 정리
      const ports = Object.values(this.config.services).map(s => s.port);
      await this.killProcessesByPorts(ports);
    } else {
      // 일반 모드: 프로세스명으로 정리
      const processNames = ['node', 'tsx', 'ts-node', 'nodemon'];
      await this.killProcessesByNames(processNames);
    }
    
    // 잠시 대기 (포트 해제)
    await this.sleep(quickMode ? 500 : 2000);
  }

  /**
   * 모니터링 서버 시작
   */
  async startMonitoring() {
    const monitoringService = this.config.services.monitoring;
    if (!monitoringService) return;

    console.log('📊 모니터링 서버 시작...');
    
    try {
      await this.startService('monitoring', monitoringService, false);
      
      // 모니터링 서버 준비 대기
      await this.waitForHealthCheck('monitoring', monitoringService);
      
      console.log(`  ✅ 모니터링 대시보드: http://localhost:${monitoringService.port}`);
    } catch (error) {
      console.warn(`  ⚠️ 모니터링 서버 시작 실패: ${error.message}`);
    }
  }

  /**
   * 병렬 서비스 시작
   */
  async startServicesParallel(mockMode = false, turboMode = false) {
    console.log('⚡ 병렬 서비스 시작...');
    
    const serviceEntries = Object.entries(this.config.services)
      .filter(([id]) => id !== 'monitoring')
      .sort(([,a], [,b]) => a.layer - b.layer);
    
    const startedServices = new Set();
    const runningPromises = new Map();
    const readyServices = new Set();
    
    while (startedServices.size < serviceEntries.length || runningPromises.size > 0) {
      // 시작 가능한 서비스 찾기
      for (const [serviceId, service] of serviceEntries) {
        if (startedServices.has(serviceId)) continue;
        
        const canStart = this.canStartService(serviceId, service, readyServices);
        if (canStart) {
          console.log(`  🚀 ${service.name} 시작...`);
          
          const promise = this.startServiceWithHealth(serviceId, service, mockMode)
            .then(success => ({ serviceId, success }))
            .catch(error => ({ serviceId, success: false, error }));
          
          runningPromises.set(serviceId, promise);
          startedServices.add(serviceId);
        }
      }

      // 완료된 서비스 확인
      if (runningPromises.size > 0) {
        const completed = await Promise.race([...runningPromises.values()]);
        const { serviceId, success, error } = completed;
        
        runningPromises.delete(serviceId);
        
        if (success) {
          readyServices.add(serviceId);
          const service = this.config.services[serviceId];
          console.log(`  ✅ ${service.name} 준비 완료`);
          
          // 성능 메트릭 기록
          this.recordServiceMetric(serviceId, 'startupTime', Date.now() - this.startTime);
        } else {
          const service = this.config.services[serviceId];
          if (service.critical) {
            throw new Error(`중요 서비스 실패: ${service.name} - ${error?.message || '알 수 없는 오류'}`);
          } else {
            console.warn(`  ⚠️ ${service.name} 시작 실패 (선택적): ${error?.message || '알 수 없는 오류'}`);
          }
        }
      }

      // CPU 스핀 방지
      if (runningPromises.size > 0) {
        await this.sleep(200);
      }
    }
  }

  /**
   * 서비스 시작 가능 여부 확인
   */
  canStartService(serviceId, service, readyServices) {
    // 필수 의존성 확인
    if (service.dependencies) {
      for (const dep of service.dependencies) {
        if (!readyServices.has(dep)) return false;
      }
    }
    
    // 조기 시작 가능 여부
    if (service.performance?.earlyStart) {
      if (service.dependencies) {
        for (const dep of service.dependencies) {
          if (this.processes.has(dep)) return true; // 의존성이 시작되었으면 조기 시작 가능
        }
      }
    }
    
    return true;
  }

  /**
   * 서비스 시작 + 헬스체크
   */
  async startServiceWithHealth(serviceId, service, mockMode = false) {
    try {
      await this.startService(serviceId, service, mockMode);
      await this.waitForHealthCheck(serviceId, service);
      return true;
    } catch (error) {
      console.error(`❌ ${service.name} 시작 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 개별 서비스 시작
   */
  async startService(serviceId, service, mockMode = false) {
    const command = mockMode && service.command.mock ? service.command.mock : service.command.dev;
    const cwd = path.resolve(service.path);
    
    // 환경 변수 설정
    const env = {
      ...process.env,
      PORT: service.port.toString(),
      NODE_ENV: 'development'
    };
    
    if (mockMode) {
      env.MOCK_MODE = 'true';
    }

    // 프로세스 시작
    const childProcess = spawn('npm', ['run', 'dev'], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    // 프로세스 추적
    this.processes.set(serviceId, {
      process: childProcess,
      service,
      startTime: Date.now()
    });

    // 로그 처리
    this.setupProcessLogging(serviceId, childProcess);

    // 프로세스 종료 처리
    childProcess.on('exit', (code, signal) => {
      console.log(`🔄 ${service.name} 프로세스 종료: code=${code}, signal=${signal}`);
      this.processes.delete(serviceId);
    });

    return childProcess;
  }

  /**
   * 프로세스 로깅 설정
   */
  setupProcessLogging(serviceId, childProcess) {
    const service = this.config.services[serviceId];
    
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`[${service.name}] ${output}`);
      }
    });

    childProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('ExperimentalWarning')) {
        console.error(`[${service.name}] ${output}`);
      }
    });
  }

  /**
   * 헬스체크 대기
   */
  async waitForHealthCheck(serviceId, service, maxRetries = null) {
    const retries = maxRetries || service.performance?.healthRetries || 15;
    const interval = service.performance?.healthInterval || 0.5;
    
    const baseUrl = `http://localhost:${service.port}`;
    const healthUrl = `${baseUrl}${service.healthPath}`;
    
    for (let i = 1; i <= retries; i++) {
      try {
        const response = await axios.get(healthUrl, { timeout: 3000 });
        if (response.status === 200) {
          return true;
        }
      } catch (error) {
        if (i === retries) {
          throw new Error(`헬스체크 실패 (${retries}회 시도): ${healthUrl}`);
        }
        await this.sleep(interval * 1000);
      }
    }
    
    return false;
  }

  /**
   * 최종 헬스체크
   */
  async finalHealthCheck() {
    console.log('🏥 최종 헬스체크...');
    
    const healthChecks = [];
    
    for (const [serviceId, processInfo] of this.processes) {
      const service = this.config.services[serviceId];
      const healthCheck = this.waitForHealthCheck(serviceId, service, 3);
      healthChecks.push({ serviceId, service, promise: healthCheck });
    }
    
    const results = await Promise.allSettled(healthChecks.map(hc => hc.promise));
    
    let healthyCount = 0;
    results.forEach((result, index) => {
      const { serviceId, service } = healthChecks[index];
      if (result.status === 'fulfilled' && result.value) {
        console.log(`  ✅ ${service.name} 정상`);
        healthyCount++;
      } else {
        console.warn(`  ⚠️ ${service.name} 헬스체크 실패`);
      }
    });
    
    console.log(`📊 헬스체크 결과: ${healthyCount}/${healthChecks.length} 서비스 정상`);
  }

  /**
   * 성공 요약 출력
   */
  printSuccessSummary() {
    const totalTime = Date.now() - this.startTime;
    const runningServices = this.processes.size;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 YameYame AutoRun 완료!');
    console.log('='.repeat(60));
    
    console.log(`⏱️  총 시작 시간: ${(totalTime / 1000).toFixed(1)}초`);
    console.log(`🚀 실행 중인 서비스: ${runningServices}개`);
    
    console.log('\n📍 서비스 엔드포인트:');
    for (const [serviceId, processInfo] of this.processes) {
      const service = this.config.services[serviceId];
      console.log(`   • ${service.name} → http://localhost:${service.port}`);
    }
    
    if (this.config.integrations?.monitoring?.enabled) {
      const monitoringUrl = this.config.integrations.monitoring.dashboardUrl;
      console.log(`\n📊 모니터링 대시보드: ${monitoringUrl}`);
    }
    
    console.log('\n🔧 관리 명령어:');
    console.log('   npm run dev:status    → 서비스 상태 확인');
    console.log('   npm run autorun:stop  → 모든 서비스 중지');
    console.log('   Ctrl+C                → 안전 종료');
  }

  /**
   * 안전한 종료
   */
  async gracefulShutdown(signal = 'SIGINT') {
    if (this.shutdownInProgress) return;
    
    console.log(`\n🛑 ${signal} 신호 수신 - 안전 종료 시작...`);
    this.shutdownInProgress = true;
    
    // 모든 프로세스 종료
    const shutdownPromises = [];
    
    for (const [serviceId, processInfo] of this.processes) {
      const { process, service } = processInfo;
      
      console.log(`  🔄 ${service.name} 종료 중...`);
      
      const shutdownPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`  💥 ${service.name} 강제 종료`);
          process.kill('SIGKILL');
          resolve();
        }, 5000);
        
        process.on('exit', () => {
          clearTimeout(timeout);
          console.log(`  ✅ ${service.name} 정상 종료`);
          resolve();
        });
        
        process.kill('SIGTERM');
      });
      
      shutdownPromises.push(shutdownPromise);
    }
    
    await Promise.all(shutdownPromises);
    
    console.log('✅ 모든 서비스 종료 완료');
    process.exit(0);
  }

  // 유틸리티 함수들
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }

  async killProcessesByPorts(ports) {
    for (const port of ports) {
      try {
        await this.executeCommand(`netstat -ano | findstr :${port}`);
        await this.executeCommand(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`);
      } catch (error) {
        // 포트가 사용되지 않는 경우 무시
      }
    }
  }

  async killProcessesByNames(names) {
    for (const name of names) {
      try {
        await this.executeCommand(`taskkill /F /IM ${name}.exe /T`);
      } catch (error) {
        // 프로세스가 없는 경우 무시
      }
    }
  }

  recordServiceMetric(serviceId, metric, value) {
    if (!this.metrics.has(serviceId)) {
      this.metrics.set(serviceId, {});
    }
    this.metrics.get(serviceId)[metric] = value;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // CLI 옵션 파싱
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mock':
      case '-m':
        options.mockMode = true;
        break;
      case '--turbo':
      case '-t':
        options.turboMode = true;
        break;
      case '--skip-prereq':
        options.skipPrerequisites = true;
        break;
      case '--no-monitoring':
        options.monitoringEnabled = false;
        break;
      case '--sequential':
        options.parallelStartup = false;
        break;
    }
  }
  
  const autorun = new YameYameAutoRun();
  autorun.start(options).then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = YameYameAutoRun;