import LoadingLogo from '../../components/LoadingLogo';

export default function RepoDetailLoading() {
  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center">
      <LoadingLogo message="FETCHING_REPO_METADATA..." size="lg" />
      
      {/* Ghost layout for structural hint */}
      <div className="w-full mt-12 opacity-5 pointer-events-none">
        <div className="h-4 w-32 bg-slate-200 border-2 border-slate-950 mb-8"></div>
        <div className="bg-white brutal-border p-8 md:p-12 mb-16 brutal-shadow">
          <div className="h-10 w-64 bg-slate-200 border-4 border-slate-950 mb-4"></div>
          <div className="h-8 w-48 bg-slate-200 border-2 border-slate-950"></div>
        </div>
        <div className="bg-white brutal-border brutal-shadow h-64"></div>
      </div>
    </div>
  );
}
