"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProfileEditableFieldsProps {
  profileId: string;
  initialCms: string | null;
  initialCmsLocked: boolean;
  initialIndustry: string | null;
  initialIndustryLocked: boolean;
  initialEmail: string | null;
  initialPhone: string | null;
  initialHostingPlatform: string | null;
}

async function patchProfile(profileId: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/admin/profiles/${profileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

function EditableField({
  label,
  value,
  locked,
  onSave,
  onToggleLock,
  placeholder,
}: {
  label: string;
  value: string | null;
  locked?: boolean;
  onSave: (val: string) => void;
  onToggleLock?: (locked: boolean) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-24 flex-shrink-0">{label}:</span>
      {editing ? (
        <form
          className="flex items-center gap-1 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setEditing(false);
          }}
        >
          <input
            className="border rounded px-2 py-0.5 text-sm flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <button type="submit" className="text-xs text-primary hover:underline">
            Save
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1">{value || <span className="text-muted-foreground">—</span>}</span>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
          >
            Edit
          </button>
          {onToggleLock && (
            <button
              className="text-xs"
              onClick={() => onToggleLock(!locked)}
              title={locked ? "Unlock (allow auto-detection)" : "Lock (prevent auto-overwrite)"}
            >
              <Badge variant={locked ? "default" : "secondary"} className="text-xs">
                {locked ? "Locked" : "Unlocked"}
              </Badge>
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function ProfileEditableFields({
  profileId,
  initialCms,
  initialCmsLocked,
  initialIndustry,
  initialIndustryLocked,
  initialEmail,
  initialPhone,
  initialHostingPlatform,
}: ProfileEditableFieldsProps) {
  const [cms, setCms] = useState(initialCms);
  const [cmsLocked, setCmsLocked] = useState(initialCmsLocked);
  const [industry, setIndustry] = useState(initialIndustry);
  const [industryLocked, setIndustryLocked] = useState(initialIndustryLocked);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [hosting, setHosting] = useState(initialHostingPlatform);
  const [, startTransition] = useTransition();

  const save = (data: Record<string, unknown>) => {
    startTransition(() => {
      patchProfile(profileId, data).catch(console.error);
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Site details</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <EditableField
            label="CMS"
            value={cms}
            locked={cmsLocked}
            placeholder="e.g. WordPress, Shopify"
            onSave={(val) => {
              setCms(val || null);
              save({ cms: val || null });
            }}
            onToggleLock={(locked) => {
              setCmsLocked(locked);
              save({ cmsLocked: locked });
            }}
          />
          <EditableField
            label="Industry"
            value={industry}
            locked={industryLocked}
            placeholder="e.g. Restaurant, SaaS"
            onSave={(val) => {
              setIndustry(val || null);
              save({ industry: val || null });
            }}
            onToggleLock={(locked) => {
              setIndustryLocked(locked);
              save({ industryLocked: locked });
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <EditableField
            label="Email"
            value={email}
            placeholder="email@example.com"
            onSave={(val) => {
              setEmail(val || null);
              save({ customerEmail: val || null });
            }}
          />
          <EditableField
            label="Phone"
            value={phone}
            placeholder="(555) 123-4567"
            onSave={(val) => {
              setPhone(val || null);
              save({ contactPhone: val || null });
            }}
          />
          <EditableField
            label="Hosting"
            value={hosting}
            placeholder="e.g. GoDaddy, Bluehost"
            onSave={(val) => {
              setHosting(val || null);
              save({ hostingPlatform: val || null });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
