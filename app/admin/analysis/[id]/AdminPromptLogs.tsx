"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PromptLog } from "@prisma/client";

interface AdminPromptLogsProps {
  logs: PromptLog[];
}

export function AdminPromptLogs({ logs }: AdminPromptLogsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt logs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No prompt logs.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prompt logs (debug)</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {logs.map((log) => {
            const isOpen = openId === log.id;
            return (
              <li
                key={log.id}
                className="border rounded-lg overflow-hidden bg-muted/20"
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-2 p-3 text-left text-sm hover:bg-muted/40"
                  onClick={() => setOpenId(isOpen ? null : log.id)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <span className="font-medium">{log.step}</span>
                  <span className="text-muted-foreground text-xs">
                    {log.provider} / {log.model}
                  </span>
                  {log.responseTime != null && (
                    <span className="text-muted-foreground text-xs">
                      {log.responseTime}ms
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t px-3 py-2 space-y-2 text-xs font-mono bg-background">
                    <div>
                      <p className="text-muted-foreground font-sans font-normal mb-1">
                        Prompt
                      </p>
                      <pre className="whitespace-pre-wrap break-words max-h-48 overflow-y-auto p-2 rounded bg-muted/50">
                        {log.promptText}
                      </pre>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-sans font-normal mb-1">
                        Response
                      </p>
                      <pre className="whitespace-pre-wrap break-words max-h-48 overflow-y-auto p-2 rounded bg-muted/50">
                        {log.responseText}
                      </pre>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
