import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
