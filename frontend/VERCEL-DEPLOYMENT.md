# 🚀 Vercel Deployment Guide - Frontend

## 📋 Prerequisites

✅ Backend deployed on Railway (get the URL)  
✅ Frontend configured with environment variables  
✅ API service updated for production  

## 🔧 Vercel Setup Steps

### 1. Connect Repository to Vercel

1. Go to [Vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. **⚠️ IMPORTANT**: Set Root Directory to `frontend`

### 2. Configure Project Settings

In Vercel dashboard during import:
- **Framework Preset**: Vite
- **Root Directory**: `frontend` 
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Environment Variables

In Vercel dashboard, go to Settings → Environment Variables and add:

```bash
VITE_API_BASE_URL=https://your-railway-app-name.railway.app
VITE_BACKEND_URL=https://your-railway-app-name.railway.app
```

**Replace `your-railway-app-name` with your actual Railway URL!**

### 4. Deploy

Click "Deploy" and Vercel will:
- Install dependencies
- Build the React app
- Deploy to CDN

## 🔄 Update Backend CORS

After getting your Vercel URL (e.g., `https://your-app.vercel.app`), update Railway environment variables:

```bash
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGIN=https://your-app.vercel.app
```

## ✅ Verify Deployment

1. **Frontend URL**: Check your Vercel app loads correctly
2. **API Connection**: Test a search to verify backend communication
3. **CORS**: Ensure no CORS errors in browser console

## 🔧 How It Works

### Development Mode:
- Uses Vite proxy: `/api` → `http://localhost:3001`
- All API calls go through proxy

### Production Mode:
- Uses `VITE_API_BASE_URL` environment variable
- Direct calls to Railway backend: `https://your-railway-app.railway.app/api/booking`

## 🐛 Troubleshooting

**CORS Errors:**
- Ensure `CORS_ORIGIN` in Railway matches your Vercel URL exactly
- Check no trailing slash differences

**API Not Found:**
- Verify `VITE_API_BASE_URL` is set correctly
- Check Railway backend is running and accessible

**Build Errors:**
- Ensure `frontend` is set as Root Directory in Vercel
- Check all dependencies are in `frontend/package.json`

## 🔄 Updates

To update the frontend:
1. Push changes to your GitHub branch
2. Vercel auto-deploys on every push
3. Check deployment status in Vercel dashboard
