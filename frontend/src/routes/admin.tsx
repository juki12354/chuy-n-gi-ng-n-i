import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteShell } from "@/components/admin/admin-ui";

export const Route = createFileRoute("/admin")({
  component: AdminRouteShell,
});
