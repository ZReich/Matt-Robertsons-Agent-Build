import matcher from "picomatch";

export const HOME_ROUTE = "/dashboards/analytics";

export const isGuestRoute = matcher([
  "/{sign-in,register,forgot-password,verify-email,new-password}",
]);

export const isProtectedRoute = matcher([
  "/dashboards/**",
  "/pages/!({unauthorized-401,not-found-404,coming-soon,maintenance})/**",
]);
