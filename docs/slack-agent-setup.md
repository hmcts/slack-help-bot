# FeePay help Slack Agent setup

Configure the existing Fee & Payments Slack app so it can also be used as an
Agent in Slack. Keep its current global help-request shortcut, Workflow Builder
step, and Jira ticket interactions enabled.

## Slack app settings

1. Open the existing Fee & Payments app in Slack API **Your Apps**. Do not create
   a replacement app: the current app owns the help-request shortcut and
   workflow callbacks.
2. In **Agents**, enable the Agent experience and provide:
   - **Agent description:** `Answers Fee and Payments questions using approved HMCTS Jira, Confluence and GitHub sources.`
   - **Suggested Prompts:** do not use **Fixed** prompts. The Messages tab
     accepts free-text questions independently of these suggestions. Choose
     **Dynamic** only if you want the app to provide adaptive suggestions
     through Slack's prompt API; that is separate from answering free-text
     questions.
3. Leave **Slack Model Context Protocol (MCP) Server** disabled for now. It is
   separate from connecting the Agent to the Fee & Payments Jira, Confluence,
   and GitHub sources. Enable it only if we later decide the Agent should use
   Slack itself as an additional source and have reviewed the resulting access.
4. In **App Home**, enable the **Messages** tab and allow messages to the app.
   Keep the existing **Home** tab enabled because the app uses it for its Jira
   request dashboard.
5. In **OAuth & Permissions**, add the scopes needed for free-text Agent DMs:
   - `im:history` to read the user's Agent conversation
   - `chat:write` to answer in Slack
   - `app_mentions:read` if users should also invoke the app by mentioning it
     in a channel

   Add `assistant:write` only if the app later calls Slack's suggested-prompt
   APIs. Retain all existing scopes, including `commands` and scopes used by
   the help-request workflow. Do not replace the scope list with only the Agent
   scopes.
6. In **Event Subscriptions**, retain the app's existing events and add
   `app_home_opened` and `message.im`. Keep `app_mention` enabled if channel
   mentions should invoke the Agent.
7. Save the changes and reinstall the app to the workspace to grant any newly
   added scopes. Update the deployed bot token secret if Slack issues a new
   token, then restart the application.
8. Open the app's **Messages** tab to use the Agent. A channel ID is not needed
   for direct Agent conversations. To support channel mentions too, invite the
   app to the chosen channel.

## Current application behavior

The app keeps the Jira dashboard on the Home tab and routes free-text Agent DMs
through the FeePay knowledge-answering handler. The existing global help-request
shortcut and help-request thread mirroring remain in place.

The answer handler queries an Azure AI Search index and uses Azure OpenAI to
compose a response from retrieved passages. The search index still needs to be
provisioned and populated from the configured source inventory in
[`../config/knowledge-sources.json`](../config/knowledge-sources.json). Until
that index exists and is populated, the Agent cannot answer source-based
questions. Configure the search endpoint, index name, OpenAI endpoint and
deployment using the same `AZURE_SEARCH_*` and `AZURE_OPENAI_*` environment
variable names used by `slack-help-bot`. The application's managed identity
needs permission to query the search index and
invoke the OpenAI deployment. The answer flow cites source URLs, says when the
sources do not support an answer, and does not create Jira issues as a side
effect.

Run the sync manually from GitHub Actions using **Sync FeePay knowledge** in
`.github/workflows/sync-knowledge.yml`, or run `npm run sync:knowledge` from a
configured environment. The workflow uses Azure OIDC; its federated identity
needs **Search Service Contributor** and **Search Index Data Contributor** on
the search service. Configure these GitHub Actions repository variables:
`JIRA_CLOUD_ID`, `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_SYNC_CLIENT_ID`, and
`AZURE_TENANT_ID`. The index name defaults to `feepay-knowledge-index`; set
`AZURE_SEARCH_KNOWLEDGE_STORE_INDEX_NAME` as a repository variable only to
override it. Configure repository secrets `JIRA_USERNAME` and
`JIRA_API_TOKEN` for an Atlassian account that can read the approved labeled
content in Jira project `PAY` and Confluence space `DTSFP`.

The sync job creates the index using `config/knowledge-index.json`, uploads
documents, and removes stale chunks. It shallow-clones the configured GitHub
repositories over HTTPS. Public repos need no token. If `GITHUB_TOKEN` is
injected into the sync environment, Git uses it for the clone; this is useful
when the token is a separately managed organization credential with read
access to the configured repositories. The automatic GitHub Actions
`GITHUB_TOKEN` is scoped to the repository running the workflow, so it may not
read other private repositories. Keep any broader credential in the sync job
only; the Slack app does not need it. The Agent's managed identity only needs
**Search Index Data Reader** on the index and **Cognitive Services OpenAI
User** on the OpenAI resource.

## Knowledge sources

- Confluence pages: only pages in space `DTSFP` with label `fee-pay-help-bot`
- Jira issues: only issues in project `PAY` with label `fee-pay-help-bot`
- Fee & Payments GitHub repositories: the 16 repositories in the source
  inventory file
- Wider HMCTS Reform GitHub sources: add an explicit curated repository list to
  the same inventory when it is agreed

The Jira and Confluence labels are an inclusion allowlist: label only content
approved for the Agent's audience. They do not enforce each Slack user's
individual Jira or Confluence permissions after content has been indexed.

The Jira project used for knowledge retrieval is kept separate from the Jira
project and issue type used by the existing help-request workflow.

## Slack references

- [Adding Agent features with Bolt for JavaScript](https://docs.slack.dev/tools/bolt-js/concepts/adding-agent-features/)
- [Slack app manifest reference](https://docs.slack.dev/reference/app-manifest/)
- [Agent messaging experience](https://docs.slack.dev/changelog/2026/06/30/agent-messages-tab/)
