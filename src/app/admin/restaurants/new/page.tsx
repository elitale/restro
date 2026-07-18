import { OnboardRestaurantForm } from "@/components/admin/onboard-restaurant-form";
import { PageHeader } from "@/components/shared/page-header";

export default function OnboardRestaurantPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Onboard a restaurant"
        description="Create a restaurant and its owner (manager) account."
      />
      <OnboardRestaurantForm />
    </div>
  );
}
