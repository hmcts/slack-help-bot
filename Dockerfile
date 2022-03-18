FROM hmctspublic.azurecr.io/base/node:16-alpine

COPY package*.json ./

RUN npm install --production

COPY --chown=hmcts:hmcts . .

CMD ["node", "app.js"]

EXPOSE 3000
