# ROOZ Deployment Guide

## Phase 1 — Railway (live today)

### Prerequisites
- [Railway account](https://railway.app) — sign up with GitHub
- Railway CLI: `npm install -g @railway/cli` then `railway login`

### Steps

**1. Create a new Railway project**
```bash
cd ~/Desktop/PHOCUS
railway init   # name it "rooz"
```

**2. Add PostgreSQL and Redis plugins**
In the Railway dashboard → your project → "+ New" → PostgreSQL  
Then "+ New" → Redis

**3. Deploy the backend**
```bash
cd backend
railway up
```

Set these environment variables in Railway dashboard → backend service → Variables:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate: openssl rand -base64 48>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://<your-dashboard-url>
HEARTBEAT_TIMEOUT_MS=120000
VAPID_PUBLIC_KEY=BMXras6nrBzW4zv30YB9d0LLoDHD1qYehHEBnNUV02Dg4rYO-roiLTMlBVzchK-Z4L2RhFeYD8__sIn23nErEX4
VAPID_PRIVATE_KEY=<from your existing .env>
```
`DATABASE_URL` and `REDIS_URL` are injected automatically by Railway.

**4. Run the seed (first time only)**
```bash
railway run --service backend npx prisma db seed
```

**5. Deploy the dashboard**
```bash
cd ../dashboard
railway up
```

Set these variables on the dashboard service:
```
VITE_API_URL=https://<your-backend-railway-url>
```

Railway auto-generates a public URL for each service. Set `CORS_ORIGIN` on the backend to match the dashboard URL.

---

## Phase 2 — AWS (100K+ users)

### Prerequisites
- AWS account with billing enabled
- Terraform >= 1.6: `brew install terraform`
- AWS CLI: `brew install awscli` then `aws configure`
- Docker Desktop running

### Steps

**1. Bootstrap Terraform**
```bash
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform plan
terraform apply
```

**2. Build & push backend image to ECR**
```bash
# Get ECR URL from Terraform output
ECR_URL=$(terraform output -raw ecr_repository_url)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URL

docker build -t $ECR_URL:latest ./backend
docker push $ECR_URL:latest
```

**3. Build & deploy dashboard to S3**
```bash
BUCKET=$(terraform output -raw dashboard_bucket)
cd dashboard
VITE_API_URL=https://api.rooz.school npm run build
aws s3 sync dist/assets s3://$BUCKET/assets --cache-control "max-age=31536000,immutable"
aws s3 sync dist s3://$BUCKET --exclude "assets/*" --cache-control "no-cache"
```

**4. Point your domains**
- `app.rooz.school` → CloudFront distribution domain (from `terraform output cloudfront_domain`)
- `api.rooz.school` → ALB DNS (from `terraform output alb_dns`)

**5. Run initial migration**
```bash
# One-time: run migrations via ECS exec or a one-off task
aws ecs run-task \
  --cluster rooz-prod \
  --task-definition rooz-prod-backend \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","prisma","migrate","deploy"]}]}'
```

**6. Ongoing deploys — push to main**
The GitHub Actions workflow in `.github/workflows/deploy.yml` handles everything automatically on every push to `main`.

### GitHub Secrets needed
| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `VITE_API_URL` | `https://api.rooz.school` |
| `CLOUDFRONT_DISTRIBUTION_ID` | From `terraform output` |

### Architecture at 100K students
```
Students/Teachers (mobile + browser)
        │
   CloudFront CDN
   ┌────┴────────────────────────────┐
   │                                 │
  /api, /socket.io             dashboard SPA
   │                               (S3)
   ALB (sticky sessions)
   ├── ECS Task 1 (Fargate)
   ├── ECS Task 2 (Fargate)
   └── ... auto-scales to 20 tasks
        │             │
      RDS           ElastiCache
    Postgres          Redis
    (Multi-AZ)   (Socket.io pub/sub)
```

Redis is the key to WebSocket scale — all ECS tasks subscribe to the same Redis channel, so a message from student A's task reaches teacher B's task instantly regardless of which container each is connected to.
