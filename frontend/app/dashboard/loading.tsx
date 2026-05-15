import LoadingLogo from '../components/LoadingLogo';

export default function DashboardLoading() {
  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center">
      <LoadingLogo message="SYNCING_DASHBOARD..." size="lg" />
      
      {/* Background Skeletons for depth */}
      <div className="w-full grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-16 opacity-10 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white brutal-border p-6 flex flex-col h-48 brutal-shadow">
            <div className="flex justify-between mb-6">
              <div className="h-12 w-12 bg-slate-200 border-4 border-slate-950"></div>
              <div className="h-6 w-24 bg-slate-200 border-2 border-slate-950"></div>
            </div>
            <div className="h-6 w-48 bg-slate-200 border-2 border-slate-950 mb-2"></div>
            <div className="h-4 w-32 bg-slate-200 border-2 border-slate-950"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
