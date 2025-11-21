## ERD Overview

Workspace(1) ── (1) WorkspaceConfig  
Workspace(1) ── (1) RequirementSummary  
Workspace(1) ── (N) ConversationMessage  
Workspace(1) ── (N) SearchScenario ── (N) ScenarioRun  
Workspace(1) ── (N) Company

### Entities

**Workspace**
- `id` (PK, string, cuid)
- `name` (string, required)
- `description` (string, optional)
- `targetCompanyCount` (int)
- `status` (`WorkspaceStatus`, default `collecting`)
- `createdAt`, `updatedAt`
- Relations: 1:1 `WorkspaceConfig`, 1:1 `RequirementSummary`, 1:N `ConversationMessage`, `SearchScenario`, `ScenarioRun`, `Company`
- Index: `status`

**WorkspaceConfig**
- `id` (PK, string, cuid)
- `workspaceId` (FK -> Workspace, unique)
- `runScoreThreshold` (float)
- `minRunsBeforeFail` (int)
- `maxConsecutiveFails` (int)
- `maxParallelScenarios` (int)
- `maxRunsPerScenario`, `maxTotalRunsPerWorkspace` (int)
- `minCompanyScore` (float)
- `staleRunWindow` (int, # of runs tracked for exhaustion)
- Index: unique on `workspaceId`

**RequirementSummary**
- `id` (PK)
- `workspaceId` (FK -> Workspace, unique)
- `textSummary` (string)
- `normalized` (Json)
- `warnings` (Json)
- `createdAt`, `updatedAt`

**ConversationMessage**
- `id` (PK)
- `workspaceId` (FK -> Workspace, indexed)
- `role` (`ConversationRole`)
- `content`
- `createdAt`
- Index: `(workspaceId, createdAt desc)`

**SearchScenario**
- `id` (PK)
- `workspaceId` (FK -> Workspace, indexed)
- `name`, `baseQuery`
- `status` (`ScenarioStatus`)
- `riskLevel` (`ScenarioRiskLevel`)
- `countryCodes` (string array)
- `language` (string)
- `notes` (string)
- `createdAt`, `updatedAt`, `lastRunAt`
- `failCount` (int)
- Indexes: `(workspaceId, status)`, `(workspaceId, riskLevel)`

**ScenarioRun**
- `id` (PK)
- `workspaceId` (FK -> Workspace, indexed)
- `scenarioId` (FK -> SearchScenario, indexed)
- `runScore` (float)
- `resultCount` (int)
- `failedByScore` (bool)
- `newCompanyCount` (int)
- `metadata` (Json)
- `createdAt`
- Index: `(workspaceId, createdAt)`

**Company**
- `id` (PK)
- `workspaceId` (FK -> Workspace, indexed)
- `scenarioId` (FK -> SearchScenario, optional)
- `canonicalWebsiteUrl` (string)
- `name`, `description`, `tags` (string array)
- `score` (float)
- `reason` (string)
- `country`, `language`
- `createdAt`, `updatedAt`
- Unique constraint on `(workspaceId, canonicalWebsiteUrl)`

### Enums
- `WorkspaceStatus`: `collecting` | `paused` | `completed` | `failed`
- `ScenarioStatus`: `active` | `paused` | `failed_by_quality` | `exhausted`
- `ScenarioRiskLevel`: `low` | `medium` | `high`
- `ConversationRole`: `user` | `assistant`
