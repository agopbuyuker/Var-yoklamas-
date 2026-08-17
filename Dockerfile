# VAR Yoklaması - hafif, bagimliliksiz Node.js imajı
FROM node:22-slim

WORKDIR /app

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Yuklenen gorseller ve veritabani icin kalici bir birim (volume) baglayin:
#   docker run -v var-data:/app/data ...
VOLUME ["/app/data"]

CMD ["node", "server.js"]
