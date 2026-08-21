const cajache = require("cajache");
const { identifyServiceOwnership } = require("../../ai/ai");
const { hashString } = require("./hashString");

function getServiceOwnershipCacheKey(catalogue, incidentContext) {
  return `service-ownership:${catalogue.id}:${catalogue.updated || "unknown"}:${hashString(
    incidentContext,
  )}`;
}

function identifyServiceOwnershipCached(catalogue, incidentContext) {
  return cajache.use(
    getServiceOwnershipCacheKey(catalogue, incidentContext),
    () => identifyServiceOwnership(incidentContext, catalogue),
    { ttl: 604800 },
  );
}

module.exports = {
  getServiceOwnershipCacheKey,
  identifyServiceOwnershipCached,
};
