"use client";

import { useHighContrast, useReducedMotionSetting } from "@/hooks/useAppearanceSettings";
import { SubtitlePicker } from "@/components/lobby/SubtitlePicker";
import { SettingSwitch } from "@/components/settings/SettingSwitch";

/** Accessibility section: site-wide viewing preferences. */
export function AccessibilitySettings() {
  const contrast = useHighContrast();
  const motion = useReducedMotionSetting();

  return (
    <section aria-labelledby="settings-a11y" className="flex flex-col gap-3">
      <h2 id="settings-a11y" className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
        Accessibility
      </h2>
      <SettingSwitch
        checked={contrast.on}
        onChange={contrast.set}
        label="High contrast"
        description="Strengthens text, borders, and active states across the whole site."
      />
      <SettingSwitch
        checked={motion.on}
        onChange={motion.set}
        label="Reduce motion"
        description="Stops decorative animation and transitions. Your operating system's setting is honored automatically too."
      />
      <SubtitlePicker />
    </section>
  );
}
