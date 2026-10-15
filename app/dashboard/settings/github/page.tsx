export default function GitHubSetupPage() {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-3 py-16">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-600 uppercase">GitHub App</p>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight text-foreground">
          Completing installation
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Syncing the repositories you selected. This window should close when the connection is
          complete.
        </p>
      </div>
    </div>
  );
}
