import { configure as configureLogging } from "./logger";
import { run as stackReport } from "./stack-report";

configureLogging();

stackReport()
  .then(() => console.log("Done"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
