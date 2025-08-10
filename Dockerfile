# YAMEYAME 프로덕션 Docker 이미지
# Node.js 18 Alpine Linux 기반 (최적화된 크기)
FROM node:18-alpine AS base

# 시스템 패키지 업데이트 및 필수 도구 설치
RUN apk update && apk add --no-cache \
    dumb-init \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# 보안을 위한 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S yameyame -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사 및 설치 (캐시 최적화)
COPY package*.json ./
COPY tsconfig.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production --silent && \
    npm cache clean --force

# 소스 코드 복사
COPY --chown=yameyame:nodejs . .

# 필요한 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/logs /app/tmp && \
    chown -R yameyame:nodejs /app

# 사용자 변경
USER yameyame

# 포트 노출
EXPOSE 3000 9999

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 프로세스 시작 (dumb-init으로 신호 처리 개선)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "autorun.js", "--turbo", "--no-monitoring"]

# 개발용 이미지 (멀티스테이지)
FROM base AS development

# 개발 의존성 설치
USER root
RUN npm install --silent
USER yameyame

# 개발 모드로 실행
CMD ["npm", "run", "dev"]