export default function SectionHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-brand-600 via-accent-700 to-accent-800 p-6 text-white shadow-soft md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-blue-50/90">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
