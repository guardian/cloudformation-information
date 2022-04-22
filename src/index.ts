import { run as stackReport } from "./stack-report";

stackReport()
  .then(() => console.log("Done"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
