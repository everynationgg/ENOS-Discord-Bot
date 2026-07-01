import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Providers from '@/components/Providers';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <Providers>
      <Navbar />
      <main>{children}</main>
    </Providers>
  );
}
