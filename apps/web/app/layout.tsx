import type { Metadata } from 'next';
import '../styles/app.css';
import { AuthProvider } from '../contexts/AuthContext';
import { QueueProvider } from '../contexts/QueueContext';
import { UIProvider } from '../contexts/UIContext';
import { ModalProvider } from '../contexts/ModalContext';

export const metadata: Metadata = {
  title: 'نظام إدارة العيادات الطبية',
  description: 'نظام متكامل لإدارة العيادات والرسائل عبر الواتس اب',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet" />
      </head>
      <body className="font-arabic bg-gray-50 text-gray-900">
        <AuthProvider>
          <QueueProvider>
            <UIProvider>
              <ModalProvider>
                {children}
              </ModalProvider>
            </UIProvider>
          </QueueProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
