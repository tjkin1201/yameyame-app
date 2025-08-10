/**
 * YAMEYAME 통합 모니터링 서버
 * 웹소켓을 통한 실시간 대시보드 및 API 제공
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const LogCollector = require('./log-collector');

class MonitoringServer {
  constructor(port = 9999) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.collector = new LogCollector();
    
    this.clients = new Set();
    this.alerts = [];
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Express 미들웨어 설정
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(__dirname));
    
    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * REST API 라우트 설정
   */
  setupRoutes() {
    // 메인 대시보드
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'dashboard.html'));
    });

    // 서비스 상태 API
    this.app.get('/api/status', async (req, res) => {
      try {
        const metrics = await this.collector.collectSystemMetrics();
        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 서비스별 상세 정보
    this.app.get('/api/services/:serviceId', async (req, res) => {
      const { serviceId } = req.params;
      
      try {
        await this.collector.checkServiceHealth(serviceId);
        const service = this.collector.services[serviceId];
        
        if (!service) {
          return res.status(404).json({
            success: false,
            error: 'Service not found'
          });
        }

        res.json({
          success: true,
          data: service
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 로그 조회 API
    this.app.get('/api/logs', async (req, res) => {
      const { service, level, limit = 100 } = req.query;
      
      try {
        const status = this.collector.getStatus();
        let logs = status.recentLogs;

        // 서비스 필터
        if (service) {
          logs = logs.filter(log => log.service === service);
        }

        // 레벨 필터
        if (level) {
          logs = logs.filter(log => log.level === level);
        }

        // 제한 적용
        logs = logs.slice(-parseInt(limit));

        res.json({
          success: true,
          data: logs
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 메트릭 히스토리 API
    this.app.get('/api/metrics/history', async (req, res) => {
      try {
        const metricsDir = path.join(__dirname, 'metrics');
        const files = await fs.readdir(metricsDir);
        
        // 최근 24시간 데이터만 조회
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);
        
        const metrics = [];
        
        for (const file of files) {
          if (file === 'latest.json') continue;
          
          const filePath = path.join(metricsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime >= last24Hours) {
            const data = await fs.readJson(filePath);
            metrics.push(data);
          }
        }

        // 시간순 정렬
        metrics.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 알림 목록 API
    this.app.get('/api/alerts', (req, res) => {
      res.json({
        success: true,
        data: this.alerts
      });
    });

    // 알림 생성 API
    this.app.post('/api/alerts', (req, res) => {
      const { service, level, message } = req.body;
      
      const alert = {
        id: Date.now(),
        service,
        level,
        message,
        timestamp: new Date().toISOString(),
        acknowledged: false
      };

      this.alerts.unshift(alert);
      
      // 최대 100개 알림 유지
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(0, 100);
      }

      // 웹소켓으로 브로드캐스트
      this.broadcast('alert', alert);

      res.json({
        success: true,
        data: alert
      });
    });

    // 알림 확인 API
    this.app.put('/api/alerts/:id/acknowledge', (req, res) => {
      const { id } = req.params;
      const alert = this.alerts.find(a => a.id === parseInt(id));
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      alert.acknowledged = true;
      
      res.json({
        success: true,
        data: alert
      });
    });

    // 헬스체크 엔드포인트
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });
  }

  /**
   * 웹소켓 설정
   */
  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log(`🔌 새로운 클라이언트 연결: ${req.connection.remoteAddress}`);
      
      this.clients.add(ws);

      // 초기 데이터 전송
      this.sendInitialData(ws);

      // 메시지 핸들링
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('웹소켓 메시지 파싱 오류:', error.message);
        }
      });

      // 연결 종료 처리
      ws.on('close', () => {
        console.log('🔌 클라이언트 연결 해제');
        this.clients.delete(ws);
      });

      // 에러 처리
      ws.on('error', (error) => {
        console.error('웹소켓 에러:', error.message);
        this.clients.delete(ws);
      });
    });
  }

  /**
   * 초기 데이터 전송
   */
  async sendInitialData(ws) {
    try {
      const metrics = await this.collector.collectSystemMetrics();
      const status = this.collector.getStatus();
      
      ws.send(JSON.stringify({
        type: 'initial',
        data: {
          metrics,
          status,
          alerts: this.alerts.slice(0, 10) // 최근 10개 알림
        }
      }));
    } catch (error) {
      console.error('초기 데이터 전송 오류:', error.message);
    }
  }

  /**
   * 웹소켓 메시지 처리
   */
  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
        
      case 'subscribe':
        // 구독 로직 (필요시 구현)
        break;
        
      case 'unsubscribe':
        // 구독 해제 로직 (필요시 구현)
        break;
        
      default:
        console.log('알 수 없는 웹소켓 메시지:', data);
    }
  }

  /**
   * 모든 클라이언트에 브로드캐스트
   */
  broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('브로드캐스트 오류:', error.message);
          this.clients.delete(client);
        }
      }
    });
  }

  /**
   * 주기적 상태 업데이트
   */
  startPeriodicUpdates() {
    // 10초마다 메트릭 업데이트
    setInterval(async () => {
      try {
        const metrics = await this.collector.collectSystemMetrics();
        this.broadcast('metrics', metrics);
        
        // 서비스 다운 감지 및 알림
        this.checkServiceAlerts(metrics);
        
      } catch (error) {
        console.error('주기적 업데이트 오류:', error.message);
      }
    }, 10000);

    // 30초마다 로그 업데이트
    setInterval(() => {
      const status = this.collector.getStatus();
      this.broadcast('logs', status.recentLogs.slice(-20));
    }, 30000);
  }

  /**
   * 서비스 알림 체크
   */
  checkServiceAlerts(metrics) {
    const now = Date.now();
    
    for (const [serviceId, serviceMetrics] of Object.entries(metrics.services)) {
      // 서비스 다운 알림
      if (serviceMetrics.status === 'stopped' || serviceMetrics.status === 'error') {
        const existingAlert = this.alerts.find(alert => 
          alert.service === serviceId && 
          alert.level === 'CRITICAL' && 
          !alert.acknowledged &&
          now - new Date(alert.timestamp).getTime() < 300000 // 5분 내
        );

        if (!existingAlert) {
          const alert = {
            id: now,
            service: serviceId,
            level: 'CRITICAL',
            message: `서비스가 중단되었습니다: ${serviceMetrics.name}`,
            timestamp: new Date().toISOString(),
            acknowledged: false
          };

          this.alerts.unshift(alert);
          this.broadcast('alert', alert);
        }
      }

      // CPU 사용률 높음 알림
      if (serviceMetrics.processMetrics && parseFloat(serviceMetrics.processMetrics.cpu) > 80) {
        const existingAlert = this.alerts.find(alert => 
          alert.service === serviceId && 
          alert.level === 'WARNING' && 
          alert.message.includes('CPU') &&
          !alert.acknowledged &&
          now - new Date(alert.timestamp).getTime() < 600000 // 10분 내
        );

        if (!existingAlert) {
          const alert = {
            id: now + 1,
            service: serviceId,
            level: 'WARNING',
            message: `CPU 사용률이 높습니다: ${serviceMetrics.processMetrics.cpu}%`,
            timestamp: new Date().toISOString(),
            acknowledged: false
          };

          this.alerts.unshift(alert);
          this.broadcast('alert', alert);
        }
      }
    }

    // 시스템 메모리 사용률 높음 알림
    if (parseFloat(metrics.system.memory.percentage) > 85) {
      const existingAlert = this.alerts.find(alert => 
        alert.service === 'system' && 
        alert.level === 'WARNING' && 
        alert.message.includes('메모리') &&
        !alert.acknowledged &&
        now - new Date(alert.timestamp).getTime() < 600000 // 10분 내
      );

      if (!existingAlert) {
        const alert = {
          id: now + 2,
          service: 'system',
          level: 'WARNING',
          message: `시스템 메모리 사용률이 높습니다: ${metrics.system.memory.percentage}%`,
          timestamp: new Date().toISOString(),
          acknowledged: false
        };

        this.alerts.unshift(alert);
        this.broadcast('alert', alert);
      }
    }
  }

  /**
   * 서버 시작
   */
  async start() {
    try {
      // 로그 수집기 시작
      await this.collector.start();
      
      // 주기적 업데이트 시작
      this.startPeriodicUpdates();
      
      // HTTP 서버 시작
      this.server.listen(this.port, () => {
        console.log(`🚀 YAMEYAME 모니터링 서버 시작`);
        console.log(`📊 대시보드: http://localhost:${this.port}`);
        console.log(`🔌 웹소켓: ws://localhost:${this.port}`);
        console.log(`⚡ API: http://localhost:${this.port}/api/status`);
      });
      
    } catch (error) {
      console.error('❌ 서버 시작 실패:', error.message);
      process.exit(1);
    }
  }

  /**
   * 서버 종료
   */
  async stop() {
    console.log('🛑 서버 종료 중...');
    
    // 웹소켓 연결 정리
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    
    // HTTP 서버 종료
    this.server.close();
    
    console.log('✅ 서버 종료 완료');
  }
}

// 직접 실행시 서버 시작
if (require.main === module) {
  const server = new MonitoringServer();
  
  // 종료 신호 처리
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
  
  server.start().catch(console.error);
}

module.exports = MonitoringServer;