#!/usr/bin/env node
/**
 * Memory Leak Test Script for YameYame Backend API
 * Tests the memory optimizations implemented to fix memory leaks
 */

const http = require('http');
const util = require('util');

class MemoryTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.testResults = [];
    this.startTime = Date.now();
  }

  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MemoryTester/1.0'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(body);
            resolve({ status: res.statusCode, data: jsonData });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async getMemoryStats() {
    try {
      const response = await this.makeRequest('/api/health');
      if (response.status === 200 && response.data.process && response.data.process.memory) {
        const mem = response.data.process.memory;
        return {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
          arrayBuffers: mem.arrayBuffers,
          heapUsagePercent: ((mem.heapUsed / mem.heapTotal) * 100).toFixed(2),
          uptime: response.data.uptime,
          pid: response.data.process.pid
        };
      }
    } catch (error) {
      console.error('Failed to get memory stats:', error.message);
    }
    return null;
  }

  async performLoadTest(duration = 60000, requestsPerSecond = 5) {
    console.log(`🧪 Starting ${duration/1000}s load test with ${requestsPerSecond} req/s`);
    console.log('⏱️  Time    | 📊 Memory | 💾 Heap | 🔢 ArrayBuffers | 📈 Usage%');
    console.log('----------|----------|-------|-------------|--------');
    
    const startStats = await this.getMemoryStats();
    if (!startStats) {
      console.error('❌ Failed to get initial memory stats');
      return;
    }

    console.log(`⏰ Start    | ${(startStats.rss/1024/1024).toFixed(1)}MB   | ${(startStats.heapUsed/1024/1024).toFixed(1)}MB | ${(startStats.arrayBuffers/1024).toFixed(0)}KB       | ${startStats.heapUsagePercent}%`);

    const testEndTime = Date.now() + duration;
    const interval = 1000 / requestsPerSecond;
    let requestCount = 0;
    let postCount = 0;

    const requests = [
      { path: '/api/health', method: 'GET' },
      { path: '/api/clubs', method: 'GET' },
      { path: '/api/members', method: 'GET' },
      { path: '/api/posts', method: 'GET' },
      { path: '/api/games', method: 'GET' }
    ];

    // Memory monitoring
    const memoryMonitor = setInterval(async () => {
      const stats = await this.getMemoryStats();
      if (stats) {
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
        console.log(`⏰ ${elapsed}s      | ${(stats.rss/1024/1024).toFixed(1)}MB   | ${(stats.heapUsed/1024/1024).toFixed(1)}MB | ${(stats.arrayBuffers/1024).toFixed(0)}KB       | ${stats.heapUsagePercent}%`);
        
        this.testResults.push({
          timestamp: Date.now(),
          elapsed: parseInt(elapsed),
          memory: stats,
          requestCount: requestCount
        });
      }
    }, 10000); // Every 10 seconds

    // Request generator
    const makeTestRequest = async () => {
      if (Date.now() >= testEndTime) return;
      
      try {
        requestCount++;
        
        if (requestCount % 20 === 0) {
          // Occasionally create posts to test memory cleanup
          postCount++;
          await this.makeRequest('/api/posts', 'POST', {
            title: `Test Post ${postCount}`,
            content: `This is test post #${postCount} created at ${new Date().toISOString()}`,
            author: 'MemoryTester'
          });
        } else {
          // Regular GET requests
          const request = requests[requestCount % requests.length];
          await this.makeRequest(request.path, request.method);
        }
        
        // Schedule next request
        setTimeout(makeTestRequest, interval);
      } catch (error) {
        console.error('Request failed:', error.message);
        setTimeout(makeTestRequest, interval);
      }
    };

    // Start the load test
    makeTestRequest();

    // Wait for test completion
    await new Promise(resolve => setTimeout(resolve, duration));
    
    clearInterval(memoryMonitor);

    // Final stats
    const endStats = await this.getMemoryStats();
    if (endStats) {
      console.log('----------|----------|-------|-------------|--------');
      console.log(`⏰ End     | ${(endStats.rss/1024/1024).toFixed(1)}MB   | ${(endStats.heapUsed/1024/1024).toFixed(1)}MB | ${(endStats.arrayBuffers/1024).toFixed(0)}KB       | ${endStats.heapUsagePercent}%`);
      
      this.analyzeLeak(startStats, endStats, requestCount);
    }
  }

  analyzeLeak(start, end, totalRequests) {
    console.log('\n🔍 Memory Leak Analysis:');
    console.log('========================');
    
    const memoryGrowth = {
      rss: end.rss - start.rss,
      heapUsed: end.heapUsed - start.heapUsed,
      arrayBuffers: end.arrayBuffers - start.arrayBuffers
    };

    console.log(`📊 Total Requests: ${totalRequests}`);
    console.log(`⏱️  Test Duration: ${(end.uptime - start.uptime).toFixed(1)}s`);
    console.log(`📈 RSS Growth: ${(memoryGrowth.rss/1024/1024).toFixed(2)}MB`);
    console.log(`📈 Heap Growth: ${(memoryGrowth.heapUsed/1024/1024).toFixed(2)}MB`);
    console.log(`📈 ArrayBuffer Growth: ${(memoryGrowth.arrayBuffers/1024).toFixed(2)}KB`);
    console.log(`📈 Heap Usage: ${start.heapUsagePercent}% → ${end.heapUsagePercent}%`);
    
    // Leak assessment
    const heapGrowthPerRequest = memoryGrowth.heapUsed / totalRequests;
    const arrayBufferGrowthPerRequest = memoryGrowth.arrayBuffers / totalRequests;
    
    console.log('\n🎯 Memory Leak Assessment:');
    console.log(`   Heap growth per request: ${(heapGrowthPerRequest/1024).toFixed(2)}KB`);
    console.log(`   ArrayBuffer growth per request: ${arrayBufferGrowthPerRequest.toFixed(2)}B`);
    
    // Thresholds for memory leak detection
    const HEAP_LEAK_THRESHOLD = 1024; // 1KB per request
    const BUFFER_LEAK_THRESHOLD = 100; // 100B per request
    const HEAP_USAGE_THRESHOLD = 75; // 75%

    let leakDetected = false;
    let warnings = [];

    if (heapGrowthPerRequest > HEAP_LEAK_THRESHOLD) {
      leakDetected = true;
      warnings.push(`⚠️  Potential heap memory leak: ${(heapGrowthPerRequest/1024).toFixed(2)}KB/request`);
    }

    if (arrayBufferGrowthPerRequest > BUFFER_LEAK_THRESHOLD) {
      leakDetected = true;
      warnings.push(`⚠️  ArrayBuffer growth detected: ${arrayBufferGrowthPerRequest.toFixed(2)}B/request`);
    }

    if (parseFloat(end.heapUsagePercent) > HEAP_USAGE_THRESHOLD) {
      warnings.push(`⚠️  High heap usage: ${end.heapUsagePercent}% (target: <${HEAP_USAGE_THRESHOLD}%)`);
    }

    if (warnings.length > 0) {
      console.log('\n❌ Issues Detected:');
      warnings.forEach(warning => console.log(`   ${warning}`));
    } else {
      console.log('\n✅ Memory management appears healthy!');
      console.log('   - Heap growth per request: ACCEPTABLE');
      console.log('   - ArrayBuffer growth: MINIMAL');
      console.log(`   - Heap usage: ${end.heapUsagePercent}% (under ${HEAP_USAGE_THRESHOLD}% target)`);
    }

    return {
      leakDetected,
      warnings,
      growth: memoryGrowth,
      performance: {
        heapGrowthPerRequest,
        arrayBufferGrowthPerRequest,
        finalHeapUsage: parseFloat(end.heapUsagePercent)
      }
    };
  }

  async runFullTest() {
    console.log('🚀 YameYame Backend API - Memory Leak Test');
    console.log('==========================================\n');

    // Initial health check
    console.log('🏥 Performing initial health check...');
    const health = await this.makeRequest('/api/health');
    if (health.status !== 200) {
      console.error('❌ Server is not healthy:', health.status);
      process.exit(1);
    }

    const initialStats = await this.getMemoryStats();
    console.log(`✅ Server is healthy (PID: ${initialStats.pid})`);
    console.log(`📊 Initial memory: ${(initialStats.heapUsed/1024/1024).toFixed(1)}MB heap (${initialStats.heapUsagePercent}% usage)\n`);

    // Run load test
    await this.performLoadTest(90000, 3); // 90 seconds, 3 req/s

    console.log('\n🏁 Test completed!');
  }
}

// Run the test
const tester = new MemoryTester();
tester.runFullTest().catch(console.error);