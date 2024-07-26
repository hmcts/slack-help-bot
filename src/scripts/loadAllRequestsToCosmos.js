import { load } from "../service/cosmos";

load()
  .then(() => console.log("Done"))
  .catch((err) => {
    console.error(
      "Error",
      err.message,
      err.code,
      err.statusCode,
      err.diagnostics,
      err.stack,
    );
  });
