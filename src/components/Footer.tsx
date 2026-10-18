import Link from "next/link";
import Icon from "./Icon";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><Icon name="phone" size={14} /> Emergency: <b className="num text-ink">911</b></span>
        <span>Ontario Poison Centre: <b className="num text-ink">1-800-268-9017</b></span>
        <Link href="/designs" className="ml-auto inline-flex items-center gap-1.5 hover:text-ink"><Icon name="palette" size={14} /> Designs</Link>
        <span>Map data © OpenStreetMap contributors</span>
      </div>
    </footer>
  );
}
