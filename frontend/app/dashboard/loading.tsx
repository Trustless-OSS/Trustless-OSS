export default function DashboardLoading() {
  return (
    <div className="w-full px-6 py-10 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 bg-white/10 rounded-lg mb-2"></div>
          <div className="h-4 w-64 bg-white/5 rounded-lg"></div>
        </div>
        <div className="h-10 w-32 bg-white/10 rounded-xl"></div>
      </div>
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl p-6 flex flex-col h-48">
            <div className="flex justify-between mb-4">
              <div className="h-6 w-6 bg-white/10 rounded-full"></div>
              <div className="h-5 w-16 bg-white/10 rounded-full"></div>
            </div>
            <div className="h-5 w-32 bg-white/10 rounded-md mb-auto"></div>
            
            <div className="pt-4 border-t border-white/5 mt-auto flex justify-between">
              <div>
                <div className="h-3 w-12 bg-white/10 rounded-md mb-1"></div>
                <div className="h-4 w-20 bg-white/10 rounded-md"></div>
              </div>
              <div className="h-8 w-16 bg-white/10 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
