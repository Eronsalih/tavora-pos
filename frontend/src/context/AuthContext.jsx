import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearAuthentication,
  getCurrentUser,
  getStoredToken,
  getStoredUser,
  getSubscription,
  saveAuthentication,
} from "../services/authService";


const AuthContext = createContext(null);


export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState("");


  const refreshSubscription = useCallback(
    async (userOverride = null) => {
      const activeUser = userOverride || getStoredUser();
      const token = getStoredToken();

      if (!token || !activeUser) {
        setSubscription(null);
        setSubscriptionError("");
        setSubscriptionLoading(false);
        return null;
      }

      if (activeUser.role === "superadmin") {
        const platformSubscription = {
          status: "active",
          plan: "platform-owner",
          expires_at: null,
        };

        setSubscription(platformSubscription);
        setSubscriptionError("");
        setSubscriptionLoading(false);
        return platformSubscription;
      }

      setSubscriptionLoading(true);
      setSubscriptionError("");

      try {
        const currentSubscription = await getSubscription();
        setSubscription(currentSubscription);
        return currentSubscription;
      } catch (error) {
        if (error.response?.status === 401) {
          clearAuthentication();
          setUser(null);
          setSubscription(null);
          return null;
        }

        setSubscription(null);

        const detail = error.response?.data?.detail;

        setSubscriptionError(
          typeof detail === "string"
            ? detail
            : "Subscription could not be verified.",
        );

        return null;
      } finally {
        setSubscriptionLoading(false);
      }
    },
    [],
  );


  const validateAuthentication = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setUser(null);
      setSubscription(null);
      setLoading(false);
      setSubscriptionLoading(false);
      return;
    }

    setLoading(true);

    try {
      const currentUser = await getCurrentUser();

      localStorage.setItem(
        "tavora_user",
        JSON.stringify(currentUser),
      );

      if (currentUser.business_id) {
        localStorage.setItem(
          "tavora_business_id",
          currentUser.business_id,
        );
      }

      setUser(currentUser);
      await refreshSubscription(currentUser);
    } catch (error) {
      console.error("Authentication validation failed:", error);

      clearAuthentication();
      setUser(null);
      setSubscription(null);
      setSubscriptionError("");
      setSubscriptionLoading(false);
    } finally {
      setLoading(false);
    }
  }, [refreshSubscription]);


  useEffect(() => {
    validateAuthentication();
  }, [validateAuthentication]);


  const login = useCallback(
    async (authenticationData) => {
      saveAuthentication(authenticationData);
      setUser(authenticationData.user);
      setSubscription(null);
      setSubscriptionError("");
      setSubscriptionLoading(true);

      return refreshSubscription(authenticationData.user);
    },
    [refreshSubscription],
  );


  const logout = useCallback(() => {
    // Business ID remains on the device so employee PIN login still works.
    clearAuthentication();
    setUser(null);
    setSubscription(null);
    setSubscriptionError("");
    setSubscriptionLoading(false);
  }, []);


  const isSubscriptionActive = useMemo(() => {
    if (user?.role === "superadmin") {
      return true;
    }

    if (subscription?.status !== "active") {
      return false;
    }

    if (!subscription.expires_at) {
      return true;
    }

    const expirationTime = new Date(
      subscription.expires_at,
    ).getTime();

    return (
      !Number.isNaN(expirationTime) &&
      expirationTime > Date.now()
    );
  }, [subscription, user]);


  const value = useMemo(
    () => ({
      user,
      loading,
      subscription,
      subscriptionLoading,
      subscriptionError,
      isAuthenticated: Boolean(user),
      isSubscriptionActive,
      login,
      logout,
      refreshUser: validateAuthentication,
      refreshSubscription,
    }),
    [
      user,
      loading,
      subscription,
      subscriptionLoading,
      subscriptionError,
      isSubscriptionActive,
      login,
      logout,
      validateAuthentication,
      refreshSubscription,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}
