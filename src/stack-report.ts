import { writeFileSync } from "fs";
import path from "path";
import { StackStatus } from "@aws-sdk/client-cloudformation";
import { parse, transforms } from "json2csv";
import { guCDKVersion, isStackDefinedWithGuCDK, validateResources } from "./analysis";
import { getStacks } from "./cloudformation";
import { Config } from "./config";
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

export const run = async (profile: string, region: string, preferCache: boolean) => {
  const now = new Date();
  ensureCleanDirectory(Config.CSV_OUTPUT_DIR);

  const stacks = await getStacks([profile], [region], preferCache);

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

  console.log(`Done. Files written to: ${Config.CSV_OUTPUT_DIR}`);

  return dataForCsv;
};
