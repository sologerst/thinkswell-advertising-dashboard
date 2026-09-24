import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewClientForm } from "./new-client-form";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-3 transition hover:text-cyan">
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <div className="eyebrow mb-2 text-cyan!">New client</div>
      <h1 className="font-serif text-[2.4rem] leading-[1.05] text-fg">Who are we building for?</h1>
      <p className="mt-2 mb-8 text-sm text-fg-2">Start with the basics. Next you&apos;ll link their Meta ad account, set the agency fee and invite their team.</p>
      <NewClientForm />
    </div>
  );
}
