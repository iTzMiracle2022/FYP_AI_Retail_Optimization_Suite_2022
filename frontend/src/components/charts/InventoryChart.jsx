import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const InventoryChart = ({ data }) => {
  return (
    <div style={{ height: 350, width: '100%' }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94A3B8', fontSize: 11 }} 
            dy={10}
            interval="preserveStartEnd"
            tickFormatter={(val) => {
              if (!val) return '';
              const parts = val.split('-');
              return parts.length === 3 ? `${parts[1]}-${parts[2]}` : val;
            }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94A3B8', fontSize: 11 }} 
            dx={-5}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#0F172A', fontWeight: 600 }}
            itemStyle={{ color: '#0F172A', fontWeight: 700 }}
            labelStyle={{ color: '#64748B', fontWeight: 600, marginBottom: '4px' }}
          />
          
          <Area 
            type="monotone" 
            dataKey="demand" 
            stroke="#3B82F6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorDemand)" 
            activeDot={{ r: 6, fill: '#3B82F6', stroke: '#ffffff', strokeWidth: 2 }} 
          />
          
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default InventoryChart;
