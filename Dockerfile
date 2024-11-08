FROM node:20

WORKDIR /action

COPY . .

RUN npm install
RUN npm run build

ENTRYPOINT ["node", "/action/dist/main.js"]
