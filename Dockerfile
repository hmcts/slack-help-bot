FROM hmctspublic.azurecr.io/base/node:18-alpine

COPY --chown=hmcts:hmcts package*.json ./

RUN npm install --production

COPY --chown=hmcts:hmcts . .

CMD ["node", "app.js"]

EXPOSE 3000
