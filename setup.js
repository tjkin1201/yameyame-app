#!/usr/bin/env node

/**
 * YAMEYAME 프로젝트 원클릭 설치 시스템
 * 
 * 이 스크립트는 신입 개발자가 5분 내에 전체 환경을 구축할 수 있도록 합니다.
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

class YameYameSetup {
  constructor() {
    this.isWindows = os.platform() === 'win32';
    this.requirements = {
      'Node.js': { command: 'node --version', minVersion: '18.0.0' },
      'npm': { command: 'npm --version', minVersion: '8.0.0' },
      'Git': { command: 'git --version', minVersion: '2.0.0' }
    };
    this.optionalRequirements = {
      'Docker': { command: 'docker --version', description: '컨테이너화를 위해 필요 (선택적)' },
      'PowerShell': { command: 'powershell -Command "echo test"', description: 'Windows 스크립트 실행용' }
    };
  }

  /**
   * 메인 설치 프로세스
   */
  async run() {
    console.log('🚀 YAMEYAME 프로젝트 원클릭 설치 시작');
    console.log('='.repeat(60));
    
    try {
      await this.displayWelcomeMessage();
      await this.checkSystemRequirements();
      await this.checkProjectStructure();
      await this.installDependencies();
      await this.setupConfiguration();
      await this.runInitialTests();
      await this.displaySuccessMessage();
      
      return true;
    } catch (error) {
      console.error(`\n❌ 설치 실패: ${error.message}`);
      console.log('\n🔧 문제 해결 가이드:');
      console.log('  1. Node.js 18+ 설치 확인: https://nodejs.org');
      console.log('  2. 관리자 권한으로 실행');
      console.log('  3. 방화벽/백신 프로그램 확인');
      console.log('  4. 네트워크 연결 상태 확인');
      return false;
    }
  }

  /**
   * 환영 메시지 및 프로젝트 소개
   */
  async displayWelcomeMessage() {
    console.log(`
👋 YAMEYAME 프로젝트에 오신 것을 환영합니다!

📋 이 설치 스크립트가 수행할 작업:
  ✅ 시스템 요구사항 검사
  ✅ 프로젝트 구조 검증
  ✅ 의존성 패키지 설치
  ✅ 개발 환경 설정
  ✅ 초기 테스트 실행

⏱️  예상 소요 시간: 3-5분
`);

    const answer = await this.promptUser('계속하시겠습니까? (y/n): ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      throw new Error('사용자가 설치를 취소했습니다.');
    }
  }

  /**
   * 시스템 요구사항 검사
   */
  async checkSystemRequirements() {
    console.log('\n🔍 시스템 요구사항 검사...');
    
    // 필수 요구사항 검사
    for (const [name, requirement] of Object.entries(this.requirements)) {
      try {
        const version = await this.executeCommand(requirement.command);
        const installedVersion = this.extractVersion(version);
        
        if (this.compareVersions(installedVersion, requirement.minVersion) >= 0) {
          console.log(`  ✅ ${name}: ${installedVersion} (최소 요구: ${requirement.minVersion})`);
        } else {
          throw new Error(`${name} 버전이 낮습니다. 현재: ${installedVersion}, 필요: ${requirement.minVersion}`);
        }
      } catch (error) {
        throw new Error(`${name}이 설치되지 않았거나 실행할 수 없습니다.`);
      }
    }

    // 선택적 요구사항 검사
    console.log('\n🔍 선택적 도구 검사...');
    for (const [name, requirement] of Object.entries(this.optionalRequirements)) {
      try {
        await this.executeCommand(requirement.command);
        console.log(`  ✅ ${name}: 사용 가능`);
      } catch (error) {
        console.log(`  ⚠️  ${name}: 없음 - ${requirement.description}`);
      }
    }
  }

  /**
   * 프로젝트 구조 검증
   */
  async checkProjectStructure() {
    console.log('\n📂 프로젝트 구조 검증...');
    
    const requiredFiles = [
      'package.json',
      'autorun.js',
      'config/services.json'
    ];

    const requiredDirectories = [
      'worktrees',
      'monitoring',
      'config'
    ];

    // 필수 파일 확인
    for (const file of requiredFiles) {
      if (await fs.pathExists(file)) {
        console.log(`  ✅ ${file}`);
      } else {
        throw new Error(`필수 파일이 없습니다: ${file}`);
      }
    }

    // 필수 디렉토리 확인
    for (const dir of requiredDirectories) {
      if (await fs.pathExists(dir)) {
        console.log(`  ✅ ${dir}/`);
      } else {
        console.log(`  ⚠️  ${dir}/ 디렉토리가 없습니다. 생성중...`);
        await fs.ensureDir(dir);
      }
    }

    // 워크스페이스 구조 검사
    console.log('\n📦 워크스페이스 구조 검사...');
    const workspaces = await this.getWorkspaces();
    for (const workspace of workspaces) {
      const workspacePath = path.join('worktrees', workspace);
      if (await fs.pathExists(workspacePath)) {
        console.log(`  ✅ ${workspace} 워크스페이스`);
      } else {
        console.log(`  ⚠️  ${workspace} 워크스페이스 없음`);
      }
    }
  }

  /**
   * 의존성 설치
   */
  async installDependencies() {
    console.log('\n📦 의존성 패키지 설치...');
    
    // 루트 패키지 설치
    console.log('  🔧 루트 패키지 설치...');
    await this.runCommand('npm install', { cwd: process.cwd() });

    // 워크스페이스 패키지 설치
    const workspaces = await this.getWorkspaces();
    for (const workspace of workspaces) {
      const workspacePath = path.join('worktrees', workspace);
      if (await fs.pathExists(workspacePath) && await fs.pathExists(path.join(workspacePath, 'package.json'))) {
        console.log(`  🔧 ${workspace} 패키지 설치...`);
        try {
          await this.runCommand('npm install', { cwd: workspacePath });
          console.log(`    ✅ ${workspace} 설치 완료`);
        } catch (error) {
          console.log(`    ⚠️  ${workspace} 설치 실패: ${error.message}`);
        }
      }
    }

    // axios 추가 설치 (autorun.js용)
    if (!await this.checkDependency('axios')) {
      console.log('  🔧 axios 설치...');
      await this.runCommand('npm install axios');
    }
  }

  /**
   * 개발 환경 설정
   */
  async setupConfiguration() {
    console.log('\n⚙️ 개발 환경 설정...');
    
    // .env 파일 생성 (없는 경우)
    const envPath = '.env';
    if (!await fs.pathExists(envPath)) {
      console.log('  📝 .env 파일 생성...');
      const envContent = `# YAMEYAME 환경 변수
NODE_ENV=development
PORT=3000

# 데이터베이스
DATABASE_URL="file:./dev.db"

# JWT 시크릿 (개발용)
JWT_SECRET=development-secret-key-change-in-production

# API 키 (필요시 설정)
# BAND_API_KEY=your-band-api-key
# GOOGLE_API_KEY=your-google-api-key

# 모니터링
MONITORING_PORT=9999
MONITORING_ENABLED=true
`;
      await fs.writeFile(envPath, envContent);
      console.log('  ✅ .env 파일 생성 완료');
    } else {
      console.log('  ✅ .env 파일 존재');
    }

    // Git 설정 확인
    try {
      await this.executeCommand('git config user.name');
      await this.executeCommand('git config user.email');
      console.log('  ✅ Git 설정 확인 완료');
    } catch (error) {
      console.log('  ⚠️  Git 사용자 설정이 필요합니다:');
      console.log('     git config --global user.name "Your Name"');
      console.log('     git config --global user.email "your.email@example.com"');
    }

    // 포트 충돌 검사
    console.log('  🌐 포트 충돌 검사...');
    await this.checkPortConflicts();
  }

  /**
   * 초기 테스트 실행
   */
  async runInitialTests() {
    console.log('\n🧪 초기 테스트 실행...');
    
    // 설정 검증
    try {
      const config = await fs.readJson('./config/services.json');
      console.log(`  ✅ 서비스 설정 검증: ${Object.keys(config.services).length}개 서비스`);
    } catch (error) {
      throw new Error('서비스 설정 파일이 올바르지 않습니다.');
    }

    // autorun.js 문법 검사
    try {
      await this.executeCommand('node -c autorun.js');
      console.log('  ✅ autorun.js 문법 검사 통과');
    } catch (error) {
      throw new Error('autorun.js 파일에 문법 오류가 있습니다.');
    }

    // 간단한 기능 테스트
    console.log('  🔍 기능 테스트...');
    try {
      const testResult = await this.executeCommand('npm run config:show');
      console.log('  ✅ 설정 표시 기능 정상');
    } catch (error) {
      console.log('  ⚠️  설정 표시 기능 테스트 실패');
    }
  }

  /**
   * 성공 메시지 출력
   */
  async displaySuccessMessage() {
    console.log(`
🎉 YAMEYAME 프로젝트 설치 완료!
${'='.repeat(60)}

🚀 바로 시작하기:
  npm run dev              # 개발 서버 시작
  npm run dev:turbo        # 빠른 시작
  npm run dashboard        # 모니터링 대시보드

🔧 유용한 명령어:
  npm run help             # 도움말 보기
  npm run status           # 서비스 상태 확인
  npm run stop             # 모든 서비스 중지

📚 추가 정보:
  - README.md              # 프로젝트 개요
  - AUTORUN_GUIDE.md       # AutoRun 사용법
  - docs/                  # 상세 문서

💡 문제가 있으면:
  npm run health           # 헬스체크
  npm run setup:check      # 설치 상태 확인

즐거운 개발 되세요! 🎯
`);
  }

  // 유틸리티 메서드들
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        stdio: ['inherit', 'inherit', 'inherit'],
        shell: this.isWindows,
        ...options
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`명령어 실행 실패: ${command} (exit code: ${code})`));
        }
      });
    });
  }

  async promptUser(question) {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question(question, (answer) => {
        readline.close();
        resolve(answer);
      });
    });
  }

  extractVersion(versionString) {
    const match = versionString.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : '0.0.0';
  }

  compareVersions(version1, version2) {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }

  async getWorkspaces() {
    try {
      const packageJson = await fs.readJson('./package.json');
      if (packageJson.workspaces && Array.isArray(packageJson.workspaces)) {
        return packageJson.workspaces.map(ws => ws.replace('worktrees/', ''));
      }
    } catch (error) {
      // package.json이 없거나 workspaces가 없는 경우
    }
    
    // 기본 워크스페이스 목록
    return ['backend-api', 'frontend-ui', 'database-layer', 'realtime-socket'];
  }

  async checkDependency(packageName) {
    try {
      const packageJson = await fs.readJson('./package.json');
      return !!(packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]);
    } catch (error) {
      return false;
    }
  }

  async checkPortConflicts() {
    const config = await fs.readJson('./config/services.json');
    const ports = Object.values(config.services).map(s => s.port);
    
    for (const port of ports) {
      try {
        await this.executeCommand(`netstat -an | findstr :${port}`);
        console.log(`    ⚠️  포트 ${port} 사용 중`);
      } catch (error) {
        console.log(`    ✅ 포트 ${port} 사용 가능`);
      }
    }
  }
}

// CLI 실행
if (require.main === module) {
  const setup = new YameYameSetup();
  setup.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('설치 오류:', error.message);
    process.exit(1);
  });
}

module.exports = YameYameSetup;