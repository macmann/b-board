-- Add new IssueHistoryField enum values for additional tracked fields
ALTER TYPE "IssueHistoryField" ADD VALUE 'TYPE';
ALTER TYPE "IssueHistoryField" ADD VALUE 'PRIORITY';
ALTER TYPE "IssueHistoryField" ADD VALUE 'EPIC';
