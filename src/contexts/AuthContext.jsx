import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión al cargar la app
    const session = localStorage.getItem('inst_session');
    const role = localStorage.getItem('inst_role');
    
    if (session === 'true' && role) {
      setIsAuthenticated(true);
      setUserRole(role);
    }
    
    setLoading(false);
  }, []);

  const login = (role) => {
    localStorage.setItem('inst_session', 'true');
    localStorage.setItem('inst_role', role);
    setIsAuthenticated(true);
    setUserRole(role);
  };

  const logout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
