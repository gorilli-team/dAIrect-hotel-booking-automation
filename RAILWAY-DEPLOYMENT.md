# 🚀 Railway Deployment Guide

This branch is specifically configured for Railway deployment.

## 📋 Pre-Deployment Checklist

✅ Backend with Browserless integration configured  
✅ Production scripts added  
✅ Railway configuration files created  
✅ Environment variables documented  

## 🔧 Railway Setup Steps

### 1. Connect Repository to Railway

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose this repository and the `railway-deployment` branch

### 2. Configure Environment Variables

In Railway dashboard, go to Variables and add:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o

# Server Configuration  
PORT=3001
NODE_ENV=production

# Frontend URL (update after frontend deployment)
FRONTEND_URL=https://your-frontend-url.vercel.app
CORS_ORIGIN=https://your-frontend-url.vercel.app

# Playwright Configuration
HEADLESS=true
SLOW_MO=0
BROWSER_TIMEOUT=30000
PAGE_TIMEOUT=10000

# Browserless Configuration
BROWSERLESS_TOKEN=2SwcDPHl5N9PzRl209f6ae5751c11582e53c0246cf4744aa2
BROWSERLESS_ENDPOINT=wss://production-sfo.browserless.io
USE_BROWSERLESS=true

# Hotel Target
TARGET_HOTEL_URL=https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR

# Logging
LOG_LEVEL=info
LOG_FILE=logs/booking.log
```

### 3. Deploy Configuration

Railway will automatically:
- Install dependencies using `npm ci`
- Set up Chromium for Playwright fallback
- Start the server using `npm run start:production`

### 4. Verify Deployment

After deployment:
1. Check Railway logs for successful startup
2. Test the health endpoint: `https://your-app.railway.app/api/health`
3. Verify Browserless connection (will fallback to local if needed)

## 🔍 Troubleshooting

### Common Issues:

**Browserless Connection Issues:**
- Check if `BROWSERLESS_TOKEN` is correct
- Verify `BROWSERLESS_ENDPOINT` format
- System will fallback to local Chromium if Browserless fails

**Memory Issues:**
- Railway provides sufficient memory for Playwright
- Local Chromium is optimized with minimal args

**Port Issues:**
- Railway automatically sets `PORT` environment variable
- Backend listens on `process.env.PORT || 3001`

## 📊 Monitoring

Monitor your deployment:
- Railway provides built-in metrics and logs
- Check logs for Browserless connection status
- Monitor API response times and error rates

## 🔄 Updates

To update the deployment:
1. Make changes to this branch
2. Push to GitHub
3. Railway will automatically redeploy

## 🎯 Next Steps

After backend deployment:
1. Note the Railway URL (e.g., `https://your-app.railway.app`)
2. Update frontend API URLs to point to Railway
3. Deploy frontend to Vercel
4. Update `FRONTEND_URL` and `CORS_ORIGIN` in Railway env vars
