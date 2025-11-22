import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/app.css';
import { UIProvider } from '../contexts/UIContext';
import { AuthProvider } from '../contexts/AuthContext';
import { QueueProvider } from '../contexts/QueueContext';
import { ModalProvider } from '../contexts/ModalContext';
import { ConfirmationProvider } from '../contexts/ConfirmationContext';
import { InputDialogProvider } from '../contexts/InputDialogContext';
import { SelectDialogProvider } from '../contexts/SelectDialogContext';
import WhatsAppSessionWrapper from '../components/Providers/WhatsAppSessionWrapper';
import ToastContainer from '../components/Common/ToastContainer';

export const metadata: Metadata = {
  title: 'نظام إدارة العيادات الطبية',
  description: 'نظام متكامل لإدارة العيادات والرسائل عبر الواتس اب',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
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
        {/** Provider order adjusted: UIProvider now wraps AuthProvider so AuthContext can trigger global toasts */}
        <UIProvider>
          <AuthProvider>
            <WhatsAppSessionWrapper>
              <QueueProvider>
                <ModalProvider>
                  <ConfirmationProvider>
                    <InputDialogProvider>
                      <SelectDialogProvider>
                        {children}
                        <ToastContainer />
                      </SelectDialogProvider>
                    </InputDialogProvider>
                  </ConfirmationProvider>
                </ModalProvider>
              </QueueProvider>
            </WhatsAppSessionWrapper>
          </AuthProvider>
        </UIProvider>
      </body>
    </html>
  );
}
