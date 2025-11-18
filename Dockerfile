FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --omit=dev

# 빌드 결과만 복사
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]

