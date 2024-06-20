const { optionBlock } = require("./util");
const environments = [
  optionBlock("AAT / Staging", "staging"),
  optionBlock("Preview / Dev", "dev"),
  optionBlock("Production"),
  optionBlock("Perftest / Test", "test"),
  optionBlock("ITHC"),
  optionBlock("Demo", "demo"),
  optionBlock("Sandbox", "sbox"),
];

function lookupEnvironment(value) {
  return environments.find((env) => env.text.text === value);
}

const teams = [
  optionBlock("Access Management", "am"),
  optionBlock("Adoption"),
  optionBlock("Architecture"),
  optionBlock("Bulk print", "bulkprint"),
  optionBlock("Bulk scan", "bulkscan"),
  optionBlock("CCD"),
  optionBlock("Civil", "civil"),
  optionBlock("CMC"),
  optionBlock("Divorce"),
  optionBlock("Employment Tribunals", "et"),
  optionBlock("Ethos"),
  optionBlock("Evidence Management", "em"),
  optionBlock("Expert UI", "xui"),
  optionBlock("Family Integration Stream", "fis"),
  optionBlock("Family Private Law", "FPRL"),
  optionBlock("Fees/Pay", "fees-pay"),
  optionBlock("Financial Remedy", "finrem"),
  optionBlock("Find a Court or Tribunal", "FACT"),
  optionBlock("Future Hearings", "HMI"),
  optionBlock("Heritage"),
  optionBlock("HMI"),
  optionBlock("IDAM"),
  optionBlock("Immigration"),
  optionBlock("Log and Audit", "LAU"),
  optionBlock("Management Information", "mi"),
  optionBlock("No fault divorce", "nfdiv"),
  optionBlock("PayBubble"),
  optionBlock("PDDA"),
  optionBlock("PET"),
  optionBlock("Private Law", "private-law"),
  optionBlock("Probate"),
  optionBlock("Reference Data", "refdata"),
  optionBlock("Reform Software Engineering", "reform-software-engineering"),
  optionBlock("Residential Property", "rpts"),
  optionBlock("Retain and Dispose", "disposer"),
  optionBlock("Security Operations / Secure Design", "security"),
  optionBlock("Special Tribunals", "sptribs"),
  optionBlock("SSCS"),
  optionBlock("Tax Tribunals", "tax-tribunals"),
  optionBlock("Video Hearings", "vh"),
  optionBlock("Work Allocation", "wa"),
  optionBlock("Other"),
];

function lookupTeam(value) {
  return teams.find((env) => env.text.text === value);
}

const areas = [
  optionBlock("AKS"),
  optionBlock("Azure"),
  optionBlock("Azure DevOps", "azure-devops"),
  optionBlock("Database read", "DBQuery"),
  optionBlock("Database update", "DBUpdate"),
  optionBlock("Elasticsearch"),
  optionBlock("GitHub"),
  optionBlock("Jenkins"),
  optionBlock("Question"),
  optionBlock("SSL"),
  optionBlock("VPN"),
  optionBlock("Other"),
];

function lookupArea(value) {
  return areas.find((env) => env.text.text === value);
}

module.exports.areas = areas;
module.exports.environments = environments;
module.exports.teams = teams;
module.exports.lookupEnvironment = lookupEnvironment;
module.exports.lookupTeam = lookupTeam;
module.exports.lookupArea = lookupArea;
