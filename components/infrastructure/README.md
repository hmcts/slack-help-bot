# FeePay Azure AI Search infrastructure

This Terraform component creates the Azure AI Search service used by the
FeePay Slack Agent and an identity for the GitHub Actions knowledge-sync
workflow. The bot runs as the shared `slack-help-bot-cftptl-intsvc-mi` workload
identity, which has **Search Index Data Reader** on the FeePay Search service. The sync
identity is federated to the configured GitHub repository and branch with
OpenID Connect, so the workflow does not need a client secret.

After the infrastructure pipeline applies this component, copy these Terraform
outputs into GitHub Actions repository variables:

| Terraform output | GitHub Actions variable |
| --- | --- |
| `azure_search_endpoint` | `AZURE_SEARCH_ENDPOINT` |
| `azure_search_sync_client_id` | `AZURE_SEARCH_SYNC_CLIENT_ID` |
| `azure_tenant_id` | `AZURE_TENANT_ID` |

The workflow's federated identity credential is restricted to
`repo:hmcts/ccpay-slack-help-bot:ref:refs/heads/main` by default. Run the
knowledge sync from `main` so the OIDC subject matches. The identity has
**Search Service Contributor** and **Search Index Data Contributor** roles on
the Search service. It also has read access to the `jira-cloud-id`,
`jira-username`, and `jira-api-token` secrets in the `cftptl-intsvc` Key Vault.
The workflow reads those secrets at runtime; their values are not copied into
GitHub Actions variables or logs.

The knowledge sync creates the `feepay-knowledge-index` index and semantic
configuration after the Search service exists. Terraform manages the Search
service, not the documents or index contents.
