export default function Severity({ n }: { n: number }) {
  const tone = n >= 4 ? "bg-danger text-white" : n === 3 ? "bg-warn text-[#1a1206]" : "bg-surface-2 text-muted";
  return <span className={`badge ${tone}`} title={`Severity ${n} of 5`}>{n}/5</span>;
}
