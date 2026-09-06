import Header from './Header';
import ProgressBar from './ProgressBar';
import { useApp } from '../context/AppContext';

export default function Layout({ children, wide = false }) {
  const { state } = useApp();
  const showProgress = state.isLoggedIn && state.currentStep >= 1;

  return (
    <div className={`app-layout ${showProgress ? 'has-progress' : ''}`}>
      <Header />
      {showProgress && <ProgressBar />}
      <main className={`page-container ${wide ? 'wide' : ''}`}>
        {children}
      </main>
    </div>
  );
}
