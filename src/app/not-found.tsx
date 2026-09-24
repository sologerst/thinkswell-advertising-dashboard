import { BrandMark } from "@/components/brand";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <BrandMark size={56} className="animate-float" />
      <div className="eyebrow mt-8 text-cyan!">404</div>
      <h1 className="mt-2 font-serif text-[2.6rem] leading-tight text-fg">This page went dark.</h1>
      <p className="mt-3 max-w-md text-fg-2">It may have moved, or it isn&apos;t shared with your login.</p>
      <ButtonLink href="/" className="mt-8">
        Back to my dashboard
      </ButtonLink>
    </main>
  );
}
