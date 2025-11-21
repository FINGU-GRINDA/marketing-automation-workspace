import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { RequirementModule } from './modules/requirement/requirement.module';
import { ScenarioModule } from './modules/scenario/scenario.module';
import { ScenarioRunModule } from './modules/scenario-run/scenario-run.module';
import { CompanyModule } from './modules/company/company.module';
import { GptModule } from './modules/gpt/gpt.module';
import { SearchModule } from './modules/search/search.module';
import { WorkerModule } from './modules/worker/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: +(process.env.REDIS_PORT || 6379),
      },
    }),
    PrismaModule,
    WorkspaceModule,
    ConversationModule,
    RequirementModule,
    ScenarioModule,
    ScenarioRunModule,
    CompanyModule,
    GptModule,
    SearchModule,
    WorkerModule,
  ],
})
export class AppModule {}
