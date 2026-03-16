import { useNavigate } from 'react-router-dom';
import WelcomePage from '../components/WelcomePage';

const WelcomeRoute = () => {
  const navigate = useNavigate();

  return <WelcomePage onLogin={() => navigate('/login')} />;
};

export default WelcomeRoute;
