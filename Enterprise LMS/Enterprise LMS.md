Enterprise LMS — Kiến trúc Production SaaS
Tổng quan hệ thống
Enterprise LMS là nền tảng Learning Management System theo hướng SaaS multi-tenant dành cho:
Trường học
Trung tâm đào tạo
AI learning platform
EdTech startup
Kiến trúc tổng thể
```text
Cloudflare CDN
       ↓
API Gateway / NGINX
       ↓

Frontend Layer
├── Next.js Web
├── Admin Dashboard
├── Student Portal
└── Parent Portal

Backend Services
├── Auth Service
├── Learning Service
├── AI Service
├── Media Service
├── Analytics Service
├── Gamification Service
├── Notification Service
└── Realtime Gateway

Infrastructure Layer
├── PostgreSQL
├── MongoDB
├── Redis
├── BullMQ
├── MinIO
├── Kafka / NATS
├── Qdrant
└── ClickHouse
```
Multi-Tenant Architecture
```prisma
model School {
  id        Int      @id @default(autoincrement())
  name      String
  domain    String?
  createdAt DateTime @default(now())

  users User\[]
}

model User {
  id        Int      @id @default(autoincrement())
  schoolId  Int

  email     String
  password  String

  school School @relation(fields: \[schoolId], references: \[id])

  @@unique(\[schoolId, email])
}
```
Frontend Architecture
```text
src/
├── app/
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── lessons/
│   ├── ai/
│   ├── classroom/
│   └── rewards/
├── shared/
├── widgets/
├── entities/
└── features/
```
Backend Architecture
```text
services/
├── auth-service
├── learning-service
├── ai-service
├── analytics-service
├── notification-service
├── game-service
└── media-service
```
Realtime Architecture
```text
Client
   ↓
WebSocket Gateway
   ↓
Redis Pub/Sub
   ↓
Realtime Services
```
AI Service Architecture
```text
Fastify API
   ↓
BullMQ
   ↓
AI Workers
```
Video Streaming Pipeline
```text
Upload
  ↓
Transcoding Queue
  ↓
FFmpeg Workers
  ↓
HLS / DASH
  ↓
CDN
```
Database Strategy
PostgreSQL
Users
Billing
Courses
Transactions
RBAC
MongoDB
Lesson blocks
AI chats
Logs
Dynamic content
Redis
Cache
Session
Queue
Presence
Leaderboards
Security
Rate limiting
JWT refresh token
Token rotation
CSRF protection
Audit log
IP throttling
DevOps
Production stack:
Kubernetes
Helm
ArgoCD
Terraform
GitHub Actions
CI/CD
```text
feature branch
   ↓
develop
   ↓
staging
   ↓
main
```
Production Risks
AI processing bottleneck
WebSocket scaling
Redis memory explosion
Video streaming load
Scaling Solutions
Queue isolation
Worker clusters
CDN
Horizontal scaling
Event-driven architecture
Recommended Roadmap
Phase 1
Auth
PostgreSQL
Prisma
RBAC
Phase 2
Courses
Lessons
Quiz
Phase 3
AI Tutor
Vector search
AI workers
Phase 4
Realtime classroom
Notifications
Live quiz
Phase 5
Kubernetes
Monitoring
Observability