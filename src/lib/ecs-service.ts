import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';

import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Platform } from './platform';

export interface ECSServiceProps {
  containerPort: number;
  cpu?: number;
  memoryReservation?: number;
  enableServiceMesh?: boolean;
}

export class ECSService extends Construct {
  constructor(scope: Construct, id: string, props: ECSServiceProps) {
    super(scope, id);

    const platform = new Platform(this, 'backend-crystal');

    const deployEnv = this.node.tryGetContext('deployEnv') ?? 'dev';

    const taskLogGroup = new logs.LogGroup(this, 'crystalLogGroup', {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.THREE_DAYS,
    });

    const crystalTaskDef = new ecs.TaskDefinition(
      this,
      'crystalTaskDefinition',
      {
        compatibility: ecs.Compatibility.EC2_AND_FARGATE,
        cpu: props.cpu?.toString() ?? '256',
        memoryMiB: props.memoryReservation?.toString() ?? '512',
      },
    );

    crystalTaskDef.addContainer('crystalBackend', {
      image: ecs.ContainerImage.fromAsset('./application'),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: `ecsworkshop-crystal-${deployEnv}`,
        logGroup: taskLogGroup,
      }),
      environment: {
        REGION: Stack.of(this).region,
      },
      portMappings: [
        {
          containerPort: 3000,
        },
      ],
      memoryReservationMiB: props.memoryReservation ?? 512,
    });

    const crystalFargateService = new ecs.FargateService(
      this,
      'crystalService',
      {
        serviceName: `ecsworkshop-crystal-${deployEnv}`,
        taskDefinition: crystalTaskDef,
        cluster: platform.ecsCluster,
        securityGroups: [platform.sharedSecGrp3000],
        cloudMapOptions: {
          name: 'ecsdemo-crystal',
        },
      },
    );

    crystalFargateService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ec2:DescribeSubnets'],
        resources: ['*'],
      }),
    );

    const autoScale = crystalFargateService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    autoScale.scaleOnCpuUtilization('crystalAutoscaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: Duration.seconds(3),
      scaleOutCooldown: Duration.seconds(3),
    });
  }
}
