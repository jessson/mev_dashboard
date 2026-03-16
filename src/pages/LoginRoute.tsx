import { useNavigate } from 'react-router-dom';
import LoginPage from '../components/LoginPage';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';

const LoginRoute = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  return (
    <LoginPage
      onLogin={(user: User) => {
        login(user);
        navigate('/app/overview', { replace: true });
      }}
    />
  );
};

export default LoginRoute;
