# Security & Performance Implementation Guide

Quick guide for implementing the security and performance enhancements in your yameyame production environment.

## 🚀 Quick Start Implementation

### 1. Environment Variables Setup
Create a `.env.production` file in your root directory:

```bash
# Security Configuration
NODE_ENV=production
JWT_SECRET=your-super-strong-secret-minimum-256-bits-here
SESSION_SECRET=another-strong-secret-for-sessions
API_KEY=optional-api-key-for-external-access

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# File Upload Configuration
UPLOAD_DIR=./secure-uploads
TEMP_DIR=./temp-uploads
MAX_FILE_SIZE=5242880

# SSL/TLS Configuration (for HTTPS)
TLS_CERT_PATH=./certs/cert.pem
TLS_KEY_PATH=./certs/key.pem
TLS_CA_PATH=./certs/ca.pem

# Database Configuration (MongoDB)
MONGODB_URI=mongodb://username:password@localhost:27017/yameyame
DB_NAME=yameyame

# Rate Limiting (optional tuning)
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5
```

### 2. Install Additional Dependencies
```bash
cd worktrees/backend-api
npm install helmet express-rate-limit joi express-validator winston morgan compression
```

### 3. Update Your Existing Server

#### Option A: Integrate with Existing TypeScript Server
Add these imports to your existing `src/server.ts`:

```typescript
// Add to existing imports
import { applySecurityMiddlewares } from './middleware/security.middleware';
import { cacheMiddleware, responseTime, queryOptimization } from './middleware/performance.middleware';
import { authenticate, authorize } from './middleware/auth.middleware';
```

#### Option B: Use the New Secure Server
Replace your current server implementation with the new secure version (files already created).

### 4. Create Required Directories
```bash
mkdir -p logs
mkdir -p secure-uploads
mkdir -p temp-uploads
mkdir -p certs
```

### 5. Generate SSL Certificates (Production)

#### For Development/Testing:
```bash
# Self-signed certificate (development only)
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes
```

#### For Production:
Use Let's Encrypt or your certificate provider:
```bash
# Using certbot (Let's Encrypt)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

## 🛡️ Security Features Activation

### Authentication Routes
The following routes are now available:
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration  
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - Secure logout

### Protected Route Example
```javascript
// In your route files
app.get('/api/admin/dashboard', 
  authenticate,              // Verify JWT token
  authorize('admin'),        // Require admin role
  (req, res) => {
    // Your protected route logic
    res.json({ message: 'Admin dashboard data' });
  }
);
```

### Rate Limiting Applied To:
- All routes: 100 requests/15 minutes
- Auth routes: 5 attempts/15 minutes
- Upload routes: 10 uploads/15 minutes

## ⚡ Performance Features Activation

### Caching Examples
```javascript
// Apply caching to specific routes
app.use('/api/clubs', cacheMiddleware({ ttl: 10 * 60 * 1000 })); // 10 minutes
app.use('/api/posts', cacheMiddleware({ ttl: 5 * 60 * 1000 }));  // 5 minutes
```

### Query Optimization Usage
```javascript
app.get('/api/posts', (req, res) => {
  const { page, limit, skip } = req.queryHelpers.getPagination();
  const filters = req.queryHelpers.getFilters();
  const sort = req.queryHelpers.getSort();
  
  // Use these in your database queries
  // Example with MongoDB:
  // const posts = await Post.find(filters).sort(sort).skip(skip).limit(limit);
});
```

## 📊 Monitoring Integration

### Health Check Response
The `/api/health` endpoint now returns:
```json
{
  "status": "healthy",
  "uptime": 10742.7673128,
  "memory": { "rss": 59252736, "heapTotal": 8962048 },
  "performance": {
    "hits": 150,
    "misses": 25,
    "hitRate": 85.7,
    "avgResponseTime": 45.2
  }
}
```

### Custom Monitoring
```javascript
// Add performance tracking to your routes
app.get('/api/custom-route', (req, res) => {
  const start = Date.now();
  
  // Your route logic here
  
  const responseTime = Date.now() - start;
  performanceMonitor.record(responseTime);
  
  res.json({ data: 'your data' });
});
```

## 🔧 Configuration Tuning

### Security Configuration
Edit `config/security.config.js`:

```javascript
// Adjust rate limits for your needs
rateLimiting: {
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Increase for high-traffic sites
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 3, // Decrease for tighter security
  }
}
```

### Performance Configuration
```javascript
// Adjust cache TTL based on your data update frequency
const cacheConfig = {
  api: { ttl: 5 * 60 * 1000 },    // 5 minutes for dynamic data
  static: { ttl: 60 * 60 * 1000 }, // 1 hour for static data
  query: { ttl: 2 * 60 * 1000 }    // 2 minutes for database queries
};
```

## 🚀 Production Deployment

### 1. Build the Application
```bash
npm run build
```

### 2. Start with PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Create PM2 configuration
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'yameyame-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Start the application
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 3. Nginx Reverse Proxy (Recommended)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔍 Testing Your Implementation

### 1. Security Testing
```bash
# Test rate limiting
for i in {1..10}; do curl http://localhost:3000/api/health; done

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123!"}'

# Test protected routes
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/admin/stats
```

### 2. Performance Testing
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test performance
ab -n 1000 -c 10 http://localhost:3000/api/health

# Test caching
curl -H "If-None-Match: \"cached-etag\"" \
  http://localhost:3000/api/clubs
```

### 3. SSL Testing
```bash
# Test SSL configuration
curl -I https://yourdomain.com/api/health

# SSL Labs test
curl "https://api.ssllabs.com/api/v3/analyze?host=yourdomain.com"
```

## 📈 Monitoring Your Performance

### Key Metrics to Monitor
- Response time: Target <100ms
- Memory usage: Monitor heap growth
- Cache hit rate: Target >80%
- Error rate: Target <1%
- Request rate: Monitor for traffic patterns

### Dashboard URLs
- Health: `http://localhost:3000/api/health`
- Stats: `http://localhost:3000/api/admin/stats` (admin only)
- Monitoring: `http://localhost:9999` (your existing dashboard)

## 🚨 Troubleshooting

### Common Issues
1. **High memory usage**: Increase cache cleanup frequency
2. **Slow responses**: Check database query optimization
3. **Rate limit errors**: Adjust limits based on usage patterns
4. **SSL errors**: Verify certificate paths and permissions

### Debug Mode
Set `NODE_ENV=development` to enable detailed logging and debugging features.

---

Your yameyame application is now production-ready with enterprise-grade security and performance! 🎉