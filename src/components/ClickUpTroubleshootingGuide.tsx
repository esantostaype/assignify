// src/components/ClickUpTroubleshootingGuide.tsx - Troubleshooting guide

"use client";

import React, { useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Alert,
  Accordion,
  AccordionItem,
} from '@/components/ui';
import {
  Icon,
  PiInfo,
  PiBug,
  PiShieldCheck,
  PiGear,
} from '@/lib/icons';

interface TroubleshootingGuideProps {
  error?: string;
  onDebugClick?: () => void;
  onRetryClick?: () => void;
}

export const ClickUpTroubleshootingGuide: React.FC<TroubleshootingGuideProps> = ({
  error,
  onDebugClick,
  onRetryClick
}) => {
  const [showGuide, setShowGuide] = useState(false);

  const commonIssues = [
    {
      title: "Invalid ClickUp token",
      description: "The API token might be expired or incorrect",
      solutions: [
        "Check that CLICKUP_API_TOKEN is set in the environment variables",
        "Generate a new token in ClickUp Settings → Apps → API Token",
        "Make sure the token has read permissions for users"
      ]
    },
    {
      title: "Users without a valid ID",
      description: "Some team members may not have an assigned ID",
      solutions: [
        "Invited users who haven't accepted the invitation",
        "Deactivated members or members with a pending status",
        "Temporary sync issues in ClickUp"
      ]
    },
    {
      title: "Insufficient permissions",
      description: "The token might not have access to all teams or users",
      solutions: [
        "Check that you have administrator permissions in the workspace",
        "Make sure the token is workspace-level, not team-level",
        "Some users might be in private teams"
      ]
    },
    {
      title: "Connectivity issues",
      description: "Network problems or API rate limits",
      solutions: [
        "Check your internet connection",
        "ClickUp might be experiencing issues (status.clickup.com)",
        "Wait a few minutes before retrying"
      ]
    }
  ];

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="soft" tone="error" icon={null}>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Icon icon={PiBug} size={20} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <Typography variant="h6">
                  Error syncing ClickUp users
                </Typography>
                <Typography variant="bodySm" className="mt-1">
                  {error}
                </Typography>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {onRetryClick && (
                <Button
                  size="sm"
                  variant="outlined"
                  color="error"
                  onClick={onRetryClick}
                >
                  Retry
                </Button>
              )}

              {onDebugClick && (
                <Button
                  size="sm"
                  variant="outlined"
                  color="warning"
                  startIcon={<Icon icon={PiBug} size={16} />}
                  onClick={onDebugClick}
                >
                  Debug API
                </Button>
              )}

              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                startIcon={<Icon icon={PiInfo} size={16} />}
                onClick={() => setShowGuide(!showGuide)}
              >
                {showGuide ? 'Hide' : 'Show'} guide
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {showGuide && (
        <Card>
          <Typography variant="h5" className="mb-3 flex items-center gap-2">
            <Icon icon={PiShieldCheck} size={20} />
            Troubleshooting Guide
          </Typography>

          <div className="space-y-3">
            <Accordion mode="multiple">
              {commonIssues.map((issue, index) => (
                <AccordionItem
                  key={index}
                  id={`issue-${index}`}
                  title={issue.title}
                  isLast={index === commonIssues.length - 1}
                >
                  <Typography variant="bodySm" className="mb-2 text-(--color-text-muted)">
                    {issue.description}
                  </Typography>
                  <ul className="space-y-1 text-sm text-(--color-text-subtle)">
                    {issue.solutions.map((solution, solutionIndex) => (
                      <li key={solutionIndex} className="flex items-start gap-2">
                        <span className="text-primary-600 mt-1">•</span>
                        <span>{solution}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600 rounded-lg">
            <Typography variant="h6" className="mb-2 flex items-center gap-2 text-blue-300">
              <Icon icon={PiGear} size={16} />
              Recommended Configuration
            </Typography>
            <div className="text-sm text-blue-200 space-y-1">
              <div>• <strong>Token Scope:</strong> Workspace-level API token</div>
              <div>• <strong>Permissions:</strong> Admin or Owner in the workspace</div>
              <div>• <strong>Environment variables:</strong> CLICKUP_API_TOKEN correctly configured</div>
              <div>• <strong>Network:</strong> Stable internet connection</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
