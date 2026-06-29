FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY . .
CMD ["sh", "-c", "serve -s . -l ${PORT:-3000}"]
