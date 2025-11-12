import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../../contexts/AuthContext';
import { UIProvider } from '../../contexts/UIContext';
import LoginScreen from '../../components/Auth/LoginScreen';

describe('LoginScreen Component', () => {
  it('renders login form with username and password fields', () => {
    render(
      <UIProvider>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </UIProvider>
    );

    expect(screen.getByPlaceholderText('أدخل اسم المستخدم')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('أدخل كلمة المرور')).toBeInTheDocument();
  });

  it('displays error message when credentials are empty', () => {
    render(
      <UIProvider>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </UIProvider>
    );

    const loginButton = screen.getByRole('button', { name: 'تسجيل الدخول' });
    fireEvent.click(loginButton);

    expect(screen.getByText('يرجى ملء جميع الحقول')).toBeInTheDocument();
  });

  it('displays error message for invalid credentials', () => {
    render(
      <UIProvider>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </UIProvider>
    );

    const usernameInput = screen.getByPlaceholderText('أدخل اسم المستخدم');
    const passwordInput = screen.getByPlaceholderText('أدخل كلمة المرور');
    const loginButton = screen.getByRole('button', { name: 'تسجيل الدخول' });

    fireEvent.change(usernameInput, { target: { value: 'invalid' } });
    fireEvent.change(passwordInput, { target: { value: 'invalid' } });
    fireEvent.click(loginButton);

    expect(screen.getByText('بيانات تسجيل الدخول غير صحيحة')).toBeInTheDocument();
  });

  it('displays quick login buttons for test credentials', () => {
    render(
      <UIProvider>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </UIProvider>
    );

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('admin2')).toBeInTheDocument();
    expect(screen.getByText('mod1')).toBeInTheDocument();
    expect(screen.getByText('user1')).toBeInTheDocument();
  });

  it('shows gradient background styling', () => {
    const { container } = render(
      <UIProvider>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </UIProvider>
    );

    const outerDiv = container.querySelector('.bg-gradient-to-br');
    expect(outerDiv).toHaveClass('from-blue-600', 'to-purple-700');
  });
});
