import pm from "picomatch";

export const HOME_ROUTE = "/dashboards/analytics";

export const isGuestRoute = pm(["/sign-in", "/register", "/forgot-password"]);

export const isProtectedRoute = pm(["/dashboards/**", "/pages/account/**"]);
