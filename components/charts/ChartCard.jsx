import SectionCard from "@/components/layout/SectionCard";

export default function ChartCard({ title, subtitle, children, height = 260 }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </SectionCard>
  );
}
