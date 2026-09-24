import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

export function BrandMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/thinkswell-mark.png"
      alt="Thinkswell"
      width={size}
      height={size}
      priority
      className={clsx("shrink-0 rounded-[3px]", className)}
    />
  );
}

/** Matches the thinkswell.com header lockup: mark + tight lowercase wordmark. */
export function BrandLockup({ href = "/", size = 34, className }: { href?: string; size?: number; className?: string }) {
  return (
    <Link href={href} aria-label="Thinkswell home" className={clsx("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <span className="text-[1.32rem] leading-none font-bold tracking-[-0.06em] text-fg">thinkswell</span>
    </Link>
  );
}
