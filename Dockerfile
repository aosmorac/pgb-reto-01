FROM node:22-alpine

WORKDIR /workspace/src

COPY src/package*.json ./
RUN npm ci

COPY src ./
COPY base /workspace/base

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
