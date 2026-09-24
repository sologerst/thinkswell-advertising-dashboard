import {
  CreditCard,
  DollarSign,
  Eye,
  Film,
  Filter,
  Flame,
  Globe,
  HandCoins,
  Heart,
  Inbox,
  MousePointerClick,
  Percent,
  Play,
  Receipt,
  Repeat,
  Rocket,
  ShoppingCart,
  Sparkles,
  Tag,
  Ticket,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SVGProps } from "react";

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="0.6" fill="currentColor" />
    </svg>
  );
}

const MAP: Record<string, LucideIcon | typeof FacebookIcon> = {
  wallet: Wallet,
  dollar: DollarSign,
  rocket: Rocket,
  ticket: Ticket,
  tag: Tag,
  receipt: Receipt,
  cart: ShoppingCart,
  creditCard: CreditCard,
  inbox: Inbox,
  funnel: Filter,
  users: Users,
  eye: Eye,
  repeat: Repeat,
  play: Play,
  film: Film,
  pointer: MousePointerClick,
  percent: Percent,
  globe: Globe,
  heart: Heart,
  trophy: Trophy,
  flame: Flame,
  sparkles: Sparkles,
  fee: HandCoins,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
};

export function MetricIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Sparkles;
  return <Icon className={className} />;
}

export const PLATFORM_META: Record<string, { label: string; color: string; icon?: typeof FacebookIcon }> = {
  facebook: { label: "Facebook", color: "var(--color-series-1)", icon: FacebookIcon },
  instagram: { label: "Instagram", color: "var(--color-series-2)", icon: InstagramIcon },
  audience_network: { label: "Audience Network", color: "var(--color-series-3)" },
  messenger: { label: "Messenger", color: "var(--color-series-3)" },
  threads: { label: "Threads", color: "var(--color-series-3)" },
  unknown: { label: "Other", color: "var(--color-series-3)" },
};

export function platformMeta(p: string) {
  return PLATFORM_META[p] ?? { label: p.replace(/_/g, " "), color: "var(--color-series-3)" };
}
