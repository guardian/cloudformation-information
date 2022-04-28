import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Config } from "./config";
import { run as runListInactive } from "./list-inactive";
import { configure as configureLogging, getLogLevel } from "./logger";
import { run as stackReport } from "./stack-report";
import { LOG_LEVELS } from "./types";

const doForAll = <A>(
  profiles: string[],
  regions: string[],
  preferCache: boolean,
  fn: (profile: string, region: string, preferCache: boolean) => Promise<A>
): Promise<A[]> => {
  const targets = profiles.flatMap((profile) => {
    return regions.map((region) => [profile, region]);
  });

  return Promise.all(targets.map(([profile, region]) => fn(profile, region, preferCache)));
};

void yargs(hideBin(process.argv))
  .command(
    "overview",
    "list stacks, contained resources, and if generated by @guardian/cdk",
    (yargs) => {
      yargs.option("prefer-cache", {
        type: "boolean",
        description: "use local cache",
      });
    },
    async (argv) => {
      const preferCache = argv["prefer-cache"] as boolean;
      const logLevel = getLogLevel(argv["log-level"] as string);

      configureLogging(logLevel);

      try {
        await doForAll(Config.AWS_PROFILES, Config.AWS_REGIONS, preferCache, stackReport);
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
  )
  .command(
    "list-inactive",
    "list stacks that appear inactive and can potentially be deleted. Note this uses simple heuristics and false positives are very likely.",
    (yargs) => {
      yargs;
    },
    async (argv) => {
      const logLevel = getLogLevel(argv["log-level"] as string);
      const preferCache = argv["prefer-cache"] as boolean;

      configureLogging(logLevel);

      try {
        await doForAll(Config.AWS_PROFILES, Config.AWS_REGIONS, preferCache, runListInactive);
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
  )
  .option("log-level", {
    type: "string",
    description: `define log level (${LOG_LEVELS.join(",")})`,
    choices: LOG_LEVELS,
  })
  .parse();
