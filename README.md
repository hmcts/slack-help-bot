# Slack help bot

Listens for new posts in a designated Slack channel and raises a coresponding request in Jira. 

## Getting Started

### Prerequisites

Running the application requires the following tools to be installed in your environment:

  * [Node.js](https://nodejs.org/) v14.0.0 or later
  * [npm](https://www.npmjs.com/)
  * [Docker](https://www.docker.com)

### Running the application

You need to create a slack bot and export the following values in your shell:

```shell
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
REPORT_CHANNEL=bot-test
```

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

The applications's health page will be available at https://localhost:3000/health

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

