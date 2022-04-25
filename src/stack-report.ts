import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { StackStatus } from "@aws-sdk/client-cloudformation";
import { parse, transforms } from "json2csv";
import { guCDKVersion, isStackDefinedWithGuCDK, validateResources } from "./analysis";
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
    "DefinedWithGuCDK",
    "GuCDKVersion",
    {
      label: "ResourceType",
      value: "ResourceTypes.ResourceType",
    },
    {
      label: "AllResourcesFollowBestPractice",
      value: "ResourceTypes.FollowsBestPractice",
    },
  ],
  transforms: [transforms.unwind({ paths: ["ResourceTypes"] })],
};

export async function run() {
  const now = new Date();
  ensureCleanDirectory(Config.CSV_OUTPUT_DIR);

  const stackInfo: Array<Awaited<StackMetadataForCsv[]>> = await Promise.all(
    Config.AWS_PROFILES.map((profile) => {
      return Config.AWS_REGIONS.map(async (region) => {
        const templateDir = path.join(Config.TEMPLATE_OUTPUT_DIR, region, profile);
        mkdirSync(templateDir, { recursive: true });

        const cfn = new CloudFormation(profile, region);
        const stacks = await cfn.getStacks(Config.PREFER_CACHE);

        const dataForCsv = stacks
          .filter(({ StackStatus: status }) => status !== StackStatus.DELETE_COMPLETE)
          .map((stack) => {
            const template = stack.Template;

            return {
              ...stack,
              ReportTime: now,
              ResourceTypes: validateResources(template),
              DefinedWithGuCDK: isStackDefinedWithGuCDK(template),
              GuCDKVersion: guCDKVersion(template),
            };
          });

        if (dataForCsv.length > 0) {
          writeFileSync(path.join(Config.CSV_OUTPUT_DIR, `${profile}.csv`), parse(dataForCsv, csvOptions));
        }

        return dataForCsv;
      });
    }).flat()
  );

  const allStackInfo = stackInfo.flat();

  if (allStackInfo.length > 0) {
    writeFileSync(path.join(Config.CSV_OUTPUT_DIR, "combined.csv"), parse(allStackInfo, csvOptions));
  }

  console.log(`Done. Files written to: ${Config.CSV_OUTPUT_DIR}`);
}
