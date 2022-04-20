import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { parse, transforms } from "json2csv";
import { CloudFormationInformation } from "./cloudformation";
import { Config } from "./config";
import { StackInfoForCsv } from "./types";

function ensureCleanDirectory(name: string) {
  if (existsSync(name)) {
    rmSync(name, { recursive: true });
  }
  mkdirSync(name, { recursive: true });
}

async function main(): Promise<StackInfoForCsv[]> {
  ensureCleanDirectory(Config.CSV_OUTPUT_DIR);
  ensureCleanDirectory(Config.TEMPLATE_OUTPUT_DIR);

  const now = new Date();

  const stackInfo: Array<Awaited<StackInfoForCsv[]>> = await Promise.all(
    Config.AWS_PROFILES.map((profile) => {
      return Config.AWS_REGIONS.map(async (region) => {
        const templateDir = path.join(Config.TEMPLATE_OUTPUT_DIR, region, profile);
        mkdirSync(templateDir, { recursive: true });

        const data = await new CloudFormationInformation(profile, region, templateDir).run();
        const dataForCsv = data.map((data) => StackInfoForCsv.fromStackInfo(now, data));

        if (dataForCsv.length > 0) {
          writeFileSync(
            path.join(Config.CSV_OUTPUT_DIR, `${profile}.csv`),
            parse(dataForCsv, { transforms: [transforms.unwind({ paths: ["ResourceTypes"] })] })
          );
        }

        return dataForCsv;
      });
    }).flat()
  );

  return stackInfo.flat();
}

main()
  .then((stackInfo) => {
    if (stackInfo.length > 0) {
      writeFileSync(
        path.join(Config.CSV_OUTPUT_DIR, "combined.csv"),
        parse(stackInfo, { transforms: [transforms.unwind({ paths: ["ResourceTypes"] })] })
      );
    }
    console.log(`Done. Files written to: ${Config.CSV_OUTPUT_DIR}`);
  })
  .catch(console.error);
