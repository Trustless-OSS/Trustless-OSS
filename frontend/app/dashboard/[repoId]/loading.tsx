export default function RepoDetailLoading() {
  return (
    <div className="w-full animate-pulse">
      <div className="h-4 w-32 bg-slate-200 border-2 border-slate-950 mb-8"></div>
      
      <div className="bg-white brutal-border p-8 md:p-12 mb-16 brutal-shadow">
        <div className="flex flex-col lg:flex-row justify-between gap-8 mb-12">
          <div>
            <div className="h-4 w-32 bg-slate-200 border-2 border-slate-950 mb-2"></div>
            <div className="h-10 w-64 bg-slate-200 border-4 border-slate-950 mb-4"></div>
            <div className="h-8 w-48 bg-slate-200 border-2 border-slate-950"></div>
          </div>
          <div className="lg:text-right border-l-4 border-slate-950 pl-8 border-dashed">
            <div className="h-4 w-32 bg-slate-200 border-2 border-slate-950 mb-2 ml-auto"></div>
            <div className="h-12 w-48 bg-slate-200 border-4 border-slate-950 mb-6 ml-auto"></div>
            <div className="h-10 w-32 bg-slate-950 border-4 border-slate-950 ml-auto"></div>
          </div>
        </div>
        <div className="border-t-4 border-slate-950 pt-8 border-dashed flex gap-4">
          <div className="h-12 w-32 bg-slate-200 border-4 border-slate-950"></div>
          <div className="h-12 w-32 bg-slate-200 border-4 border-slate-950"></div>
          <div className="h-12 w-32 bg-slate-200 border-4 border-slate-950"></div>
        </div>
      </div>
      
      <div className="flex items-end justify-between mb-8 border-b-[4px] border-slate-950 pb-4">
        <div className="h-8 w-48 bg-slate-200 border-4 border-slate-950"></div>
        <div className="h-6 w-24 bg-slate-200 border-2 border-slate-950"></div>
      </div>
      
      <div className="bg-white brutal-border brutal-shadow">
        <div className="w-full h-12 bg-slate-950 border-b-4 border-slate-950"></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-full h-16 border-b-4 border-slate-950 flex items-center px-6 gap-6">
            <div className="h-6 w-3/12 bg-slate-200 border-2 border-slate-950"></div>
            <div className="h-6 w-1/12 bg-slate-200 border-2 border-slate-950"></div>
            <div className="h-6 w-2/12 bg-slate-200 border-2 border-slate-950"></div>
            <div className="h-6 w-2/12 bg-slate-200 border-2 border-slate-950"></div>
            <div className="h-6 w-2/12 bg-slate-200 border-2 border-slate-950"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
