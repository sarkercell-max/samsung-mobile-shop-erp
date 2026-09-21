import { getSettings } from "@/actions/settings.actions";
import { SettingsForm } from "@/components/shared/settings-form";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
