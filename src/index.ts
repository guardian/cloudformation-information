import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { parse, transforms } from "json2csv";
import { CloudFormationInformation } from "./cloudformation";
import { Config } from "./config";
import type { StackInfo } from "./types";

function ensureCleanDirectory(name: string) {
  if (existsSync(name)) {
    rmSync(name, { recursive: true });
  }
  mkdirSync(name, { recursive: true });
}

async function main(): Promise<StackInfo[]> {
  ensureCleanDirectory(Config.CSV_OUTPUT_DIR);

  const stackInfo: Array<Awaited<StackInfo[]>> = await Promise.all(
    Config.AWS_PROFILES.map(async (profile) => {
      const templateDir = path.join(Config.TEMPLATE_OUTPUT_DIR, Config.AWS_REGION, profile);
      ensureCleanDirectory(templateDir);
      const data = await new CloudFormationInformation(profile, Config.AWS_REGION, templateDir).run();
      writeFileSync(
        path.join(Config.CSV_OUTPUT_DIR, `${profile}.csv`),
        parse(data, { transforms: [transforms.unwind({ paths: ["ResourceTypes"] })] })
      );
      return data;
    })
  );

  return stackInfo.flat();
}

main()
  .then((stackInfo) => {
    console.log(stackInfo);
    writeFileSync(
      path.join(Config.CSV_OUTPUT_DIR, "combined.csv"),
      parse(stackInfo, { transforms: [transforms.unwind({ paths: ["ResourceTypes"] })] })
    );
    console.log(`Done. Files written to: ${Config.CSV_OUTPUT_DIR}`);
  })
  .catch(console.error);
