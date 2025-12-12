"use client";

import { useRouter } from "next/navigation";

import CreateProjectDrawer from "@/components/projects/CreateProjectDrawer";

export default function CreateProjectTrigger() {
  const router = useRouter();

  return <CreateProjectDrawer onCreated={() => router.refresh()} />;
}
