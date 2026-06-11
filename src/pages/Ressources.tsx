import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LibraryContent } from '@/pages/Library';
import { PersonasContent } from '@/pages/Personas';
import { useSearchParams } from 'react-router-dom';

export default function Ressources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'scripts';

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Ressources</h1>
        <Tabs
          value={tab}
          onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
        >
          <TabsList>
            <TabsTrigger value="scripts">Scripts & templates</TabsTrigger>
            <TabsTrigger value="personas">Personas</TabsTrigger>
          </TabsList>
          <TabsContent value="scripts" className="mt-0">
            <LibraryContent />
          </TabsContent>
          <TabsContent value="personas" className="mt-0">
            <PersonasContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
