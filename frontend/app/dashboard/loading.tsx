export default function DashboardLoading() {
  return (
    <div className="w-full animate-pulse">
      <div className="flex items-center justify-between mb-12 border-b-[4px] border-slate-950 pb-4">
        <div>
          <div className="h-10 w-64 bg-slate-200 border-4 border-slate-950 mb-2"></div>
          <div className="h-4 w-48 bg-slate-200 border-2 border-slate-950"></div>
        </div>
        <div className="h-12 w-32 bg-slate-950 border-4 border-slate-950"></div>
      </div>
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white brutal-border p-6 flex flex-col h-48 brutal-shadow">
            <div className="flex justify-between mb-6">
              <div className="h-12 w-12 bg-slate-200 border-4 border-slate-950"></div>
              <div className="h-6 w-24 bg-slate-200 border-2 border-slate-950"></div>
            </div>
            <div className="h-6 w-48 bg-slate-200 border-2 border-slate-950 mb-2"></div>
            <div className="h-4 w-32 bg-slate-200 border-2 border-slate-950 mb-auto"></div>
            
            <div className="pt-4 border-t-4 border-slate-950 border-dashed flex justify-between">
              <div>
                <div className="h-3 w-16 bg-slate-200 border-2 border-slate-950 mb-1"></div>
                <div className="h-6 w-24 bg-slate-200 border-2 border-slate-950"></div>
              </div>
              <div className="h-10 w-24 bg-slate-950 border-4 border-slate-950"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
