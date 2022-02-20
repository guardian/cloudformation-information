import type { DescribeStacksCommandOutput, GetTemplateCommandOutput, Stack } from "@aws-sdk/client-cloudformation";
import {
  CloudFormationClient,
  DescribeStacksCommand,
  GetTemplateCommand,
  GetTemplateSummaryCommand,
  StackStatus,
} from "@aws-sdk/client-cloudformation";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { StandardRetryStrategy } from "@aws-sdk/middleware-retry";
import { yamlParse } from "yaml-cfn";
import type { CloudFormationTemplate, HydratedStack } from "./types";

const GU_CDK_TAG = "gu:cdk:version";
const SDK_MAX_ATTEMPTS = 10;
const SDK_MAX_RETRY_DELAY = 30 * 1000;

class CloudFormationInformation {
  private readonly client: CloudFormationClient;

  constructor(profile: string, region: string = "eu-west-1") {
    this.client = new CloudFormationClient({
      region,
      credentials: fromIni({ profile }),
      retryStrategy: new StandardRetryStrategy(() => Promise.resolve(SDK_MAX_ATTEMPTS), {
        delayDecider: (delayBase: number, attempts: number) => {
          return Math.floor(Math.min(SDK_MAX_RETRY_DELAY, 2 ** attempts * delayBase));
        },
      }),
    });
  }

  private async describeStacks(next?: string): Promise<Stack[]> {
    const command: DescribeStacksCommand = new DescribeStacksCommand({ NextToken: next });
    const { Stacks = [], NextToken }: DescribeStacksCommandOutput = await this.client.send(command);
    return NextToken ? [...Stacks, ...(await this.describeStacks(NextToken))] : Stacks;
  }

  private async getTemplate(stackArn: string): Promise<CloudFormationTemplate> {
    const command: GetTemplateCommand = new GetTemplateCommand({ StackName: stackArn });
    const { TemplateBody }: GetTemplateCommandOutput = await this.client.send(command);

    if (!TemplateBody) {
      return Promise.reject("No template");
    }

    try {
      return JSON.parse(TemplateBody) as CloudFormationTemplate;
    } catch (err) {
      try {
        return yamlParse(TemplateBody) as CloudFormationTemplate;
      } catch (e) {
        return Promise.reject(`Unable to determine a JSON or YAML template for stack ${stackArn}`);
      }
    }
  }

  private async getUniqueTemplateResourceTypes(stackArn: string): Promise<string[]> {
    const command: GetTemplateSummaryCommand = new GetTemplateSummaryCommand({ StackName: stackArn });
    const { ResourceTypes = [] } = await this.client.send(command);
    return Promise.resolve(Array.from(new Set(ResourceTypes)));
  }

  private async isStackDefinedWithGuCDK(stackArn: string): Promise<boolean> {
    const { Resources }: CloudFormationTemplate = await this.getTemplate(stackArn);

    return Object.values(Resources)
      .flatMap((resource) => resource.Properties)
      .flatMap((properties) => properties?.Tags ?? [])
      .some((tag) => tag.Key === GU_CDK_TAG);
  }

  async run(): Promise<HydratedStack[]> {
    const allStacks: Stack[] = await this.describeStacks();
    const stacks: Stack[] = allStacks.filter(({ StackStatus: status }) => status !== StackStatus.DELETE_COMPLETE);

    return await Promise.all(
      stacks.map(async (stack: Stack) => {
        const { StackId } = stack;

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- AWS's types are strange, `StackId` is never going to be `undefined`
        const stackArn = StackId!;

        const resourceTypes = await this.getUniqueTemplateResourceTypes(stackArn);
        const isDefinedWithGuCDK = await this.isStackDefinedWithGuCDK(stackArn);

        return {
          ...stack,
          metadata: {
            resourceTypes,
            isDefinedWithGuCDK,
          },
        } as HydratedStack;
      })
    );
  }
}

new CloudFormationInformation("deployTools")
  .run()
  .then((stacks) => console.log(JSON.stringify(stacks, null, 2)))
  .catch(console.error);
