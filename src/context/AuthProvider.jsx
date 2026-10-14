import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../utils/api";
import AuthContext from "./contextStore";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async signIn(path, values) {
      const data = await apiRequest(path, { method: "POST", body: JSON.stringify(values) });
      setUser(data.user);
      return data.user;
    },
    async signOut() {
      await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
