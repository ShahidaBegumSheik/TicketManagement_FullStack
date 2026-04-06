import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';

export default function ChartCard({ title, description, type = 'bar', data }) {
  const Chart = { bar: Bar, line: Line, pie: Pie, doughnut: Doughnut }[type] || Bar;
  return (
    <div className="card p-5">
      <div>
        <h4 className="text-lg font-semibold text-indigo-700">{title}</h4>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="mt-5 h-[320px]">
        <Chart
          data={data}
          options={{
            maintainAspectRatio: false,
            responsive: true,
            animation: {
              duration: 1000,
              easing: 'easeInOutQuart',
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: '#374151',
                  font: {
                    size: 12,
                    weight: 'bold',
                  },
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
