const { Cacheables } = require("cacheables");

const cache = new Cacheables({
  logTiming: false,
  log: false,
});

async function lookupUser({ client, user }) {
  return cache.cacheable(
    () => {
      return client.users.profile.get({
        user,
      });
    },
    {
      cachePolicy: "max-age",
      maxAge: 86400,
    },
  );
}

async function lookupUsersName({ client, user }) {
  return lookupUser({ client, user }).then((result) => {
    if (result.ok) {
      return convertProfileToName(result.profile);
    } else {
      throw new Error(`Failed to lookup user ${result}`);
    }
  });
}

async function lookupUsersEmail({ client, user }) {
  return lookupUser({ client, user }).then((result) => {
    if (result.ok) {
      return result.profile.email;
    } else {
      throw new Error(`Failed to lookup user ${result}`);
    }
  });
}

/**
 * Users may have a display name set or may not.
 * Display name is normally better than real name, so we prefer that but fallback to real name.
 */
function convertProfileToName(profile) {
  let name = profile.display_name_normalized;
  if (!name) {
    name = profile.real_name_normalized;
  }
  return name;
}

module.exports.lookupUser = lookupUser;
module.exports.lookupUsersName = lookupUsersName;
module.exports.lookupUsersEmail = lookupUsersEmail;
