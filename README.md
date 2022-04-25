# CloudFormation Information

## What is it, and why?
A script that scrapes all cloudformation stacks in an account and produces a report listing:
  - The unique AWS resource types being used
  - If the stack has been defined with [`@guardian/cdk`](https://github.com/guardian/cdk)

This is to help understand which stacks should be migrated next.

## How does it work?
1. List all CloudFormation stacks in an account (via `describe-stacks`)
2. Parse the template for each stack:
   1. Download a stack's template (via `get-template`)
   2. Attempt to parse the template as JSON or YAML, downloading to `./output/templates`
   3. If _any_ resource if the stack has the Tag "gu:cdk:version", it has been defined with `@guardian/cdk`
3. Produce a CSV report in `./output/data`

## How do I run it?
1. Get CloudFormation Read credentials from Janus for each account you want to report for
2. Update the list of profiles in [`src/config.ts`](./src/config.ts) to match the credentials obtained from step 1
3. Install dependencies `npm install` (see [`.nvmrc`](./.nvmrc) for node version)
4. Run `npm run start [-- --prefer-cache --log-level=debug|log|warn|error|off]`

## Limitations
- Every so often AWS requests will experience throttling, efforts have been made to solve this, but they do not work in all scenarios
