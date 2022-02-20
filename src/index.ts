import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { parse, transforms } from "json2csv";
import { CloudFormationInformation } from "./cloudformation";
import { Config } from "./config";

if (!existsSync(Config.OUTPUT_DIR)) {
  mkdirSync(Config.OUTPUT_DIR);
}

async function main() {
  return await Promise.all(
    Config.AWS_PROFILES.map(async (profile) => {
      const data = await new CloudFormationInformation(profile).run();
      await writeFile(
        path.join(Config.OUTPUT_DIR, `${profile}.csv`),
        parse(data, { transforms: [transforms.unwind({ paths: ["ResourceTypes"] })] })
      );
    })
  );
}

main()
  .then(() => console.log(`Done. Files written to: ${Config.OUTPUT_DIR}`))
  .catch(console.error);
