import { App } from 'aws-cdk-lib';
import { ECSDemoCrystal } from '../lib/backend';

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new ECSDemoCrystal(app, 'ecsworkshop-crystal', { env: devEnv });

app.synth();
