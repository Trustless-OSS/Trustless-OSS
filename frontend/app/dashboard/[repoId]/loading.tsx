export default function RepoDetailLoading() {
  return (
    <div className="w-full px-6 py-10 animate-pulse">
      <div className="glass rounded-2xl p-8 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="h-8 w-48 bg-white/10 rounded-lg mb-2"></div>
            <div className="h-4 w-32 bg-white/5 rounded-lg"></div>
          </div>
          <div className="text-right">
            <div className="h-3 w-20 bg-white/10 rounded-md mb-1 ml-auto"></div>
            <div className="h-8 w-24 bg-white/10 rounded-lg ml-auto"></div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/5 flex gap-4">
          <div className="h-10 w-24 bg-white/10 rounded-lg"></div>
          <div className="h-10 w-24 bg-white/10 rounded-lg"></div>
          <div className="h-10 w-24 bg-white/10 rounded-lg"></div>
        </div>
      </div>
      
      <div className="h-6 w-32 bg-white/10 rounded-lg mb-4"></div>
      
      <div className="glass rounded-2xl overflow-hidden">
        <div className="w-full h-12 bg-white/5 border-b border-white/10"></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-full h-16 border-b border-white/5 flex items-center px-6 gap-6">
            <div className="h-4 w-3/12 bg-white/10 rounded-md"></div>
            <div className="h-4 w-1/12 bg-white/10 rounded-md"></div>
            <div className="h-4 w-2/12 bg-white/10 rounded-md"></div>
            <div className="h-4 w-2/12 bg-white/10 rounded-md"></div>
            <div className="h-4 w-2/12 bg-white/10 rounded-md"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
