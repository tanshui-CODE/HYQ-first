FROM alpine:3.18

RUN apk add --no-cache nodejs npm

WORKDIR /app

COPY package*.json ./

RUN npm install --production --registry=https://registry.npmmirror.com

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
