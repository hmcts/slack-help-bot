# Slack help bot

Listens for new posts in a designated Slack channel and raises a coresponding request in Jira.

## Creating the Slack App 
<details>
  <summary>Steps</summary>
1. Create a new app.

<img src="images/step1.png" width=50% height=50% />

2. Head to socket mode and enable it. You will then be asked to create a new token (call it **jira-integration**) This will only have **connections:write** in the scope. Select **Generate**. Make sure to write down the generated token as this will be required for the slack-help-bot configuration.

<img src="images/step2.png" width=50% height=50% />

3. Head to **Event subscriptions** and enable it. 

<img src="images/step3.png" width=50% height=50% />

4. Expand the **Subscribe to bot events** tab, add the following settings and save changes.

<img src="images/step4.png" width=50% height=50% />

5. Expand the **Subscribe to events on behalf of users** tab, add the following settings and save changes.

<img src="images/step5.png" width=50% height=50% />

6. Head to **Interactivity and shortcuts** and create a **Global** shortcut with the following settings and save changes. 

<img src="images/step6.png" width=50% height=50% />

7. Head to **Oauth and Permissions** and install the app to your workspace. Allow the app the default permissions. Copy the generated **Bot User OAuth Access Token** as this will be required for the slack-help-bot configuration. 

<img src="images/step7.png" width=50% height=50% />

8. Add the app in the channel where you would like it to be used. Make a note of the **channelID** as this will later be required in the slack-help-bot configuration.

<details>

## Getting Started with the Bot

### Prerequisites

Running the application requires the following tools to be installed in your environment:

  * [Node.js](https://nodejs.org/) v14.0.0 or later
  * [npm](https://www.npmjs.com/)
  * [Docker](https://www.docker.com)

You need to create a Slack App as required in the steps above and export the following values in your shell:

```shell
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
SLACK_REPORT_CHANNEL=
SLACK_REPORT_CHANNEL_ID=
```

### Running the application

We use 'Socket mode' so no need to proxy Slack's requests.

Rename "env.template.txt" to ".env" which is gitignored and safe for secrets.
You can source into your shell with:

 ```bash
$ set -o allexport; source .env; set +o allexport
 ```

#### Running locally

Install dependencies by executing the following command:

 ```bash
$ npm install
 ```
Run:

```bash
$ node app.js
```

#### Running with Docker

Create docker image:

```bash
  docker-compose build
```

Run the application by executing the following command:

```bash
  docker-compose up
```

This will start the frontend container exposing the application's port
(set to `3000` in this template app).

In order to test if the application is up, you can visit https://localhost:3000/health in your browser.
You should get a very basic health page (no styles, etc.).
