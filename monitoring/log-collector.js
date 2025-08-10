/**
 * YAMEYAME 로그 수집기
 * 5개 마이크로서비스의 로그를 실시간으로 수집하고 중앙 저장소에 관리
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const pidusage = require('pidusage');

class LogCollector {
  constructor() {
    this.services = {
      'backend-api': {
        name: '백엔드 API',
        port: 3000,
        logPath: '../worktrees/backend-api/logs',
        status: 'unknown',
        pid: null,
        metrics: {}
      },
      'band-integration': {
        name: '밴드 연동',
        port: 3002,
        logPath: '../worktrees/band-integration/logs',
        status: 'unknown',
        pid: null,
        metrics: {}
      },
      'database-layer': {
        name: '데이터베이스',
        port: 3003,
        logPath: '../worktrees/database-layer/logs',
        status: 'unknown',
        pid: null,
        metrics: {}
      },
      'realtime-socket': {
        name: '실시간 소켓',
        port: 3001,
        logPath: '../worktrees/realtime-socket/logs',
        status: 'unknown',
        pid: null,
        metrics: {}
      },
      'frontend-ui': {
        name: '프론트엔드',
        port: 8081,
        logPath: '../worktrees/frontend-ui/logs',
        status: 'unknown',
        pid: null,
        metrics: {}
      }
    };

    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.logsDir = path.join(__dirname, 'logs');
    this.metricsDir = path.join(__dirname, 'metrics');
    
    this.initializeDirectories();
  }

  /**
   * 로그 및 메트릭 디렉토리 초기화
   */
  async initializeDirectories() {
    await fs.ensureDir(this.logsDir);
    await fs.ensureDir(this.metricsDir);
    
    // 서비스별 로그 디렉토리 생성
    for (const serviceId of Object.keys(this.services)) {
      await fs.ensureDir(path.join(this.logsDir, serviceId));
    }

    console.log('📁 로그 디렉토리 초기화 완료');
  }

  /**
   * 서비스 상태 확인
   */
  async checkServiceHealth(serviceId) {
    const service = this.services[serviceId];
    
    try {
      // 포트 체크
      const isPortActive = await this.checkPort(service.port);
      
      if (isPortActive) {
        service.status = 'running';
        
        // PID 찾기 (Windows 환경)
        try {
          const { spawn } = require('child_process');
          const netstat = spawn('netstat', ['-ano']);
          
          let data = '';
          netstat.stdout.on('data', (chunk) => {
            data += chunk.toString();
          });
          
          netstat.on('close', () => {
            const lines = data.split('\n');
            for (const line of lines) {
              if (line.includes(`:${service.port} `) && line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                service.pid = parseInt(parts[parts.length - 1]);
                break;
              }
            }
          });
          
        } catch (error) {
          console.warn(`⚠️  PID 찾기 실패 - ${serviceId}:`, error.message);
        }
      } else {
        service.status = 'stopped';
        service.pid = null;
      }
    } catch (error) {
      service.status = 'error';
      service.pid = null;
      this.logEvent(serviceId, 'ERROR', `Health check failed: ${error.message}`);
    }
  }

  /**
   * 포트 활성화 상태 확인
   */
  async checkPort(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    });
  }

  /**
   * 시스템 메트릭 수집
   */
  async collectSystemMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        cpu: os.loadavg(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        uptime: os.uptime()
      },
      services: {}
    };

    // 각 서비스별 메트릭 수집
    for (const [serviceId, service] of Object.entries(this.services)) {
      await this.checkServiceHealth(serviceId);
      
      metrics.services[serviceId] = {
        name: service.name,
        status: service.status,
        port: service.port,
        pid: service.pid
      };

      // PID가 있으면 프로세스 메트릭 수집
      if (service.pid) {
        try {
          const processStats = await pidusage(service.pid);
          metrics.services[serviceId].processMetrics = {
            cpu: processStats.cpu.toFixed(2),
            memory: processStats.memory,
            ppid: processStats.ppid,
            ctime: processStats.ctime,
            elapsed: processStats.elapsed
          };
        } catch (error) {
          console.warn(`⚠️  프로세스 메트릭 수집 실패 - ${serviceId}:`, error.message);
        }
      }
    }

    return metrics;
  }

  /**
   * 로그 이벤트 기록
   */
  logEvent(serviceId, level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: serviceId,
      level: level,
      message: message,
      metadata: metadata
    };

    // 버퍼에 추가
    this.logBuffer.push(logEntry);
    
    // 버퍼 크기 제한
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // 콘솔 출력
    const timestamp = new Date().toLocaleTimeString('ko-KR');
    console.log(`[${timestamp}] ${serviceId} - ${level}: ${message}`);
  }

  /**
   * 로그를 파일에 저장
   */
  async saveLogs() {
    if (this.logBuffer.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `combined-${today}.json`);
    
    try {
      let existingLogs = [];
      if (await fs.pathExists(logFile)) {
        const data = await fs.readFile(logFile, 'utf8');
        existingLogs = JSON.parse(data);
      }

      existingLogs.push(...this.logBuffer);
      await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2));
      
      console.log(`💾 로그 저장 완료: ${this.logBuffer.length}개 항목`);
      this.logBuffer = [];
      
    } catch (error) {
      console.error('❌ 로그 저장 실패:', error.message);
    }
  }

  /**
   * 메트릭을 파일에 저장
   */
  async saveMetrics(metrics) {
    const filename = `metrics-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const filepath = path.join(this.metricsDir, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(metrics, null, 2));
      
      // 최신 메트릭 파일도 업데이트
      const latestPath = path.join(this.metricsDir, 'latest.json');
      await fs.writeFile(latestPath, JSON.stringify(metrics, null, 2));
      
    } catch (error) {
      console.error('❌ 메트릭 저장 실패:', error.message);
    }
  }

  /**
   * 오래된 로그 및 메트릭 파일 정리
   */
  async cleanupOldFiles() {
    const retentionDays = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      // 로그 파일 정리
      const logFiles = await fs.readdir(this.logsDir);
      for (const file of logFiles) {
        const filePath = path.join(this.logsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate && file.startsWith('combined-')) {
          await fs.remove(filePath);
          console.log(`🗑️  오래된 로그 파일 삭제: ${file}`);
        }
      }

      // 메트릭 파일 정리 (latest.json 제외)
      const metricFiles = await fs.readdir(this.metricsDir);
      for (const file of metricFiles) {
        if (file === 'latest.json') continue;
        
        const filePath = path.join(this.metricsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
          console.log(`🗑️  오래된 메트릭 파일 삭제: ${file}`);
        }
      }
      
    } catch (error) {
      console.error('❌ 파일 정리 실패:', error.message);
    }
  }

  /**
   * 수집기 시작
   */
  async start() {
    console.log('🚀 YAMEYAME 로그 수집기 시작');
    
    // 초기 서비스 상태 확인
    for (const serviceId of Object.keys(this.services)) {
      await this.checkServiceHealth(serviceId);
    }

    // 주기적 작업 스케줄링
    const cron = require('node-cron');
    
    // 매분마다 메트릭 수집
    cron.schedule('* * * * *', async () => {
      try {
        const metrics = await this.collectSystemMetrics();
        await this.saveMetrics(metrics);
      } catch (error) {
        console.error('❌ 메트릭 수집 오류:', error.message);
      }
    });

    // 5분마다 로그 저장
    cron.schedule('*/5 * * * *', async () => {
      await this.saveLogs();
    });

    // 매일 자정에 파일 정리
    cron.schedule('0 0 * * *', async () => {
      await this.cleanupOldFiles();
    });

    // 초기 메트릭 수집
    const initialMetrics = await this.collectSystemMetrics();
    await this.saveMetrics(initialMetrics);

    console.log('✅ 로그 수집기 초기화 완료');
    console.log('📊 메트릭 수집 주기: 1분');
    console.log('💾 로그 저장 주기: 5분');
    console.log('🗑️  파일 정리 주기: 매일 자정');
  }

  /**
   * 현재 상태 반환 (모니터링 서버용)
   */
  getStatus() {
    return {
      services: this.services,
      logBufferSize: this.logBuffer.length,
      recentLogs: this.logBuffer.slice(-10) // 최근 10개 로그
    };
  }
}

// 직접 실행시 수집기 시작
if (require.main === module) {
  const collector = new LogCollector();
  collector.start().catch(console.error);
}

module.exports = LogCollector;