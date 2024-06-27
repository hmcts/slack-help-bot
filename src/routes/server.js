const http = require("http");
const fastStartup = process.env.FAST_STARTUP === "true";

let appInsights;
if (!fastStartup) {
  appInsights = require("../modules/appInsights");
}

function requestListener(app) {
  return (req, res) => {
    if (!fastStartup) {
      appInsights
        .client()
        .trackNodeHttpRequest({ request: req, response: res });
    }
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end("error");
    } else if (req.url === "/health") {
      const connectionError = app.receiver.client.badConnection;
      if (connectionError) {
        res.statusCode = 500;
      } else {
        res.statusCode = 200;
      }
      const myResponse = {
        status: "UP",
        slack: {
          connection: connectionError ? "DOWN" : "UP",
        },
        node: {
          uptime: process.uptime(),
          time: new Date().toString(),
        },
      };
      res.setHeader("Content-Type", "application/json");
    } else if (req.url === "/health/liveness") {
      if (app.receiver.client.badConnection) {
        res.statusCode = 500;
        res.end("Internal Server Error");
        return;
      }
      res.end("OK");
    } else if (req.url === "/health/readiness") {
      res.end(`<h1>slack-help-bot</h1>`);
    } else if (req.url === "/health/error") {
      // Dummy error page
      res.statusCode = 500;
      res.end(`{"error": "${http.STATUS_CODES[500]}"}`);
    } else {
      res.statusCode = 404;
      res.end(`{"error": "${http.STATUS_CODES[404]}"}`);
    }
  };
}

module.exports.requestListener = requestListener;
