const { AzureOpenAI } = require("openai");
const {
  DefaultAzureCredential,
  getBearerTokenProvider,
} = require("@azure/identity");
const { parseResponseToRecommendation } = require("./parseAiResponses");

const scope = "https://cognitiveservices.azure.com/.default";
const azureADTokenProvider = getBearerTokenProvider(
  new DefaultAzureCredential(),
  scope,
);
const deployment = "gpt-4";
const apiVersion = "2024-04-01-preview";
const client = new AzureOpenAI({
  azureADTokenProvider,
  deployment,
  apiVersion,
});

async function analyticsRecommendations(input) {
  const result = await client.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a member of the Platform Operations support team at HMCTS. You are to assist the team by classifying what team, environment and area the user needs help with

The environment must be one of: AAT, Staging, Preview, Dev, Production, Perftest, Test, ITHC, demo, sandbox

The area must be one of AKS, Azure, Azure DevOps, Database read, Database update, Elasticsearch, GitHub, Jenkins, Question, SSL, VPN, Other

The team must be one of Access Management, Adoption, Architecture, Bulk print, Bulk scan, CCD, Civil, CMC, Divorce, Employment Tribunals, Ethos, Evidence Management, Expert UI, Family Integration Stream, Family Private Law, Fees/Pay, Financial Remedy, Find a Court or Tribunal, Future Hearings, Heritage, HMI, IDAM, Immigration, Log and Audit, Management Information, No fault divorce, PayBubble, PDDA, PET, Private Law, Probate, Reference Data, Reform Software Engineering, Residential Property, Retain and Dispose, Security Operations / Secure Design, Special Tribunals, SSCS, Tax Tribunals, Video Hearings, Work Allocation, Other

Teams are also known by their short names:
* Work Allocation=wa
* Log and audit=lau
* Expert UI = xui
* Access Management=am
* Evidence Management=em
* Evidence Management=dm-store
* Special Tribunals=sptribs
* Video Hearings=vh

You must reply with an environment, and area and a team, each reply should be prefixed with what it is and separated by a comma, e.g. environment=Production,team=Access Management,area=AKS,
You must only reply with the above no other words
If you don't know the answer reply with unknown

PR means pull request.
Pull requests are used in the preview environment`,
      },
      {
        role: "user",
        content: input,
      },
    ],
    model: "",
  });

  if (result.choices.length > 1) {
    throw new Error(`Unexpected response from LLM: ${result.choices}`);
  }

  if (result.choices.length === 0) {
    throw new Error(`No response from LLM, ${result}`);
  }

  const content = result.choices.pop().message.content;

  const parsed = parseResponseToRecommendation(content);
  console.log("LLM recommended", parsed);

  return parsed;
}

module.exports.analyticsRecommendations = analyticsRecommendations;
