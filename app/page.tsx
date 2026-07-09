"use client";

// Root route. Logged-out visitors see the product landing; signed-in users are
// bounced straight to /hub. Auth check is client-side (static export, no
// middleware).

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Landing from "./components/Landing";
import { useSession } from "./lib/session";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && user) router.replace("/hub");
  }, [loading, user, router]);

  if (!loading && user) {
    return (
      <div className="shell-boot">
        <img className="shell-boot-mark" src="/brand/logomark.svg" alt="" />
        <span>Loading your hub…</span>
      </div>
    );
  }

  return <Landing />;
}
