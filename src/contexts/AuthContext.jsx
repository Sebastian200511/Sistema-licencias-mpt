import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión al cargar la app
    const session = localStorage.getItem('inst_session');
    const role = localStorage.getItem('inst_role');
    const id = localStorage.getItem('inst_id');
    
    if (session === 'true' && role) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthenticated(true);
      setUserRole(role);
      setUserId(id);
    }
    
    setLoading(false);
  }, []);

  const login = (role, id) => {
    localStorage.setItem('inst_session', 'true');
    localStorage.setItem('inst_role', role);
    if (id) localStorage.setItem('inst_id', id);
    setIsAuthenticated(true);
    setUserRole(role);
    setUserId(id);
  };

  const logout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, userId, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
