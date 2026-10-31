"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/src/components/ui/cn";
import { toast } from "@/src/components/ui/toast";
import { NAV_ITEMS, isNavItemActive, type NavItem } from "./nav-items";
import { NavIcon } from "./NavIcon";

const itemBase =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold " +
  "transition-[transform,color] duration-100 active:scale-95 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function Item({ item, active }: { item: NavItem; active: boolean }) {
  if (item.primary) {
    const circle = (
      <span
        className={cn(
          "-mt-6 grid h-13 w-13 place-items-center rounded-full bg-primary-gradient text-on-primary shadow-card ring-4 ring-bg",
          "transition-transform duration-100 group-active:scale-95"
        )}
      >
        <NavIcon name={item.icon} size={26} strokeWidth={2.5} />
      </span>
    );
    const label = <span className={cn("truncate", active ? "text-primary" : "text-fg-muted")}>{item.label}</span>;
    if (!item.enabled) {
      return (
        <button
          type="button"
          aria-disabled="true"
          title="Próximamente"
          onClick={() => toast.info("Próximamente")}
          className={cn(itemBase, "group opacity-50")}
        >
          {circle}
          {label}
        </button>
      );
    }
    return (
      <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(itemBase, "group")}>
        {circle}
        {label}
      </Link>
    );
  }

  const content = (
    <>
      <NavIcon name={item.icon} />
      <span className="max-w-full truncate">{item.label}</span>
    </>
  );

  if (!item.enabled) {
    return (
      <button
        type="button"
        aria-disabled="true"
        title="Próximamente"
        onClick={() => toast.info("Próximamente")}
        className={cn(itemBase, "text-fg-subtle opacity-50")}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(itemBase, active ? "text-primary" : "text-fg-muted hover:text-fg")}
    >
      {content}
    </Link>
  );
}

/** Navegación inferior fija, solo en mobile (< sm). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-1/95 pb-safe backdrop-blur sm:hidden"
    >
      <div className="mx-auto flex h-16 max-w-screen-sm items-stretch gap-1 px-2 pt-1">
        {NAV_ITEMS.map((item) => (
          <Item key={item.id} item={item} active={isNavItemActive(item, pathname)} />
        ))}
      </div>
    </nav>
  );
}
