// /exercises/[slug] — dynamic route under static export. This server component
// pre-renders one page per exercise slug via generateStaticParams(), then hands
// off to the client <ExerciseDetail> for the interactive detail view.

import type { Metadata } from "next";
import { EXERCISES } from "../../../lib/movements/registry";
import ExerciseDetail from "./ExerciseDetail";

export function generateStaticParams() {
  return Object.keys(EXERCISES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = EXERCISES[slug];
  if (!meta) return {};
  const description = `${meta.name}: ${meta.instructions[0] ?? "form cues, camera coaching, and rep tracking"} Target muscles: ${meta.primaryMuscles.join(", ")}.`;
  return {
    title: `${meta.name} | RepMint`,
    description,
    openGraph: { title: `${meta.name} | RepMint`, description },
    twitter: { title: `${meta.name} | RepMint`, description },
  };
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ExerciseDetail slug={slug} />;
}
