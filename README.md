# Fee & Payments Slack help bot 

Listens for new posts in a designated Slack channel and raises a coresponding request in Jira.

## Creating the Slack App 
<details>
  <summary>Steps</summary>

1. Create a new app in your workspace.

<img src="images/step1.png" width=50% height=50% />

2. Head to socket mode and enable it. You will then be asked to create a new token (call it **jira-integration**) This will only have **connections:write** in the scope. Select **Generate**. Copy the generated token as this will be required for the slack-help-bot configuration.

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

8. Invite the app in the channel where you would like it to be used in Slack. Make a note of the **channel ID** as this will later be required in the slack-help-bot configuration. You can get the channel ID by right clicking, 'copy link', and then it will be the bit after archives in the url, e.g. `C01APTJAM7D`.

</details>

## Enabling the FeePay help Agent

The existing global help-request shortcut and Jira ticket workflow should remain
enabled. To configure the Agent messaging experience in the same Slack app, follow
the [FeePay Agent setup guide](docs/slack-agent-setup.md). The guide adds the
Agent settings alongside the existing shortcuts and workflow.

The initial knowledge-source allow-list is recorded in
[`config/knowledge-sources.json`](config/knowledge-sources.json). It covers the
Fee & Payments Confluence space, Jira project, and repositories supplied by the
team. Broader HMCTS Reform repositories should be added as an explicit curated
list.

## Getting Started with the Bot

### Prerequisites

Running the application requires the following tools to be installed in your environment:

  * [Node.js](https://nodejs.org/) v24.0.0 or later
  * [npm](https://www.npmjs.com/)
  * [Docker](https://www.docker.com)

You need to create a Slack App as detailed in the steps above. For development purposes, this will have to be created in a new Slack workspace.
You will also need the JIRA details. For development purposes, these values can be found in the "env.template.txt" file for the HMCTS Jira SBOX Project.

The app connects to Jira Cloud via the Atlassian API gateway using `JIRA_API_URL` (defaults to `https://api.atlassian.com/ex/jira/`) and `JIRA_CLOUD_ID`, which routes requests to your site (e.g. `/ex/jira/<cloud-id>/rest/api/2/...`).
Human-facing Jira links in Slack use `JIRA_BROWSE_URL` (defaults to `https://hmcts.atlassian.net`). Find your cloud id at `https://<JIRA_BROWSE_URL>/_edge/tenant_info`.
Authentication uses basic auth with your email address (`JIRA_USERNAME`) and a Cloud API token (`JIRA_API_TOKEN`). Create an API token here: https://id.atlassian.com/manage-profile/security/api-tokens

Set the relevant environment variables defined in [env.template.txt](env.template.txt) based on above steps.

## Running the application

We use 'Socket mode' so no need to proxy Slack's requests. 

### Running on Kubernetes

The application can be deployed on Kubernetes using the [HMCTS nodejs chart](https://github.com/hmcts/chart-nodejs). To avoid exposing sensitive data from the configuration above you can add them as secrets from an Azure Key Vault. See the chart documentation for further info.

In production the deployment is managed via [Flux](https://github.com/hmcts/cnp-flux-config) (`apps/slack-help-bot/ccpay-slack-help-bot`). In addition to the tokens and Jira credentials, the Key Vault secret `jira-cloud-id` must be mounted (referenced as `jira-cloud-id` in the HelmRelease `keyVaults`) and the pod restarted after it is added so the secret is picked up. 

### Running locally

All configuration requirements listed above can be found in the "env.template.txt" file.

Rename "env.template.txt" to ".env" which is gitignored and safe for secrets.

Source into your shell with:

 ```bash
$ set -o allexport; source .env; set +o allexport
 ```

Install dependencies by executing the following command:

 ```bash
$ npm install
 ```
Run:

```bash
$ node app.js
```

#### Running locally with Docker

There is no need to source your configuration. The ".env" file will be mounted as a volume.  

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
