const { optionBlock } = require("./util");
const environments = (area) => {
  const nonCrimeEnvs = [
    optionBlock("AAT / Staging", "staging"),
    optionBlock("Preview / Dev", "dev"),
    optionBlock("Production"),
    optionBlock("Perftest / Test", "test"),
    optionBlock("ITHC"),
    optionBlock("Demo", "demo"),
    optionBlock("Sandbox", "sbox"),
  ];

  const crimeEnvs = [
    optionBlock("STE"),
    optionBlock("DEV"),
    optionBlock("SIT"),
    optionBlock("NFT"),
    optionBlock("Pre-Production"),
    optionBlock("Production"),
    optionBlock("PRX"),
    optionBlock("Non-live Management"),
    optionBlock("Live Management"),
    optionBlock("Other"),
  ];

  return area === "crime" ? crimeEnvs : nonCrimeEnvs;
};

function lookupEnvironment(value, area) {
  if (!value) {
    return undefined;
  }
  return environments(area).find(
    (env) => env.text.text.toLowerCase() === value.toLowerCase(),
  );
}

const teams = (area) => {
  const nonCrimeTeams = [
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

  const crimeTeams = [
    optionBlock("Application: Common Platform", "application-common-platform"),
    optionBlock("Atlassian"),
    optionBlock("IDAM", "crime-idam"),
    optionBlock("Rota"),
    optionBlock("Other"),
  ];

  return area === "crime" ? crimeTeams : nonCrimeTeams;
};

function lookupTeam(value, area) {
  return teams(area).find((env) => env.text.text === value);
}

const areas = (area) => {
  const nonCrimeAreas = [
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

  const crimeAreas = [
    optionBlock("Access"),
    optionBlock("AKS"),
    optionBlock("Azure"),
    optionBlock("Database"),
    optionBlock("Environment"),
    optionBlock("GitHub"),
    optionBlock("Joiner / Mover / Leaver (JML)", "jml"),
    optionBlock("Pipeline"),
    optionBlock("SSL"),
    optionBlock("VPN"),
    optionBlock("Other"),
  ];

  return area === "crime" ? crimeAreas : nonCrimeAreas;
};

function lookupArea(value, area) {
  return areas(area).find((env) => env.text.text === value);
}

module.exports.areas = areas;
module.exports.environments = environments;
module.exports.teams = teams;
module.exports.lookupEnvironment = lookupEnvironment;
module.exports.lookupTeam = lookupTeam;
module.exports.lookupArea = lookupArea;
