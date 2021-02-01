FROM hmctspublic.azurecr.io/base/node:14-alpine-262ae7342a91df1908d8cbd2b3e7107716300edc 

COPY package*.json ./

RUN npm install

COPY --chown=hmcts:hmcts . .

CMD ["node", "app.js"]

EXPOSE 3000