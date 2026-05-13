'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-4 group-[.toaster]:border-slate-950 group-[.toaster]:shadow-[8px_8px_0px_0px_var(--color-blue)] group-[.toaster]:rounded-none group-[.toaster]:font-sans',
          description: 'group-[.toast]:text-slate-600 group-[.toast]:font-sans group-[.toast]:font-bold group-[.toast]:text-xs group-[.toast]:uppercase',
          actionButton:
            'group-[.toast]:bg-slate-950 group-[.toast]:text-slate-50 group-[.toast]:rounded-none group-[.toast]:font-black group-[.toast]:uppercase group-[.toast]:text-xs group-[.toast]:border-2 group-[.toast]:border-slate-950',
          cancelButton:
            'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500 group-[.toast]:rounded-none group-[.toast]:font-bold group-[.toast]:uppercase group-[.toast]:text-xs group-[.toast]:border-2 group-[.toast]:border-slate-100',
          error: 'group-[.toaster]:border-red-600 group-[.toaster]:shadow-[8px_8px_0px_0px_#ef4444]',
          success: 'group-[.toaster]:border-emerald-600 group-[.toaster]:shadow-[8px_8px_0px_0px_#10b981]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
