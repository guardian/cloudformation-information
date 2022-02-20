import { existsSync, mkdirSync, rmSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { parse, transforms } from "json2csv";
import { CloudFormationInformation } from "./cloudformation";
import { Config } from "./config";

function ensureCleanDirectory(name: string) {
  if (existsSync(name)) {
    rmSync(name, { recursive: true });
  }
  mkdirSync(name, { recursive: true });
}

async function main() {
  ensureCleanDirectory(Config.CSV_OUTPUT_DIR);

  return await Promise.all(
    Config.AWS_PROFILES.map(async (profile) => {
      const templateDir = path.join(Config.TEMPLATE_OUTPUT_DIR, Config.AWS_REGION, profile);
      ensureCleanDirectory(templateDir);
      const data = await new CloudFormationInformation(profile, Config.AWS_REGION, templateDir).run();
      await writeFile(
        path.join(Config.CSV_OUTPUT_DIR, `${profile}.csv`),
        parse(data, { transforms: [transforms.unwind({ paths: ["ResourceTypes"] })] })
      );
    })
  );
}

main()
  .then(() => console.log(`Done. Files written to: ${Config.CSV_OUTPUT_DIR}`))
  .catch(console.error);
