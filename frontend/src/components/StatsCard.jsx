const colors = [
  'from-indigo-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-600',
];

let index = 0;

export default function StatsCard({ label, value }) {
  const color = colors[index % colors.length];
  index++;

  return (
    <div className={`rounded-2xl bg-gradient-to-r ${color} p-[2px] shadow-lg`}>
      <div className="rounded-2xl bg-white p-5">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
