// Security Configuration for YameYame
// Production-ready security hardening configuration

module.exports = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION_TO_STRONG_SECRET',
    expiresIn: '7d',
    refreshExpiresIn: '30d',
    algorithm: 'HS256',
    issuer: 'yameyame-api',
    audience: 'yameyame-client'
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || 'CHANGE_THIS_SESSION_SECRET_IN_PRODUCTION',
    name: 'yameyame.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'strict'
    }
  },

  // Rate Limiting Configuration
  rateLimiting: {
    // Global rate limit
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    },
    
    // API endpoints rate limiting
    api: {
      windowMs: 15 * 60 * 1000,
      max: 100,
      skipSuccessfulRequests: false,
    },
    
    // Auth endpoints (stricter)
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5, // Only 5 login attempts per 15 minutes
      skipFailedRequests: false,
    },
    
    // File upload endpoints
    upload: {
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: false,
    }
  },

  // CORS Configuration
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8081',
        'http://localhost:19000',
        'exp://localhost:8081'
      ];
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400 // 24 hours
  },

  // Security Headers (Helmet configuration)
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true,
  },

  // Input Validation Rules
  validation: {
    // Max lengths
    maxUsernameLength: 30,
    maxPasswordLength: 128,
    maxEmailLength: 254,
    maxTextLength: 1000,
    maxTitleLength: 200,
    maxDescriptionLength: 500,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    
    // Patterns
    usernamePattern: /^[a-zA-Z0-9_-]{3,30}$/,
    emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phonePattern: /^[0-9-+().\s]+$/,
    
    // Allowed file types
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocumentTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    
    // SQL Injection prevention patterns
    sqlInjectionPatterns: [
      /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UNION|UPDATE)\b)/gi,
      /(--|\*|;|'|"|`|\\x00|\\n|\\r|\\x1a)/gi
    ],
    
    // XSS prevention patterns
    xssPatterns: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ]
  },

  // Password Policy
  passwordPolicy: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    
    // Bcrypt configuration
    saltRounds: 12,
    
    // Password history (prevent reuse)
    historyCount: 5,
    
    // Password expiration (days)
    expirationDays: 90,
    
    // Account lockout
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
  },

  // File Upload Security
  fileUpload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 10,
    
    // Virus scanning (if available)
    enableVirusScan: false,
    
    // Storage
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    tempDir: process.env.TEMP_DIR || './temp',
    
    // Filename sanitization
    sanitizeFilename: true,
    preserveExtension: true,
    
    // Image processing
    imageProcessing: {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 85,
      stripMetadata: true
    }
  },

  // API Security
  api: {
    // API versioning
    version: 'v1',
    
    // Request size limits
    jsonLimit: '10mb',
    urlEncodedLimit: '10mb',
    
    // Timeout
    requestTimeout: 30000, // 30 seconds
    
    // API key configuration (if needed)
    requireApiKey: false,
    apiKeyHeader: 'X-API-Key',
    
    // Request ID for tracking
    generateRequestId: true,
    requestIdHeader: 'X-Request-Id'
  },

  // Database Security
  database: {
    // Connection string encryption
    encryptConnectionString: true,
    
    // Query timeout
    queryTimeout: 5000, // 5 seconds
    
    // Connection pool
    connectionPool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000
    },
    
    // Audit logging
    enableAuditLog: true,
    
    // Sensitive data encryption
    encryptSensitiveData: true,
    encryptionAlgorithm: 'aes-256-gcm'
  },

  // Logging Security
  logging: {
    // Never log these fields
    sensitiveFields: [
      'password',
      'token',
      'refreshToken',
      'apiKey',
      'secret',
      'ssn',
      'creditCard',
      'cvv',
      'pin'
    ],
    
    // Log retention
    retentionDays: 30,
    
    // Log encryption
    encryptLogs: false,
    
    // Audit trail
    enableAuditTrail: true
  },

  // HTTPS/TLS Configuration
  tls: {
    enabled: process.env.NODE_ENV === 'production',
    
    // Certificate paths
    cert: process.env.TLS_CERT_PATH || './certs/cert.pem',
    key: process.env.TLS_KEY_PATH || './certs/key.pem',
    ca: process.env.TLS_CA_PATH || './certs/ca.pem',
    
    // TLS options
    minVersion: 'TLSv1.2',
    ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
    
    // HSTS
    hstsMaxAge: 31536000,
    hstsIncludeSubDomains: true,
    hstsPreload: true
  },

  // Content Security
  content: {
    // Sanitization
    enableHtmlSanitization: true,
    enableSqlSanitization: true,
    
    // Content type validation
    strictContentType: true,
    
    // Output encoding
    outputEncoding: 'utf-8'
  },

  // DDoS Protection
  ddos: {
    // Rate limiting per IP
    burst: 10,
    rate: 0.1, // 1 request per 10 seconds after burst
    
    // Connection limits
    maxConnections: 100,
    
    // Request validation
    validateRequest: true,
    
    // Blacklist/Whitelist
    whitelist: [],
    blacklist: [],
    
    // Cloudflare integration (if available)
    useCloudflare: false
  },

  // Two-Factor Authentication
  twoFactor: {
    enabled: false,
    issuer: 'YameYame',
    window: 1, // Time window for TOTP
    
    // Backup codes
    backupCodes: {
      count: 10,
      length: 8
    }
  },

  // OAuth Configuration (if needed)
  oauth: {
    providers: {
      google: {
        enabled: false,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: '/auth/google/callback'
      },
      kakao: {
        enabled: false,
        clientId: process.env.KAKAO_CLIENT_ID,
        clientSecret: process.env.KAKAO_CLIENT_SECRET,
        callbackUrl: '/auth/kakao/callback'
      }
    }
  },

  // Environment-specific overrides
  environments: {
    development: {
      rateLimiting: { global: { max: 1000 } },
      tls: { enabled: false },
      cors: { origin: true }
    },
    staging: {
      rateLimiting: { global: { max: 200 } }
    },
    production: {
      jwt: { expiresIn: '1d' },
      passwordPolicy: { saltRounds: 14 },
      tls: { enabled: true }
    }
  }
};