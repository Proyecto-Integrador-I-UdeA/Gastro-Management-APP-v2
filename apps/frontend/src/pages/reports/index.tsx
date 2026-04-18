'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function ReportsIndexPage() {
  useAuthGuard('reports.read');
  const router = useRouter();

  useEffect(() => {
    void router.replace('/reports/products');
  }, [router]);

  return (
    <DashboardLayout>
      <p className="text-gray-600">Redirigiendo a reportes de productos…</p>
    </DashboardLayout>
  );
}
