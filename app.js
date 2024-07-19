// some things gated by this take a bit of time to initialise and delay startup
// decrease iteration time by turning off feature not needed locally
const fastStartup = process.env.FAST_STARTUP === "true";
let config;
if (fastStartup) {
  config = require("config");
} else {
  config = require("@hmcts/properties-volume").addTo(require("config"));
  const setupSecrets = require("./src/setupSecrets");
  // must be called before any config.get calls
  setupSecrets.setup();
}

const { App } = require("@slack/bolt");

let appInsights;
if (!fastStartup) {
  appInsights = require("./src/modules/appInsights");

  appInsights.enableAppInsights();
}

const app = new App({
  token: config.get("slack.bot_token"), //disable this if enabling OAuth in socketModeReceiver
  // logLevel: LogLevel.DEBUG,
  appToken: config.get("slack.app_token"),
  socketMode: true,
});

//////////////////////////////////
//// Setup health check page /////
//////////////////////////////////

const http = require("http");
const cron = require("node-cron");
const { requestListener } = require("./src/routes/server");
const { beginHelpRequest } = require("./src/slackHandlers/beginHelpRequest");
const { showPlatoDialogue } = require("./src/slackHandlers/showPlatoDialogue");
const { startHelpForm } = require("./src/slackHandlers/startHelpForm");
const {
  submitInitialHelpRequest,
} = require("./src/slackHandlers/submitInitialHelpRequest");
const { submitHelpRequest } = require("./src/slackHandlers/submitHelpRequest");
const { appMention } = require("./src/slackHandlers/appMention");
const {
  assignHelpRequestToMe,
} = require("./src/slackHandlers/assignHelpRequestToMe");
const {
  assignHelpRequestToUser,
} = require("./src/slackHandlers/assignHelpRequestToUser");
const {
  resolveHelpRequestHandler,
} = require("./src/slackHandlers/resolveHelpRequest");
const {
  appHomeUnassignedIssues,
} = require("./src/slackHandlers/appHome/appHomeOpened");
const {
  viewRequestsAssignedToMe,
} = require("./src/slackHandlers/appHome/viewRequestsAssignedToMe");
const { appMessaged } = require("./src/slackHandlers/appMessaged");
const {
  viewRequestsRaisedByMe,
} = require("./src/slackHandlers/appHome/viewRequestsRaisedByMe");
const {
  startHelpRequestHandler,
} = require("./src/slackHandlers/startHelpRequestHandler");
const {
  documentHelpRequest,
} = require("./src/slackHandlers/documentHelpRequest");
const {
  withdrawInactiveIssues,
} = require("./src/slackHandlers/withdrawInactiveIssues");
const port = process.env.PORT || 3000;

const server = http.createServer(requestListener(app));
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

(async () => {
  await app.start();
  console.log("⚡️ Bolt app started");
})();

app.shortcut(
  "begin_help_request_sc",
  async ({ body, context, client, ack }) => {
    await ack();
    await beginHelpRequest(context.userId, client);
  },
);

app.action(
  "show_plato_dialogue",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await showPlatoDialogue(client, body);
  },
);

app.action(
  "start_help_form",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await startHelpForm(client, body);
  },
);

app.action(
  "submit_initial_help_request",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await submitInitialHelpRequest(body, client);
  },
);

app.action(
  "submit_help_request",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await submitHelpRequest(body, client);
  },
);

app.event("app_mention", async ({ event, context, client, say }) => {
  await appMention(event, client, say);
});

app.action(
  "assign_help_request_to_me",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await assignHelpRequestToMe(body, client);
  },
);

app.action(
  "assign_help_request_to_user",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await assignHelpRequestToUser(action, body, client);
  },
);

app.action(
  "resolve_help_request",
  async ({ body, action, ack, client, context, payload }) => {
    await ack();
    await resolveHelpRequestHandler(client, body);
  },
);

app.view("document_help_request", async ({ ack, body, view, client }) => {
  await ack();
  await documentHelpRequest(client, body);
});

app.action(
  "start_help_request",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await startHelpRequestHandler(body, client);
  },
);

// Processes whenever the bot receives a message
app.event("message", async ({ event, context, client, say }) => {
  await appMessaged(event, context, client, say);
});

/////////////////////////////
//// Setup App Homepage  ////
/////////////////////////////

app.event("app_home_opened", async ({ event, client }) => {
  await appHomeUnassignedIssues(event.user, client);
});

app.action(
  "view_open_unassigned_requests",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await appHomeUnassignedIssues(body.user.id, client);
  },
);

app.action(
  "view_requests_assigned_to_me",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await viewRequestsAssignedToMe(body, client);
  },
);

app.action(
  "view_requests_raised_by_me",
  async ({ body, action, ack, client, context }) => {
    await ack();
    await viewRequestsRaisedByMe(body, client);
  },
);

cron.schedule("0 8 * * 1-5", async () => {
  await withdrawInactiveIssues(app);
});
