# FreeSplit Deployment Guide

## Deploy as Two Separate Services on Render.com

### Step 1: Deploy Backend Service

1. **Create New Web Service** on Render.com
2. **Connect Repository**: Link your GitHub repo
3. **Configuration**:
   - **Name**: `freesplit-backend`
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Port**: `8080`
   - **Environment**: `Docker`
4. **Deploy** and note the URL (e.g., `https://freesplit-backend.onrender.com`)

### Step 2: Deploy Frontend Service

1. **Create New Web Service** on Render.com
2. **Connect Repository**: Link your GitHub repo
3. **Configuration**:
   - **Name**: `freesplit-frontend`
   - **Dockerfile Path**: `./frontend/Dockerfile`
   - **Port**: `3000`
   - **Environment**: `Docker`
4. **Environment Variables**:
   - `REACT_APP_API_URL`: `https://freesplit-backend.onrender.com`
5. **Deploy**

### Step 3: Access Your App

- **Frontend URL**: `https://freesplit-frontend.onrender.com`
- **Backend API**: `https://freesplit-backend.onrender.com/api/`

## Local Development

Still works the same way:
```bash
./start.sh
```

- **Frontend**: `http://10.0.0.54:3001` (with dynamic IP detection)
- **Backend**: `http://10.0.0.54:8080`

## Benefits of Separate Services

✅ **Simpler**: No nginx proxy complexity
✅ **Independent**: Scale frontend/backend separately
✅ **Standard**: Common microservices pattern
✅ **Easier debugging**: Clear separation of concerns
✅ **Flexible**: Can deploy to different regions/platforms
