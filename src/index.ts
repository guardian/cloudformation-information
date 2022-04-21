import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { StackStatus } from "@aws-sdk/client-cloudformation";
import { parse, transforms } from "json2csv";
import { guCDKVersion, isStackDefinedWithGuCDK, uniqueTemplateResourceTypes } from "./analysis";
import { CloudFormation } from "./cloudformation";
import { Config } from "./config";
import type { StackMetadataForCsv } from "./types";
import { ensureCleanDirectory } from "./util";

const csvOptions = {
  // Columns for the CSV file
  // They're keys from `StackMetadataForCsv`
  // TODO Can this be automatically derived?
  fields: [
    "ReportTime",
    "StackId",
    "StackName",
    "StackStatus",
    "CreationTime",
    "LastUpdatedTime",
    "Profile",
    "Region",
    "ResourceTypes",
    "DefinedWithGuCDK",
    "GuCDKVersion",
  ],
  transforms: [transforms.unwind({ paths: ["ResourceTypes"] })],
};

async function main(): Promise<StackMetadataForCsv[]> {
  const now = new Date();
  ensureCleanDirectory(Config.CSV_OUTPUT_DIR);

  const stackInfo: Array<Awaited<StackMetadataForCsv[]>> = await Promise.all(
    Config.AWS_PROFILES.map((profile) => {
      return Config.AWS_REGIONS.map(async (region) => {
        const templateDir = path.join(Config.TEMPLATE_OUTPUT_DIR, region, profile);
        mkdirSync(templateDir, { recursive: true });

        const cfn = new CloudFormation(profile, region);
        const stacks = await cfn.getStacks();

        const dataForCsv = stacks
          .filter(({ StackStatus: status }) => status !== StackStatus.DELETE_COMPLETE)
          .map((stack) => {
            const template = stack.Template;

            return template
              ? {
                  ...stack,
                  ReportTime: now,
                  ResourceTypes: uniqueTemplateResourceTypes(template),
                  DefinedWithGuCDK: isStackDefinedWithGuCDK(template),
                  GuCDKVersion: guCDKVersion(template),
                }
              : {
                  ...stack,
                  ReportTime: now,
                  ResourceTypes: [],
                  DefinedWithGuCDK: false,
                };
          });

        if (dataForCsv.length > 0) {
          writeFileSync(path.join(Config.CSV_OUTPUT_DIR, `${profile}.csv`), parse(dataForCsv, csvOptions));
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
      writeFileSync(path.join(Config.CSV_OUTPUT_DIR, "combined.csv"), parse(stackInfo, csvOptions));
    }
    console.log(`Done. Files written to: ${Config.CSV_OUTPUT_DIR}`);
  })
  .catch(console.error);
