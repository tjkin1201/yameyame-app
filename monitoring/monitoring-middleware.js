/**
 * YAMEYAME 모니터링 미들웨어
 * 각 서비스에서 공통으로 사용할 모니터링 기능
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MonitoringMiddleware {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.options = {
      monitoringServerUrl: options.monitoringServerUrl || 'http://localhost:9999',
      logToFile: options.logToFile !== false,
      logToConsole: options.logToConsole !== false,
      sendToMonitoring: options.sendToMonitoring !== false,
      healthCheckInterval: options.healthCheckInterval || 30000,
      ...options
    };

    this.metrics = {
      requests: 0,
      errors: 0,
      responses: {},
      uptime: Date.now()
    };

    this.logBuffer = [];
    this.maxLogBuffer = 500; // Reduced from 1000
    this.timers = new Set(); // Track timers for cleanup
    this.setupLogging();
    
    if (this.options.sendToMonitoring) {
      this.startHealthReporting();
    }
  }

  /**
   * Express 미들웨어 생성
   */
  express() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // 요청 로깅
      this.log('INFO', `${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // 응답 모니터링
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // 메트릭 업데이트
        this.metrics.requests++;
        this.metrics.responses[res.statusCode] = 
          (this.metrics.responses[res.statusCode] || 0) + 1;

        if (res.statusCode >= 400) {
          this.metrics.errors++;
          this.log('ERROR', `HTTP ${res.statusCode} ${req.method} ${req.path}`, {
            statusCode: res.statusCode,
            responseTime,
            method: req.method,
            path: req.path
          });
        } else {
          this.log('INFO', `HTTP ${res.statusCode} ${req.method} ${req.path} - ${responseTime}ms`, {
            statusCode: res.statusCode,
            responseTime,
            method: req.method,
            path: req.path
          });
        }

        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  /**
   * 로그 기록
   */
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message,
      metadata,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    // 버퍼에 추가 with memory management
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxLogBuffer) {
      this.logBuffer = this.logBuffer.slice(-this.maxLogBuffer);
    }
    
    // Clear metadata references to help GC
    if (typeof logEntry.metadata === 'object') {
      logEntry.metadata = JSON.parse(JSON.stringify(logEntry.metadata));
    }

    // 콘솔 출력
    if (this.options.logToConsole) {
      const timestamp = new Date().toLocaleTimeString('ko-KR');
      console.log(`[${timestamp}] ${this.serviceName} - ${level}: ${message}`);
    }

    // 파일 저장 (비동기)
    if (this.options.logToFile) {
      this.saveLogToFile(logEntry).catch(console.error);
    }

    // 모니터링 서버로 전송
    if (this.options.sendToMonitoring) {
      this.sendToMonitoringServer(logEntry).catch(console.error);
    }
  }

  /**
   * 메모리 최적화된 로그 파일 저장
   */
  async saveLogToFile(logEntry) {
    try {
      const logsDir = path.join(__dirname, 'logs', this.serviceName);
      await fs.ensureDir(logsDir);

      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(logsDir, `${today}.json`);

      // Stream-based approach to avoid loading entire file into memory
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(logFile, logLine);
      
      // Rotate logs if file gets too large (>10MB)
      const stats = await fs.stat(logFile).catch(() => ({ size: 0 }));
      if (stats.size > 10 * 1024 * 1024) {
        const rotatedFile = `${logFile}.${Date.now()}.old`;
        await fs.move(logFile, rotatedFile).catch(() => {});
      }
    } catch (error) {
      // Silently handle log file errors to prevent cascading issues
    }
  }

  /**
   * 배치 방식 모니터링 서버 로그 전송
   */
  async sendToMonitoringServer(logEntry) {
    try {
      // 메모리에 배치 수집 후 주기적으로 전송
      if (!this.batchLogs) {
        this.batchLogs = [];
      }
      
      this.batchLogs.push({
        timestamp: logEntry.timestamp,
        service: logEntry.service,
        level: logEntry.level,
        message: logEntry.message,
        pid: logEntry.pid
      });
      
      // 50개씩 배치 처리
      if (this.batchLogs.length >= 50) {
        const batch = this.batchLogs.splice(0, 50);
        const monitoringLogDir = path.join(__dirname, 'monitoring-queue');
        await fs.ensureDir(monitoringLogDir);
        
        const filename = `${this.serviceName}-batch-${Date.now()}.json`;
        const filepath = path.join(monitoringLogDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(batch));
      }
    } catch (error) {
      // 모니터링 서버 전송 실패는 조용히 처리
    }
  }

  /**
   * 헬스 체크 정보 생성
   */
  getHealthStatus() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      service: this.serviceName,
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        memory: memUsage,
        cpu: cpuUsage
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      },
      metrics: {
        ...this.metrics,
        uptimeSince: new Date(this.metrics.uptime).toISOString()
      },
      recentLogs: this.logBuffer.slice(-5) // 최근 5개 로그 (메모리 절약)
    };
  }

  /**
   * 메모리 누수 방지를 위한 헬스 리포팅
   */
  startHealthReporting() {
    const healthTimer = setInterval(() => {
      this.reportHealth();
    }, this.options.healthCheckInterval);
    
    this.timers.add(healthTimer);

    // 초기 리포트
    const initialTimer = setTimeout(() => this.reportHealth(), 1000);
    this.timers.add(initialTimer);
  }

  /**
   * 헬스 상태 리포트
   */
  async reportHealth() {
    try {
      const healthData = this.getHealthStatus();
      
      // 파일 기반 헬스 리포트
      const healthDir = path.join(__dirname, 'health-reports');
      await fs.ensureDir(healthDir);
      
      const healthFile = path.join(healthDir, `${this.serviceName}.json`);
      await fs.writeFile(healthFile, JSON.stringify(healthData, null, 2));
      
      this.log('DEBUG', '헬스 리포트 전송 완료');
      
    } catch (error) {
      this.log('ERROR', `헬스 리포트 실패: ${error.message}`);
    }
  }

  /**
   * 에러 핸들링 미들웨어 (Express용)
   */
  errorHandler() {
    return (error, req, res, next) => {
      this.log('ERROR', `Unhandled error: ${error.message}`, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        request: {
          method: req.method,
          path: req.path,
          body: req.body,
          params: req.params,
          query: req.query
        }
      });

      // 에러 메트릭 업데이트
      this.metrics.errors++;

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          timestamp: new Date().toISOString(),
          requestId: req.id || 'unknown'
        });
      }
    };
  }

  /**
   * 프로세스 이벤트 모니터링
   */
  setupProcessMonitoring() {
    // 처리되지 않은 예외
    process.on('uncaughtException', (error) => {
      this.log('CRITICAL', `Uncaught Exception: ${error.message}`, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
    });

    // 처리되지 않은 Promise 거부
    process.on('unhandledRejection', (reason, promise) => {
      this.log('CRITICAL', `Unhandled Rejection: ${reason}`, {
        promise: promise.toString(),
        reason: reason.toString()
      });
    });

    // 프로세스 종료 시그널
    process.on('SIGINT', () => {
      this.log('INFO', 'SIGINT 수신 - 서비스 종료 중');
    });

    process.on('SIGTERM', () => {
      this.log('INFO', 'SIGTERM 수신 - 서비스 종료 중');
    });

    // 메모리 사용량 모니터링 with cleanup
    const memoryTimer = setInterval(() => {
      const memUsage = process.memoryUsage();
      const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      if (memoryUsagePercent > 75) {
        this.log('WARNING', `높은 메모리 사용률: ${memoryUsagePercent.toFixed(2)}%`, {
          memory: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            rss: memUsage.rss
          }
        });
        
        // Aggressive cleanup when memory is high
        this.performMemoryCleanup();
      }
    }, 60000); // 1분마다 체크
    
    this.timers.add(memoryTimer);
  }

  /**
   * 로깅 설정
   */
  setupLogging() {
    // 프로세스 모니터링 설정
    this.setupProcessMonitoring();
    
    // 시작 로그
    this.log('INFO', `${this.serviceName} 모니터링 시작`, {
      pid: process.pid,
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch()
    });
  }

  /**
   * 커스텀 메트릭 추가
   */
  incrementMetric(name, value = 1) {
    if (!this.metrics.custom) {
      this.metrics.custom = {};
    }
    this.metrics.custom[name] = (this.metrics.custom[name] || 0) + value;
  }

  /**
   * 커스텀 메트릭 설정
   */
  setMetric(name, value) {
    if (!this.metrics.custom) {
      this.metrics.custom = {};
    }
    this.metrics.custom[name] = value;
  }
  
  /**
   * 메모리 정리 수행
   */
  performMemoryCleanup() {
    // 로그 버퍼 축소
    this.logBuffer = this.logBuffer.slice(-200);
    
    // 배치 로그 정리
    if (this.batchLogs && this.batchLogs.length > 20) {
      this.batchLogs = this.batchLogs.slice(-20);
    }
    
    // GC 권장 (개발용)
    if (global.gc) {
      global.gc();
    }
    
    this.log('INFO', '메모리 정리 완료', {
      logBufferSize: this.logBuffer.length,
      batchLogsSize: this.batchLogs ? this.batchLogs.length : 0
    });
  }
  
  /**
   * 리소스 정리
   */
  cleanup() {
    // 모든 타이머 정리
    this.timers.forEach(timer => {
      clearInterval(timer);
      clearTimeout(timer);
    });
    this.timers.clear();
    
    // 버퍼 정리
    this.logBuffer.length = 0;
    if (this.batchLogs) {
      this.batchLogs.length = 0;
    }
    
    this.log('INFO', '모니터링 미들웨어 정리 완료');
  }
}

module.exports = MonitoringMiddleware;