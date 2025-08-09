# 테스트 전략 및 CI/CD 파이프라인 설계

## 목차
1. [테스트 전략 개요](#테스트-전략-개요)
2. [프론트엔드 테스트 전략](#프론트엔드-테스트-전략)
3. [백엔드 테스트 전략](#백엔드-테스트-전략)
4. [E2E 및 통합 테스트](#e2e-및-통합-테스트)
5. [Band API 테스트 전략](#band-api-테스트-전략)
6. [CI/CD 파이프라인 설계](#cicd-파이프라인-설계)
7. [배포 전략](#배포-전략)
8. [품질 게이트](#품질-게이트)
9. [모니터링 및 롤백](#모니터링-및-롤백)

## 테스트 전략 개요

### 테스트 피라미드
```
    /\
   /  \    E2E Tests (5%)
  /____\   - Critical user journeys
 /      \  Integration Tests (15%)
/_______\  - API integration, Components
Unit Tests (80%)
- Functions, Components, Services
```

### 테스트 커버리지 목표
- **Unit Tests**: 90% 이상
- **Integration Tests**: 80% 이상
- **E2E Tests**: 핵심 기능 100%
- **API Tests**: 모든 엔드포인트 100%

### 테스트 환경 구성
```yaml
environments:
  development:
    - Local testing
    - Mock API responses
    - Jest + React Native Testing Library
  
  staging:
    - Integration testing
    - Real Band API (test account)
    - Performance testing
  
  production:
    - Smoke tests only
    - Health checks
    - Monitoring validation
```

## 프론트엔드 테스트 전략

### Unit Tests (React Native)

#### 설정
```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    './src/test-utils/setup.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-navigation|@react-navigation|@expo|expo)/)'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 90,
      statements: 90
    }
  }
};
```

#### 컴포넌트 테스트 예시
```javascript
// src/components/__tests__/GameCard.test.js
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GameCard } from '../GameCard';

describe('GameCard', () => {
  const mockGame = {
    id: '1',
    title: '저녁 복식',
    time: '19:00',
    participants: ['김철수', '이영희'],
    maxParticipants: 4
  };

  it('renders game information correctly', () => {
    const { getByText } = render(<GameCard game={mockGame} />);
    
    expect(getByText('저녁 복식')).toBeTruthy();
    expect(getByText('19:00')).toBeTruthy();
    expect(getByText('2/4명')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const mockOnPress = jest.fn();
    const { getByTestId } = render(
      <GameCard game={mockGame} onPress={mockOnPress} />
    );
    
    fireEvent.press(getByTestId('game-card'));
    expect(mockOnPress).toHaveBeenCalledWith(mockGame);
  });
});
```

#### 네비게이션 테스트
```javascript
// src/navigation/__tests__/AppNavigator.test.js
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from '../AppNavigator';
import { AuthProvider } from '../../context/AuthContext';

const renderWithProviders = (component) => {
  return render(
    <NavigationContainer>
      <AuthProvider>
        {component}
      </AuthProvider>
    </NavigationContainer>
  );
};

describe('AppNavigator', () => {
  it('renders login screen when not authenticated', () => {
    const { getByTestId } = renderWithProviders(<AppNavigator />);
    expect(getByTestId('login-screen')).toBeTruthy();
  });
});
```

### Service Layer Tests

#### API Service 테스트
```javascript
// src/services/__tests__/bandAPI.test.js
import { bandAPI } from '../bandAPI';
import { mockBandResponse } from '../test-utils/mockData';

// Mock fetch
global.fetch = jest.fn();

describe('bandAPI', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('getMembers', () => {
    it('returns formatted member data', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBandResponse.members
      });

      const members = await bandAPI.getMembers();
      
      expect(members).toHaveLength(3);
      expect(members[0]).toHaveProperty('id');
      expect(members[0]).toHaveProperty('name');
      expect(members[0]).toHaveProperty('role');
    });

    it('handles API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(bandAPI.getMembers()).rejects.toThrow('Band API 오류');
    });
  });
});
```

#### Context 테스트
```javascript
// src/context/__tests__/AuthContext.test.js
import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { AuthProvider, useAuth } from '../AuthContext';

describe('AuthContext', () => {
  it('provides authentication state', () => {
    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('updates state on login', async () => {
    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.login('mock-token');
    });
    
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

## 백엔드 테스트 전략

### Unit Tests (Node.js/Express)

#### 설정
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js']
};
```

#### Controller 테스트
```javascript
// src/controllers/__tests__/gameController.test.js
import request from 'supertest';
import app from '../../app';
import { Game } from '../../models/Game';
import { generateToken } from '../../utils/auth';

describe('Game Controller', () => {
  let authToken;
  
  beforeEach(async () => {
    authToken = generateToken({ userId: 'test-user' });
    await Game.deleteMany({});
  });

  describe('POST /api/games', () => {
    it('creates a new game', async () => {
      const gameData = {
        title: '저녁 복식',
        time: '2024-01-15T19:00:00Z',
        maxParticipants: 4
      };

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData)
        .expect(201);

      expect(response.body.title).toBe(gameData.title);
      expect(response.body.creator).toBe('test-user');
    });

    it('validates required fields', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.errors).toContain('Title is required');
    });
  });
});
```

#### Service Layer 테스트
```javascript
// src/services/__tests__/gameService.test.js
import { GameService } from '../gameService';
import { Game } from '../../models/Game';
import { BandAPI } from '../bandAPI';

jest.mock('../bandAPI');
jest.mock('../../models/Game');

describe('GameService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGame', () => {
    it('creates game and notifies band', async () => {
      const gameData = {
        title: '저녁 복식',
        creator: 'user-1',
        time: new Date(),
        maxParticipants: 4
      };

      Game.create.mockResolvedValue({ ...gameData, id: 'game-1' });
      BandAPI.postToBoard.mockResolvedValue({ success: true });

      const result = await GameService.createGame(gameData);

      expect(Game.create).toHaveBeenCalledWith(gameData);
      expect(BandAPI.postToBoard).toHaveBeenCalled();
      expect(result.id).toBe('game-1');
    });
  });
});
```

### Database 테스트

#### MongoDB 테스트 설정
```javascript
// tests/setup.js
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

#### 모델 테스트
```javascript
// src/models/__tests__/Game.test.js
import { Game } from '../Game';

describe('Game Model', () => {
  it('creates game with valid data', async () => {
    const gameData = {
      title: '저녁 복식',
      creator: 'user-1',
      time: new Date(),
      maxParticipants: 4
    };

    const game = await Game.create(gameData);
    
    expect(game.title).toBe(gameData.title);
    expect(game.participants).toHaveLength(0);
    expect(game.status).toBe('pending');
  });

  it('validates required fields', async () => {
    const game = new Game({});
    
    await expect(game.save()).rejects.toThrow();
  });
});
```

## E2E 및 통합 테스트

### Detox 설정 (React Native)

#### 설정 파일
```javascript
// .detoxrc.js
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  configurations: {
    'ios.sim.debug': {
      device: {
        type: 'ios.simulator',
        device: {
          type: 'iPhone 14'
        }
      },
      app: {
        type: 'ios.app',
        binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/DongBaeJul.app',
        build: 'xcodebuild -workspace ios/DongBaeJul.xcworkspace -scheme DongBaeJul -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
      }
    },
    'android.emu.debug': {
      device: {
        type: 'android.emulator',
        device: {
          avdName: 'Pixel_API_30'
        }
      },
      app: {
        type: 'android.apk',
        binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
        build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..'
      }
    }
  }
};
```

#### E2E 테스트 예시
```javascript
// e2e/gameFlow.e2e.js
describe('Game Management Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete game creation flow', async () => {
    // 로그인
    await element(by.id('login-button')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(5000);

    // 게임 생성 페이지로 이동
    await element(by.id('create-game-fab')).tap();
    await expect(element(by.id('game-create-screen'))).toBeVisible();

    // 게임 정보 입력
    await element(by.id('game-title-input')).typeText('E2E 테스트 게임');
    await element(by.id('game-time-picker')).tap();
    await element(by.text('19:00')).tap();
    await element(by.id('max-participants-4')).tap();

    // 게임 생성
    await element(by.id('create-game-button')).tap();
    
    // 게임 목록에서 확인
    await waitFor(element(by.text('E2E 테스트 게임'))).toBeVisible().withTimeout(3000);
  });

  it('should allow joining and leaving games', async () => {
    // 게임 카드 탭
    await element(by.id('game-card-0')).tap();
    
    // 게임 참가
    await element(by.id('join-game-button')).tap();
    await expect(element(by.text('참가 완료'))).toBeVisible();
    
    // 게임 나가기
    await element(by.id('leave-game-button')).tap();
    await element(by.text('확인')).tap();
    await expect(element(by.text('참가하기'))).toBeVisible();
  });
});
```

### API 통합 테스트

#### Supertest를 이용한 API 테스트
```javascript
// tests/integration/api.test.js
import request from 'supertest';
import app from '../../src/app';
import { connectDB, closeDB } from '../helpers/database';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('Authentication Flow', () => {
    it('should complete OAuth flow', async () => {
      // OAuth 시작
      const authResponse = await request(app)
        .get('/api/auth/band')
        .expect(302);

      expect(authResponse.headers.location).toContain('band.us/oauth');
    });
  });

  describe('Game API', () => {
    let authToken;

    beforeEach(async () => {
      // 테스트 사용자 로그인
      const loginResponse = await request(app)
        .post('/api/auth/test-login')
        .send({ userId: 'test-user' });
      
      authToken = loginResponse.body.token;
    });

    it('should handle complete game lifecycle', async () => {
      // 게임 생성
      const createResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '통합 테스트 게임',
          time: new Date(Date.now() + 86400000).toISOString(),
          maxParticipants: 4
        })
        .expect(201);

      const gameId = createResponse.body.id;

      // 게임 참가
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 게임 조회
      const gameResponse = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(gameResponse.body.participants).toHaveLength(1);
    });
  });
});
```

## Band API 테스트 전략

### Mock 서버 설정

#### MSW (Mock Service Worker) 설정
```javascript
// src/test-utils/mocks/handlers.js
import { rest } from 'msw';

export const handlers = [
  // Band OAuth
  rest.post('https://auth.band.us/oauth2/token', (req, res, ctx) => {
    return res(
      ctx.json({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      })
    );
  }),

  // Band API - Members
  rest.get('https://openapi.band.us/v2.1/bands/:bandKey/members', (req, res, ctx) => {
    return res(
      ctx.json({
        result_code: 1,
        result_data: {
          members: [
            {
              user_key: 'user1',
              name: '김철수',
              profile_image_url: 'https://example.com/profile1.jpg',
              role: 'admin'
            }
          ]
        }
      })
    );
  }),

  // Band API - Posts
  rest.get('https://openapi.band.us/v2.1/bands/:bandKey/posts', (req, res, ctx) => {
    return res(
      ctx.json({
        result_code: 1,
        result_data: {
          posts: [
            {
              post_key: 'post1',
              content: '공지사항입니다',
              created_at: 1640995200,
              author: {
                name: '관리자'
              }
            }
          ]
        }
      })
    );
  })
];
```

#### Contract Testing
```javascript
// tests/contracts/bandAPI.contract.test.js
import { BandAPI } from '../../src/services/bandAPI';
import { validateBandResponse } from '../helpers/validators';

describe('Band API Contract Tests', () => {
  it('should match expected member response format', async () => {
    const members = await BandAPI.getMembers();
    
    expect(members).toBeInstanceOf(Array);
    members.forEach(member => {
      expect(member).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        profileImage: expect.any(String),
        role: expect.stringMatching(/^(admin|member)$/)
      });
    });
  });

  it('should handle rate limiting gracefully', async () => {
    // Rate limit 시뮬레이션
    const promises = Array(10).fill().map(() => BandAPI.getMembers());
    
    await expect(Promise.all(promises)).resolves.not.toThrow();
  });
});
```

## CI/CD 파이프라인 설계

### GitHub Actions 워크플로

#### 프론트엔드 CI/CD
```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI/CD

on:
  push:
    branches: [main, develop]
    paths: ['src/**', 'package.json']
  pull_request:
    branches: [main]
    paths: ['src/**', 'package.json']

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run lint
        run: npm run lint
      
      - name: Run type check
        run: npm run typecheck
      
      - name: Run tests
        run: npm test -- --coverage --watchAll=false
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
  
  build-ios:
    needs: test
    runs-on: macos-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build iOS
        run: expo build:ios --release-channel production
  
  build-android:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '11'
      
      - name: Setup Android SDK
        uses: android-actions/setup-android@v2
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Android
        run: |
          cd android
          ./gradlew assembleRelease
      
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-release.apk
          path: android/app/build/outputs/apk/release/app-release.apk

  e2e-tests:
    needs: test
    runs-on: macos-latest
    if: github.event_name == 'pull_request'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Detox CLI
        run: npm install -g detox-cli
      
      - name: Build iOS for testing
        run: detox build --configuration ios.sim.debug
      
      - name: Run E2E tests
        run: detox test --configuration ios.sim.debug --cleanup
```

#### 백엔드 CI/CD
```yaml
# .github/workflows/backend-ci.yml
name: Backend CI/CD

on:
  push:
    branches: [main, develop]
    paths: ['backend/**']
  pull_request:
    branches: [main]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:5.0
        env:
          MONGO_INITDB_ROOT_USERNAME: test
          MONGO_INITDB_ROOT_PASSWORD: test
        ports:
          - 27017:27017
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run lint
        run: |
          cd backend
          npm run lint
      
      - name: Run tests
        run: |
          cd backend
          npm test -- --coverage
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://test:test@localhost:27017/test
          REDIS_URL: redis://localhost:6379
      
      - name: Run integration tests
        run: |
          cd backend
          npm run test:integration
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://test:test@localhost:27017/test
          REDIS_URL: redis://localhost:6379

  security-scan:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --file=backend/package.json

  deploy:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: dongbaejul-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster dongbaejul-cluster \
            --service dongbaejul-backend-service \
            --force-new-deployment
```

### 품질 게이트 설정

#### SonarQube 설정
```yaml
# sonar-project.properties
sonar.projectKey=dongbaejul
sonar.organization=dongbaejul
sonar.host.url=https://sonarcloud.io

# Frontend
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/__tests__/**,**/*.test.js,**/*.test.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.coverage.exclusions=**/__tests__/**,**/*.test.js,**/*.test.ts

# Backend
sonar.sources=backend/src
sonar.tests=backend/tests
sonar.javascript.lcov.reportPaths=backend/coverage/lcov.info

# Quality Gates
sonar.qualitygate.wait=true
```

#### 품질 기준
```yaml
quality_gates:
  coverage:
    unit_tests: ">= 90%"
    integration_tests: ">= 80%"
    e2e_tests: "100% of critical paths"
  
  code_quality:
    maintainability_rating: "A"
    reliability_rating: "A"
    security_rating: "A"
    duplicated_lines: "< 3%"
  
  performance:
    build_time: "< 10 minutes"
    test_execution: "< 5 minutes"
    bundle_size: "< 50MB"
```

## 배포 전략

### Blue-Green 배포

#### 백엔드 배포 스크립트
```bash
#!/bin/bash
# deploy.sh

set -e

# 환경 변수
CLUSTER_NAME="dongbaejul-cluster"
SERVICE_NAME="dongbaejul-backend-service"
TASK_FAMILY="dongbaejul-backend"
IMAGE_TAG=${1:-latest}

echo "🚀 Starting Blue-Green deployment for $SERVICE_NAME"

# 현재 서비스 상태 확인
CURRENT_TASK_DEF=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --query 'services[0].taskDefinition' \
  --output text)

echo "📋 Current task definition: $CURRENT_TASK_DEF"

# 새 태스크 정의 생성
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --family $TASK_FAMILY \
  --task-role-arn arn:aws:iam::account:role/ecsTaskRole \
  --execution-role-arn arn:aws:iam::account:role/ecsTaskExecutionRole \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --container-definitions file://task-definition.json \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ New task definition created: $NEW_TASK_DEF"

# 서비스 업데이트
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition $NEW_TASK_DEF

echo "🔄 Service update initiated"

# 배포 완료 대기
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME

echo "✅ Deployment completed successfully"

# 헬스 체크
HEALTH_CHECK_URL="https://api.dongbaejul.com/health"
for i in {1..5}; do
  if curl -f $HEALTH_CHECK_URL; then
    echo "✅ Health check passed"
    break
  else
    echo "⚠️ Health check failed, retrying... ($i/5)"
    sleep 10
  fi
done
```

### 모바일 앱 배포

#### Expo EAS 설정
```json
// eas.json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account-key.json",
        "track": "production"
      }
    }
  }
}
```

#### 앱 배포 스크립트
```bash
#!/bin/bash
# mobile-deploy.sh

set -e

ENVIRONMENT=${1:-production}
PLATFORM=${2:-all}

echo "📱 Starting mobile app deployment"
echo "Environment: $ENVIRONMENT"
echo "Platform: $PLATFORM"

# 환경별 설정
case $ENVIRONMENT in
  "development")
    CHANNEL="development"
    ;;
  "preview")
    CHANNEL="preview"
    ;;
  "production")
    CHANNEL="production"
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT"
    exit 1
    ;;
esac

# 빌드 실행
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
  echo "🍎 Building iOS app..."
  eas build --platform ios --profile $ENVIRONMENT
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
  echo "🤖 Building Android app..."
  eas build --platform android --profile $ENVIRONMENT
fi

# 프로덕션 환경에서는 스토어에 제출
if [ "$ENVIRONMENT" = "production" ]; then
  echo "🚀 Submitting to app stores..."
  
  if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
    eas submit --platform ios --profile production
  fi
  
  if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
    eas submit --platform android --profile production
  fi
fi

echo "✅ Mobile deployment completed"
```

## 모니터링 및 롤백

### 배포 모니터링

#### CloudWatch 알람 설정
```yaml
# cloudwatch-alarms.yml
ErrorRateAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: DongBaeJul-HighErrorRate
    AlarmDescription: High error rate detected
    MetricName: 4XXError
    Namespace: AWS/ApplicationELB
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 50
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSTopic

ResponseTimeAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: DongBaeJul-HighResponseTime
    AlarmDescription: High response time detected
    MetricName: TargetResponseTime
    Namespace: AWS/ApplicationELB
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 2.0
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSTopic
```

#### 자동 롤백 스크립트
```bash
#!/bin/bash
# rollback.sh

set -e

CLUSTER_NAME="dongbaejul-cluster"
SERVICE_NAME="dongbaejul-backend-service"

echo "🔄 Starting automatic rollback"

# 이전 태스크 정의 찾기
PREVIOUS_TASK_DEF=$(aws ecs list-task-definitions \
  --family-prefix dongbaejul-backend \
  --status ACTIVE \
  --sort DESC \
  --max-items 2 \
  --query 'taskDefinitionArns[1]' \
  --output text)

if [ -z "$PREVIOUS_TASK_DEF" ]; then
  echo "❌ No previous task definition found"
  exit 1
fi

echo "📋 Rolling back to: $PREVIOUS_TASK_DEF"

# 서비스 롤백
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition $PREVIOUS_TASK_DEF

echo "🔄 Rollback initiated"

# 롤백 완료 대기
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME

echo "✅ Rollback completed successfully"

# 슬랙 알림
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🔄 DongBaeJul backend has been rolled back automatically"}' \
  $SLACK_WEBHOOK_URL
```

### 테스트 리포팅

#### Jest 커스텀 리포터
```javascript
// jest-reporter.js
class CustomReporter {
  onRunComplete(contexts, results) {
    const { numTotalTests, numPassedTests, numFailedTests } = results;
    
    const report = {
      timestamp: new Date().toISOString(),
      total: numTotalTests,
      passed: numPassedTests,
      failed: numFailedTests,
      coverage: results.coverageMap ? results.coverageMap.getCoverageSummary() : null
    };

    // Slack 알림
    if (numFailedTests > 0) {
      this.sendSlackNotification(`❌ Tests failed: ${numFailedTests}/${numTotalTests}`);
    } else {
      this.sendSlackNotification(`✅ All tests passed: ${numPassedTests}/${numTotalTests}`);
    }
  }

  sendSlackNotification(message) {
    // Slack 웹훅 구현
  }
}

module.exports = CustomReporter;
```

이 테스트 및 CI/CD 전략을 통해 코드 품질을 보장하고 안정적인 배포를 실현할 수 있습니다.