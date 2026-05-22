import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Eye, Settings } from "lucide-react";

const SettingsTab = () => {
  const [showSessionId, setShowSessionId] = useState(() => {
    const saved = localStorage.getItem("superadmin_settings_show_session_id");
    return saved === "true";
  });

  const handleToggle = (checked) => {
    setShowSessionId(checked);
    localStorage.setItem(
      "superadmin_settings_show_session_id",
      checked ? "true" : "false",
    );
    // Dispatch a custom storage event so other components on the page know to update
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div className="space-y-6 mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/10">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">System Settings</h2>
          <p className="text-xs text-muted-foreground">
            Configure global preferences and invigilation tools.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="h-4.5 w-4.5 text-blue-600 animate-pulse" />
            <CardTitle className="text-base font-bold text-slate-900">
              Feedback Invigilation & Verification
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Manage how student qualitative feedback is analyzed and verified by
            administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          <div className="flex items-center justify-between border rounded-xl p-4 bg-slate-50/50 border-slate-100 hover:border-slate-200 transition-colors">
            <div className="space-y-1 pr-4">
              <Label
                htmlFor="toggle-session-id"
                className="text-sm font-semibold text-slate-900 cursor-pointer"
              >
                Display Session ID in Sentiment Cards
              </Label>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                When enabled, the session ID (e.g.,{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-slate-800">
                  SESS-RAM / 20260520-5AMU
                </code>
                ) will be displayed next to ratings in the{" "}
                <strong>Highlights</strong>, <strong>Attention</strong>,{" "}
                <strong>Key Learning</strong>, and{" "}
                <strong>Future Demand</strong> cards. This helps you identify
                exactly which session a specific student review came from.
              </p>
            </div>
            <Switch
              id="toggle-session-id"
              checked={showSessionId}
              onCheckedChange={handleToggle}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsTab;
