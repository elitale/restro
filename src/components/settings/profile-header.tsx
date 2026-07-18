"use client";

import { Badge } from "@/components/ui/badge";
import { FORMAT_LABELS } from "@/lib/restaurant-format";
import type { RestaurantProfileDTO } from "@/types/settings";

import { CoverUploader } from "./cover-uploader";
import { LogoUploader } from "./logo-uploader";

export function ProfileHeader({
  profile,
  completeness,
}: {
  readonly profile: RestaurantProfileDTO;
  readonly completeness: { done: number; total: number };
}) {
  const complete = completeness.done >= completeness.total;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <CoverUploader coverUrl={profile.coverUrl} brandColor={profile.brandColor} />
        <div className="absolute -bottom-8 left-6">
          <LogoUploader logoUrl={profile.logoUrl} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-8 pl-2">
        <div>
          <h2 className="text-lg font-semibold">{profile.name}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {profile.restaurantFormat ? (
              <Badge variant="secondary">
                {FORMAT_LABELS[profile.restaurantFormat]}
              </Badge>
            ) : null}
            {profile.tagline ? (
              <span className="text-muted-foreground text-sm">
                {profile.tagline}
              </span>
            ) : null}
          </div>
        </div>
        <Badge variant={complete ? "default" : "secondary"}>
          Bill essentials {completeness.done}/{completeness.total}
        </Badge>
      </div>
    </div>
  );
}
