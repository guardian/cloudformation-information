import { AutoScalingClient, DescribeScalingActivitiesCommand } from "@aws-sdk/client-auto-scaling";
import { CloudFormationClient, DescribeStackResourceCommand } from "@aws-sdk/client-cloudformation";
import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { getStacks } from "./cloudformation";
import { Config } from "./config";
import type { StackMetadata } from "./types";

const Inactive = {
  NoRecentUpdate: "Stack has not been updated at all in the last 2 years.",
  NoRecentAsgDeployment: "Stack ASG has not been deployed to in the last month.",
  NoRecentLambdaDeployment: "Stack Lambda has not been updated in the last 6 months.",
  TestInName: "Stack name contains 'Test', which suggests it may be temporary.",
};

type InactiveStatus = keyof typeof Inactive;

const marshallTxt = (profile: string, region: string, stacks: Map<StackMetadata, InactiveStatus>): string => {
  if (stacks.size === 0) return "";

  const kvs = [...stacks.entries()];

  const lastUpdatedWidth = new Date().toISOString().length;
  const stackNameWidth = kvs
    .map(([meta]) => (meta.StackName ?? "").length)
    .sort()
    .reverse()[0];

  const paddedLastUpdated = (m: StackMetadata): string => {
    const dt = (m.LastUpdatedTime ?? m.CreationTime)?.toISOString() ?? "";
    return dt.padEnd(lastUpdatedWidth);
  };

  const paddedStackName = (m: StackMetadata): string => {
    return (m.StackName ?? "").padEnd(stackNameWidth);
  };

  return `${profile}:${region}
${"Last updated".padEnd(lastUpdatedWidth)}|${"StackName".padEnd(stackNameWidth)}|Reason
${kvs.map(([meta, reason]) => `${paddedLastUpdated(meta)}|${paddedStackName(meta)}|${Inactive[reason]}`).join("\n")}
`;
};

const noRecentUpdate = (metadata: StackMetadata): Promise<InactiveStatus | undefined> => {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const stackDate = (metadata.LastUpdatedTime ?? metadata.CreationTime) as Date;
  const isOld = twoYearsAgo > stackDate;
  return isOld ? Promise.resolve("NoRecentUpdate") : Promise.resolve(undefined);
};

const testInName = (metadata: StackMetadata): Promise<InactiveStatus | undefined> => {
  const matches = metadata.StackName?.toLowerCase().includes("test");
  return matches ? Promise.resolve("TestInName") : Promise.resolve(undefined);
};

// Lambda - lastModified :)
const noRecentLambdaDeployment = async (
  clients: Clients,
  metadata: StackMetadata
): Promise<InactiveStatus | undefined> => {
  // get lambda and then query lastmodified

  const lambda = Object.entries(metadata.Template.Resources).find(
    ([, resource]) => resource.Type === "AWS::Lambda::Function"
  );

  if (!lambda) return undefined;

  const [id] = lambda;

  const describeStackCmd = new DescribeStackResourceCommand({ StackName: metadata.StackName, LogicalResourceId: id });
  const describeStackOutput = await clients.cfnClient.send(describeStackCmd);
  const lambdaId = describeStackOutput.StackResourceDetail?.PhysicalResourceId;

  const getFunctionCmd = new GetFunctionCommand({ FunctionName: lambdaId });
  const fn = await clients.lambdaClient.send(getFunctionCmd);
  const lastModifiedStr = fn.Configuration?.LastModified;

  if (!lastModifiedStr) return undefined;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const lastModified = new Date(lastModifiedStr);

  console.debug(
    `stack:${
      metadata.StackName ?? "unknown"
    }; lambda:${id}; lastModified:${lastModified.toISOString()}; oneMonthAgo:${sixMonthsAgo.toISOString()}`
  );

  return lastModified < sixMonthsAgo ? "NoRecentLambdaDeployment" : undefined;
};

const noRecentAsgDeployment = async (
  clients: Clients,
  metadata: StackMetadata
): Promise<InactiveStatus | undefined> => {
  const asg = Object.entries(metadata.Template.Resources).find(
    ([, resource]) => resource.Type === "AWS::AutoScaling::AutoScalingGroup"
  );

  if (!asg) return undefined;

  const [id] = asg;

  const describeStackCmd = new DescribeStackResourceCommand({ StackName: metadata.StackName, LogicalResourceId: id });
  const describeStackOutput = await clients.cfnClient.send(describeStackCmd);
  const asgId = describeStackOutput.StackResourceDetail?.PhysicalResourceId;
  const describeScalingActivitiesCmd = new DescribeScalingActivitiesCommand({ AutoScalingGroupName: asgId });
  const describeScalingActivitiesOutput = await clients.asgClient.send(describeScalingActivitiesCmd);
  const activities = describeScalingActivitiesOutput.Activities;

  if (!activities || activities.length === 0) return undefined;

  const lastActivity = activities[0].StartTime;
  if (!lastActivity) return undefined;

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  console.debug(
    `stack:${
      metadata.StackName ?? "unknown"
    }; asg:${id}; lastActivity:${lastActivity.toISOString()}; oneMonthAgo:${oneMonthAgo.toISOString()}`
  );

  return lastActivity < oneMonthAgo ? "NoRecentAsgDeployment" : undefined;
};

type Clients = {
  asgClient: AutoScalingClient;
  cfnClient: CloudFormationClient;
  lambdaClient: LambdaClient;
};

export const run = async (profile: string, region: string, preferCache: boolean = false) => {
  // filter stacks to ASG and lambda
  const isStandardService = (metadata: StackMetadata): boolean => {
    return !!Object.entries(metadata.Template.Resources).find(
      ([, resource]) =>
        resource.Type === "AWS::AutoScaling::AutoScalingGroup" || resource.Type === "AWS::Lambda::Function"
    );
  };

  const stacks = await getStacks([profile], [region], preferCache);
  const clients = {
    cfnClient: new CloudFormationClient({
      region,
      maxAttempts: Config.SDK_MAX_ATTEMPTS,
      credentials: fromIni({ profile }),
    }),
    asgClient: new AutoScalingClient({
      region,
      maxAttempts: Config.SDK_MAX_ATTEMPTS,
      credentials: fromIni({ profile }),
    }),
    lambdaClient: new LambdaClient({
      region,
      maxAttempts: Config.SDK_MAX_ATTEMPTS,
      credentials: fromIni({ profile }),
    }),
  };

  const services = stacks.filter(isStandardService);
  const checks = [
    noRecentUpdate,
    testInName,
    noRecentAsgDeployment.bind(null, clients),
    noRecentLambdaDeployment.bind(null, clients),
  ];

  const failures: Array<[StackMetadata, InactiveStatus]> = [];
  for (const service of services) {
    for (const check of checks) {
      const res = await check(service);
      if (res) {
        failures.push([service, res]);
      }
    }
  }

  const out = marshallTxt(profile, region, new Map(failures));
  console.log(out);
};
